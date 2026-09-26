-- ==============================================================================
-- 20260927000001: Plans & limits, role-based visibility, platform owner console
--
-- Applies on top of 20260926000001..3.
--
--   1. Plans: organizations.plan / status, plan_limits(), server-side enforcement of
--      seats (invitations), pipelines, contacts and monthly AI requests; usage + plan RPCs.
--   2. Suspended workspaces: current_org_id() never returns one (RLS denies everything),
--      get_my_context() reports the suspension instead of creating a new workspace.
--   3. RBAC: reps see the deals they own or created, the tasks they created or are assigned,
--      their own activities plus activities on deals they can see; reps can't assign a deal to
--      someone else; managers invite reps only. SECURITY DEFINER analytics/search follow suit.
--      The deal audit log is readable only on the Enterprise plan.
--   4. Platform owner console: platform_admins + platform_* RPCs (counts / metadata only).
--   5. Function privileges re-applied (everything revoked, then granted explicitly).
--
-- Errors follow the round-1 convention: 42501 'Not authenticated', everything else P0001 with a
-- message the UI may show verbatim.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Plans
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_check
        CHECK (plan IN ('starter', 'growth', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_status_check
        CHECK (status IN ('active', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Monthly AI usage is counted per workspace. Requests whose upstream call failed are marked
-- failed by the ai-chat function: they still count toward the per-user minute/day guards but not
-- toward the plan's monthly allowance or usage statistics.
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS failed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_created ON public.ai_usage(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_org_owner ON public.deals(organization_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_user ON public.tasks(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_user ON public.activities(organization_id, user_id);
-- Stage-history analytics read every stage_id change of a workspace.
CREATE INDEX IF NOT EXISTS idx_deal_audit_log_org_field_created ON public.deal_audit_log(organization_id, field, created_at);

-- Plan catalog. MUST match src/lib/plans.ts. JSON null = unlimited.
CREATE OR REPLACE FUNCTION public.plan_limits(p_plan TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE lower(btrim(COALESCE(p_plan, '')))
        WHEN 'enterprise' THEN jsonb_build_object(
            'plan', 'enterprise', 'name', 'Enterprise',
            'seats', NULL, 'pipelines', NULL, 'contacts', NULL, 'ai_requests_per_month', 2000,
            'features', jsonb_build_array('forecast', 'advanced_reports', 'csv_import', 'csv_export',
                                          'audit_history', 'workspace_backup', 'priority_support'))
        WHEN 'growth' THEN jsonb_build_object(
            'plan', 'growth', 'name', 'Growth',
            'seats', 15, 'pipelines', 5, 'contacts', 25000, 'ai_requests_per_month', 500,
            'features', jsonb_build_array('forecast', 'advanced_reports', 'csv_import', 'csv_export'))
        ELSE jsonb_build_object(
            'plan', 'starter', 'name', 'Starter',
            'seats', 3, 'pipelines', 1, 'contacts', 1000, 'ai_requests_per_month', 50,
            'features', jsonb_build_array())
    END;
$$;

-- Internal: one limit as an integer (NULL = unlimited).
CREATE OR REPLACE FUNCTION public._plan_limit(p_plan TEXT, p_key TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT (public.plan_limits(p_plan)->>p_key)::INT;
$$;

-- Internal: "1,000"
CREATE OR REPLACE FUNCTION public._fmt_int(p_value BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.to_char(p_value, 'FM999,999,999,990');
$$;

-- Internal: current usage of the plan-limited resources of a workspace.
CREATE OR REPLACE FUNCTION public._workspace_usage(p_org_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH u AS (
        SELECT
            (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = p_org_id) AS members,
            (SELECT count(*) FROM public.invitations i
              WHERE i.organization_id = p_org_id AND i.accepted_at IS NULL AND i.expires_at > NOW()) AS pending_invites,
            (SELECT count(*) FROM public.pipelines p WHERE p.organization_id = p_org_id) AS pipelines,
            (SELECT count(*) FROM public.contacts c WHERE c.organization_id = p_org_id) AS contacts,
            (SELECT count(*) FROM public.ai_usage a
              WHERE a.organization_id = p_org_id AND NOT a.failed
                AND a.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS ai_requests_this_month
    )
    SELECT jsonb_build_object(
        'members', u.members,
        'pending_invites', u.pending_invites,
        'seats_used', u.members + u.pending_invites,
        'pipelines', u.pipelines,
        'contacts', u.contacts,
        'ai_requests_this_month', u.ai_requests_this_month
    )
    FROM u;
$$;

-- Internal: why p_org_id can't move to p_plan (NULL when it can).
CREATE OR REPLACE FUNCTION public._plan_violation(p_org_id UUID, p_plan TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usage JSONB := public._workspace_usage(p_org_id);
    v_name TEXT := public.plan_limits(p_plan)->>'name';
    v_limit INT;
    v_used BIGINT;
BEGIN
    v_limit := public._plan_limit(p_plan, 'seats');
    v_used := (v_usage->>'seats_used')::BIGINT;
    IF v_limit IS NOT NULL AND v_used > v_limit THEN
        RETURN format('Your workspace uses %s seats (members and pending invitations), but the %s plan includes %s. Remove members or revoke invitations first.',
                      public._fmt_int(v_used), v_name, public._fmt_int(v_limit));
    END IF;

    v_limit := public._plan_limit(p_plan, 'pipelines');
    v_used := (v_usage->>'pipelines')::BIGINT;
    IF v_limit IS NOT NULL AND v_used > v_limit THEN
        RETURN format('Your workspace has %s pipelines, but the %s plan includes %s. Delete pipelines first.',
                      public._fmt_int(v_used), v_name, public._fmt_int(v_limit));
    END IF;

    v_limit := public._plan_limit(p_plan, 'contacts');
    v_used := (v_usage->>'contacts')::BIGINT;
    IF v_limit IS NOT NULL AND v_used > v_limit THEN
        RETURN format('Your workspace has %s contacts, but the %s plan includes %s. Delete contacts first.',
                      public._fmt_int(v_used), v_name, public._fmt_int(v_limit));
    END IF;

    RETURN NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Tenancy helpers: suspended workspaces are never "current"
-- ------------------------------------------------------------------------------
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
           JOIN public.organizations o ON o.id = m.organization_id
          WHERE p.user_id = p_user_id AND o.status = 'active'),
        (SELECT m.organization_id
           FROM public.organization_members m
           JOIN public.organizations o ON o.id = m.organization_id
          WHERE m.user_id = p_user_id AND o.status = 'active'
          ORDER BY m.joined_at, m.organization_id
          LIMIT 1)
    );
$$;

-- The current workspace's plan (used by RLS).
CREATE OR REPLACE FUNCTION public.current_org_plan()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT o.plan FROM public.organizations o WHERE o.id = public.current_org_id();
$$;

-- ------------------------------------------------------------------------------
-- 3. Platform admins (SaaS operator). Rows are added in the SQL editor only.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- No policies: clients can't read or write it (is_platform_admin() is the only interface).
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_admins TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid());
$$;

-- ------------------------------------------------------------------------------
-- 4. Limit enforcement triggers
-- ------------------------------------------------------------------------------

-- Pipelines: at most plan.pipelines per workspace.
CREATE OR REPLACE FUNCTION public.enforce_pipeline_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_plan TEXT;
    v_limit INT;
    v_count BIGINT;
BEGIN
    IF NEW.organization_id IS NULL THEN
        RETURN NEW; -- NOT NULL constraint reports it
    END IF;
    SELECT o.plan INTO v_plan FROM public.organizations o WHERE o.id = NEW.organization_id;
    v_limit := public._plan_limit(v_plan, 'pipelines');
    IF v_limit IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_pipeline_limit:' || NEW.organization_id::text, 0));
    SELECT count(*) INTO v_count FROM public.pipelines p WHERE p.organization_id = NEW.organization_id;
    IF v_count >= v_limit THEN
        RAISE EXCEPTION 'Your % plan includes % %. Upgrade to add more.',
            public.plan_limits(v_plan)->>'name', public._fmt_int(v_limit),
            CASE WHEN v_limit = 1 THEN 'pipeline' ELSE 'pipelines' END
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipelines_plan_limit ON public.pipelines;
CREATE TRIGGER trg_pipelines_plan_limit
    BEFORE INSERT ON public.pipelines
    FOR EACH ROW EXECUTE FUNCTION public.enforce_pipeline_limit();

-- Contacts: at most plan.contacts per workspace. Checked once per INSERT statement (after the
-- rows are in, using the transition table) so bulk CSV imports don't recount per row; a
-- statement that would cross the limit is rejected as a whole.
CREATE OR REPLACE FUNCTION public.enforce_contact_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    r RECORD;
    v_plan TEXT;
    v_limit INT;
    v_count BIGINT;
BEGIN
    FOR r IN SELECT DISTINCT n.organization_id AS org FROM new_contacts n WHERE n.organization_id IS NOT NULL LOOP
        SELECT o.plan INTO v_plan FROM public.organizations o WHERE o.id = r.org;
        v_limit := public._plan_limit(v_plan, 'contacts');
        CONTINUE WHEN v_limit IS NULL;

        PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_contact_limit:' || r.org::text, 0));
        SELECT count(*) INTO v_count FROM public.contacts c WHERE c.organization_id = r.org;
        IF v_count > v_limit THEN
            RAISE EXCEPTION 'Your % plan includes % contacts. Upgrade to add more.',
                public.plan_limits(v_plan)->>'name', public._fmt_int(v_limit)
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_plan_limit ON public.contacts;
CREATE TRIGGER trg_contacts_plan_limit
    AFTER INSERT ON public.contacts
    REFERENCING NEW TABLE AS new_contacts
    FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_contact_limit();

-- Deals: reps can't make someone else the owner (NULL or themselves only).
-- Runs after trg_00_same_org (triggers fire in name order).
CREATE OR REPLACE FUNCTION public.guard_deal_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    -- Service role / SQL editor / FK actions are not client edits.
    IF v_uid IS NULL OR pg_catalog.pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    IF NEW.owner_id IS NULL OR NEW.owner_id = v_uid THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id THEN
        RETURN NEW;
    END IF;
    IF public.org_role(NEW.organization_id) IN ('admin'::public.app_role, 'manager'::public.app_role) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only admins and managers can assign deals to someone else.' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_01_deal_owner_guard ON public.deals;
CREATE TRIGGER trg_01_deal_owner_guard
    BEFORE INSERT OR UPDATE OF owner_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.guard_deal_owner();

-- ------------------------------------------------------------------------------
-- 5. Invitations: seat limits, managers invite reps only, suspended workspaces
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._accept_invitation(p_user_id UUID, p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv RECORD;
    v_user RECORD;
    v_org RECORD;
    v_limit INT;
    v_members BIGINT;
BEGIN
    SELECT i.* INTO v_inv FROM public.invitations i WHERE i.token = btrim(COALESCE(p_token, '')) FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'This invitation link is invalid.' USING ERRCODE = 'P0001';
    END IF;

    IF v_inv.accepted_at IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.organization_members m
                   WHERE m.organization_id = v_inv.organization_id AND m.user_id = p_user_id) THEN
            UPDATE public.profiles SET current_organization_id = v_inv.organization_id WHERE user_id = p_user_id;
            RETURN v_inv.organization_id;
        END IF;
        RAISE EXCEPTION 'This invitation has already been used.' USING ERRCODE = 'P0001';
    END IF;

    IF v_inv.expires_at < NOW() THEN
        RAISE EXCEPTION 'This invitation has expired. Ask your workspace admin for a new one.' USING ERRCODE = 'P0001';
    END IF;

    SELECT u.email, u.email_confirmed_at INTO v_user FROM auth.users u WHERE u.id = p_user_id;
    IF v_user.email IS NULL OR lower(btrim(v_user.email)) <> lower(btrim(v_inv.email)) THEN
        RAISE EXCEPTION 'This invitation was sent to a different email address.' USING ERRCODE = 'P0001';
    END IF;
    IF v_user.email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Confirm your email address before accepting the invitation.' USING ERRCODE = 'P0001';
    END IF;

    -- Lock the workspace row so concurrent acceptances can't overshoot the seat limit.
    SELECT o.plan, o.status INTO v_org FROM public.organizations o WHERE o.id = v_inv.organization_id FOR UPDATE;
    IF v_org.status = 'suspended' THEN
        RAISE EXCEPTION 'This workspace has been suspended. Contact support.' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.organization_members m
                   WHERE m.organization_id = v_inv.organization_id AND m.user_id = p_user_id) THEN
        v_limit := public._plan_limit(v_org.plan, 'seats');
        IF v_limit IS NOT NULL THEN
            SELECT count(*) INTO v_members FROM public.organization_members m
            WHERE m.organization_id = v_inv.organization_id;
            IF v_members >= v_limit THEN
                RAISE EXCEPTION 'This workspace has used all % seats on its % plan. Ask the workspace admin to upgrade.',
                    public._fmt_int(v_limit), public.plan_limits(v_org.plan)->>'name'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_inv.organization_id, p_user_id, v_inv.role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE public.invitations SET accepted_at = NOW() WHERE id = v_inv.id;
    UPDATE public.profiles SET current_organization_id = v_inv.organization_id WHERE user_id = p_user_id;

    RETURN v_inv.organization_id;
END;
$$;

-- Signup: a failing invitation (e.g. no free seats) must not block the account from being created;
-- the invitee can retry from the invite link after sign-in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    v_full_name TEXT;
    v_company TEXT;
    v_token TEXT;
BEGIN
    v_full_name := left(COALESCE(
        NULLIF(btrim(v_meta->>'full_name'), ''),
        NULLIF(btrim(v_meta->>'name'), ''),
        split_part(COALESCE(NEW.email, ''), '@', 1)
    ), 200);
    v_company := left(NULLIF(btrim(v_meta->>'company'), ''), 100);

    INSERT INTO public.profiles (user_id, full_name, company)
    VALUES (NEW.id, v_full_name, v_company)
    ON CONFLICT (user_id) DO NOTHING;

    v_token := NULLIF(btrim(COALESCE(v_meta->>'invite_token', '')), '');
    IF v_token IS NOT NULL AND public._invitation_valid_for(v_token, NEW.email) THEN
        IF NEW.email_confirmed_at IS NOT NULL THEN
            BEGIN
                PERFORM public._accept_invitation(NEW.id, v_token);
            EXCEPTION WHEN OTHERS THEN
                NULL; -- surfaced again when the client calls accept_invitation after sign-in
            END;
        END IF;
        RETURN NEW;
    END IF;

    PERFORM public._create_workspace(NEW.id, public._default_workspace_name(v_full_name, v_company, NEW.email));
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invitation(p_email TEXT, p_role public.app_role)
RETURNS TABLE (id UUID, token TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID;
    v_plan TEXT;
    v_my_role public.app_role;
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_role public.app_role := COALESCE(p_role, 'rep'::public.app_role);
    v_limit INT;
    v_seats BIGINT;
    v_token TEXT;
    v_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    v_org := public.current_org_id();
    v_my_role := public.org_role(v_org);
    IF v_org IS NULL OR v_my_role IS NULL OR v_my_role NOT IN ('admin'::public.app_role, 'manager'::public.app_role) THEN
        RAISE EXCEPTION 'Only admins and managers can invite teammates.' USING ERRCODE = 'P0001';
    END IF;
    IF v_role = 'admin'::public.app_role AND v_my_role <> 'admin'::public.app_role THEN
        RAISE EXCEPTION 'Only admins can invite other admins.' USING ERRCODE = 'P0001';
    END IF;
    IF v_my_role = 'manager'::public.app_role AND v_role <> 'rep'::public.app_role THEN
        RAISE EXCEPTION 'Managers can only invite sales reps.' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(v_email) > 320 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.organization_members m
               JOIN auth.users u ON u.id = m.user_id
               WHERE m.organization_id = v_org AND lower(u.email) = v_email) THEN
        RAISE EXCEPTION 'That person is already a member of this workspace.' USING ERRCODE = 'P0001';
    END IF;

    -- Serialise invitations per workspace (seat counting).
    SELECT o.plan INTO v_plan FROM public.organizations o WHERE o.id = v_org FOR UPDATE;

    IF (SELECT count(*) FROM public.invitations i
        WHERE i.organization_id = v_org AND i.accepted_at IS NULL AND i.expires_at > NOW()) >= 100 THEN
        RAISE EXCEPTION 'Too many pending invitations. Revoke some before inviting more people.' USING ERRCODE = 'P0001';
    END IF;

    -- Seats = members + pending invitations (a re-invite replaces the same person's pending one).
    v_limit := public._plan_limit(v_plan, 'seats');
    IF v_limit IS NOT NULL THEN
        SELECT (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = v_org)
             + (SELECT count(*) FROM public.invitations i
                 WHERE i.organization_id = v_org AND i.accepted_at IS NULL AND i.expires_at > NOW()
                   AND lower(i.email) <> v_email)
          INTO v_seats;
        IF v_seats >= v_limit THEN
            RAISE EXCEPTION 'Your % plan includes % seats (members and pending invitations). Upgrade to invite more teammates.',
                public.plan_limits(v_plan)->>'name', public._fmt_int(v_limit)
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    DELETE FROM public.invitations i
    WHERE i.organization_id = v_org AND lower(i.email) = v_email AND i.accepted_at IS NULL;

    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.invitations (organization_id, email, role, token, invited_by, expires_at)
    VALUES (v_org, v_email, v_role, v_token, v_uid, NOW() + INTERVAL '7 days')
    RETURNING invitations.id INTO v_id;

    RETURN QUERY SELECT v_id, v_token;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. get_my_context: plan, workspace status, platform admin flag (return type changed)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_context();
CREATE FUNCTION public.get_my_context()
RETURNS TABLE (
    organization_id UUID,
    organization_name TEXT,
    monthly_quota NUMERIC,
    currency TEXT,
    role public.app_role,
    plan TEXT,
    workspace_status TEXT,
    is_platform_admin BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID;
    v_user RECORD;
    v_token TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_ctx:' || v_uid::text, 0));

    SELECT u.email, u.raw_user_meta_data INTO v_user FROM auth.users u WHERE u.id = v_uid;

    INSERT INTO public.profiles (user_id, full_name)
    VALUES (v_uid, left(COALESCE(NULLIF(btrim(v_user.raw_user_meta_data->>'full_name'), ''),
                                 split_part(COALESCE(v_user.email, ''), '@', 1)), 200))
    ON CONFLICT (user_id) DO NOTHING;

    -- Only ever an active workspace the caller belongs to.
    v_org := public.current_org_id();

    -- Every workspace the caller belongs to is suspended: report it, don't create a new one.
    IF v_org IS NULL AND EXISTS (
        SELECT 1 FROM public.organization_members m
        JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.user_id = v_uid AND o.status = 'suspended'
    ) THEN
        RAISE EXCEPTION 'This workspace has been suspended. Contact support.' USING ERRCODE = 'P0001';
    END IF;

    IF v_org IS NULL THEN
        v_token := NULLIF(btrim(COALESCE(v_user.raw_user_meta_data->>'invite_token', '')), '');
        IF v_token IS NOT NULL AND public._invitation_valid_for(v_token, v_user.email) THEN
            BEGIN
                v_org := public._accept_invitation(v_uid, v_token);
            EXCEPTION WHEN OTHERS THEN
                v_org := NULL;
            END;
        END IF;
    END IF;

    IF v_org IS NULL THEN
        SELECT public._create_workspace(
                   v_uid,
                   public._default_workspace_name(p.full_name, p.company, v_user.email))
          INTO v_org
          FROM public.profiles p WHERE p.user_id = v_uid;
    END IF;

    UPDATE public.profiles p SET current_organization_id = v_org
    WHERE p.user_id = v_uid AND p.current_organization_id IS DISTINCT FROM v_org;

    RETURN QUERY
    SELECT o.id, o.name, o.monthly_quota, o.currency, m.role, o.plan, o.status, public.is_platform_admin()
    FROM public.organizations o
    JOIN public.organization_members m ON m.organization_id = o.id AND m.user_id = v_uid
    WHERE o.id = v_org;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Plan RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_workspace_usage()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_plan TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'You are not a member of an active workspace.' USING ERRCODE = 'P0001';
    END IF;
    SELECT o.plan INTO v_plan FROM public.organizations o WHERE o.id = v_org;
    RETURN public._workspace_usage(v_org)
        || jsonb_build_object('plan', v_plan, 'limits', public.plan_limits(v_plan));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_plan(p_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_plan TEXT := lower(btrim(COALESCE(p_plan, '')));
    v_problem TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins can change the plan.' USING ERRCODE = 'P0001';
    END IF;
    IF v_plan NOT IN ('starter', 'growth', 'enterprise') THEN
        RAISE EXCEPTION 'Choose a valid plan (starter, growth or enterprise).' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1 FROM public.organizations o WHERE o.id = v_org FOR UPDATE;
    v_problem := public._plan_violation(v_org, v_plan);
    IF v_problem IS NOT NULL THEN
        RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.organizations o SET plan = v_plan WHERE o.id = v_org AND o.plan IS DISTINCT FROM v_plan;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. AI quota (service role only): per-user minute/day guards + per-workspace monthly plan limit.
--    Return type changed -> DROP + CREATE. `reason` is NULL when allowed, else one of
--    'rate_minute' | 'rate_day' | 'monthly_limit' | 'no_workspace'.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_ai_quota(UUID, INT, INT, TEXT);
CREATE FUNCTION public.consume_ai_quota(
    p_user_id UUID,
    p_per_minute INT DEFAULT 20,
    p_per_day INT DEFAULT 300,
    p_model TEXT DEFAULT NULL
)
RETURNS TABLE (
    allowed BOOLEAN,
    retry_after_seconds INT,
    usage_id UUID,
    reason TEXT,
    plan TEXT,
    monthly_limit INT,
    monthly_used INT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    v_minute_count INT;
    v_day_count INT;
    v_oldest TIMESTAMPTZ;
    v_id UUID;
    v_org UUID;
    v_plan TEXT;
    v_limit INT;
    v_month_start TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_next_month TIMESTAMPTZ := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';
    v_month_count INT;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_ai:' || p_user_id::text, 0));

    v_org := public.user_current_org_id(p_user_id);
    SELECT o.plan INTO v_plan FROM public.organizations o WHERE o.id = v_org;
    v_limit := CASE WHEN v_org IS NULL THEN NULL ELSE public._plan_limit(v_plan, 'ai_requests_per_month') END;

    IF v_org IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, NULL::UUID, 'no_workspace'::TEXT, NULL::TEXT, NULL::INT, NULL::INT;
        RETURN;
    END IF;

    -- Keep ~13 months of history (monthly limits + platform statistics).
    DELETE FROM public.ai_usage a WHERE a.user_id = p_user_id AND a.created_at < NOW() - INTERVAL '400 days';

    SELECT count(*) INTO v_minute_count FROM public.ai_usage a
    WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 minute';
    IF v_minute_count >= p_per_minute THEN
        SELECT min(a.created_at) INTO v_oldest FROM public.ai_usage a
        WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 minute';
        RETURN QUERY SELECT FALSE, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + INTERVAL '1 minute' - NOW())))::INT),
                            NULL::UUID, 'rate_minute'::TEXT, v_plan, v_limit, NULL::INT;
        RETURN;
    END IF;

    SELECT count(*) INTO v_day_count FROM public.ai_usage a
    WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 day';
    IF v_day_count >= p_per_day THEN
        SELECT min(a.created_at) INTO v_oldest FROM public.ai_usage a
        WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 day';
        RETURN QUERY SELECT FALSE, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + INTERVAL '1 day' - NOW())))::INT),
                            NULL::UUID, 'rate_day'::TEXT, v_plan, v_limit, NULL::INT;
        RETURN;
    END IF;

    -- Workspace-wide monthly allowance (serialised per workspace).
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_ai_org:' || v_org::text, 0));
    SELECT count(*) INTO v_month_count FROM public.ai_usage a
    WHERE a.organization_id = v_org AND a.created_at >= v_month_start AND NOT a.failed;
    IF v_limit IS NOT NULL AND v_month_count >= v_limit THEN
        RETURN QUERY SELECT FALSE, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_next_month - NOW())))::INT),
                            NULL::UUID, 'monthly_limit'::TEXT, v_plan, v_limit, v_month_count;
        RETURN;
    END IF;

    INSERT INTO public.ai_usage (user_id, organization_id, model)
    VALUES (p_user_id, v_org, p_model)
    RETURNING id INTO v_id;

    RETURN QUERY SELECT TRUE, 0, v_id, NULL::TEXT, v_plan, v_limit, v_month_count + 1;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RBAC: row visibility
--    admin / manager: every row of the workspace.
--    rep: deals they own or created; tasks they created or are assigned; their own activities
--         and activities on deals they can see; audit rows of deals they can see.
--    Contacts and companies stay shared (unchanged).
--    The role/uid lookups are wrapped in scalar subqueries (evaluated once per statement).
-- ------------------------------------------------------------------------------

-- Deals
DROP POLICY IF EXISTS "Members can view deals" ON public.deals;
DROP POLICY IF EXISTS "Members can view accessible deals" ON public.deals;
CREATE POLICY "Members can view accessible deals" ON public.deals
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR owner_id = (SELECT auth.uid())
             OR created_by = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "Members can update deals" ON public.deals;
DROP POLICY IF EXISTS "Members can update accessible deals" ON public.deals;
CREATE POLICY "Members can update accessible deals" ON public.deals
    FOR UPDATE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR owner_id = (SELECT auth.uid())
             OR created_by = (SELECT auth.uid()))
    )
    WITH CHECK (organization_id = (SELECT public.current_org_id()));
