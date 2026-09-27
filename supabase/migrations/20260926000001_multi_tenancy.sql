-- ==============================================================================
-- 20260926000001: Multi-tenancy — workspaces, membership, new columns, backfill
--
-- Applies on top of 20260919000001..06 on a database that may already contain
-- data (and may have had the old loose scripts such as fixes.sql applied).
--
--   * organizations / organization_members / invitations / contact_requests / ai_usage
--   * new columns on profiles, tasks, deals, pipeline_stages
--   * tenancy helper functions (current_org_id, is_org_member, org_role, has_org_role, ...)
--   * backfill: ONE workspace that owns all pre-existing data, every existing user
--     becomes a member with their legacy user_roles role
--   * organization_id on every business table (default public.current_org_id()),
--     NOT NULL + indexed
--   * user FKs on shared records become nullable + ON DELETE SET NULL
--
-- Functions/triggers are in ..._000002, RLS + grants in ..._000003.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. New tables
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    monthly_quota NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'ETB',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organizations_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT organizations_quota_nonnegative CHECK (monthly_quota >= 0),
    CONSTRAINT organizations_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS public.organization_members (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'rep'::public.app_role,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_role ON public.organization_members(organization_id, role);

CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'rep'::public.app_role,
    token TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT invitations_email_format CHECK (char_length(email) <= 320 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT invitations_token_length CHECK (char_length(token) >= 32)
);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.invitations(organization_id, created_at DESC);
-- At most one pending invitation per email per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_pending_email
    ON public.invitations(organization_id, lower(email)) WHERE accepted_at IS NULL;

-- Marketing "Contact us" form (anon INSERT only; read via the dashboard / service role).
CREATE TABLE IF NOT EXISTS public.contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contact_requests_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT contact_requests_email_format CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT contact_requests_company_length CHECK (company IS NULL OR char_length(company) <= 120),
    CONSTRAINT contact_requests_message_length CHECK (char_length(btrim(message)) BETWEEN 1 AND 5000)
);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON public.contact_requests(created_at DESC);

-- AI request log used by the ai-chat edge function for per-user rate limiting.
-- Only the service role touches this table.
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    model TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. New columns on existing tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS current_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB,
    ADD COLUMN IF NOT EXISTS job_title TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT,
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- fixes.sql (if it was ever applied) created notification_preferences with other keys;
-- map them onto the contract keys and normalise the default to '{}'.
UPDATE public.profiles
SET notification_preferences =
    CASE
        WHEN notification_preferences IS NULL OR jsonb_typeof(notification_preferences) <> 'object' THEN '{}'::jsonb
        ELSE notification_preferences
            || CASE WHEN notification_preferences ? 'stage_changes' AND NOT notification_preferences ? 'deal_stage_changes'
                    THEN jsonb_build_object('deal_stage_changes', notification_preferences->'stage_changes') ELSE '{}'::jsonb END
    END;
ALTER TABLE public.profiles ALTER COLUMN notification_preferences SET DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN notification_preferences SET NOT NULL;

-- Existing users have already been using the app: don't send them through onboarding again.
UPDATE public.profiles SET onboarding_completed_at = NOW() WHERE onboarding_completed_at IS NULL;

DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR char_length(full_name) <= 200) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_job_title_length CHECK (job_title IS NULL OR char_length(job_title) <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_timezone_length CHECK (timezone IS NULL OR char_length(timezone) <= 64);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.tasks SET assigned_to = user_id WHERE assigned_to IS NULL;
ALTER TABLE public.tasks ALTER COLUMN assigned_to SET DEFAULT auth.uid();

ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS lost_reason TEXT,
    ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

ALTER TABLE public.pipeline_stages
    ADD COLUMN IF NOT EXISTS is_won BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS probability INTEGER;

UPDATE public.pipeline_stages SET is_won = TRUE
WHERE lower(btrim(name)) IN ('won', 'closed won') AND NOT is_won;
UPDATE public.pipeline_stages SET is_lost = TRUE
WHERE lower(btrim(name)) IN ('lost', 'closed lost') AND NOT is_lost;
UPDATE public.pipeline_stages SET probability = 100 WHERE is_won AND probability IS NULL;
UPDATE public.pipeline_stages SET probability = 0 WHERE is_lost AND probability IS NULL;

DO $$ BEGIN
    ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_won_xor_lost CHECK (NOT (is_won AND is_lost));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_probability_range CHECK (probability IS NULL OR probability BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Best-effort close timestamps for deals that already sit in a won/lost stage:
-- the time of the audit-logged move into that stage, else the last update.
UPDATE public.deals d
SET won_at = COALESCE(
        (SELECT max(a.created_at) FROM public.deal_audit_log a
          WHERE a.deal_id = d.id AND a.field = 'stage_id' AND a.new_value = d.stage_id::text),
        d.updated_at)
FROM public.pipeline_stages s
WHERE s.id = d.stage_id AND s.is_won AND d.won_at IS NULL;

UPDATE public.deals d
SET lost_at = COALESCE(
        (SELECT max(a.created_at) FROM public.deal_audit_log a
          WHERE a.deal_id = d.id AND a.field = 'stage_id' AND a.new_value = d.stage_id::text),
        d.updated_at)
FROM public.pipeline_stages s
WHERE s.id = d.stage_id AND s.is_lost AND d.lost_at IS NULL;

-- ------------------------------------------------------------------------------
-- 3. Tenancy helper functions
--    SECURITY DEFINER so they can read membership without tripping RLS recursion.
-- ------------------------------------------------------------------------------

-- Internal: the workspace a given user is working in (their chosen workspace if they
-- are still a member of it, else their oldest membership). Not granted to clients.
CREATE OR REPLACE FUNCTION public.user_current_org_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT p.current_organization_id
           FROM public.profiles p
           JOIN public.organization_members m
             ON m.organization_id = p.current_organization_id AND m.user_id = p.user_id
          WHERE p.user_id = p_user_id),
        (SELECT m.organization_id
           FROM public.organization_members m
          WHERE m.user_id = p_user_id
          ORDER BY m.joined_at, m.organization_id
          LIMIT 1)
    );
$$;

-- The caller's current workspace. Only ever returns an organization the caller is a member of.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.user_current_org_id(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.organization_id = p_org_id AND m.user_id = auth.uid()
    );
$$;

-- The caller's role in the given workspace (NULL when not a member).
CREATE OR REPLACE FUNCTION public.org_role(p_org_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT m.role FROM public.organization_members m
    WHERE m.organization_id = p_org_id AND m.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id UUID, p_roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(public.org_role(p_org_id) = ANY (p_roles), FALSE);
$$;

-- The caller's role in their current workspace.
CREATE OR REPLACE FUNCTION public.current_org_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.org_role(public.current_org_id());
$$;

-- TRUE when the caller and p_user_id are members of at least one common workspace.
CREATE OR REPLACE FUNCTION public.shares_org_with(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members me
        JOIN public.organization_members them ON them.organization_id = me.organization_id
        WHERE me.user_id = auth.uid() AND them.user_id = p_user_id
    );
$$;

-- Legacy helper kept for backwards compatibility: now means
-- "_user_id has _role in their current workspace". user_roles is no longer consulted.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.user_id = _user_id
          AND m.role = _role
          AND m.organization_id = public.user_current_org_id(_user_id)
    );
$$;

-- ------------------------------------------------------------------------------
-- 4. Backfill: one workspace for all existing data
-- ------------------------------------------------------------------------------
ALTER TABLE public.pipelines        ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.pipeline_stages  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.companies        ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.contacts         ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.deals            ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.deal_audit_log   ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.activities       ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.tasks            ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.email_templates  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.notifications    ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.feedback         ADD COLUMN IF NOT EXISTS organization_id UUID;

DO $$
DECLARE
    v_tables TEXT[] := ARRAY['pipelines', 'pipeline_stages', 'companies', 'contacts', 'deals',
                             'deal_audit_log', 'activities', 'tasks', 'email_templates',
                             'notifications', 'feedback'];
    v_tbl TEXT;
    v_needs_org BOOLEAN := FALSE;
    v_found BOOLEAN;
    v_org UUID;
    v_admin UUID;
    v_name TEXT;
