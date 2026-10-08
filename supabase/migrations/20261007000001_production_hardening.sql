-- ==============================================================================
-- 20261007000001: Production hardening
--
-- Applies on top of 20260927000001. Never edit an applied migration: put changes here or in a
-- later file.
--
--   1. Billing: 14-day trial for every workspace, then a paid period (paid_until). A workspace
--      whose trial/subscription ended is never "current" (RLS denies its data) and
--      get_my_context() reports it as billing_state = 'expired' so the app shows the paywall.
--      Admins request a plan; the platform owner activates it after payment (or a payment
--      webhook calls billing_activate_workspace as service_role). Admins can no longer
--      upgrade themselves; during the trial they may switch plans freely.
--   2. Account with a password published in git history (old seed script) is removed.
--   3. Invitations: atomic email throttle (send-invite), managers only see/revoke/replace rep
--      invitations.
--   4. Record integrity: creators/authors can't be rewritten, activities/tasks can only point at
--      deals the caller can see, deleting a deal or contact keeps its activities (SET NULL),
--      stages can't move to another pipeline while they hold deals, pipelines with deals
--      can't be deleted, flipping a stage's won/lost flag re-stamps its deals.
--   5. Workspaces always keep an admin; removed members' work is reassigned; members can leave.
--   6. Privacy: avatar bucket can't be listed; account deletion drops the feedback email.
--   7. Abuse limits on public/free-text inputs; indexes for FK lookups; privilege hygiene;
--      realtime publication trimmed to tables the app subscribes to.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Billing: trial + paid period
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS requested_plan TEXT,
    ADD COLUMN IF NOT EXISTS plan_requested_at TIMESTAMPTZ;

DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_requested_plan_check
        CHECK (requested_plan IS NULL OR requested_plan IN ('starter', 'growth', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing workspaces start their 14-day trial now; new ones get it from the column default.
UPDATE public.organizations SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL AND paid_until IS NULL;
ALTER TABLE public.organizations ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '14 days');
-- New workspaces trial the Growth plan (spreadsheet import, forecast and reports included).
ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'growth';
-- 20260926000001 was edited in place (USD -> ETB) after it had been applied; make it real.
ALTER TABLE public.organizations ALTER COLUMN currency SET DEFAULT 'ETB';

CREATE INDEX IF NOT EXISTS idx_organizations_requested_plan
    ON public.organizations(plan_requested_at DESC) WHERE requested_plan IS NOT NULL;

-- 'active' (paid), 'trialing' or 'expired'.
CREATE OR REPLACE FUNCTION public._billing_state(p_trial_ends_at TIMESTAMPTZ, p_paid_until TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_paid_until IS NOT NULL AND p_paid_until > NOW() THEN 'active'
        WHEN p_trial_ends_at IS NOT NULL AND p_trial_ends_at > NOW() THEN 'trialing'
        ELSE 'expired'
    END;
$$;

-- Suspended workspaces and workspaces whose trial/subscription ended are never "current".
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
          WHERE p.user_id = p_user_id AND o.status = 'active'
            AND (o.paid_until > NOW() OR o.trial_ends_at > NOW())),
        (SELECT m.organization_id
           FROM public.organization_members m
           JOIN public.organizations o ON o.id = m.organization_id
          WHERE m.user_id = p_user_id AND o.status = 'active'
            AND (o.paid_until > NOW() OR o.trial_ends_at > NOW())
          ORDER BY m.joined_at, m.organization_id
          LIMIT 1)
    );
$$;