-- INSERT ("Members can create deals": created_by = caller) and DELETE (owner/creator or
-- admin/manager) are unchanged. Owner reassignment by reps is blocked by trg_01_deal_owner_guard.

-- Tasks
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can view accessible tasks" ON public.tasks;
CREATE POLICY "Members can view accessible tasks" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR user_id = (SELECT auth.uid())
             OR assigned_to = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can update accessible tasks" ON public.tasks;
CREATE POLICY "Members can update accessible tasks" ON public.tasks
    FOR UPDATE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR user_id = (SELECT auth.uid())
             OR assigned_to = (SELECT auth.uid()))
    )
    WITH CHECK (organization_id = (SELECT public.current_org_id()));

-- Activities
DROP POLICY IF EXISTS "Members can view activities" ON public.activities;
DROP POLICY IF EXISTS "Members can view accessible activities" ON public.activities;
CREATE POLICY "Members can view accessible activities" ON public.activities
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR user_id = (SELECT auth.uid())
             OR (deal_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.deals d
                    WHERE d.id = activities.deal_id
                      AND (d.owner_id = (SELECT auth.uid()) OR d.created_by = (SELECT auth.uid())))))
    );

DROP POLICY IF EXISTS "Members can update activities" ON public.activities;
DROP POLICY IF EXISTS "Members can update accessible activities" ON public.activities;
CREATE POLICY "Members can update accessible activities" ON public.activities
    FOR UPDATE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR user_id = (SELECT auth.uid())
             OR (deal_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.deals d
                    WHERE d.id = activities.deal_id
                      AND (d.owner_id = (SELECT auth.uid()) OR d.created_by = (SELECT auth.uid())))))
    )
    WITH CHECK (organization_id = (SELECT public.current_org_id()));

