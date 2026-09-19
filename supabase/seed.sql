-- ==============================================================================
-- OPTIONAL: Seed Data for Demo / Sandbox Testing ONLY
-- WARNING: DO NOT RUN THIS IN PRODUCTION IF YOU WANT A CLEAN EMPTY WORKSPACE.
-- To clean preseeded records, run supabase/clean_workspace.sql.
-- ==============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_pipeline_id UUID;
    v_stage_prospect UUID;
    v_stage_qualified UUID;
    v_stage_proposal UUID;
    v_stage_negotiation UUID;
    v_stage_won UUID;
    v_stage_lost UUID;

    v_comp_northstar UUID;
    v_comp_arc UUID;
    v_comp_harbor UUID;
    v_comp_atlas UUID;
    v_comp_orchid UUID;
    v_comp_cybershield UUID;
    v_comp_nova UUID;

    v_cont_maya UUID;
    v_cont_noah UUID;
    v_cont_sofia UUID;
    v_cont_amara UUID;
    v_cont_theo UUID;
    v_cont_elena UUID;
    v_cont_marcus UUID;

    v_deal_1 UUID;
    v_deal_2 UUID;
    v_deal_3 UUID;
    v_deal_4 UUID;
    v_deal_5 UUID;
    v_deal_6 UUID;
    v_deal_7 UUID;