-- Return type changed (billing columns) -> DROP + CREATE.
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
    is_platform_admin BOOLEAN,
    trial_ends_at TIMESTAMPTZ,
    paid_until TIMESTAMPTZ,
    billing_state TEXT,
    requested_plan TEXT
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
    v_expired UUID;
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

    -- An active (paid or trialing) workspace the caller belongs to.
    v_org := public.current_org_id();

    -- The workspace the user selected has ended its trial/subscription: show its paywall (with a
    -- way to pay or switch) instead of silently moving them to another workspace. RLS keeps
    -- denying its data either way.
    SELECT m.organization_id INTO v_expired
    FROM public.profiles p
    JOIN public.organization_members m ON m.organization_id = p.current_organization_id AND m.user_id = p.user_id
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE p.user_id = v_uid AND o.status = 'active'
      AND public._billing_state(o.trial_ends_at, o.paid_until) = 'expired';
    IF v_expired IS NOT NULL THEN
        v_org := v_expired;
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

    -- A workspace whose trial or subscription ended stays the caller's workspace and is shown
    -- behind the paywall. Never create a fresh workspace (and trial) for them instead.
    IF v_org IS NULL THEN
        SELECT m.organization_id INTO v_org
        FROM public.organization_members m
        JOIN public.organizations o ON o.id = m.organization_id
        LEFT JOIN public.profiles p ON p.user_id = m.user_id
        WHERE m.user_id = v_uid AND o.status = 'active'
        ORDER BY (m.organization_id = p.current_organization_id) DESC NULLS LAST, m.joined_at DESC, m.organization_id
        LIMIT 1;
    END IF;

    -- Every workspace the caller belongs to is suspended: report it, don't create a new one.
    IF v_org IS NULL AND EXISTS (
        SELECT 1 FROM public.organization_members m
        JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.user_id = v_uid AND o.status = 'suspended'
    ) THEN
        RAISE EXCEPTION 'This workspace has been suspended. Contact support.' USING ERRCODE = 'P0001';
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
    SELECT o.id, o.name, o.monthly_quota, o.currency, m.role, o.plan, o.status, public.is_platform_admin(),
           o.trial_ends_at, o.paid_until, public._billing_state(o.trial_ends_at, o.paid_until), o.requested_plan
    FROM public.organizations o
    JOIN public.organization_members m ON m.organization_id = o.id AND m.user_id = v_uid
    WHERE o.id = v_org;
END;
$$;

-- Admins: during the trial any plan may be tried; once paid, only downgrades (upgrades are
-- activated after payment).
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
    v_order CONSTANT TEXT[] := ARRAY['starter', 'growth', 'enterprise'];
    v_cur RECORD;
    v_problem TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins can change the plan.' USING ERRCODE = 'P0001';
    END IF;
    IF v_plan <> ALL (v_order) THEN
        RAISE EXCEPTION 'Choose a valid plan (starter, growth or enterprise).' USING ERRCODE = 'P0001';
    END IF;

    SELECT o.plan, o.trial_ends_at, o.paid_until INTO v_cur FROM public.organizations o WHERE o.id = v_org FOR UPDATE;
    IF public._billing_state(v_cur.trial_ends_at, v_cur.paid_until) = 'active'
       AND array_position(v_order, v_plan) > array_position(v_order, v_cur.plan) THEN
        RAISE EXCEPTION 'Upgrades start after payment. Request the plan and we''ll send you the payment details.'
            USING ERRCODE = 'P0001';
    END IF;

    v_problem := public._plan_violation(v_org, v_plan);
    IF v_problem IS NOT NULL THEN
        RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.organizations o SET plan = v_plan WHERE o.id = v_org AND o.plan IS DISTINCT FROM v_plan;
END;
$$;