BEGIN
    -- Every auth user gets a profile (older scripts could leave users without one).
    INSERT INTO public.profiles (user_id, full_name)
    SELECT u.id,
           left(COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(u.email, ''), '@', 1)), 200)
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

    -- Is there anything that needs a home?
    IF EXISTS (SELECT 1 FROM auth.users u
               WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = u.id)) THEN
        v_needs_org := TRUE;
    END IF;
    FOREACH v_tbl IN ARRAY v_tables LOOP
        EXIT WHEN v_needs_org;
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE organization_id IS NULL)', v_tbl) INTO v_found;
        v_needs_org := v_found;
    END LOOP;

    IF NOT v_needs_org THEN
        RETURN;
    END IF;

    -- Reuse the oldest workspace if one already exists (re-run safety), else create one.
    SELECT o.id INTO v_org FROM public.organizations o ORDER BY o.created_at LIMIT 1;

    IF v_org IS NULL THEN
        -- The earliest legacy admin names the workspace (profile.company), else the earliest user.
        SELECT ur.user_id INTO v_admin
        FROM public.user_roles ur
        JOIN auth.users u ON u.id = ur.user_id
        WHERE ur.role = 'admin'::public.app_role
        ORDER BY ur.created_at, u.created_at
        LIMIT 1;

        IF v_admin IS NULL THEN
            SELECT u.id INTO v_admin FROM auth.users u ORDER BY u.created_at LIMIT 1;
        END IF;

        SELECT left(NULLIF(btrim(p.company), ''), 100) INTO v_name
        FROM public.profiles p WHERE p.user_id = v_admin;

        INSERT INTO public.organizations (name, created_by)
        VALUES (COALESCE(v_name, 'My workspace'), v_admin)
        RETURNING id INTO v_org;
    END IF;

    -- Every existing user joins with their highest legacy role (enum order: admin < manager < rep).
    INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
    SELECT v_org,
           u.id,
           COALESCE((SELECT min(ur.role) FROM public.user_roles ur WHERE ur.user_id = u.id), 'rep'::public.app_role),
           u.created_at
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = u.id)
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- A workspace must always have an admin.
    IF NOT EXISTS (SELECT 1 FROM public.organization_members m
                   WHERE m.organization_id = v_org AND m.role = 'admin'::public.app_role) THEN
        UPDATE public.organization_members m
        SET role = 'admin'::public.app_role
        WHERE m.organization_id = v_org
          AND m.user_id = (SELECT m2.user_id FROM public.organization_members m2
                           WHERE m2.organization_id = v_org ORDER BY m2.joined_at LIMIT 1);
    END IF;

    UPDATE public.profiles p
    SET current_organization_id = public.user_current_org_id(p.user_id)
    WHERE p.current_organization_id IS NULL;

    FOREACH v_tbl IN ARRAY v_tables LOOP
        EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', v_tbl) USING v_org;
    END LOOP;

    -- The old signup trigger seeded one identical "Sales Pipeline" per user. Now that they share
    -- a workspace, drop the unused duplicates (no deals) but keep the oldest pipeline.
    DELETE FROM public.pipelines p
    WHERE p.organization_id = v_org
      AND p.name = 'Sales Pipeline'
      AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.pipeline_id = p.id)
      AND p.id <> (SELECT p2.id FROM public.pipelines p2 WHERE p2.organization_id = v_org
                   ORDER BY (SELECT count(*) FROM public.deals d2 WHERE d2.pipeline_id = p2.id) DESC,
                            p2.created_at
                   LIMIT 1);
END $$;

