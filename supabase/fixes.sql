-- ==============================================================================
-- Goom CRM — Security & RLS Fix Patch
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard
-- Apply AFTER deploying the code changes.
-- ==============================================================================

-- 1. Add notification_preferences column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "deal_assigned": true,
    "mentions": true,
    "stage_changes": true,
    "close_reminders": true
  }'::jsonb;

-- ==============================================================================
-- 2. Fix RLS Policies — Scope companies, contacts, deals, activities, tasks
--    to the owning user (created_by = auth.uid()) instead of open USING (true)
-- ==============================================================================

-- ── Companies ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage companies" ON public.companies;

CREATE POLICY "Users can view companies in their workspace" ON public.companies
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_team_member(created_by, auth.uid()));

CREATE POLICY "Users can insert their own companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own companies" ON public.companies
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── Contacts ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON public.contacts;

CREATE POLICY "Users can view contacts in their workspace" ON public.contacts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_team_member(created_by, auth.uid()));

CREATE POLICY "Users can insert their own contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── Deals ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage deals" ON public.deals;

CREATE POLICY "Users can view their own or team deals" ON public.deals
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_team_member(owner_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own deals" ON public.deals
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── Activities ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage activities" ON public.activities;

CREATE POLICY "Users can view their own or team activities" ON public.activities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(user_id, auth.uid()));

CREATE POLICY "Users can insert their own activities" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own activities" ON public.activities
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own activities" ON public.activities
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── Tasks ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON public.tasks;

CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ==============================================================================
-- 3. Fix global_search RPC — scope results to auth.uid()
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.global_search(p_query TEXT, p_limit INT DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_pattern TEXT;
    v_deals JSONB; v_contacts JSONB; v_companies JSONB; v_activities JSONB; v_tasks JSONB;
BEGIN
    v_pattern := '%' || p_query || '%';

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_deals FROM (
        SELECT id, title, value FROM public.deals
        WHERE title ILIKE v_pattern
          AND (owner_id = v_uid OR public.is_team_member(owner_id, v_uid) OR public.has_role(v_uid, 'admin'))
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_contacts FROM (
        SELECT id, first_name, last_name, email FROM public.contacts
        WHERE (first_name || ' ' || last_name || ' ' || COALESCE(email, '')) ILIKE v_pattern
          AND (created_by = v_uid OR public.is_team_member(created_by, v_uid))
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_companies FROM (
        SELECT id, name, industry FROM public.companies
        WHERE name ILIKE v_pattern
          AND (created_by = v_uid OR public.is_team_member(created_by, v_uid))
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_activities FROM (
        SELECT id, title, type FROM public.activities
        WHERE title ILIKE v_pattern
          AND (user_id = v_uid OR public.is_team_member(user_id, v_uid))
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_tasks FROM (
        SELECT id, title, priority, completed FROM public.tasks
        WHERE title ILIKE v_pattern AND user_id = v_uid
        ORDER BY created_at DESC LIMIT p_limit
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

-- ==============================================================================
-- 4. Fix feedback table — restrict to authenticated users (prevent anon spam)
-- ==============================================================================
DROP POLICY IF EXISTS "Anyone can submit beta feedback" ON public.feedback;

CREATE POLICY "Authenticated users can submit feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (true);

-- Admins can update/delete feedback
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;

CREATE POLICY "Admins can manage feedback" ON public.feedback
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