-- Admins: ask to (re)activate or upgrade the workspace on a plan; NULL withdraws the request.
-- Works while the workspace is expired (it is then not "current", so resolve it via the profile).
CREATE OR REPLACE FUNCTION public.request_plan(p_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_plan TEXT := NULLIF(lower(btrim(COALESCE(p_plan, ''))), '');
    v_org UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_plan IS NOT NULL AND v_plan NOT IN ('starter', 'growth', 'enterprise') THEN
        RAISE EXCEPTION 'Choose a valid plan (starter, growth or enterprise).' USING ERRCODE = 'P0001';
    END IF;

    SELECT m.organization_id INTO v_org
    FROM public.profiles p
    JOIN public.organization_members m ON m.organization_id = p.current_organization_id AND m.user_id = p.user_id
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE p.user_id = v_uid AND m.role = 'admin'::public.app_role AND o.status = 'active';
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'Only workspace admins can choose a plan.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.organizations o
    SET requested_plan = v_plan,
        plan_requested_at = CASE WHEN v_plan IS NULL THEN NULL ELSE NOW() END
    WHERE o.id = v_org;
END;
$$;

-- Platform owner: activate (or renew) a paid plan for p_months after payment was received.
CREATE OR REPLACE FUNCTION public.platform_activate_workspace(p_org_id UUID, p_plan TEXT, p_months INT)
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
    IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 36 THEN
        RAISE EXCEPTION 'Choose between 1 and 36 months.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organizations o
    SET plan = v_plan,
        paid_until = GREATEST(COALESCE(o.paid_until, NOW()), NOW()) + pg_catalog.make_interval(months => p_months),
        requested_plan = NULL,
        plan_requested_at = NULL
    WHERE o.id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- Platform owner: give a workspace more trial days.
CREATE OR REPLACE FUNCTION public.platform_extend_trial(p_org_id UUID, p_days INT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public._require_platform_admin();
    IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 90 THEN
        RAISE EXCEPTION 'Choose between 1 and 90 days.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organizations o
    SET trial_ends_at = GREATEST(COALESCE(o.trial_ends_at, NOW()), NOW()) + pg_catalog.make_interval(days => p_days)
    WHERE o.id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- Platform owner: end a paid period now (refund, chargeback). Data is kept.
CREATE OR REPLACE FUNCTION public.platform_end_subscription(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public._require_platform_admin();
    UPDATE public.organizations o SET paid_until = NOW() WHERE o.id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- Payment provider webhook (service role only): set the plan and paid period.
CREATE OR REPLACE FUNCTION public.billing_activate_workspace(p_org_id UUID, p_plan TEXT, p_paid_until TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_plan TEXT := lower(btrim(COALESCE(p_plan, '')));
BEGIN
    IF v_plan NOT IN ('starter', 'growth', 'enterprise') THEN
        RAISE EXCEPTION 'Invalid plan %', p_plan USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organizations o
    SET plan = v_plan, paid_until = p_paid_until, requested_plan = NULL, plan_requested_at = NULL
    WHERE o.id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found.' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- Platform console: billing columns + pending requests first (return type changed).
DROP FUNCTION IF EXISTS public.platform_workspaces(TEXT, INT, INT);
CREATE FUNCTION public.platform_workspaces(p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
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
    trial_ends_at TIMESTAMPTZ,
    paid_until TIMESTAMPTZ,
    billing_state TEXT,
    requested_plan TEXT,
    plan_requested_at TIMESTAMPTZ,
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
        SELECT o.id, o.name, o.plan, o.status, o.created_at, o.trial_ends_at, o.paid_until,
               o.requested_plan, o.plan_requested_at,
               (SELECT u.email::TEXT FROM public.organization_members m JOIN auth.users u ON u.id = m.user_id
                 WHERE m.organization_id = o.id AND m.role = 'admin'::public.app_role
                 ORDER BY m.joined_at, m.user_id LIMIT 1) AS owner_email
        FROM public.organizations o
    ),
    filtered AS (
        SELECT b.*, count(*) OVER () AS total_count
        FROM base b
        WHERE v_pattern IS NULL OR b.name ILIKE v_pattern OR COALESCE(b.owner_email, '') ILIKE v_pattern
        ORDER BY (b.requested_plan IS NOT NULL) DESC, b.created_at DESC, b.id
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
           f.trial_ends_at, f.paid_until, public._billing_state(f.trial_ends_at, f.paid_until),
           f.requested_plan, f.plan_requested_at,
           f.total_count
    FROM filtered f
    ORDER BY (f.requested_plan IS NOT NULL) DESC, f.created_at DESC, f.id;
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
        'paying_workspaces', (SELECT count(*) FROM public.organizations o WHERE o.paid_until > NOW()),
        'trialing_workspaces', (SELECT count(*) FROM public.organizations o
                                WHERE (o.paid_until IS NULL OR o.paid_until <= NOW()) AND o.trial_ends_at > NOW()),
        'expired_workspaces', (SELECT count(*) FROM public.organizations o
                               WHERE public._billing_state(o.trial_ends_at, o.paid_until) = 'expired'),
        'plan_requests', (SELECT count(*) FROM public.organizations o WHERE o.requested_plan IS NOT NULL),
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

-- AI quota: trials get at most 100 assistant requests a month whatever the plan
-- (reason 'trial_limit'); expired workspaces are not current, so they get 'no_workspace'.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
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
    v_state TEXT;
    v_limit INT;
    v_trial_cap CONSTANT INT := 100;
    v_month_start TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_next_month TIMESTAMPTZ := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';
    v_month_count INT;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_ai:' || p_user_id::text, 0));

    v_org := public.user_current_org_id(p_user_id);
    IF v_org IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, NULL::UUID, 'no_workspace'::TEXT, NULL::TEXT, NULL::INT, NULL::INT;
        RETURN;
    END IF;

    SELECT o.plan, public._billing_state(o.trial_ends_at, o.paid_until) INTO v_plan, v_state
    FROM public.organizations o WHERE o.id = v_org;
    v_limit := public._plan_limit(v_plan, 'ai_requests_per_month');
    IF v_state = 'trialing' THEN
        v_limit := LEAST(COALESCE(v_limit, v_trial_cap), v_trial_cap);
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
                            NULL::UUID,
                            (CASE WHEN v_state = 'trialing' THEN 'trial_limit' ELSE 'monthly_limit' END)::TEXT,
                            v_plan, v_limit, v_month_count;
        RETURN;
    END IF;

    INSERT INTO public.ai_usage (user_id, organization_id, model)
    VALUES (p_user_id, v_org, p_model)
    RETURNING id INTO v_id;

    RETURN QUERY SELECT TRUE, 0, v_id, NULL::TEXT, v_plan, v_limit, v_month_count + 1;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Remove the account whose password was published by the deleted seed script.
--    Another member is promoted first if it was the only admin of a shared workspace.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_uid UUID;
    r RECORD;
BEGIN
    SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = 'marakicreative@gmail.com';
    IF v_uid IS NULL THEN
        RETURN;
    END IF;

    FOR r IN SELECT m.organization_id FROM public.organization_members m
             WHERE m.user_id = v_uid AND m.role = 'admin'::public.app_role LOOP
        IF NOT EXISTS (SELECT 1 FROM public.organization_members x
                       WHERE x.organization_id = r.organization_id AND x.user_id <> v_uid
                         AND x.role = 'admin'::public.app_role) THEN
            UPDATE public.organization_members x SET role = 'admin'::public.app_role
            WHERE x.organization_id = r.organization_id
              AND x.user_id = (SELECT y.user_id FROM public.organization_members y
                               WHERE y.organization_id = r.organization_id AND y.user_id <> v_uid
                               ORDER BY (y.role = 'manager'::public.app_role) DESC, y.joined_at, y.user_id
                               LIMIT 1);
        END IF;
    END LOOP;

    BEGIN
        DELETE FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN
        -- Couldn't delete (e.g. a dependent row blocks it): lock the account out instead.
        RAISE WARNING 'Could not delete the leaked seed account (%); banning it instead.', SQLERRM;
        UPDATE auth.users SET banned_until = 'infinity', encrypted_password = NULL WHERE id = v_uid;
        DELETE FROM auth.sessions WHERE user_id = v_uid;
        DELETE FROM public.organization_members WHERE user_id = v_uid;
    END;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Invitations
-- ------------------------------------------------------------------------------
-- send-invite throttle: 3 emails per invitation (10 min apart), 30 per workspace per day,
-- 20 per sender per hour. Re-inviting replaces the invitation row, so the log is what counts.
ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS email_sent_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS email_last_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.invite_email_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invite_email_log_org ON public.invite_email_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invite_email_log_user ON public.invite_email_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
ALTER TABLE public.invite_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invite_email_log FROM PUBLIC, anon, authenticated;

-- NULL = allowed (and recorded); otherwise the reason it was refused.
CREATE OR REPLACE FUNCTION public.claim_invite_email(p_invitation_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT i.organization_id, i.email_sent_count, i.email_last_sent_at INTO v_inv
    FROM public.invitations i WHERE i.id = p_invitation_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_invite_org:' || v_inv.organization_id::text, 0));

    IF v_inv.email_sent_count >= 3 THEN
        RETURN 'invite_max';
    END IF;
    IF v_inv.email_last_sent_at > NOW() - INTERVAL '10 minutes' THEN
        RETURN 'invite_cooldown';
    END IF;
    IF (SELECT count(*) FROM public.invite_email_log l
        WHERE l.organization_id = v_inv.organization_id AND l.created_at > NOW() - INTERVAL '1 day') >= 30 THEN
        RETURN 'org_daily';
    END IF;
    IF (SELECT count(*) FROM public.invite_email_log l
        WHERE l.user_id = p_user_id AND l.created_at > NOW() - INTERVAL '1 hour') >= 20 THEN
        RETURN 'user_hourly';
    END IF;

    UPDATE public.invitations
    SET email_sent_count = email_sent_count + 1, email_last_sent_at = NOW()
    WHERE id = p_invitation_id;
    INSERT INTO public.invite_email_log (organization_id, user_id) VALUES (v_inv.organization_id, p_user_id);
    DELETE FROM public.invite_email_log l WHERE l.created_at < NOW() - INTERVAL '30 days';
    RETURN NULL;
END;
$$;

-- Managers work with rep invitations only (they can't invite admins/managers either).
DROP POLICY IF EXISTS "Admins and managers can view invitations" ON public.invitations;
CREATE POLICY "Admins and managers can view invitations" ON public.invitations
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) = 'admin'
             OR ((SELECT public.current_org_role()) = 'manager' AND role = 'rep'::public.app_role))
    );

DROP POLICY IF EXISTS "Admins and managers can revoke invitations" ON public.invitations;
CREATE POLICY "Admins and managers can revoke invitations" ON public.invitations
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND ((SELECT public.current_org_role()) = 'admin'
             OR ((SELECT public.current_org_role()) = 'manager' AND role = 'rep'::public.app_role))
    );

-- Same as 20260927000001, plus: a manager can't replace an admin's pending invitation.
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

    IF v_my_role = 'manager'::public.app_role AND EXISTS (
        SELECT 1 FROM public.invitations i
        WHERE i.organization_id = v_org AND lower(i.email) = v_email AND i.accepted_at IS NULL
          AND i.role <> 'rep'::public.app_role) THEN
        RAISE EXCEPTION 'An admin has already invited this person.' USING ERRCODE = 'P0001';
    END IF;

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
-- 4. Record integrity
-- ------------------------------------------------------------------------------
-- 4a. Creators/authors are fixed, and activities/tasks can only be linked to visible deals.
--     (Delete rules key off created_by/user_id, and deal ownership off created_by.)
CREATE OR REPLACE FUNCTION public.protect_record_authorship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    -- Service role / SQL editor / FK actions (ON DELETE SET NULL) are not client edits.
    IF v_uid IS NULL OR pg_catalog.pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    IF TG_TABLE_NAME IN ('companies', 'contacts', 'deals') THEN
        IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'The creator of a record cannot be changed.' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'The author of a record cannot be changed.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.deal_id IS DISTINCT FROM OLD.deal_id AND NEW.deal_id IS NOT NULL
           AND COALESCE(public.org_role(NEW.organization_id)::TEXT, '') NOT IN ('admin', 'manager')
           AND NOT EXISTS (SELECT 1 FROM public.deals d
                           WHERE d.id = NEW.deal_id AND (d.owner_id = v_uid OR d.created_by = v_uid)) THEN
            RAISE EXCEPTION 'Deal not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_02_protect_authorship ON public.companies;
CREATE TRIGGER trg_02_protect_authorship BEFORE UPDATE OF created_by ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.protect_record_authorship();
DROP TRIGGER IF EXISTS trg_02_protect_authorship ON public.contacts;
CREATE TRIGGER trg_02_protect_authorship BEFORE UPDATE OF created_by ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.protect_record_authorship();
DROP TRIGGER IF EXISTS trg_02_protect_authorship ON public.deals;
CREATE TRIGGER trg_02_protect_authorship BEFORE UPDATE OF created_by ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.protect_record_authorship();
DROP TRIGGER IF EXISTS trg_02_protect_authorship ON public.activities;
CREATE TRIGGER trg_02_protect_authorship BEFORE UPDATE OF user_id, deal_id ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.protect_record_authorship();
DROP TRIGGER IF EXISTS trg_02_protect_authorship ON public.tasks;
CREATE TRIGGER trg_02_protect_authorship BEFORE UPDATE OF user_id, deal_id ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.protect_record_authorship();

-- The deals subquery runs under the caller's RLS: only deals they can see qualify.
DROP POLICY IF EXISTS "Members can create activities" ON public.activities;
CREATE POLICY "Members can create activities" ON public.activities
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = (SELECT public.current_org_id())
        AND user_id = (SELECT auth.uid())
        AND (activities.deal_id IS NULL OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = activities.deal_id))
    );
DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
CREATE POLICY "Members can create tasks" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = (SELECT public.current_org_id())
        AND user_id = (SELECT auth.uid())
        AND (tasks.deal_id IS NULL OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = tasks.deal_id))
    );

