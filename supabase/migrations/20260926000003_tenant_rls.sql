-- ==============================================================================
-- 20260926000003: Row Level Security rewrite + function/table privileges
--
-- Production may have had loose scripts applied (fixes.sql etc.), so policy names are
-- unknown: every policy on every public table is dropped and recreated here.
-- Storage (avatars) policies live in the storage schema and are left untouched.
--
-- Conventions: `(select public.current_org_id())` / `(select auth.uid())` are wrapped in
-- scalar subqueries so Postgres evaluates them once per statement, not once per row.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop every existing policy in public, enable RLS on every public table
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;

    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Workspace tables
-- ------------------------------------------------------------------------------
CREATE POLICY "Members can view their workspaces" ON public.organizations
    FOR SELECT TO authenticated
    USING (public.is_org_member(id));
-- Writes: update_organization() / signup trigger only.

CREATE POLICY "Members can view members of their workspaces" ON public.organization_members
    FOR SELECT TO authenticated
    USING (public.is_org_member(organization_id));
-- Writes: accept_invitation(), update_member_role(), remove_member() only.

CREATE POLICY "Admins and managers can view invitations" ON public.invitations
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (SELECT public.current_org_role()) IN ('admin', 'manager')
    );

CREATE POLICY "Admins and managers can revoke invitations" ON public.invitations
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (SELECT public.current_org_role()) IN ('admin', 'manager')
    );
-- Inserts: create_invitation() only.

-- ------------------------------------------------------------------------------
-- 3. Profiles & legacy roles
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view profiles of their teammates" ON public.profiles
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.shares_org_with(user_id));

CREATE POLICY "Users can create their own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
-- current_organization_id changes are validated by trg_profiles_guard_current_org.

CREATE POLICY "Users can view their own legacy roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- teams / team_members are legacy and unused: RLS on, no policies (no client access).

-- ------------------------------------------------------------------------------
-- 4. Pipelines & stages: members read, admins/managers modify
-- ------------------------------------------------------------------------------
CREATE POLICY "Members can view pipelines" ON public.pipelines
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));

CREATE POLICY "Admins and managers can create pipelines" ON public.pipelines
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = (SELECT public.current_org_id())
        AND (SELECT public.current_org_role()) IN ('admin', 'manager')
        AND created_by = (SELECT auth.uid())
    );

CREATE POLICY "Admins and managers can update pipelines" ON public.pipelines
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'))
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'));

CREATE POLICY "Admins and managers can delete pipelines" ON public.pipelines
    FOR DELETE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'));

CREATE POLICY "Members can view pipeline stages" ON public.pipeline_stages
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));

CREATE POLICY "Admins and managers can create pipeline stages" ON public.pipeline_stages
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'));

CREATE POLICY "Admins and managers can update pipeline stages" ON public.pipeline_stages
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'))
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'));

CREATE POLICY "Admins and managers can delete pipeline stages" ON public.pipeline_stages
    FOR DELETE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) IN ('admin', 'manager'));

-- ------------------------------------------------------------------------------
-- 5. Shared records: members read/insert/update; creator/owner or admin/manager delete
-- ------------------------------------------------------------------------------
-- Companies
CREATE POLICY "Members can view companies" ON public.companies
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Members can create companies" ON public.companies
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY "Members can update companies" ON public.companies
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()))
    WITH CHECK (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Creators, admins and managers can delete companies" ON public.companies
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (created_by = (SELECT auth.uid()) OR (SELECT public.current_org_role()) IN ('admin', 'manager'))
    );

-- Contacts
CREATE POLICY "Members can view contacts" ON public.contacts
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Members can create contacts" ON public.contacts
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY "Members can update contacts" ON public.contacts
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()))
    WITH CHECK (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Creators, admins and managers can delete contacts" ON public.contacts
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (created_by = (SELECT auth.uid()) OR (SELECT public.current_org_role()) IN ('admin', 'manager'))
    );

-- Deals
CREATE POLICY "Members can view deals" ON public.deals
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Members can create deals" ON public.deals
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY "Members can update deals" ON public.deals
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()))
    WITH CHECK (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Owners, creators, admins and managers can delete deals" ON public.deals
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (owner_id = (SELECT auth.uid())
             OR created_by = (SELECT auth.uid())
             OR (SELECT public.current_org_role()) IN ('admin', 'manager'))
    );

