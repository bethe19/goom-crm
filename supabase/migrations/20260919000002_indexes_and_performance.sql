-- ==============================================================================
-- 02: High-Performance Indexes & GIN Trigram Search
-- ==============================================================================

-- 1. Deals Indexes
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON public.deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON public.deals(close_date) WHERE close_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals(created_at DESC);

-- 2. Pipeline Stages Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_pos ON public.pipeline_stages(pipeline_id, position);

-- 3. Contacts Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at DESC);

-- 4. Companies Indexes
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON public.companies(created_at DESC);

-- 5. Activities Indexes
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id, created_at DESC) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id, created_at DESC);

-- 6. Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, completed, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON public.tasks(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON public.tasks(contact_id) WHERE contact_id IS NOT NULL;

-- 7. Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- 8. Deal Audit Log Indexes
CREATE INDEX IF NOT EXISTS idx_deal_audit_log_deal ON public.deal_audit_log(deal_id, created_at DESC);

-- 9. Team & User Roles Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- 10. GIN Trigram Search Indexes (Sub-millisecond Command-K & ILIKE searches)
CREATE INDEX IF NOT EXISTS idx_deals_title_trgm ON public.deals USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_search_trgm ON public.contacts USING gin ((first_name || ' ' || last_name || ' ' || coalesce(email, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON public.companies USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activities_title_trgm ON public.activities USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON public.tasks USING gin (title gin_trgm_ops);