-- 4b. Deleting a deal or contact keeps the activity history (the UI promised this; the
--     cascade also let a rep wipe teammates' activities they can't otherwise delete).
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT DISTINCT con.conname
        FROM pg_constraint con
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'public.activities'::regclass AND con.contype = 'f'
          AND a.attname IN ('deal_id', 'contact_id')
    LOOP
        EXECUTE format('ALTER TABLE public.activities DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
ALTER TABLE public.activities
    ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL,
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 4c. A stage holding deals can't move to another pipeline (its deals' pipeline_id would no
--     longer match, and every later edit of them would fail).
CREATE OR REPLACE FUNCTION public.guard_stage_pipeline_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id
       AND EXISTS (SELECT 1 FROM public.deals d WHERE d.stage_id = OLD.id) THEN
        RAISE EXCEPTION 'Move this stage''s deals before moving it to another pipeline.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_01_stage_pipeline_guard ON public.pipeline_stages;
CREATE TRIGGER trg_01_stage_pipeline_guard BEFORE UPDATE OF pipeline_id ON public.pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION public.guard_stage_pipeline_change();

-- 4d. Deleting a pipeline directly is refused while it has deals (cascades from a workspace
--     deletion are allowed).
CREATE OR REPLACE FUNCTION public.guard_pipeline_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF pg_catalog.pg_trigger_depth() = 1 AND EXISTS (SELECT 1 FROM public.deals d WHERE d.pipeline_id = OLD.id) THEN
        RAISE EXCEPTION 'This pipeline still has deals. Move or delete them before deleting the pipeline.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_pipelines_guard_delete ON public.pipelines;