-- Activities
CREATE POLICY "Members can view activities" ON public.activities
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Members can create activities" ON public.activities
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Members can update activities" ON public.activities
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()))
    WITH CHECK (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Authors, admins and managers can delete activities" ON public.activities
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (user_id = (SELECT auth.uid()) OR (SELECT public.current_org_role()) IN ('admin', 'manager'))
    );

-- Tasks
CREATE POLICY "Members can view tasks" ON public.tasks
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Members can create tasks" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Members can update tasks" ON public.tasks
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()))
    WITH CHECK (organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Creators, assignees, admins and managers can delete tasks" ON public.tasks
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT public.current_org_id())
        AND (user_id = (SELECT auth.uid())
             OR assigned_to = (SELECT auth.uid())
             OR (SELECT public.current_org_role()) IN ('admin', 'manager'))
    );

-- Deal audit log: read-only for members; written by the deals trigger only.
CREATE POLICY "Members can view the deal audit log" ON public.deal_audit_log
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()));

-- ------------------------------------------------------------------------------
-- 6. Personal rows
-- ------------------------------------------------------------------------------
-- Email templates are personal (and are deleted with the user).
CREATE POLICY "Users can view their email templates" ON public.email_templates
    FOR SELECT TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Users can create their email templates" ON public.email_templates
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update their email templates" ON public.email_templates
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()))
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete their email templates" ON public.email_templates
    FOR DELETE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND user_id = (SELECT auth.uid()));

-- Notifications: own only, no client INSERT (created by triggers).
CREATE POLICY "Users can view their notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Users can update their notifications" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND organization_id = (SELECT public.current_org_id()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Users can delete their notifications" ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND organization_id = (SELECT public.current_org_id()));

-- Feedback: submit as yourself; read your own; workspace admins triage their workspace's feedback.
CREATE POLICY "Users can submit feedback" ON public.feedback
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND organization_id = (SELECT public.current_org_id()));
CREATE POLICY "Users see own feedback, admins see workspace feedback" ON public.feedback
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) = 'admin')
    );
CREATE POLICY "Admins can update workspace feedback" ON public.feedback
    FOR UPDATE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) = 'admin')
    WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) = 'admin');
CREATE POLICY "Admins can delete workspace feedback" ON public.feedback
    FOR DELETE TO authenticated
    USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_org_role()) = 'admin');

-- ------------------------------------------------------------------------------
-- 7. Marketing contact form: insert only (anon + authenticated), no reads.
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can submit a contact request" ON public.contact_requests
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        char_length(btrim(name)) BETWEEN 1 AND 100
        AND char_length(btrim(email)) BETWEEN 3 AND 254
        AND (company IS NULL OR char_length(company) <= 120)
        AND char_length(btrim(message)) BETWEEN 1 AND 5000
    );

-- ai_usage: no policies (service role only).

-- ------------------------------------------------------------------------------
-- 8. Table privileges (defence in depth on top of RLS)
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT INSERT ON public.contact_requests TO anon;

-- TRUNCATE bypasses RLS; REFERENCES/TRIGGER are never needed by API clients.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.organizations, public.organization_members, public.user_roles,
    public.deal_audit_log, public.teams, public.team_members FROM authenticated;
REVOKE INSERT, UPDATE ON public.invitations FROM authenticated;
REVOKE SELECT, UPDATE, DELETE ON public.contact_requests FROM authenticated;
REVOKE INSERT ON public.notifications FROM authenticated;
REVOKE DELETE ON public.profiles FROM authenticated;
REVOKE ALL ON public.ai_usage FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 9. Function privileges: nothing in public is callable unless granted below.
--    Extension-owned functions (pg_trgm, ...) are left alone.
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

-- Future functions created by the migration role are not executable by PUBLIC/anon by default.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Helpers evaluated inside RLS policies / column defaults run as the caller: authenticated needs them.
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Client RPCs
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

-- The invitation token is the secret: the /invite/:token page previews it before sign-in.
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO anon, authenticated;

-- consume_ai_quota and all _internal / trigger functions: service_role only (granted above).

-- ------------------------------------------------------------------------------
-- 10. Realtime: make sure the live-updating tables are published (no-op if already there).
--     Realtime delivers postgres_changes only for rows the subscriber can SELECT under RLS.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_tbl TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        RETURN;
    END IF;
    FOREACH v_tbl IN ARRAY ARRAY['notifications', 'deals', 'activities', 'tasks', 'pipeline_stages'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
        END IF;
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', v_tbl);
    END LOOP;
END $$;
