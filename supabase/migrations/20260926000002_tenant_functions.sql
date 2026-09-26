-- ==============================================================================
-- 20260926000002: Workspace-aware triggers and RPCs
--
-- Every SECURITY DEFINER function pins search_path and checks the caller's
-- membership/role explicitly. Grants are applied in ..._000003.
-- Errors: 42501 'Not authenticated' when there is no JWT; every other error is
-- RAISE ... USING ERRCODE = 'P0001' with a short, human-readable message that the UI
-- may show verbatim.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Drop superseded signatures (argument names/types changed)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.seed_default_pipeline(UUID);
DROP FUNCTION IF EXISTS public.global_search(TEXT, INT);

-- ------------------------------------------------------------------------------
-- 1. Internal building blocks (never granted to clients)
-- ------------------------------------------------------------------------------

-- Creates the default pipeline for a workspace unless it already has one. No permission checks.
CREATE OR REPLACE FUNCTION public._seed_default_pipeline(p_org_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    SELECT p.id INTO v_pipeline_id
    FROM public.pipelines p
    WHERE p.organization_id = p_org_id
    ORDER BY p.created_at
    LIMIT 1;

    IF v_pipeline_id IS NOT NULL THEN
        RETURN v_pipeline_id;
    END IF;

    INSERT INTO public.pipelines (name, created_by, organization_id)
    VALUES ('Sales pipeline', p_user_id, p_org_id)
    RETURNING id INTO v_pipeline_id;

    INSERT INTO public.pipeline_stages (pipeline_id, organization_id, name, color, position, probability, is_won, is_lost)
    VALUES
        (v_pipeline_id, p_org_id, 'Prospect',    '#3b82f6', 0, 10,  FALSE, FALSE),
        (v_pipeline_id, p_org_id, 'Qualified',   '#8b5cf6', 1, 25,  FALSE, FALSE),
        (v_pipeline_id, p_org_id, 'Proposal',    '#f97316', 2, 50,  FALSE, FALSE),
        (v_pipeline_id, p_org_id, 'Negotiation', '#eab308', 3, 75,  FALSE, FALSE),
        (v_pipeline_id, p_org_id, 'Won',         '#10b981', 4, 100, TRUE,  FALSE),
        (v_pipeline_id, p_org_id, 'Lost',        '#ef4444', 5, 0,   FALSE, TRUE);

    RETURN v_pipeline_id;
END;
$$;

-- Creates a workspace with p_user_id as its admin, makes it their current workspace and
-- seeds the default pipeline. No permission checks.
CREATE OR REPLACE FUNCTION public._create_workspace(p_user_id UUID, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_name TEXT := left(COALESCE(NULLIF(btrim(p_name), ''), 'My workspace'), 100);
BEGIN
    INSERT INTO public.organizations (name, created_by)
    VALUES (v_name, p_user_id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'admin'::public.app_role);

    UPDATE public.profiles SET current_organization_id = v_org_id WHERE user_id = p_user_id;

    PERFORM public._seed_default_pipeline(v_org_id, p_user_id);
    RETURN v_org_id;
END;
$$;

-- Default workspace name for a user: profile.company, else "<first name>'s workspace".
CREATE OR REPLACE FUNCTION public._default_workspace_name(p_full_name TEXT, p_company TEXT, p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT left(COALESCE(
        NULLIF(btrim(p_company), ''),
        COALESCE(NULLIF(split_part(btrim(COALESCE(p_full_name, '')), ' ', 1), ''),
                 NULLIF(split_part(COALESCE(p_email, ''), '@', 1), ''),
                 'My') || '''s workspace'
    ), 100);
$$;

-- TRUE when p_token is a pending (unaccepted, unexpired) invitation addressed to p_email.
CREATE OR REPLACE FUNCTION public._invitation_valid_for(p_token TEXT, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.invitations i
        WHERE i.token = btrim(COALESCE(p_token, ''))
          AND i.accepted_at IS NULL
          AND i.expires_at > NOW()
          AND lower(btrim(i.email)) = lower(btrim(COALESCE(p_email, '')))
    );
$$;

-- Accepts invitation p_token on behalf of p_user_id (all validity checks, no caller checks).
-- Adds the membership, marks the invitation accepted, switches the user's current workspace.
CREATE OR REPLACE FUNCTION public._accept_invitation(p_user_id UUID, p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv RECORD;
    v_user RECORD;
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

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_inv.organization_id, p_user_id, v_inv.role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE public.invitations SET accepted_at = NOW() WHERE id = v_inv.id;
    UPDATE public.profiles SET current_organization_id = v_inv.organization_id WHERE user_id = p_user_id;

    RETURN v_inv.organization_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Signup: profile + (unless invited) a personal workspace
-- ------------------------------------------------------------------------------
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

    -- Signed up from a valid invitation: join that workspace instead of creating one.
    -- If the email is already confirmed (OAuth / autoconfirm) accept now; otherwise the
    -- invitation is accepted after sign-in (get_my_context / accept_invitation).
    v_token := NULLIF(btrim(COALESCE(v_meta->>'invite_token', '')), '');
    IF v_token IS NOT NULL AND public._invitation_valid_for(v_token, NEW.email) THEN
        IF NEW.email_confirmed_at IS NOT NULL THEN
            PERFORM public._accept_invitation(NEW.id, v_token);
        END IF;
        RETURN NEW;
    END IF;

    PERFORM public._create_workspace(NEW.id, public._default_workspace_name(v_full_name, v_company, NEW.email));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. Integrity triggers
-- ------------------------------------------------------------------------------

-- profiles.current_organization_id may only point at a workspace the user belongs to.
CREATE OR REPLACE FUNCTION public.guard_profile_current_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.current_organization_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.current_organization_id IS DISTINCT FROM OLD.current_organization_id)
       AND NOT EXISTS (SELECT 1 FROM public.organization_members m
                       WHERE m.organization_id = NEW.current_organization_id AND m.user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'You are not a member of that workspace.' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'profiles.user_id cannot be changed.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_current_org ON public.profiles;
CREATE TRIGGER trg_profiles_guard_current_org
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_current_org();

-- Rows may only reference rows (and users) of the same workspace.
CREATE OR REPLACE FUNCTION public.enforce_same_org_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := NEW.organization_id;
    v_ok BOOLEAN;
BEGIN
    IF TG_TABLE_NAME = 'pipeline_stages' THEN
        IF NOT EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = NEW.pipeline_id AND p.organization_id = v_org) THEN
            RAISE EXCEPTION 'Pipeline not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;

    ELSIF TG_TABLE_NAME = 'contacts' THEN
        IF NEW.company_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id AND c.organization_id = v_org) THEN
            RAISE EXCEPTION 'Company not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;

    ELSIF TG_TABLE_NAME = 'deals' THEN
        IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages s
                       WHERE s.id = NEW.stage_id AND s.pipeline_id = NEW.pipeline_id AND s.organization_id = v_org) THEN
            RAISE EXCEPTION 'Stage not found in this pipeline.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.company_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id AND c.organization_id = v_org) THEN
            RAISE EXCEPTION 'Company not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.contact_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.organization_id = v_org) THEN
            RAISE EXCEPTION 'Contact not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.owner_id IS NOT NULL
           AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
           AND NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = v_org AND m.user_id = NEW.owner_id) THEN
            RAISE EXCEPTION 'The deal owner must be a member of this workspace.' USING ERRCODE = 'P0001';
        END IF;

    ELSIF TG_TABLE_NAME IN ('activities', 'tasks') THEN
        IF NEW.deal_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.id = NEW.deal_id AND d.organization_id = v_org) THEN
            RAISE EXCEPTION 'Deal not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.contact_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.organization_id = v_org) THEN
            RAISE EXCEPTION 'Contact not found in this workspace.' USING ERRCODE = 'P0001';
        END IF;
        IF TG_TABLE_NAME = 'tasks' THEN
            v_ok := NEW.assigned_to IS NULL
                 OR (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to)
                 OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = v_org AND m.user_id = NEW.assigned_to);
            IF NOT v_ok THEN
                RAISE EXCEPTION 'Tasks can only be assigned to members of this workspace.' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_same_org ON public.pipeline_stages;
CREATE TRIGGER trg_00_same_org BEFORE INSERT OR UPDATE ON public.pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_references();
DROP TRIGGER IF EXISTS trg_00_same_org ON public.contacts;
CREATE TRIGGER trg_00_same_org BEFORE INSERT OR UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_references();
DROP TRIGGER IF EXISTS trg_00_same_org ON public.deals;
CREATE TRIGGER trg_00_same_org BEFORE INSERT OR UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_references();
DROP TRIGGER IF EXISTS trg_00_same_org ON public.activities;
CREATE TRIGGER trg_00_same_org BEFORE INSERT OR UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_references();
DROP TRIGGER IF EXISTS trg_00_same_org ON public.tasks;
CREATE TRIGGER trg_00_same_org BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_references();

-- A stage that still has deals can't be deleted (deals.stage_id FK is NO ACTION; this gives a
-- readable message). Cascaded deletes (whole pipeline / workspace) are not blocked here.
CREATE OR REPLACE FUNCTION public.guard_stage_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF pg_catalog.pg_trigger_depth() = 1
       AND EXISTS (SELECT 1 FROM public.deals d WHERE d.stage_id = OLD.id) THEN
        RAISE EXCEPTION 'This stage still has deals. Move them to another stage before deleting it.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_stages_guard_delete ON public.pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_guard_delete
    BEFORE DELETE ON public.pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION public.guard_stage_delete();

-- ------------------------------------------------------------------------------
-- 4. Deals: close timestamps, audit log, notifications
--    BEFORE trigger so won_at / lost_at are written on the row itself.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_deal_changes_and_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_stage_name TEXT;
    v_is_won BOOLEAN := FALSE;
    v_is_lost BOOLEAN := FALSE;
    v_old_is_lost BOOLEAN := FALSE;
    v_stage_changed BOOLEAN := (TG_OP = 'INSERT') OR (NEW.stage_id IS DISTINCT FROM OLD.stage_id);
    v_wants_stage_notice BOOLEAN;
BEGIN
    IF v_stage_changed THEN
        SELECT s.name, s.is_won, s.is_lost INTO v_stage_name, v_is_won, v_is_lost
        FROM public.pipeline_stages s WHERE s.id = NEW.stage_id;
        v_is_won := COALESCE(v_is_won, FALSE);
        v_is_lost := COALESCE(v_is_lost, FALSE);

        IF v_is_won THEN
            -- Keep an explicitly supplied timestamp (e.g. imported/sample data), else stamp now.
            NEW.won_at := COALESCE(CASE WHEN TG_OP = 'INSERT' OR NEW.won_at IS DISTINCT FROM OLD.won_at THEN NEW.won_at END, NOW());
            NEW.lost_at := NULL;
        ELSIF v_is_lost THEN
            NEW.lost_at := COALESCE(CASE WHEN TG_OP = 'INSERT' OR NEW.lost_at IS DISTINCT FROM OLD.lost_at THEN NEW.lost_at END, NOW());
            NEW.won_at := NULL;
        ELSE
            NEW.won_at := NULL;
            NEW.lost_at := NULL;
            -- Re-opened deals drop a stale loss reason (unless this same update sets one).
            IF TG_OP = 'UPDATE' AND NEW.lost_reason IS NOT DISTINCT FROM OLD.lost_reason THEN
                SELECT s.is_lost INTO v_old_is_lost FROM public.pipeline_stages s WHERE s.id = OLD.stage_id;
                IF COALESCE(v_old_is_lost, FALSE) THEN
                    NEW.lost_reason := NULL;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Updates issued by FK actions (e.g. owner_id SET NULL while a user account is being
    -- deleted) or other triggers are not user edits: no audit rows or notifications.
    IF TG_OP = 'UPDATE' AND pg_catalog.pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Tell a teammate when a deal is created for them.
        IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM v_actor THEN
            INSERT INTO public.notifications (user_id, organization_id, title, message, type, reference_id, reference_type)
            VALUES (NEW.owner_id, NEW.organization_id, 'New deal assigned',
                    'You are the owner of "' || NEW.title || '".', 'info', NEW.id::text, 'deal');
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: audit trail
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
        INSERT INTO public.deal_audit_log (deal_id, organization_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, NEW.organization_id, v_actor, 'stage_id', OLD.stage_id::text, NEW.stage_id::text);
    END IF;
    IF NEW.value IS DISTINCT FROM OLD.value THEN
        INSERT INTO public.deal_audit_log (deal_id, organization_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, NEW.organization_id, v_actor, 'value', OLD.value::text, NEW.value::text);
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        INSERT INTO public.deal_audit_log (deal_id, organization_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, NEW.organization_id, v_actor, 'owner_id', OLD.owner_id::text, NEW.owner_id::text);
    END IF;
    IF NEW.lost_reason IS DISTINCT FROM OLD.lost_reason AND NEW.lost_reason IS NOT NULL THEN
        INSERT INTO public.deal_audit_log (deal_id, organization_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, NEW.organization_id, v_actor, 'lost_reason', OLD.lost_reason, NEW.lost_reason);
    END IF;

    -- Notify the owner when their deal is won or lost (respecting their preference).
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.owner_id IS NOT NULL
       AND (v_is_won OR v_is_lost) THEN
        SELECT COALESCE((p.notification_preferences->>'deal_stage_changes')::boolean, TRUE)
          INTO v_wants_stage_notice
          FROM public.profiles p WHERE p.user_id = NEW.owner_id;

        IF COALESCE(v_wants_stage_notice, TRUE) THEN
            IF v_is_won THEN
                INSERT INTO public.notifications (user_id, organization_id, title, message, type, reference_id, reference_type)
                VALUES (NEW.owner_id, NEW.organization_id, 'Deal won',
                        '"' || NEW.title || '" was marked as won.', 'success', NEW.id::text, 'deal');
            ELSE
                INSERT INTO public.notifications (user_id, organization_id, title, message, type, reference_id, reference_type)
                VALUES (NEW.owner_id, NEW.organization_id, 'Deal lost',
                        '"' || NEW.title || '" was moved to ' || COALESCE(v_stage_name, 'Lost') || '.', 'warning', NEW.id::text, 'deal');
            END IF;
        END IF;
    END IF;

    -- Notify a new owner (unless they reassigned it to themselves).
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id AND NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM v_actor THEN
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, reference_id, reference_type)
        VALUES (NEW.owner_id, NEW.organization_id, 'Deal assigned to you',
                'You are now the owner of "' || NEW.title || '".', 'info', NEW.id::text, 'deal');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_audit_notify ON public.deals;
CREATE TRIGGER trg_deal_audit_notify
    BEFORE INSERT OR UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.log_deal_changes_and_notify();

-- Tasks: notify the assignee when someone else assigns them a task
-- (respects the assignee's task_reminders preference; missing key = enabled).
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to IS DISTINCT FROM auth.uid()
       AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
       AND COALESCE((SELECT (p.notification_preferences->>'task_reminders')::boolean
                     FROM public.profiles p WHERE p.user_id = NEW.assigned_to), TRUE) THEN
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, reference_id, reference_type)
        VALUES (NEW.assigned_to, NEW.organization_id, 'Task assigned to you',
                '"' || NEW.title || '"', 'info', NEW.id::text, 'task');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assignment_notify ON public.tasks;
CREATE TRIGGER trg_task_assignment_notify
    AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- ------------------------------------------------------------------------------
-- 5. Client RPCs
-- ------------------------------------------------------------------------------

-- The caller's current workspace + role. Repairs accounts without a workspace: creates the
-- profile if missing, accepts a still-valid invitation from signup metadata (invite_token),
-- and only otherwise creates a personal workspace.
CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS TABLE (
    organization_id UUID,
    organization_name TEXT,
    monthly_quota NUMERIC,
    currency TEXT,
    role public.app_role
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

    -- Serialise per user so two tabs can't both create a workspace.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_ctx:' || v_uid::text, 0));

    SELECT u.email, u.raw_user_meta_data INTO v_user FROM auth.users u WHERE u.id = v_uid;

    INSERT INTO public.profiles (user_id, full_name)
    VALUES (v_uid, left(COALESCE(NULLIF(btrim(v_user.raw_user_meta_data->>'full_name'), ''),
                                 split_part(COALESCE(v_user.email, ''), '@', 1)), 200))
    ON CONFLICT (user_id) DO NOTHING;

    v_org := public.current_org_id();

    -- No workspace yet: join the workspace from the signup invitation if it is still valid.
    IF v_org IS NULL THEN
        v_token := NULLIF(btrim(COALESCE(v_user.raw_user_meta_data->>'invite_token', '')), '');
        IF v_token IS NOT NULL AND public._invitation_valid_for(v_token, v_user.email) THEN
            BEGIN
                v_org := public._accept_invitation(v_uid, v_token);
            EXCEPTION WHEN OTHERS THEN
                v_org := NULL; -- e.g. email not confirmed yet: fall through to a personal workspace
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
    SELECT o.id, o.name, o.monthly_quota, o.currency, m.role
    FROM public.organizations o
    JOIN public.organization_members m ON m.organization_id = o.id AND m.user_id = v_uid
    WHERE o.id = v_org;
END;
$$;

-- Accepts an invitation for the signed-in user (email must match, case-insensitive, and be confirmed).
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    RETURN public._accept_invitation(auth.uid(), p_token);
END;
$$;

-- Public (anon) preview of an invitation for the /invite/:token page. The token is the secret.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token TEXT)
RETURNS TABLE (
    organization_name TEXT,
    email TEXT,
    role public.app_role,
    expired BOOLEAN,
    accepted BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT o.name, i.email, i.role, (i.expires_at < NOW()), (i.accepted_at IS NOT NULL)
    FROM public.invitations i
    JOIN public.organizations o ON o.id = i.organization_id
    WHERE char_length(COALESCE(p_token, '')) BETWEEN 32 AND 200
      AND i.token = p_token;
$$;

-- Admins/managers invite a teammate to the current workspace (7-day link).
-- search_path includes `extensions` because Supabase installs pgcrypto (gen_random_bytes) there.
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
    v_my_role public.app_role;
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_role public.app_role := COALESCE(p_role, 'rep'::public.app_role);
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
    IF char_length(v_email) > 320 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.organization_members m
               JOIN auth.users u ON u.id = m.user_id
               WHERE m.organization_id = v_org AND lower(u.email) = v_email) THEN
        RAISE EXCEPTION 'That person is already a member of this workspace.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.invitations i
        WHERE i.organization_id = v_org AND i.accepted_at IS NULL AND i.expires_at > NOW()) >= 100 THEN
        RAISE EXCEPTION 'Too many pending invitations. Revoke some before inviting more people.' USING ERRCODE = 'P0001';
    END IF;

    -- Re-inviting replaces the previous pending invitation (old link stops working).
    DELETE FROM public.invitations i
    WHERE i.organization_id = v_org AND lower(i.email) = v_email AND i.accepted_at IS NULL;

    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.invitations (organization_id, email, role, token, invited_by, expires_at)
    VALUES (v_org, v_email, v_role, v_token, v_uid, NOW() + INTERVAL '7 days')
    RETURNING invitations.id INTO v_id;

    RETURN QUERY SELECT v_id, v_token;
END;
$$;

-- Admin: change a member's role in the current workspace. The last admin can't be demoted.
CREATE OR REPLACE FUNCTION public.update_member_role(p_user_id UUID, p_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_target_role public.app_role;
    v_admins INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins can change roles.' USING ERRCODE = 'P0001';
    END IF;
    IF p_role IS NULL THEN
        RAISE EXCEPTION 'Choose a role.' USING ERRCODE = 'P0001';
    END IF;

    -- Lock the workspace's memberships so concurrent demotions can't both pass the check.
    PERFORM 1 FROM public.organization_members m WHERE m.organization_id = v_org FOR UPDATE;

    SELECT m.role INTO v_target_role FROM public.organization_members m
    WHERE m.organization_id = v_org AND m.user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That person is not a member of this workspace.' USING ERRCODE = 'P0001';
    END IF;

    IF v_target_role = 'admin'::public.app_role AND p_role <> 'admin'::public.app_role THEN
        SELECT count(*) INTO v_admins FROM public.organization_members m
        WHERE m.organization_id = v_org AND m.role = 'admin'::public.app_role;
        IF v_admins <= 1 THEN
            RAISE EXCEPTION 'You are the last admin of this workspace. Promote someone else first.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    UPDATE public.organization_members m SET role = p_role
    WHERE m.organization_id = v_org AND m.user_id = p_user_id;
END;
$$;

-- Admin: remove a member from the current workspace. Their records stay with the workspace.
CREATE OR REPLACE FUNCTION public.remove_member(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_target_role public.app_role;
    v_admins INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins can remove members.' USING ERRCODE = 'P0001';
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

    DELETE FROM public.organization_members m WHERE m.organization_id = v_org AND m.user_id = p_user_id;
    DELETE FROM public.notifications n WHERE n.organization_id = v_org AND n.user_id = p_user_id;

    UPDATE public.profiles p
    SET current_organization_id = (SELECT m.organization_id FROM public.organization_members m
                                   WHERE m.user_id = p_user_id ORDER BY m.joined_at LIMIT 1)
    WHERE p.user_id = p_user_id AND p.current_organization_id = v_org;
END;
$$;

-- Admin: rename the workspace / set quota & currency. NULL arguments keep the current value.
CREATE OR REPLACE FUNCTION public.update_organization(p_name TEXT, p_monthly_quota NUMERIC, p_currency TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_name TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
    v_currency TEXT := upper(NULLIF(btrim(COALESCE(p_currency, '')), ''));
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins can change workspace settings.' USING ERRCODE = 'P0001';
    END IF;
    IF v_name IS NOT NULL AND char_length(v_name) > 100 THEN
        RAISE EXCEPTION 'Workspace name must be 100 characters or fewer.' USING ERRCODE = 'P0001';
    END IF;
    IF p_monthly_quota IS NOT NULL AND (p_monthly_quota < 0 OR p_monthly_quota > 999999999999) THEN
        RAISE EXCEPTION 'Monthly quota must be zero or a positive amount.' USING ERRCODE = 'P0001';
    END IF;
    IF v_currency IS NOT NULL AND v_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Currency must be a 3-letter ISO code such as USD.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.organizations o
    SET name = COALESCE(v_name, o.name),
        monthly_quota = COALESCE(p_monthly_quota, o.monthly_quota),
        currency = COALESCE(v_currency, o.currency)
    WHERE o.id = v_org;
END;
$$;

-- Members of the current workspace (any member may call).
CREATE OR REPLACE FUNCTION public.list_members()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    job_title TEXT,
    role public.app_role,
    joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT m.user_id, p.full_name, u.email::text, p.avatar_url, p.job_title, m.role, m.joined_at
    FROM public.organization_members m
    JOIN auth.users u ON u.id = m.user_id
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    WHERE auth.uid() IS NOT NULL
      AND m.organization_id = public.current_org_id()
    ORDER BY lower(COALESCE(p.full_name, u.email::text)), m.joined_at;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    UPDATE public.profiles SET onboarding_completed_at = NOW()
    WHERE user_id = auth.uid() AND onboarding_completed_at IS NULL;
END;
$$;

-- Deletes the caller's account. Workspaces where they are the only member are deleted with
-- them; blocked while they are the last admin of a workspace that has other members.
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

    -- Cascades to profile, memberships, notifications, email templates, AI usage;
    -- shared records keep their data with created_by/owner_id set to NULL.
    DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Returns the workspace's first pipeline, creating the default one (admins/managers) if none exists.
CREATE OR REPLACE FUNCTION public.seed_default_pipeline(p_org_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_org UUID := COALESCE(p_org_id, public.current_org_id());
    v_pipeline_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.is_org_member(v_org) THEN
        RAISE EXCEPTION 'You are not a member of that workspace.' USING ERRCODE = 'P0001';
    END IF;

    SELECT p.id INTO v_pipeline_id FROM public.pipelines p
    WHERE p.organization_id = v_org ORDER BY p.created_at LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
        RETURN v_pipeline_id;
    END IF;

    IF NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role, 'manager'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins and managers can create pipelines.' USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_pipeline:' || v_org::text, 0));
    RETURN public._seed_default_pipeline(v_org, v_uid);
END;
$$;

-- Atomic stage reordering: p_stages = [{ "id": uuid, "position": int }, ...]. Admins/managers only.
CREATE OR REPLACE FUNCTION public.reorder_pipeline_stages(p_stages JSONB)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_item JSONB;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF v_org IS NULL OR NOT public.has_org_role(v_org, ARRAY['admin'::public.app_role, 'manager'::public.app_role]) THEN
        RAISE EXCEPTION 'Only admins and managers can reorder stages.' USING ERRCODE = 'P0001';
    END IF;
    IF p_stages IS NULL OR jsonb_typeof(p_stages) <> 'array' THEN
        RAISE EXCEPTION 'p_stages must be a JSON array.' USING ERRCODE = 'P0001';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_stages) LOOP
        UPDATE public.pipeline_stages s
        SET position = (v_item->>'position')::INTEGER
        WHERE s.id = (v_item->>'id')::UUID AND s.organization_id = v_org;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Stage % not found in this workspace.', v_item->>'id' USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
END;
$$;

-- Dashboard KPIs for the current workspace (won/lost from stage flags, not names).
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_since TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    v_since := NOW() - make_interval(days => LEAST(GREATEST(COALESCE(p_period_days, 30), 1), 3650));

    WITH filtered_deals AS (
        SELECT d.id, COALESCE(d.value, 0) AS value, d.stage_id, s.is_won, s.is_lost
        FROM public.deals d
        JOIN public.pipeline_stages s ON s.id = d.stage_id
        WHERE d.organization_id = v_org AND d.created_at >= v_since
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

-- Command-K search across the current workspace. LIKE wildcards in the term are escaped.
CREATE OR REPLACE FUNCTION public.global_search(search_term TEXT, max_results INT DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org UUID := public.current_org_id();
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

    v_pattern := '%' || replace(replace(replace(left(v_term, 200), '\', '\\'), '%', '\%'), '_', '\_') || '%';

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_deals FROM (
        SELECT d.id, d.title, d.value FROM public.deals d
        WHERE d.organization_id = v_org AND d.title ILIKE v_pattern
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
        ORDER BY a.created_at DESC LIMIT v_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_tasks FROM (
        SELECT t.id, t.title, t.priority, t.completed, t.due_date FROM public.tasks t
        WHERE t.organization_id = v_org AND t.title ILIKE v_pattern
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
-- 6. Service-role only: atomic per-user AI rate limit used by the ai-chat edge function.
--    Returns allowed=false with retry_after_seconds when over the limit; otherwise
--    records the request and returns allowed=true.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
    p_user_id UUID,
    p_per_minute INT DEFAULT 20,
    p_per_day INT DEFAULT 300,
    p_model TEXT DEFAULT NULL
)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INT, usage_id UUID)
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
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('goom_ai:' || p_user_id::text, 0));

    -- Opportunistic cleanup of this user's old rows.
    DELETE FROM public.ai_usage a WHERE a.user_id = p_user_id AND a.created_at < NOW() - INTERVAL '2 days';

    SELECT count(*) INTO v_minute_count FROM public.ai_usage a
    WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 minute';
    IF v_minute_count >= p_per_minute THEN
        SELECT min(a.created_at) INTO v_oldest FROM public.ai_usage a
        WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 minute';
        RETURN QUERY SELECT FALSE, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + INTERVAL '1 minute' - NOW())))::INT), NULL::UUID;
        RETURN;
    END IF;

    SELECT count(*) INTO v_day_count FROM public.ai_usage a
    WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 day';
    IF v_day_count >= p_per_day THEN
        SELECT min(a.created_at) INTO v_oldest FROM public.ai_usage a
        WHERE a.user_id = p_user_id AND a.created_at > NOW() - INTERVAL '1 day';
        RETURN QUERY SELECT FALSE, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + INTERVAL '1 day' - NOW())))::INT), NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.ai_usage (user_id, organization_id, model)
    VALUES (p_user_id, public.user_current_org_id(p_user_id), p_model)
    RETURNING id INTO v_id;

    RETURN QUERY SELECT TRUE, 0, v_id;
END;
$$;
