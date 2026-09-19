-- ==============================================================================
-- Clean Workspace Script for Production
-- Run this in your Supabase SQL Editor if you previously executed seed.sql,
-- or if you wish to reset your live workspace to a completely pristine empty state.
--
-- This script preserves:
--   - auth.users & profiles
--   - user_roles
--   - pipelines & pipeline_stages (so your stage columns remain configured)
--
-- This script removes:
--   - deals
--   - contacts
--   - companies
--   - activities
--   - tasks
--   - notifications
-- ==============================================================================

BEGIN;

-- 1. Delete dependent transactional entities
DELETE FROM public.activities;
DELETE FROM public.tasks;
DELETE FROM public.deal_audit_log;
DELETE FROM public.notifications;

-- 2. Delete deals
DELETE FROM public.deals;

-- 3. Delete contacts
DELETE FROM public.contacts;

-- 4. Delete companies
DELETE FROM public.companies;

-- 5. Delete email templates if any
DELETE FROM public.email_templates;

COMMIT;

-- Verify all counts are now 0:
SELECT 
    (SELECT COUNT(*) FROM public.deals) AS remaining_deals,
    (SELECT COUNT(*) FROM public.contacts) AS remaining_contacts,
    (SELECT COUNT(*) FROM public.companies) AS remaining_companies,
    (SELECT COUNT(*) FROM public.activities) AS remaining_activities,
    (SELECT COUNT(*) FROM public.tasks) AS remaining_tasks;