-- ------------------------------------------------------------------------------
-- 5. organization_id: default, NOT NULL, FK, index
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_tbl TEXT;
BEGIN
    FOREACH v_tbl IN ARRAY ARRAY['pipelines', 'pipeline_stages', 'companies', 'contacts', 'deals',
                                 'deal_audit_log', 'activities', 'tasks', 'email_templates',
                                 'notifications', 'feedback']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.current_org_id()', v_tbl);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', v_tbl);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conrelid = format('public.%I', v_tbl)::regclass
                         AND conname = v_tbl || '_organization_id_fkey') THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE',
                           v_tbl, v_tbl || '_organization_id_fkey');
        END IF;
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)', 'idx_' || v_tbl || '_org', v_tbl);
    END LOOP;
END $$;

ALTER TABLE public.invitations ALTER COLUMN organization_id SET DEFAULT public.current_org_id();

-- Workspace-scoped composite indexes for the common list queries.
CREATE INDEX IF NOT EXISTS idx_deals_org_created ON public.deals(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_org_stage ON public.deals(organization_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON public.contacts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_org_created ON public.companies(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON public.activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON public.tasks(organization_id, completed, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org_pipeline ON public.pipeline_stages(organization_id, pipeline_id, position);
CREATE INDEX IF NOT EXISTS idx_feedback_org_created ON public.feedback(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON public.notifications(organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_user ON public.email_templates(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON public.deals(created_by);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_by ON public.pipelines(created_by);
CREATE INDEX IF NOT EXISTS idx_deal_audit_log_user ON public.deal_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin ON public.contacts USING gin (tags);
-- (activities(contact_id, created_at DESC) already exists as idx_activities_contact_id.)

-- ------------------------------------------------------------------------------
-- 6. User FKs on shared records: nullable + ON DELETE SET NULL (+ default auth.uid())
--    so a departing user's records stay with the workspace.
--    Existing constraint names are looked up dynamically (loose scripts may have renamed them).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    c RECORD;
    v_attnum SMALLINT;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('pipelines', 'created_by'),
            ('companies', 'created_by'),
            ('contacts', 'created_by'),
            ('deals', 'owner_id'),
            ('deals', 'created_by'),
            ('deal_audit_log', 'user_id'),
            ('activities', 'user_id'),
            ('tasks', 'user_id')
        ) AS t(tbl, col)
    LOOP
        SELECT a.attnum INTO v_attnum FROM pg_attribute a
        WHERE a.attrelid = format('public.%I', r.tbl)::regclass AND a.attname = r.col;

        FOR c IN
            SELECT con.conname FROM pg_constraint con
            WHERE con.conrelid = format('public.%I', r.tbl)::regclass
              AND con.contype = 'f'
              AND con.conkey = ARRAY[v_attnum]
        LOOP
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, c.conname);
        END LOOP;

        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.tbl, r.col);
        -- Orphaned references (possible after manual scripts) would block the new FK.
        EXECUTE format('UPDATE public.%I t SET %I = NULL WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I)',
                       r.tbl, r.col, r.col, r.col);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
                       r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT auth.uid()', r.tbl, r.col);
    END LOOP;
END $$;

-- Personal rows default to the caller as well.
ALTER TABLE public.email_templates ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.feedback ALTER COLUMN user_id SET DEFAULT auth.uid();

-- deals.stage_id was ON DELETE RESTRICT, which is checked immediately and makes a cascading
-- workspace delete fail depending on row order. NO ACTION (checked at statement end) still
-- blocks deleting a stage that has deals, but lets a whole workspace be deleted.
DO $$
DECLARE
    c RECORD;
    v_attnum SMALLINT;
BEGIN
    SELECT a.attnum INTO v_attnum FROM pg_attribute a
    WHERE a.attrelid = 'public.deals'::regclass AND a.attname = 'stage_id';
    FOR c IN
        SELECT con.conname FROM pg_constraint con
        WHERE con.conrelid = 'public.deals'::regclass AND con.contype = 'f' AND con.conkey = ARRAY[v_attnum]
    LOOP
        EXECUTE format('ALTER TABLE public.deals DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE public.deals ADD CONSTRAINT deals_stage_id_fkey
        FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id) ON DELETE NO ACTION;
END $$;

-- updated_at on organizations
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