CREATE TRIGGER trg_pipelines_guard_delete BEFORE DELETE ON public.pipelines
    FOR EACH ROW EXECUTE FUNCTION public.guard_pipeline_delete();

-- 4e. Turning a stage into (or out of) Won/Lost re-stamps the deals already in it, so they
--     show up in won revenue / win rate / forecast.
CREATE OR REPLACE FUNCTION public.sync_deals_on_stage_outcome_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.deals d SET
        won_at = CASE WHEN NEW.is_won THEN COALESCE(d.won_at, NOW()) END,
        lost_at = CASE WHEN NEW.is_lost AND NOT NEW.is_won THEN COALESCE(d.lost_at, NOW()) END,
        probability = CASE WHEN NEW.is_won THEN 100 WHEN NEW.is_lost THEN 0 ELSE d.probability END
    WHERE d.stage_id = NEW.id;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pipeline_stages_sync_outcome ON public.pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_sync_outcome AFTER UPDATE OF is_won, is_lost ON public.pipeline_stages
    FOR EACH ROW
    WHEN (NEW.is_won IS DISTINCT FROM OLD.is_won OR NEW.is_lost IS DISTINCT FROM OLD.is_lost)
    EXECUTE FUNCTION public.sync_deals_on_stage_outcome_change();

-- ------------------------------------------------------------------------------
-- 5. Membership
-- ------------------------------------------------------------------------------
-- 5a. A workspace with members always has an admin, even when an account is deleted from the
--     Supabase dashboard (membership rows cascade without going through the RPC guards).
CREATE OR REPLACE FUNCTION public.ensure_workspace_has_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := OLD.organization_id;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_org) THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = v_org)
       AND NOT EXISTS (SELECT 1 FROM public.organization_members m
                       WHERE m.organization_id = v_org AND m.role = 'admin'::public.app_role) THEN
        UPDATE public.organization_members m SET role = 'admin'::public.app_role
        WHERE m.organization_id = v_org
          AND m.user_id = (SELECT m2.user_id FROM public.organization_members m2
                           WHERE m2.organization_id = v_org
                           ORDER BY (m2.role = 'manager'::public.app_role) DESC, m2.joined_at, m2.user_id
                           LIMIT 1);
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_org_members_keep_admin ON public.organization_members;
CREATE CONSTRAINT TRIGGER trg_org_members_keep_admin
    AFTER DELETE OR UPDATE OF role ON public.organization_members
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION public.ensure_workspace_has_admin();

