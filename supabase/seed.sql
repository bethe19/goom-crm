-- ==============================================================================
-- LOCAL DEVELOPMENT SEED ONLY — NEVER RUN THIS AGAINST A HOSTED / PRODUCTION DATABASE.
--
-- Used by `supabase db reset` (see [db.seed] in config.toml) on the local stack.
-- It creates two throwaway local users with a well-known password and a fictional
-- "Sample Workspace". All emails use the reserved example.com domain.
--
--   admin@example.com / local-dev-password1   (workspace admin)
--   rep@example.com   / local-dev-password1   (sales rep)
--
-- Safety: the script refuses to run if the database contains any user whose email is
-- not on example.com (i.e. it looks like a real database). It is idempotent: it does
-- nothing if admin@example.com already exists.
-- ==============================================================================

DO $$
DECLARE
    v_admin UUID := gen_random_uuid();
    v_rep UUID := gen_random_uuid();
    v_org UUID;
    v_pipeline UUID;
    v_s0 UUID; v_s1 UUID; v_s2 UUID; v_s3 UUID; v_won UUID; v_lost UUID;
    v_c1 UUID; v_c2 UUID; v_c3 UUID; v_c4 UUID;
    v_p1 UUID; v_p2 UUID; v_p3 UUID; v_p4 UUID; v_p5 UUID;
    v_d1 UUID; v_d2 UUID;
    v_pw TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email NOT ILIKE '%@example.com') THEN
        RAISE EXCEPTION 'seed.sql is for LOCAL DEVELOPMENT ONLY and refuses to run on a database with real users.';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@example.com') THEN
        RAISE NOTICE 'Local seed already applied; skipping.';
        RETURN;
    END IF;

    v_pw := extensions.crypt('local-dev-password1', extensions.gen_salt('bf'));

    -- Users (handle_new_user creates profiles + a workspace for each).
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES
        ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated', 'admin@example.com', v_pw, NOW(),
         '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Admin","company":"Sample Workspace"}', NOW(), NOW(), '', '', '', ''),
        ('00000000-0000-0000-0000-000000000000', v_rep, 'authenticated', 'authenticated', 'rep@example.com', v_pw, NOW(),
         '{"provider":"email","providers":["email"]}', '{"full_name":"Riley Rep"}', NOW(), NOW(), '', '', '', '');

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_admin, v_admin::text, jsonb_build_object('sub', v_admin::text, 'email', 'admin@example.com', 'email_verified', true), 'email', NOW(), NOW(), NOW()),
        (gen_random_uuid(), v_rep, v_rep::text, jsonb_build_object('sub', v_rep::text, 'email', 'rep@example.com', 'email_verified', true), 'email', NOW(), NOW(), NOW());

    SELECT current_organization_id INTO v_org FROM public.profiles WHERE user_id = v_admin;

    -- Move the rep into the admin's workspace and drop the personal one the trigger made.
    DELETE FROM public.organizations WHERE created_by = v_rep;
    INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (v_org, v_rep, 'rep');
    UPDATE public.profiles SET current_organization_id = v_org, onboarding_completed_at = NOW() WHERE user_id IN (v_admin, v_rep);
    UPDATE public.profiles SET job_title = 'Head of Sales' WHERE user_id = v_admin;
    UPDATE public.profiles SET job_title = 'Account Executive' WHERE user_id = v_rep;
    UPDATE public.organizations SET monthly_quota = 120000 WHERE id = v_org;

    -- Act as the admin so triggers attribute changes correctly.
    PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);

    SELECT id INTO v_pipeline FROM public.pipelines WHERE organization_id = v_org LIMIT 1;
    SELECT id INTO v_s0 FROM public.pipeline_stages WHERE pipeline_id = v_pipeline AND position = 0;
    SELECT id INTO v_s1 FROM public.pipeline_stages WHERE pipeline_id = v_pipeline AND position = 1;
    SELECT id INTO v_s2 FROM public.pipeline_stages WHERE pipeline_id = v_pipeline AND position = 2;
    SELECT id INTO v_s3 FROM public.pipeline_stages WHERE pipeline_id = v_pipeline AND position = 3;
    SELECT id INTO v_won FROM public.pipeline_stages WHERE pipeline_id = v_pipeline AND is_won;
    SELECT id INTO v_lost FROM public.pipeline_stages WHERE pipeline_id = v_pipeline AND is_lost;

    INSERT INTO public.companies (organization_id, name, industry, website, created_by) VALUES
        (v_org, 'Northwind Analytics', 'Software', 'https://northwind.example.com', v_admin) RETURNING id INTO v_c1;
    INSERT INTO public.companies (organization_id, name, industry, website, created_by) VALUES
        (v_org, 'Bluefin Logistics', 'Transportation', 'https://bluefin.example.com', v_rep) RETURNING id INTO v_c2;
    INSERT INTO public.companies (organization_id, name, industry, website, created_by) VALUES
        (v_org, 'Cedar Health Partners', 'Healthcare', 'https://cedar.example.com', v_admin) RETURNING id INTO v_c3;
    INSERT INTO public.companies (organization_id, name, industry, website, created_by) VALUES
        (v_org, 'Lumen Retail Group', 'Retail', 'https://lumen.example.com', v_rep) RETURNING id INTO v_c4;

    INSERT INTO public.contacts (organization_id, company_id, first_name, last_name, email, position, tags, created_by) VALUES
        (v_org, v_c1, 'Jordan', 'Lee', 'jordan.lee@example.com', 'VP Operations', ARRAY['decision-maker'], v_admin) RETURNING id INTO v_p1;
    INSERT INTO public.contacts (organization_id, company_id, first_name, last_name, email, position, tags, created_by) VALUES
        (v_org, v_c2, 'Sam', 'Patel', 'sam.patel@example.com', 'Procurement Lead', ARRAY['champion'], v_rep) RETURNING id INTO v_p2;
    INSERT INTO public.contacts (organization_id, company_id, first_name, last_name, email, position, tags, created_by) VALUES
        (v_org, v_c3, 'Morgan', 'Diaz', 'morgan.diaz@example.com', 'CFO', ARRAY['decision-maker'], v_admin) RETURNING id INTO v_p3;
    INSERT INTO public.contacts (organization_id, company_id, first_name, last_name, email, position, tags, created_by) VALUES
        (v_org, v_c4, 'Casey', 'Nguyen', 'casey.nguyen@example.com', 'Store Systems Manager', ARRAY[]::TEXT[], v_rep) RETURNING id INTO v_p4;
    INSERT INTO public.contacts (organization_id, company_id, first_name, last_name, email, position, tags, created_by) VALUES
        (v_org, v_c1, 'Taylor', 'Brooks', 'taylor.brooks@example.com', 'IT Director', ARRAY['technical'], v_admin) RETURNING id INTO v_p5;

    INSERT INTO public.deals (organization_id, title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, created_by)
    VALUES (v_org, 'Northwind platform rollout', v_c1, v_p1, v_pipeline, v_s2, v_admin, 48000, 50, CURRENT_DATE + 21, v_admin)
    RETURNING id INTO v_d1;
    INSERT INTO public.deals (organization_id, title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, created_by)
    VALUES (v_org, 'Bluefin fleet tracking', v_c2, v_p2, v_pipeline, v_s1, v_rep, 22000, 25, CURRENT_DATE + 45, v_rep)
    RETURNING id INTO v_d2;
    INSERT INTO public.deals (organization_id, title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, created_by) VALUES
        (v_org, 'Cedar Health annual renewal', v_c3, v_p3, v_pipeline, v_s3, v_admin, 36000, 75, CURRENT_DATE + 10, v_admin),
        (v_org, 'Lumen POS integration', v_c4, v_p4, v_pipeline, v_s0, v_rep, 15000, 10, CURRENT_DATE + 60, v_rep),
        (v_org, 'Northwind analytics add-on', v_c1, v_p5, v_pipeline, v_won, v_admin, 12000, 100, CURRENT_DATE - 5, v_admin),
        (v_org, 'Bluefin warehouse pilot', v_c2, v_p2, v_pipeline, v_lost, v_rep, 9000, 0, CURRENT_DATE - 12, v_rep);

    INSERT INTO public.activities (organization_id, deal_id, contact_id, user_id, title, type, description, created_at) VALUES
        (v_org, v_d1, v_p1, v_admin, 'Discovery call', 'call', 'Walked through reporting needs and timeline.', NOW() - INTERVAL '6 days'),
        (v_org, v_d1, v_p1, v_admin, 'Sent proposal', 'email', 'Proposal v1 with two pricing options.', NOW() - INTERVAL '2 days'),
        (v_org, v_d2, v_p2, v_rep, 'Intro meeting', 'meeting', 'Met procurement and fleet ops.', NOW() - INTERVAL '4 days');

    INSERT INTO public.tasks (organization_id, deal_id, contact_id, user_id, assigned_to, title, priority, due_date) VALUES
        (v_org, v_d1, v_p1, v_admin, v_admin, 'Follow up on proposal', 'high', NOW() + INTERVAL '1 day'),
        (v_org, v_d2, v_p2, v_admin, v_rep, 'Send fleet tracking case study', 'medium', NOW() + INTERVAL '3 days'),
        (v_org, NULL, v_p4, v_rep, v_rep, 'Book POS demo', 'low', NOW() + INTERVAL '7 days');

    PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