BEGIN
    -- 1. Identify or create seed reference user
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

    IF v_user_id IS NULL THEN
        -- If running in environment without auth.users, create dummy UUID for relations
        v_user_id := 'a0000000-0000-0000-0000-000000000001'::UUID;
    END IF;

    -- 2. Seed Default Pipeline
    SELECT id INTO v_pipeline_id FROM public.pipelines WHERE created_by = v_user_id LIMIT 1;
    IF v_pipeline_id IS NULL THEN
        INSERT INTO public.pipelines (id, name, created_by)
        VALUES ('b0000000-0000-0000-0000-000000000001'::UUID, 'Enterprise Sales Pipeline', v_user_id)
        RETURNING id INTO v_pipeline_id;
    END IF;

    -- 3. Seed Stages
    SELECT id INTO v_stage_prospect FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Prospect';
    IF v_stage_prospect IS NULL THEN
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Prospect', '#3b82f6', 0) RETURNING id INTO v_stage_prospect;
    END IF;

    SELECT id INTO v_stage_qualified FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Qualified';
    IF v_stage_qualified IS NULL THEN
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Qualified', '#8b5cf6', 1) RETURNING id INTO v_stage_qualified;
    END IF;

    SELECT id INTO v_stage_proposal FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Proposal';
    IF v_stage_proposal IS NULL THEN
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Proposal', '#f97316', 2) RETURNING id INTO v_stage_proposal;
    END IF;

    SELECT id INTO v_stage_negotiation FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Negotiation';
    IF v_stage_negotiation IS NULL THEN
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Negotiation', '#eab308', 3) RETURNING id INTO v_stage_negotiation;
    END IF;

    SELECT id INTO v_stage_won FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Won';
    IF v_stage_won IS NULL THEN
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Won', '#10b981', 4) RETURNING id INTO v_stage_won;
    END IF;

    SELECT id INTO v_stage_lost FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Lost';
    IF v_stage_lost IS NULL THEN
        INSERT INTO public.pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Lost', '#ef4444', 5) RETURNING id INTO v_stage_lost;
    END IF;

    -- 4. Seed Companies
    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Northstar Labs', 'Enterprise AI Infrastructure', 'https://northstar.io', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_northstar;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Arc Systems', 'DevOps & Cloud Security', 'https://arcsys.com', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_arc;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Harbor & Co.', 'Fintech & Wealth Operations', 'https://harbor.co', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_harbor;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Atlas Works', 'Autonomous Logistics', 'https://atlas.works', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_atlas;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Orchid Health', 'HealthTech & Telehealth', 'https://orchidhealth.org', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_orchid;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('CyberShield AI', 'Zero Trust Cybersecurity', 'https://cybershield.ai', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_cybershield;

    INSERT INTO public.companies (name, industry, website, created_by)
    VALUES ('Nova Dynamics', 'Aerospace Robotics', 'https://novadynamics.space', v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_comp_nova;

    -- Ensure company IDs populated if already existing
    SELECT id INTO v_comp_northstar FROM public.companies WHERE name = 'Northstar Labs' LIMIT 1;
    SELECT id INTO v_comp_arc FROM public.companies WHERE name = 'Arc Systems' LIMIT 1;
    SELECT id INTO v_comp_harbor FROM public.companies WHERE name = 'Harbor & Co.' LIMIT 1;
    SELECT id INTO v_comp_atlas FROM public.companies WHERE name = 'Atlas Works' LIMIT 1;
    SELECT id INTO v_comp_orchid FROM public.companies WHERE name = 'Orchid Health' LIMIT 1;
    SELECT id INTO v_comp_cybershield FROM public.companies WHERE name = 'CyberShield AI' LIMIT 1;
    SELECT id INTO v_comp_nova FROM public.companies WHERE name = 'Nova Dynamics' LIMIT 1;

    -- 5. Seed Contacts
    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Maya', 'Chen', 'maya@northstar.io', '+1 (415) 555-0142', 'VP of Engineering', v_comp_northstar, ARRAY['Decision Maker', 'VIP', 'AI'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_maya;

    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Noah', 'Williams', 'noah@arcsys.com', '+1 (650) 555-0198', 'Head of Revenue Ops', v_comp_arc, ARRAY['Evaluator', 'Cloud'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_noah;

    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Sofia', 'Miller', 'sofia@harbor.co', '+1 (212) 555-0177', 'Chief Commercial Officer', v_comp_harbor, ARRAY['Executive Sponsor', 'Fintech'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_sofia;

    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Amara', 'Davis', 'amara@atlas.works', '+1 (312) 555-0163', 'Director of Business Dev', v_comp_atlas, ARRAY['Champion', 'Logistics'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_amara;

    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Theo', 'Martin', 'theo@orchidhealth.org', '+1 (617) 555-0189', 'Growth Lead', v_comp_orchid, ARRAY['Procurement', 'HealthTech'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_theo;

    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Elena', 'Rostova', 'elena@cybershield.ai', '+1 (206) 555-0112', 'VP Product Strategy', v_comp_cybershield, ARRAY['Key Stakeholder', 'Security'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_elena;

    INSERT INTO public.contacts (first_name, last_name, email, phone, position, company_id, tags, created_by)
    VALUES ('Marcus', 'Vance', 'marcus@novadynamics.space', '+1 (303) 555-0125', 'Chief Operating Officer', v_comp_nova, ARRAY['C-Suite', 'Robotics'], v_user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cont_marcus;

    SELECT id INTO v_cont_maya FROM public.contacts WHERE email = 'maya@northstar.io' LIMIT 1;
    SELECT id INTO v_cont_noah FROM public.contacts WHERE email = 'noah@arcsys.com' LIMIT 1;
    SELECT id INTO v_cont_sofia FROM public.contacts WHERE email = 'sofia@harbor.co' LIMIT 1;
    SELECT id INTO v_cont_amara FROM public.contacts WHERE email = 'amara@atlas.works' LIMIT 1;
    SELECT id INTO v_cont_theo FROM public.contacts WHERE email = 'theo@orchidhealth.org' LIMIT 1;
    SELECT id INTO v_cont_elena FROM public.contacts WHERE email = 'elena@cybershield.ai' LIMIT 1;
    SELECT id INTO v_cont_marcus FROM public.contacts WHERE email = 'marcus@novadynamics.space' LIMIT 1;

    -- 6. Seed Deals
    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('Northstar Enterprise AI Rollout', v_comp_northstar, v_cont_maya, v_pipeline_id, v_stage_negotiation, v_user_id, 145000, 90, CURRENT_DATE + 9, 'Security audit passed; finalizing MSA legal terms.', v_user_id)
    RETURNING id INTO v_deal_1;

    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('Arc Systems Cloud Migration', v_comp_arc, v_cont_noah, v_pipeline_id, v_stage_proposal, v_user_id, 88000, 75, CURRENT_DATE + 14, 'Proposal delivered to executive committee.', v_user_id)
    RETURNING id INTO v_deal_2;

    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('Harbor Wealth Stack Integration', v_comp_harbor, v_cont_sofia, v_pipeline_id, v_stage_qualified, v_user_id, 210000, 50, CURRENT_DATE + 21, 'Discovery calls completed; architecture review scheduled.', v_user_id)
    RETURNING id INTO v_deal_3;

    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('Atlas Autonomous Dispatch Pilot', v_comp_atlas, v_cont_amara, v_pipeline_id, v_stage_prospect, v_user_id, 65000, 30, CURRENT_DATE + 35, 'Inbound demo request; pending technical deep dive.', v_user_id)
    RETURNING id INTO v_deal_4;

    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('Orchid Clinical Pipeline Expansion', v_comp_orchid, v_cont_theo, v_pipeline_id, v_stage_won, v_user_id, 120000, 100, CURRENT_DATE - 5, 'Contract signed! Onboarding underway.', v_user_id)
    RETURNING id INTO v_deal_5;

    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('CyberShield SOC Modernization', v_comp_cybershield, v_cont_elena, v_pipeline_id, v_stage_lost, v_user_id, 42000, 0, CURRENT_DATE - 12, 'Postponed to FY27 budget cycle.', v_user_id)
    RETURNING id INTO v_deal_6;

    INSERT INTO public.deals (title, company_id, contact_id, pipeline_id, stage_id, owner_id, value, probability, close_date, notes, created_by)
    VALUES ('Nova Robotics Telemetry Engine', v_comp_nova, v_cont_marcus, v_pipeline_id, v_stage_negotiation, v_user_id, 95000, 80, CURRENT_DATE + 18, 'Pricing tier discounts approved by finance.', v_user_id)
    RETURNING id INTO v_deal_7;

    -- 7. Seed Activities
    INSERT INTO public.activities (deal_id, contact_id, user_id, title, type, description)
    VALUES
        (v_deal_1, v_cont_maya, v_user_id, 'MSA Legal Review Call', 'call', 'Reviewed indemnity and SLA terms with Maya and general counsel.'),
        (v_deal_2, v_cont_noah, v_user_id, 'Proposal Deck Sent', 'email', 'Shared complete security architecture and pricing tier comparison.'),
        (v_deal_3, v_cont_sofia, v_user_id, 'Executive Architecture Briefing', 'meeting', 'Met with C-suite stakeholders; presented compliance certifications.'),
        (v_deal_5, v_cont_theo, v_user_id, 'Signed Contract Received', 'note', 'Countersigned order form received. Revenue recognized.');

    -- 8. Seed Tasks
    INSERT INTO public.tasks (deal_id, contact_id, user_id, title, description, due_date, priority, completed)
    VALUES
        (v_deal_1, v_cont_maya, v_user_id, 'Send updated Redline NDA', 'Incorporate legal team changes', NOW() + INTERVAL '1 day', 'high', false),
        (v_deal_2, v_cont_noah, v_user_id, 'Follow up on technical proposal', 'Check in on executive committee feedback', NOW() + INTERVAL '3 days', 'medium', false),
        (v_deal_3, v_cont_sofia, v_user_id, 'Prepare SOC 2 Type II summary', 'Send compliance docs to IT evaluation lead', NOW() + INTERVAL '2 days', 'high', false),
        (v_deal_4, v_cont_amara, v_user_id, 'Schedule technical discovery call', 'Confirm calendar invite with solutions engineer', NOW() + INTERVAL '4 days', 'medium', false);

    -- 9. Seed Email Templates
    INSERT INTO public.email_templates (user_id, name, subject, body)
    VALUES
        (v_user_id, 'Post-Demo Follow Up', 'Thank you for your time today - PipelineIQ Next Steps', 'Hi {{contact_name}},' || E'\n\n' || 'Thank you for joining our product deep dive today. As discussed, I have attached our solution brief and ROI model for {{company_name}}.' || E'\n\n' || 'Would Thursday at 2 PM work for a brief 15-minute follow-up with your engineering lead?' || E'\n\n' || 'Best regards,'),
        (v_user_id, 'Executive Introduction', 'Introduction: PipelineIQ & {{company_name}} Revenue Architecture', 'Hi {{contact_name}},' || E'\n\n' || 'I noticed {{company_name}}''s recent expansion and wanted to share how enterprise sales teams are cutting deal cycle lengths by 40% with automated pipeline visibility.' || E'\n\n' || 'Do you have 10 minutes next week to exchange thoughts?' || E'\n\n' || 'Best regards,'),
        (v_user_id, 'Formal Proposal Delivery', 'PipelineIQ Commercial Proposal for {{company_name}}', 'Hi {{contact_name}},' || E'\n\n' || 'Please find attached our formal commercial proposal tailored to your team''s requirements. We have included volume tiered discounts and our expedited 5-day onboarding plan.' || E'\n\n' || 'Looking forward to your feedback.' || E'\n\n' || 'Best regards,');

END $$;