-- 5b. Removing a member hands their deals and open tasks to the admin who removed them, so
--     nothing is left owned by someone outside the workspace.
CREATE OR REPLACE FUNCTION public.remove_member(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID := public.current_org_id();
    v_target_role public.app_role;
    v_admins INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins can remove members.' USING ERRCODE = 'P0001';
    END IF;
    IF p_user_id = v_uid THEN
        RAISE EXCEPTION 'Use "Leave workspace" to remove yourself.' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1 FROM public.organization_members m WHERE m.organization_id = v_org FOR UPDATE;

    SELECT m.role INTO v_target_role FROM public.organization_members m
    WHERE m.organization_id = v_org AND m.user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That person is not a member of this workspace.' USING ERRCODE = 'P0001';
    END IF;

    IF v_target_role = 'admin'::public.app_role THEN
        SELECT count(*) INTO v_admins FROM public.organization_members m
        WHERE m.organization_id = v_org AND m.role = 'admin'::public.app_role;
        IF v_admins <= 1 THEN
            RAISE EXCEPTION 'You are the last admin of this workspace. Promote someone else first.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    UPDATE public.deals d SET owner_id = v_uid WHERE d.organization_id = v_org AND d.owner_id = p_user_id;
    UPDATE public.tasks t SET assigned_to = v_uid
    WHERE t.organization_id = v_org AND t.assigned_to = p_user_id AND NOT t.completed;

    DELETE FROM public.organization_members m WHERE m.organization_id = v_org AND m.user_id = p_user_id;
    DELETE FROM public.notifications n WHERE n.organization_id = v_org AND n.user_id = p_user_id;

    UPDATE public.profiles p
    SET current_organization_id = (SELECT m.organization_id FROM public.organization_members m
                                   WHERE m.user_id = p_user_id ORDER BY m.joined_at LIMIT 1)
    WHERE p.user_id = p_user_id AND p.current_organization_id = v_org;
END;
$$;

-- 5c. Leave the current workspace (not as its only member or last admin). Deals you own become
--     unassigned (admins and managers still see them); your open assigned tasks are unassigned.
CREATE OR REPLACE FUNCTION public.leave_workspace()
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID;
    v_role public.app_role;
    v_admins INT;
    v_members INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    -- The workspace the user is looking at, even if its trial has ended.
    SELECT p.current_organization_id INTO v_org FROM public.profiles p WHERE p.user_id = v_uid;
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'You are not in a workspace.' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1 FROM public.organization_members m WHERE m.organization_id = v_org FOR UPDATE;
    SELECT m.role INTO v_role FROM public.organization_members m
    WHERE m.organization_id = v_org AND m.user_id = v_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'You are not a member of this workspace.' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) FILTER (WHERE m.role = 'admin'::public.app_role), count(*)
      INTO v_admins, v_members
      FROM public.organization_members m WHERE m.organization_id = v_org;
    IF v_members <= 1 THEN
        RAISE EXCEPTION 'You are the only member of this workspace.' USING ERRCODE = 'P0001';
    END IF;
    IF v_role = 'admin'::public.app_role AND v_admins <= 1 THEN
        RAISE EXCEPTION 'You are the last admin of this workspace. Promote someone else first.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.deals d SET owner_id = NULL WHERE d.organization_id = v_org AND d.owner_id = v_uid;
    UPDATE public.tasks t SET assigned_to = NULL
    WHERE t.organization_id = v_org AND t.assigned_to = v_uid AND NOT t.completed;

    DELETE FROM public.organization_members m WHERE m.organization_id = v_org AND m.user_id = v_uid;
    DELETE FROM public.notifications n WHERE n.organization_id = v_org AND n.user_id = v_uid;

    UPDATE public.profiles p
    SET current_organization_id = (SELECT m.organization_id FROM public.organization_members m
                                   WHERE m.user_id = v_uid ORDER BY m.joined_at LIMIT 1)
    WHERE p.user_id = v_uid;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Privacy