-- Deal audit log: Enterprise plan only, and only for deals the caller can see.
DROP POLICY IF EXISTS "Members can view the deal audit log" ON public.deal_audit_log;
DROP POLICY IF EXISTS "Members can view the audit log of accessible deals" ON public.deal_audit_log;
CREATE POLICY "Members can view the audit log of accessible deals" ON public.deal_audit_log
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (SELECT public.current_org_plan()) = 'enterprise'
        AND ((SELECT public.current_org_role()) IN ('admin', 'manager')
             OR EXISTS (SELECT 1 FROM public.deals d
                        WHERE d.id = deal_audit_log.deal_id
                          AND (d.owner_id = (SELECT auth.uid()) OR d.created_by = (SELECT auth.uid()))))
    );

-- ------------------------------------------------------------------------------
-- 10. SECURITY DEFINER read RPCs apply the same visibility
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID := public.current_org_id();
    v_all BOOLEAN;
    v_since TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    v_all := public.org_role(v_org) IN ('admin'::public.app_role, 'manager'::public.app_role);
    v_since := NOW() - make_interval(days => LEAST(GREATEST(COALESCE(p_period_days, 30), 1), 3650));

    WITH filtered_deals AS (
        SELECT d.id, COALESCE(d.value, 0) AS value, d.stage_id, s.is_won, s.is_lost
        FROM public.deals d
        JOIN public.pipeline_stages s ON s.id = d.stage_id
        WHERE d.organization_id = v_org AND d.created_at >= v_since
          AND (v_all OR d.owner_id = v_uid OR d.created_by = v_uid)
    ),
    summary AS (
        SELECT
            COUNT(*)::INT AS total_deals,
            COALESCE(SUM(value), 0)::NUMERIC(14,2) AS total_value,
            COUNT(*) FILTER (WHERE is_won)::INT AS won_deals,
            COALESCE(SUM(value) FILTER (WHERE is_won), 0)::NUMERIC(14,2) AS won_value,
            COUNT(*) FILTER (WHERE is_lost)::INT AS lost_deals,
            COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost)::INT AS open_deals,
            COALESCE(SUM(value) FILTER (WHERE NOT is_won AND NOT is_lost), 0)::NUMERIC(14,2) AS open_value,
            COUNT(*) FILTER (WHERE is_won OR is_lost)::INT AS closed_deals
        FROM filtered_deals
    ),
    stage_breakdown AS (
        SELECT s.id, s.pipeline_id, s.name, s.color, s.position, s.is_won, s.is_lost,
               COUNT(d.id)::INT AS count,
               COALESCE(SUM(d.value), 0)::NUMERIC(14,2) AS value
        FROM public.pipeline_stages s
        LEFT JOIN filtered_deals d ON d.stage_id = s.id
        WHERE s.organization_id = v_org
        GROUP BY s.id, s.pipeline_id, s.name, s.color, s.position, s.is_won, s.is_lost
    )
    SELECT jsonb_build_object(
        'period_days', LEAST(GREATEST(COALESCE(p_period_days, 30), 1), 3650),
        'scope', CASE WHEN v_all THEN 'workspace' ELSE 'own' END,
        'total_deals', sm.total_deals,
        'total_value', sm.total_value,
        'won_deals', sm.won_deals,
        'won_value', sm.won_value,
        'lost_deals', sm.lost_deals,
        'open_deals', sm.open_deals,
        'open_value', sm.open_value,
        'win_rate', CASE WHEN sm.closed_deals > 0
                         THEN ROUND((sm.won_deals::NUMERIC / sm.closed_deals::NUMERIC) * 100, 1)
                         ELSE NULL END,
        'stages', COALESCE((SELECT jsonb_agg(to_jsonb(sb) ORDER BY sb.pipeline_id, sb.position) FROM stage_breakdown sb), '[]'::jsonb)
    )
    INTO v_result
    FROM summary sm;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.global_search(search_term TEXT, max_results INT DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID := public.current_org_id();
    v_all BOOLEAN;
    v_term TEXT := btrim(COALESCE(search_term, ''));
    v_limit INT := LEAST(GREATEST(COALESCE(max_results, 5), 1), 25);
    v_pattern TEXT;
    v_deals JSONB;
    v_contacts JSONB;
    v_companies JSONB;
    v_activities JSONB;
    v_tasks JSONB;
BEGIN
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_term = '' THEN
        RETURN jsonb_build_object('deals', '[]'::jsonb, 'contacts', '[]'::jsonb, 'companies', '[]'::jsonb,
                                  'activities', '[]'::jsonb, 'tasks', '[]'::jsonb);
    END IF;
    v_all := public.org_role(v_org) IN ('admin'::public.app_role, 'manager'::public.app_role);

    v_pattern := '%' || replace(replace(replace(left(v_term, 200), '\', '\\'), '%', '\%'), '_', '\_') || '%';

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_deals FROM (
        SELECT d.id, d.title, d.value FROM public.deals d
        WHERE d.organization_id = v_org AND d.title ILIKE v_pattern
          AND (v_all OR d.owner_id = v_uid OR d.created_by = v_uid)
        ORDER BY d.created_at DESC LIMIT v_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_contacts FROM (
        SELECT c.id, c.first_name, c.last_name, c.email FROM public.contacts c
        WHERE c.organization_id = v_org
          AND (c.first_name || ' ' || c.last_name || ' ' || coalesce(c.email, '')) ILIKE v_pattern
        ORDER BY c.created_at DESC LIMIT v_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_companies FROM (
        SELECT c.id, c.name, c.industry FROM public.companies c
        WHERE c.organization_id = v_org AND c.name ILIKE v_pattern
        ORDER BY c.created_at DESC LIMIT v_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_activities FROM (
        SELECT a.id, a.title, a.type, a.deal_id, a.contact_id FROM public.activities a
        WHERE a.organization_id = v_org AND a.title ILIKE v_pattern
          AND (v_all OR a.user_id = v_uid
               OR EXISTS (SELECT 1 FROM public.deals d
                          WHERE d.id = a.deal_id AND (d.owner_id = v_uid OR d.created_by = v_uid)))
        ORDER BY a.created_at DESC LIMIT v_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_tasks FROM (
        SELECT t.id, t.title, t.priority, t.completed, t.due_date FROM public.tasks t
        WHERE t.organization_id = v_org AND t.title ILIKE v_pattern
          AND (v_all OR t.user_id = v_uid OR t.assigned_to = v_uid)
        ORDER BY t.created_at DESC LIMIT v_limit
    ) sub;

    RETURN jsonb_build_object(
        'deals', v_deals,
        'contacts', v_contacts,
        'companies', v_companies,
        'activities', v_activities,
        'tasks', v_tasks
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Platform owner console RPCs. Counts and metadata only — never the contents of deals,
--     contacts, companies, activities or tasks. Each raises 'Not allowed.' for non-admins.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._require_platform_admin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not allowed.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- Internal: LIKE pattern for a user-supplied search term (NULL = no filter).
CREATE OR REPLACE FUNCTION public._like_pattern(p_term TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE WHEN btrim(COALESCE(p_term, '')) = '' THEN NULL
                ELSE '%' || replace(replace(replace(left(btrim(p_term), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%'
           END;
$$;

CREATE OR REPLACE FUNCTION public.platform_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_since TIMESTAMPTZ := NOW() - INTERVAL '30 days';
    v_result JSONB;
BEGIN
    PERFORM public._require_platform_admin();

    SELECT jsonb_build_object(
        'total_workspaces', (SELECT count(*) FROM public.organizations),
        'active_workspaces_30d', (
            SELECT count(*) FROM public.organizations o
            WHERE EXISTS (SELECT 1 FROM public.organization_members m JOIN auth.users u ON u.id = m.user_id
                          WHERE m.organization_id = o.id AND u.last_sign_in_at >= v_since)
               OR EXISTS (SELECT 1 FROM public.deals d WHERE d.organization_id = o.id AND d.updated_at >= v_since)
               OR EXISTS (SELECT 1 FROM public.contacts c WHERE c.organization_id = o.id AND c.updated_at >= v_since)
               OR EXISTS (SELECT 1 FROM public.activities a WHERE a.organization_id = o.id AND a.created_at >= v_since)
               OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.organization_id = o.id AND t.updated_at >= v_since)
               OR EXISTS (SELECT 1 FROM public.ai_usage x WHERE x.organization_id = o.id AND x.created_at >= v_since AND NOT x.failed)),
        'suspended_workspaces', (SELECT count(*) FROM public.organizations o WHERE o.status = 'suspended'),
        'total_users', (SELECT count(*) FROM auth.users),
        'signups_7d', (SELECT count(*) FROM auth.users u WHERE u.created_at >= NOW() - INTERVAL '7 days'),
        'signups_30d', (SELECT count(*) FROM auth.users u WHERE u.created_at >= v_since),
        'confirmed_users', (SELECT count(*) FROM auth.users u WHERE u.email_confirmed_at IS NOT NULL),
        'plan_counts', jsonb_build_object(
            'starter', (SELECT count(*) FROM public.organizations o WHERE o.plan = 'starter'),
            'growth', (SELECT count(*) FROM public.organizations o WHERE o.plan = 'growth'),
            'enterprise', (SELECT count(*) FROM public.organizations o WHERE o.plan = 'enterprise')),
        'ai_requests_30d', (SELECT count(*) FROM public.ai_usage x WHERE x.created_at >= v_since AND NOT x.failed),
        'total_deals', (SELECT count(*) FROM public.deals),
        'total_contacts', (SELECT count(*) FROM public.contacts)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_timeseries(p_days INT DEFAULT 90)
RETURNS TABLE (day DATE, signups INT, new_workspaces INT, ai_requests INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    v_days INT := LEAST(GREATEST(COALESCE(p_days, 90), 1), 730);
    v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
    v_first DATE;
BEGIN
    PERFORM public._require_platform_admin();
    v_first := v_today - (v_days - 1);

    RETURN QUERY
    WITH days AS (
        SELECT g::DATE AS day FROM generate_series(v_first::TIMESTAMP, v_today::TIMESTAMP, INTERVAL '1 day') g
    ),
    s AS (
        SELECT (u.created_at AT TIME ZONE 'UTC')::DATE AS day, count(*) AS n
        FROM auth.users u WHERE u.created_at >= v_first::TIMESTAMP AT TIME ZONE 'UTC' GROUP BY 1
    ),
    w AS (
        SELECT (o.created_at AT TIME ZONE 'UTC')::DATE AS day, count(*) AS n
        FROM public.organizations o WHERE o.created_at >= v_first::TIMESTAMP AT TIME ZONE 'UTC' GROUP BY 1
    ),
    a AS (
        SELECT (x.created_at AT TIME ZONE 'UTC')::DATE AS day, count(*) AS n
        FROM public.ai_usage x WHERE x.created_at >= v_first::TIMESTAMP AT TIME ZONE 'UTC' AND NOT x.failed GROUP BY 1
    )
    SELECT d.day, COALESCE(s.n, 0)::INT, COALESCE(w.n, 0)::INT, COALESCE(a.n, 0)::INT
    FROM days d
    LEFT JOIN s ON s.day = d.day
    LEFT JOIN w ON w.day = d.day
    LEFT JOIN a ON a.day = d.day
    ORDER BY d.day;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_workspaces(p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
    id UUID,
    name TEXT,
    plan TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    owner_email TEXT,
    member_count INT,
    deal_count INT,
    contact_count INT,
    ai_requests_30d INT,
    last_activity_at TIMESTAMPTZ,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    v_pattern TEXT := public._like_pattern(p_search);
    v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
    v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    PERFORM public._require_platform_admin();

    RETURN QUERY
    WITH base AS (
        SELECT o.id, o.name, o.plan, o.status, o.created_at,
               (SELECT u.email::TEXT FROM public.organization_members m JOIN auth.users u ON u.id = m.user_id
                 WHERE m.organization_id = o.id AND m.role = 'admin'::public.app_role
                 ORDER BY m.joined_at, m.user_id LIMIT 1) AS owner_email
        FROM public.organizations o
    ),
    filtered AS (
        SELECT b.*, count(*) OVER () AS total_count
        FROM base b
        WHERE v_pattern IS NULL OR b.name ILIKE v_pattern OR COALESCE(b.owner_email, '') ILIKE v_pattern
        ORDER BY b.created_at DESC, b.id
        LIMIT v_limit OFFSET v_offset
    )
    SELECT f.id, f.name, f.plan, f.status, f.created_at, f.owner_email,
           (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = f.id)::INT,
           (SELECT count(*) FROM public.deals d WHERE d.organization_id = f.id)::INT,
           (SELECT count(*) FROM public.contacts c WHERE c.organization_id = f.id)::INT,
           (SELECT count(*) FROM public.ai_usage x WHERE x.organization_id = f.id AND x.created_at >= NOW() - INTERVAL '30 days' AND NOT x.failed)::INT,
           GREATEST(
               (SELECT max(d.updated_at) FROM public.deals d WHERE d.organization_id = f.id),
               (SELECT max(c.updated_at) FROM public.contacts c WHERE c.organization_id = f.id),
               (SELECT max(a.created_at) FROM public.activities a WHERE a.organization_id = f.id),
               (SELECT max(t.updated_at) FROM public.tasks t WHERE t.organization_id = f.id),
               (SELECT max(x.created_at) FROM public.ai_usage x WHERE x.organization_id = f.id AND NOT x.failed)
           ),
           f.total_count
    FROM filtered f
    ORDER BY f.created_at DESC, f.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_users(p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    email_confirmed BOOLEAN,
    workspaces TEXT,
    is_platform_admin BOOLEAN,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    v_pattern TEXT := public._like_pattern(p_search);
    v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
    v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    PERFORM public._require_platform_admin();

    RETURN QUERY
    WITH filtered AS (
        SELECT u.id, u.email::TEXT AS email, p.full_name, u.created_at, u.last_sign_in_at,
               (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
               count(*) OVER () AS total_count
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.user_id = u.id
        WHERE v_pattern IS NULL OR u.email::TEXT ILIKE v_pattern OR COALESCE(p.full_name, '') ILIKE v_pattern
        ORDER BY u.created_at DESC, u.id
        LIMIT v_limit OFFSET v_offset
    )
    SELECT f.id, f.email, f.full_name, f.created_at, f.last_sign_in_at, f.email_confirmed,
           (SELECT string_agg(o.name, ', ' ORDER BY o.name) FROM public.organization_members m
              JOIN public.organizations o ON o.id = m.organization_id WHERE m.user_id = f.id),
           EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = f.id),
           f.total_count
    FROM filtered f
    ORDER BY f.created_at DESC, f.id;
END;
$$;

-- Product feedback is addressed to the operator, so its text is shown here.
CREATE OR REPLACE FUNCTION public.platform_feedback(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    rating INT,
    category TEXT,
    comment TEXT,
    status TEXT,
    user_email TEXT,
    workspace_name TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
    PERFORM public._require_platform_admin();

    RETURN QUERY
    SELECT f.id, f.created_at, f.rating, f.category, f.comment, f.status,
           COALESCE(u.email::TEXT, f.email), o.name, count(*) OVER ()
    FROM public.feedback f
    LEFT JOIN auth.users u ON u.id = f.user_id
    LEFT JOIN public.organizations o ON o.id = f.organization_id
    ORDER BY f.created_at DESC, f.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_contact_requests(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    name TEXT,
    email TEXT,
    company TEXT,
    message TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
    PERFORM public._require_platform_admin();

    RETURN QUERY
    SELECT r.id, r.created_at, r.name, r.email, r.company, r.message, count(*) OVER ()
    FROM public.contact_requests r
    ORDER BY r.created_at DESC, r.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

-- Operator override: no downgrade guard (existing data is kept; only new inserts are limited).
CREATE OR REPLACE FUNCTION public.platform_set_workspace_plan(p_org_id UUID, p_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_plan TEXT := lower(btrim(COALESCE(p_plan, '')));
BEGIN
    PERFORM public._require_platform_admin();
    IF v_plan NOT IN ('starter', 'growth', 'enterprise') THEN
        RAISE EXCEPTION 'Choose a valid plan (starter, growth or enterprise).' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organizations o SET plan = v_plan WHERE o.id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_workspace_status(p_org_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status TEXT := lower(btrim(COALESCE(p_status, '')));
BEGIN
    PERFORM public._require_platform_admin();
    IF v_status NOT IN ('active', 'suspended') THEN
        RAISE EXCEPTION 'Status must be active or suspended.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organizations o SET status = v_status WHERE o.id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. Function privileges (same pattern as 20260926000003): revoke everything in public,
--     then grant back explicitly. Extension-owned functions are left alone.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d
                          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Helpers evaluated inside RLS policies / column defaults (run as the caller).
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_limits(TEXT) TO authenticated;

-- Client RPCs (round 1)
GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation(TEXT, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_organization(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_pipeline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_pipeline_stages(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.global_search(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO anon, authenticated;

-- Client RPCs (round 2)
GRANT EXECUTE ON FUNCTION public.get_workspace_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_plan(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_timeseries(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_workspaces(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_users(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_feedback(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_contact_requests(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_workspace_plan(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_workspace_status(UUID, TEXT) TO authenticated;

-- consume_ai_quota, _internal helpers and trigger functions: service_role only (granted above).
