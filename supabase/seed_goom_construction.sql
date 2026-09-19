-- ==============================================================================
-- Goom Construction: Complete Seed Data & User Setup
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- 
-- Email: marakicreative@gmail.com
-- Password: Password123! (or Goom2026!)
-- Company: Goom Construction
-- ==============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_comp_apex_id UUID;
    v_comp_oakridge_id UUID;
    v_comp_mta_id UUID;
    v_comp_harbor_id UUID;
    v_comp_greenfield_id UUID;

    v_pipeline_id UUID;
    v_stage_tender UUID;
    v_stage_feasibility UUID;
    v_stage_estimation UUID;
    v_stage_proposal UUID;
    v_stage_negotiation UUID;
    v_stage_won UUID;
    v_stage_lost UUID;

    v_cont_marcus UUID;
    v_cont_elena UUID;
    v_cont_david UUID;
    v_cont_sarah UUID;
    v_cont_ahmed UUID;
    v_cont_sophia UUID;

    v_deal_downtown UUID;
    v_deal_oakridge UUID;
    v_deal_greenfield UUID;
    v_deal_mta UUID;
    v_deal_harbor UUID;
    v_deal_techpark UUID;
BEGIN
    -- 2. Find or Create User for marakicreative@gmail.com
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'marakicreative@gmail.com';

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            'marakicreative@gmail.com',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Goom Construction Admin","company":"Goom Construction"}'::jsonb,
            NOW(),
            NOW()
        );
    ELSE
        -- Confirm existing user and set password to Password123!
        UPDATE auth.users
        SET encrypted_password = crypt('Password123!', gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            confirmed_at = COALESCE(confirmed_at, NOW()),
            raw_user_meta_data = '{"full_name":"Goom Construction Admin","company":"Goom Construction"}'::jsonb,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- 3. Profiles table entry
    INSERT INTO public.profiles (user_id, full_name, company, created_at, updated_at)
    VALUES (v_user_id, 'Goom Construction Admin', 'Goom Construction', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        company = EXCLUDED.company,
        updated_at = NOW();

    -- 4. Assign Admin Role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 5. Primary Company: Goom Construction
    SELECT id INTO v_company_id FROM public.companies WHERE name = 'Goom Construction' AND created_by = v_user_id;
    IF v_company_id IS NULL THEN
        INSERT INTO public.companies (name, industry, website, created_by)
        VALUES ('Goom Construction', 'Commercial Contracting & Infrastructure', 'https://goomconstruction.com', v_user_id)
        RETURNING id INTO v_company_id;
    END IF;

    -- Client / Partner Companies
    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Apex Commercial Development', 'Commercial Real Estate Development', 'https://apexdevelopment.com', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_apex_id;
    IF v_comp_apex_id IS NULL THEN SELECT id INTO v_comp_apex_id FROM public.companies WHERE name = 'Apex Commercial Development' AND created_by = v_user_id; END IF;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Oakridge Luxury Estates', 'High-End Residential & Mixed-Use', 'https://oakridge-estates.com', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_oakridge_id;
    IF v_comp_oakridge_id IS NULL THEN SELECT id INTO v_comp_oakridge_id FROM public.companies WHERE name = 'Oakridge Luxury Estates' AND created_by = v_user_id; END IF;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Metropolitan Transit Authority', 'Public Infrastructure & Transportation', 'https://mta-transit.gov', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_mta_id;
    IF v_comp_mta_id IS NULL THEN SELECT id INTO v_comp_mta_id FROM public.companies WHERE name = 'Metropolitan Transit Authority' AND created_by = v_user_id; END IF;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Harbor Logistics & Port Terminal', 'Supply Chain & Heavy Industrial', 'https://harborlogistics.com', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_harbor_id;
    IF v_comp_harbor_id IS NULL THEN SELECT id INTO v_comp_harbor_id FROM public.companies WHERE name = 'Harbor Logistics & Port Terminal' AND created_by = v_user_id; END IF;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Greenfield Healthcare Trust', 'Healthcare & Hospital Facilities', 'https://greenfieldhealth.org', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_greenfield_id;
    IF v_comp_greenfield_id IS NULL THEN SELECT id INTO v_comp_greenfield_id FROM public.companies WHERE name = 'Greenfield Healthcare Trust' AND created_by = v_user_id; END IF;

    -- 6. Commercial Pipeline & Stages
    SELECT id INTO v_pipeline_id FROM public.pipelines WHERE name = 'Commercial Construction Pipeline' AND created_by = v_user_id;
    IF v_pipeline_id IS NULL THEN
        INSERT INTO public.pipelines (name, created_by)
        VALUES ('Commercial Construction Pipeline', v_user_id)
        RETURNING id INTO v_pipeline_id;

        -- Create pipeline stages
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Tender & Lead In', '#3b82f6', 0) RETURNING id INTO v_stage_tender;

        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Site Inspection & Feasibility', '#8b5cf6', 1) RETURNING id INTO v_stage_feasibility;

        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Blueprint & Estimation', '#06b6d4', 2) RETURNING id INTO v_stage_estimation;

        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Proposal / Bid Submitted', '#f59e0b', 3) RETURNING id INTO v_stage_proposal;

        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Contract Negotiation', '#ec4899', 4) RETURNING id INTO v_stage_negotiation;

        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Won (Contract Signed)', '#10b981', 5) RETURNING id INTO v_stage_won;

        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
        VALUES (v_pipeline_id, 'Lost', '#ef4444', 6) RETURNING id INTO v_stage_lost;
    ELSE
        SELECT id INTO v_stage_tender FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 0;
        SELECT id INTO v_stage_feasibility FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 1;
        SELECT id INTO v_stage_estimation FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 2;
        SELECT id INTO v_stage_proposal FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 3;
        SELECT id INTO v_stage_negotiation FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 4;
        SELECT id INTO v_stage_won FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 5;
        SELECT id INTO v_stage_lost FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND position = 6;
    END IF;

    -- 7. Realistic Contacts
    INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, position, tags, created_by)
    VALUES (v_comp_apex_id, 'Marcus', 'Vance', 'm.vance@apexdevelopment.com', '+1 (415) 890-2341', 'Senior VP of Development', ARRAY['Decision Maker', 'Commercial', 'VIP'], v_user_id)
    RETURNING id INTO v_cont_marcus;

    INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, position, tags, created_by)
    VALUES (v_comp_oakridge_id, 'Elena', 'Rostova', 'e.rostova@oakridge-estates.com', '+1 (312) 674-8890', 'Director of Capital Projects', ARRAY['Executive Sponsor', 'Luxury Residential'], v_user_id)
    RETURNING id INTO v_cont_elena;

    INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, position, tags, created_by)
    VALUES (v_company_id, 'David', 'Kalu', 'd.kalu@goomconstruction.com', '+1 (212) 555-4019', 'Chief Estimator & Structural Engineer', ARRAY['Internal Team', 'Engineering Lead'], v_user_id)
    RETURNING id INTO v_cont_david;

    INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, position, tags, created_by)
    VALUES (v_comp_mta_id, 'Sarah', 'Jenkins', 'sjenkins@mta-transit.gov', '+1 (202) 431-7720', 'Chief Infrastructure Officer', ARRAY['Government Tender', 'Procurement'], v_user_id)
    RETURNING id INTO v_cont_sarah;

    INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, position, tags, created_by)
    VALUES (v_comp_harbor_id, 'Ahmed', 'Al-Mansoor', 'ahmed@harborlogistics.com', '+1 (713) 902-1145', 'Managing Director of Facilities', ARRAY['Industrial', 'High Budget'], v_user_id)
    RETURNING id INTO v_cont_ahmed;

    INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, position, tags, created_by)
    VALUES (v_comp_greenfield_id, 'Sophia', 'Chen', 'schen@greenfieldhealth.org', '+1 (617) 388-9022', 'Director of Hospital Operations', ARRAY['Healthcare', 'Seismic Retrofit'], v_user_id)
    RETURNING id INTO v_cont_sophia;

    -- 8. Realistic Construction Deals ($2,670,000 Pipeline)
    -- Deal 1: Downtown Commercial Tower ($480,000)
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES (
        'Downtown Commercial Tower - Phase 2',
        v_comp_apex_id,
        v_cont_marcus,
        v_pipeline_id,
        v_stage_negotiation,
        v_user_id,
        480000.00,
        85,
        (CURRENT_DATE + INTERVAL '25 days'),
        'Structural steel framing & concrete core package. Finalizing material cost-escalation clause before sign-off.',
        v_user_id
    ) RETURNING id INTO v_deal_downtown;

    -- Deal 2: Oakridge Luxury Residential Complex ($750,000)
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES (
        'Oakridge Luxury Residential Complex',
        v_comp_oakridge_id,
        v_cont_elena,
        v_pipeline_id,
        v_stage_estimation,
        v_user_id,
        750000.00,
        60,
        (CURRENT_DATE + INTERVAL '60 days'),
        '24-unit luxury residential development. Geotechnical soil compaction passed. Architectural bill of quantities in progress.',
        v_user_id
    ) RETURNING id INTO v_deal_oakridge;

    -- Deal 3: Greenfield Medical Center Seismic Retrofit ($620,000 - Won)
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES (
        'Greenfield Medical Center Seismic Retrofit',
        v_comp_greenfield_id,
        v_cont_sophia,
        v_pipeline_id,
        v_stage_won,
        v_user_id,
        620000.00,
        100,
        (CURRENT_DATE - INTERVAL '10 days'),
        'Contract awarded & executed. Site mobilization and safety barricades underway. Structural steel dampeners ordered.',
        v_user_id
    ) RETURNING id INTO v_deal_greenfield;

    -- Deal 4: Metropolitan Transit Hub Glazing & Facade ($295,000)
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES (
        'Metropolitan Transit Hub Glazing & Facade',
        v_comp_mta_id,
        v_cont_sarah,
        v_pipeline_id,
        v_stage_proposal,
        v_user_id,
        295000.00,
        75,
        (CURRENT_DATE + INTERVAL '35 days'),
        'Public tender submitted. Goom Construction scored #1 in technical review. Price bid opening scheduled next Tuesday.',
        v_user_id
    ) RETURNING id INTO v_deal_mta;

    -- Deal 5: Harbor Logistics Center Warehouse Expansion ($340,000)
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES (
        'Harbor Logistics Center Warehouse Expansion',
        v_comp_harbor_id,
        v_cont_ahmed,
        v_pipeline_id,
        v_stage_feasibility,
        v_user_id,
        340000.00,
        40,
        (CURRENT_DATE + INTERVAL '75 days'),
        '85,000 sq ft industrial slab extension with heavy-duty loading bays. Feasibility study underway.',
        v_user_id
    ) RETURNING id INTO v_deal_harbor;

    -- Deal 6: Tech Park Substation Civil Works ($185,000)
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES (
        'Tech Park Substation Civil Works',
        v_comp_apex_id,
        v_cont_marcus,
        v_pipeline_id,
        v_stage_tender,
        v_user_id,
        185000.00,
        30,
        (CURRENT_DATE + INTERVAL '90 days'),
        'Foundational concrete footings and perimeter blast wall tender for sub-station facility.',
        v_user_id
    ) RETURNING id INTO v_deal_techpark;

    -- 9. Activities (Calls, Meetings, Emails, Notes)
    INSERT INTO public.activities (deal_id, contact_id, user_id, title, type, description)
    VALUES
        (v_deal_downtown, v_cont_marcus, v_user_id, 'Contract Redline Alignment Call', 'call'::public.activity_type, 'Discussed steel escalation clauses with Marcus Vance. Agreed on a 4% cap on structural materials.'),
        (v_deal_greenfield, v_cont_sophia, v_user_id, 'Seismic Engineering Site Walkthrough', 'meeting'::public.activity_type, 'Completed pre-construction walkthrough with Sophia Chen and hospital operations team. Safety clear.'),
        (v_deal_mta, v_cont_sarah, v_user_id, 'BOQ & Warranty Package Submission', 'email'::public.activity_type, 'Submitted formal Bill of Quantities and 10-year thermal glass warranty packet to Sarah Jenkins.'),
        (v_deal_oakridge, v_cont_elena, v_user_id, 'Geotechnical Soil Density Report', 'note'::public.activity_type, 'Chief Estimator David Kalu confirmed soil compaction rating exceeds 98% Proctor standard.');

    -- 10. Open Action Tasks
    INSERT INTO public.tasks (deal_id, contact_id, user_id, title, description, due_date, priority, completed)
    VALUES
        (v_deal_downtown, v_cont_marcus, v_user_id, 'Send final contract execution packet to Marcus Vance', 'Incorporate 4% steel cap amendment into final agreement', CURRENT_DATE + INTERVAL '3 days', 'high', FALSE),
        (v_deal_mta, v_cont_sarah, v_user_id, 'Prepare Transit Hub technical oral presentation', 'Prepare slide deck with structural glazing safety tests', CURRENT_DATE + INTERVAL '5 days', 'high', FALSE),
        (v_deal_harbor, v_cont_ahmed, v_user_id, 'Schedule geotechnical site drill for Harbor Logistics', 'Coordinate with core sampling rig for slab load-bearing survey', CURRENT_DATE + INTERVAL '8 days', 'medium', FALSE),
        (v_deal_greenfield, v_cont_sophia, v_user_id, 'Inspect subcontractor liability certificates', 'Verify $5M insurance coverage before Phase 1 seismic mobilization', CURRENT_DATE + INTERVAL '4 days', 'medium', FALSE);

END $$;

-- 11. Verification Query
SELECT 
    u.email,
    p.company,
    r.role,
    (SELECT COUNT(*) FROM public.deals WHERE created_by = u.id) AS deals_count,
    (SELECT SUM(value) FROM public.deals WHERE created_by = u.id) AS total_pipeline_value,
    (SELECT COUNT(*) FROM public.contacts WHERE created_by = u.id) AS contacts_count,
    (SELECT COUNT(*) FROM public.companies WHERE created_by = u.id) AS companies_count
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.user_roles r ON u.id = r.user_id
WHERE u.email = 'marakicreative@gmail.com';