-- ------------------------------------------------------------------------------
-- 6a. Avatars: the bucket is public, so image URLs work without a SELECT policy. Users may
--     only list/write their own folder, one "avatar.<ext>" object at a time.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own avatar objects" ON storage.objects;
CREATE POLICY "Users can read their own avatar objects" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND array_length(storage.foldername(name), 1) = 1
        AND storage.filename(name) ~ '^avatar\.(jpe?g|png|gif|webp)$'
    );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND array_length(storage.foldername(name), 1) = 1
        AND storage.filename(name) ~ '^avatar\.(jpe?g|png|gif|webp)$'
    );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 6b. Account deletion also drops the email stored on the user's feedback.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    r RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.organization_members m
    WHERE m.organization_id IN (SELECT m2.organization_id FROM public.organization_members m2 WHERE m2.user_id = v_uid)
    FOR UPDATE;

    FOR r IN
        SELECT o.name,
               m.role,
               (SELECT count(*) FROM public.organization_members x WHERE x.organization_id = m.organization_id) AS member_count,
               (SELECT count(*) FROM public.organization_members x
                 WHERE x.organization_id = m.organization_id AND x.role = 'admin'::public.app_role) AS admin_count
        FROM public.organization_members m
        JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.user_id = v_uid
    LOOP
        IF r.member_count > 1 AND r.role = 'admin'::public.app_role AND r.admin_count <= 1 THEN
            RAISE EXCEPTION 'You are the last admin of "%". Promote someone else to admin (or remove the other members) before deleting your account.', r.name
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    -- Workspaces nobody else uses go with the account.
    DELETE FROM public.organizations o
    WHERE o.id IN (SELECT m.organization_id FROM public.organization_members m WHERE m.user_id = v_uid)
      AND (SELECT count(*) FROM public.organization_members x WHERE x.organization_id = o.id) = 1;

    UPDATE public.feedback f SET email = NULL WHERE f.user_id = v_uid;

    -- Cascades to profile, memberships, notifications, email templates, AI usage;
    -- shared records keep their data with created_by/owner_id set to NULL.
    DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Abuse limits, indexes, privileges, realtime
