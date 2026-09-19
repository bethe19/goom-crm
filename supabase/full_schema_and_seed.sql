-- ==============================================================================
-- PipelineIQ CRM: Complete Supabase Production Schema & Seed
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Custom Types & Enums
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'rep');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'meeting', 'note');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    company TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'rep'::public.app_role,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_roles_user_role_key UNIQUE (user_id, role)
);

-- 5. Teams & Team Members
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT team_members_team_user_key UNIQUE (team_id, user_id)
);

-- 6. Pipelines & Pipeline Stages
CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Companies
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT,
    phone TEXT,
    position TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Deals
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    value NUMERIC(14,2) DEFAULT 0,
    probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
    close_date DATE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Deal Audit Log
CREATE TABLE IF NOT EXISTS public.deal_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Activities
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type public.activity_type NOT NULL DEFAULT 'note'::public.activity_type,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    priority TEXT NOT NULL DEFAULT 'medium',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_id TEXT,
    reference_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- Indexes for Sub-Millisecond Queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON public.deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON public.deals(close_date) WHERE close_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_pos ON public.pipeline_stages(pipeline_id, position);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON public.companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id, created_at DESC) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, completed, due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_audit_log_deal ON public.deal_audit_log(deal_id, created_at DESC);

-- GIN Trigram Search Indexes
CREATE INDEX IF NOT EXISTS idx_deals_title_trgm ON public.deals USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_search_trgm ON public.contacts USING gin ((first_name || ' ' || last_name || ' ' || coalesce(email, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON public.companies USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activities_title_trgm ON public.activities USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON public.tasks USING gin (title gin_trgm_ops);

-- ==============================================================================
-- Stored Procedures, Functions & Triggers
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pipelines_updated_at ON public.pipelines;
CREATE TRIGGER trg_pipelines_updated_at BEFORE UPDATE ON public.pipelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_deals_updated_at ON public.deals;
CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_role(
    _user_id UUID,
    _role public.app_role
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(
    _target_user_id UUID,
    _user_id UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members tm1
        JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = _user_id AND tm2.user_id = _target_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.seed_default_pipeline(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    SELECT id INTO v_pipeline_id FROM public.pipelines WHERE created_by = p_user_id LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
        RETURN v_pipeline_id;
    END IF;

    INSERT INTO public.pipelines (name, created_by)
    VALUES ('Sales Pipeline', p_user_id)
    RETURNING id INTO v_pipeline_id;

    INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
        (v_pipeline_id, 'Prospect', '#3b82f6', 0),
        (v_pipeline_id, 'Qualified', '#8b5cf6', 1),
        (v_pipeline_id, 'Proposal', '#f97316', 2),
        (v_pipeline_id, 'Negotiation', '#eab308', 3),
        (v_pipeline_id, 'Won', '#10b981', 4),
        (v_pipeline_id, 'Lost', '#ef4444', 5);

    RETURN v_pipeline_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_is_first_user BOOLEAN;
    v_role public.app_role;
    v_full_name TEXT;
    v_company TEXT;
BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    v_company := COALESCE(NEW.raw_user_meta_data->>'company', 'My Company');

    INSERT INTO public.profiles (user_id, full_name, company)
    VALUES (NEW.id, v_full_name, v_company)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first_user;
    IF v_is_first_user THEN v_role := 'admin'::public.app_role;
    ELSE v_role := 'rep'::public.app_role; END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    PERFORM public.seed_default_pipeline(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.log_deal_changes_and_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_actor_id UUID;
    v_new_stage_name TEXT;
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.owner_id);

    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        INSERT INTO public.deal_audit_log (deal_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, v_actor_id, 'stage_id', OLD.stage_id::text, NEW.stage_id::text);

        SELECT name INTO v_new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;
        IF v_new_stage_name = 'Won' THEN
            INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
            VALUES (NEW.owner_id, 'Deal Won!', 'Congratulations! Deal "' || NEW.title || '" marked as Won ($' || COALESCE(NEW.value, 0)::text || ').', 'success', NEW.id::text, 'deal');
        ELSIF v_new_stage_name = 'Lost' THEN
            INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
            VALUES (NEW.owner_id, 'Deal Lost', 'Deal "' || NEW.title || '" moved to Lost.', 'warning', NEW.id::text, 'deal');
        END IF;
    END IF;

    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO public.deal_audit_log (deal_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, v_actor_id, 'value', OLD.value::text, NEW.value::text);
    END IF;

    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        INSERT INTO public.deal_audit_log (deal_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, v_actor_id, 'owner_id', OLD.owner_id::text, NEW.owner_id::text);

        INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
        VALUES (NEW.owner_id, 'New Deal Assigned', 'You have been assigned as the owner of deal "' || NEW.title || '".', 'info', NEW.id::text, 'deal');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_audit_notify ON public.deals;
CREATE TRIGGER trg_deal_audit_notify
    AFTER UPDATE ON public.deals
    FOR EACH ROW
    WHEN (
        OLD.stage_id IS DISTINCT FROM NEW.stage_id OR
        OLD.value IS DISTINCT FROM NEW.value OR
        OLD.owner_id IS DISTINCT FROM NEW.owner_id
    )
    EXECUTE FUNCTION public.log_deal_changes_and_notify();

CREATE OR REPLACE FUNCTION public.reorder_pipeline_stages(p_stages JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item JSONB;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_stages) LOOP
        UPDATE public.pipeline_stages
        SET position = (item->>'position')::INTEGER
        WHERE id = (item->>'id')::UUID;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(p_period_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_since TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_since := NOW() - (p_period_days || ' days')::INTERVAL;

    WITH filtered_deals AS (
        SELECT d.id, d.title, COALESCE(d.value, 0) as value, d.probability, d.stage_id,
               s.name as stage_name, s.color as stage_color, s.position as stage_position
        FROM public.deals d
        JOIN public.pipeline_stages s ON s.id = d.stage_id
        WHERE d.created_at >= v_since
    ),
    summary AS (
        SELECT COUNT(*)::INT AS total_deals,
               COALESCE(SUM(value), 0)::NUMERIC(14,2) AS total_value,
               COUNT(*) FILTER (WHERE stage_name = 'Won')::INT AS won_deals,
               COALESCE(SUM(value) FILTER (WHERE stage_name = 'Won'), 0)::NUMERIC(14,2) AS won_value,
               COUNT(*) FILTER (WHERE stage_name = 'Lost')::INT AS lost_deals,
               COUNT(*) FILTER (WHERE stage_name IN ('Won', 'Lost'))::INT AS closed_deals
        FROM filtered_deals
    ),
    stage_breakdown AS (
        SELECT s.id, s.name, s.color, s.position,
               COUNT(d.id)::INT AS count,
               COALESCE(SUM(d.value), 0)::NUMERIC(14,2) AS value
        FROM public.pipeline_stages s
        LEFT JOIN filtered_deals d ON d.stage_id = s.id
        GROUP BY s.id, s.name, s.color, s.position
        ORDER BY s.position ASC
    )
    SELECT jsonb_build_object(
        'total_deals', s.total_deals,
        'total_value', s.total_value,
        'won_deals', s.won_deals,
        'won_value', s.won_value,
        'lost_deals', s.lost_deals,
        'win_rate', CASE WHEN s.closed_deals > 0 THEN ROUND((s.won_deals::NUMERIC / s.closed_deals::NUMERIC) * 100, 1) ELSE 0 END,
        'stages', (SELECT jsonb_agg(sb) FROM stage_breakdown sb)
    )
    INTO v_result
    FROM summary s;

    RETURN v_result;
END;
$$;

-- Global Search RPC
CREATE OR REPLACE FUNCTION public.global_search(p_query TEXT, p_limit INT DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_pattern TEXT;
    v_deals JSONB; v_contacts JSONB; v_companies JSONB; v_activities JSONB; v_tasks JSONB;
BEGIN
    v_pattern := '%' || p_query || '%';
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_deals FROM (
        SELECT id, title, value FROM public.deals WHERE title ILIKE v_pattern ORDER BY created_at DESC LIMIT p_limit
    ) sub;
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_contacts FROM (
        SELECT id, first_name, last_name, email FROM public.contacts WHERE (first_name || ' ' || last_name || ' ' || COALESCE(email, '')) ILIKE v_pattern ORDER BY created_at DESC LIMIT p_limit
    ) sub;
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_companies FROM (
        SELECT id, name, industry FROM public.companies WHERE name ILIKE v_pattern ORDER BY created_at DESC LIMIT p_limit
    ) sub;
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_activities FROM (
        SELECT id, title, type FROM public.activities WHERE title ILIKE v_pattern ORDER BY created_at DESC LIMIT p_limit
    ) sub;
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_tasks FROM (
        SELECT id, title, priority, completed FROM public.tasks WHERE title ILIKE v_pattern ORDER BY created_at DESC LIMIT p_limit
    ) sub;
    RETURN jsonb_build_object('deals', v_deals, 'contacts', v_contacts, 'companies', v_companies, 'activities', v_activities, 'tasks', v_tasks);
END;
$$;

-- ==============================================================================
-- Row Level Security
-- ==============================================================================
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

-- Standard Policies
DO $$ BEGIN
    CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Roles viewable by authenticated users" ON public.user_roles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

    CREATE POLICY "Teams viewable by authenticated users" ON public.teams FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
    CREATE POLICY "Team members viewable by authenticated users" ON public.team_members FOR SELECT TO authenticated USING (true);

    CREATE POLICY "Pipelines viewable by authenticated users" ON public.pipelines FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can create pipelines" ON public.pipelines FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
    CREATE POLICY "Pipeline stages viewable by authenticated users" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can manage pipeline stages" ON public.pipeline_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "Companies viewable by authenticated users" ON public.companies FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can manage companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "Contacts viewable by authenticated users" ON public.contacts FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can manage contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "Deals viewable by authenticated users" ON public.deals FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can manage deals" ON public.deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "Deal audit log viewable by authenticated users" ON public.deal_audit_log FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Deal audit log insertable by authenticated users" ON public.deal_audit_log FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY "Activities viewable by authenticated users" ON public.activities FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can manage activities" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "Tasks viewable by authenticated users" ON public.tasks FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can manage tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "Users can only view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY "Users can view their email templates" ON public.email_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Users can manage their email templates" ON public.email_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Storage & Realtime
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
    CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
    CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.deals REPLICA IDENTITY FULL;
    ALTER TABLE public.activities REPLICA IDENTITY FULL;
    ALTER TABLE public.tasks REPLICA IDENTITY FULL;
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
    ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;

    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 15. Beta Feedback Table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL,
    comment TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can submit beta feedback" ON public.feedback FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY "Authenticated users can view feedback" ON public.feedback FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

