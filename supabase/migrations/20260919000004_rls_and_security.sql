-- ==============================================================================
-- 04: Row Level Security (RLS) & Collaborative Access Policies
-- ==============================================================================

-- 1. Enable RLS on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 3. User Roles Policies
DROP POLICY IF EXISTS "Roles are viewable by authenticated users" ON public.user_roles;
CREATE POLICY "Roles are viewable by authenticated users"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Teams & Team Members Policies
DROP POLICY IF EXISTS "Teams are viewable by authenticated users" ON public.teams;
CREATE POLICY "Teams are viewable by authenticated users"
    ON public.teams FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
CREATE POLICY "Authenticated users can create teams"
    ON public.teams FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Team creators or admins can update teams" ON public.teams;
CREATE POLICY "Team creators or admins can update teams"
    ON public.teams FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Team members viewable by authenticated users" ON public.team_members;
CREATE POLICY "Team members viewable by authenticated users"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins or team creators can manage team members" ON public.team_members;
CREATE POLICY "Admins or team creators can manage team members"
    ON public.team_members FOR ALL
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR
        EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND created_by = auth.uid())
    );

-- 5. Pipelines & Pipeline Stages Policies
DROP POLICY IF EXISTS "Pipelines viewable by authenticated users" ON public.pipelines;
CREATE POLICY "Pipelines viewable by authenticated users"
    ON public.pipelines FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create pipelines" ON public.pipelines;
CREATE POLICY "Authenticated users can create pipelines"
    ON public.pipelines FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Pipeline owners or admins can update pipelines" ON public.pipelines;
CREATE POLICY "Pipeline owners or admins can update pipelines"
    ON public.pipelines FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pipeline owners or admins can delete pipelines" ON public.pipelines;
CREATE POLICY "Pipeline owners or admins can delete pipelines"
    ON public.pipelines FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pipeline stages viewable by authenticated users" ON public.pipeline_stages;
CREATE POLICY "Pipeline stages viewable by authenticated users"
    ON public.pipeline_stages FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Authenticated users can manage pipeline stages"
    ON public.pipeline_stages FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Companies Policies
DROP POLICY IF EXISTS "Companies viewable by authenticated users" ON public.companies;
CREATE POLICY "Companies viewable by authenticated users"
    ON public.companies FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
    ON public.companies FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
CREATE POLICY "Authenticated users can update companies"
    ON public.companies FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Creators or admins can delete companies" ON public.companies;
CREATE POLICY "Creators or admins can delete companies"
    ON public.companies FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- 7. Contacts Policies
DROP POLICY IF EXISTS "Contacts viewable by authenticated users" ON public.contacts;
CREATE POLICY "Contacts viewable by authenticated users"
    ON public.contacts FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create contacts" ON public.contacts;
CREATE POLICY "Authenticated users can create contacts"
    ON public.contacts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
CREATE POLICY "Authenticated users can update contacts"
    ON public.contacts FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Creators or admins can delete contacts" ON public.contacts;
CREATE POLICY "Creators or admins can delete contacts"
    ON public.contacts FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- 8. Deals Policies
DROP POLICY IF EXISTS "Deals viewable by authenticated users" ON public.deals;
CREATE POLICY "Deals viewable by authenticated users"
    ON public.deals FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create deals" ON public.deals;
CREATE POLICY "Authenticated users can create deals"
    ON public.deals FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can update deals" ON public.deals;
CREATE POLICY "Authenticated users can update deals"
    ON public.deals FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Owners, creators or admins can delete deals" ON public.deals;
CREATE POLICY "Owners, creators or admins can delete deals"
    ON public.deals FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- 9. Deal Audit Log Policies
DROP POLICY IF EXISTS "Deal audit log viewable by authenticated users" ON public.deal_audit_log;
CREATE POLICY "Deal audit log viewable by authenticated users"
    ON public.deal_audit_log FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert deal audit entries" ON public.deal_audit_log;
CREATE POLICY "Authenticated users can insert deal audit entries"
    ON public.deal_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 10. Activities Policies
DROP POLICY IF EXISTS "Activities viewable by authenticated users" ON public.activities;
CREATE POLICY "Activities viewable by authenticated users"
    ON public.activities FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create activities" ON public.activities;
CREATE POLICY "Authenticated users can create activities"
    ON public.activities FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Activity creators or admins can update activities" ON public.activities;
CREATE POLICY "Activity creators or admins can update activities"
    ON public.activities FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Activity creators or admins can delete activities" ON public.activities;
CREATE POLICY "Activity creators or admins can delete activities"
    ON public.activities FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 11. Tasks Policies
DROP POLICY IF EXISTS "Tasks viewable by authenticated users" ON public.tasks;
CREATE POLICY "Tasks viewable by authenticated users"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
CREATE POLICY "Authenticated users can create tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
CREATE POLICY "Authenticated users can update tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Task owners or admins can delete tasks" ON public.tasks;
CREATE POLICY "Task owners or admins can delete tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 12. Notifications Policies
DROP POLICY IF EXISTS "Users can only view their own notifications" ON public.notifications;
CREATE POLICY "Users can only view their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 13. Email Templates Policies
DROP POLICY IF EXISTS "Users can view their email templates" ON public.email_templates;
CREATE POLICY "Users can view their email templates"
    ON public.email_templates FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email templates" ON public.email_templates;
CREATE POLICY "Users can insert their own email templates"
    ON public.email_templates FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email templates" ON public.email_templates;
CREATE POLICY "Users can update their own email templates"
    ON public.email_templates FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own email templates" ON public.email_templates;
CREATE POLICY "Users can delete their own email templates"
    ON public.email_templates FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