-- ------------------------------------------------------------------------------
-- 7a. Public contact form: 3 messages per email per hour, 20 per minute overall.
CREATE OR REPLACE FUNCTION public.throttle_contact_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_contact_requests', 0));
    IF (SELECT count(*) FROM public.contact_requests c
        WHERE lower(c.email) = lower(NEW.email) AND c.created_at > NOW() - INTERVAL '1 hour') >= 3
       OR (SELECT count(*) FROM public.contact_requests c WHERE c.created_at > NOW() - INTERVAL '1 minute') >= 20 THEN
        RAISE EXCEPTION 'Too many messages. Please try again later.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_contact_requests_throttle ON public.contact_requests;
CREATE TRIGGER trg_contact_requests_throttle BEFORE INSERT ON public.contact_requests
    FOR EACH ROW EXECUTE FUNCTION public.throttle_contact_requests();
CREATE INDEX IF NOT EXISTS idx_contact_requests_email ON public.contact_requests(lower(email), created_at DESC);

-- 7b. Size limits on free text (NOT VALID: existing rows aren't re-checked).
DO $$ BEGIN
    ALTER TABLE public.deals ADD CONSTRAINT deals_title_len CHECK (char_length(title) <= 500) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.deals ADD CONSTRAINT deals_notes_len CHECK (notes IS NULL OR char_length(notes) <= 50000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.activities ADD CONSTRAINT activities_title_len CHECK (char_length(title) <= 500) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.activities ADD CONSTRAINT activities_description_len
        CHECK (description IS NULL OR char_length(description) <= 50000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_title_len CHECK (char_length(title) <= 500) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_description_len
        CHECK (description IS NULL OR char_length(description) <= 50000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.companies ADD CONSTRAINT companies_name_len CHECK (char_length(name) <= 300) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.feedback ADD CONSTRAINT feedback_comment_len CHECK (char_length(comment) <= 5000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.feedback ADD CONSTRAINT feedback_category_len CHECK (char_length(category) <= 50) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7c. Indexes for FK lookups (stage/pipeline/user/workspace deletes otherwise scan whole tables).
--     On a large production table run these with CREATE INDEX CONCURRENTLY first; the
--     IF NOT EXISTS then makes this a no-op.
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON public.deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_current_org ON public.profiles(current_organization_id) WHERE current_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations(invited_by) WHERE invited_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.feedback(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_templates_user ON public.email_templates(user_id);

-- 7d. Realtime: the app subscribes to deals, activities, notifications and pipeline stages only.
DO $$
DECLARE
    t TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        RETURN;
    END IF;
    FOREACH t IN ARRAY ARRAY['feedback', 'tasks'] LOOP
        IF EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
            EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', t);
        END IF;
    END LOOP;
END $$;

-- 7e. Privileges. Every function created above starts with no client access; grants are explicit.
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

REVOKE ALL ON FUNCTION public._billing_state(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_current_org_id(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_workspace_plan(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_plan(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_activate_workspace(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_extend_trial(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_end_subscription(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_activate_workspace(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_workspaces(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_overview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_quota(UUID, INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_invite_email(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_invitation(TEXT, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_record_authorship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_stage_pipeline_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_pipeline_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_deals_on_stage_outcome_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_workspace_has_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_member(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_workspace() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.throttle_contact_requests() FROM PUBLIC, anon, authenticated;
-- No policy uses it any more, and it reveals any user's role to any signed-in user.
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._billing_state(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_current_org_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_invite_email(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_activate_workspace(UUID, TEXT, TIMESTAMPTZ) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_workspace_plan(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_plan(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_activate_workspace(UUID, TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_extend_trial(UUID, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_end_subscription(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_workspaces(TEXT, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invitation(TEXT, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_workspace() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, service_role;

-- Functions created by later migrations start without client access unless granted.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
