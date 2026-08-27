-- ==============================================================================
-- 03: Database Functions, Stored Procedures & Triggers
-- ==============================================================================

-- 1. Automatic updated_at Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
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

-- 2. Role & Team Helper Functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(
    _user_id UUID,
    _role public.app_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(
    _target_user_id UUID,
    _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.team_members tm1
        JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = _user_id AND tm2.user_id = _target_user_id
    );
$$;

-- 3. Seed Default Pipeline Function
CREATE OR REPLACE FUNCTION public.seed_default_pipeline(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    -- Check if user already has a pipeline
    SELECT id INTO v_pipeline_id
    FROM public.pipelines
    WHERE created_by = p_user_id
    LIMIT 1;

    IF v_pipeline_id IS NOT NULL THEN
        RETURN v_pipeline_id;
    END IF;

    -- Create default pipeline
    INSERT INTO public.pipelines (name, created_by)
    VALUES ('Sales Pipeline', p_user_id)
    RETURNING id INTO v_pipeline_id;

    -- Insert default stages
    INSERT INTO public.pipeline_stages (pipeline_id, name, color, position)
    VALUES
        (v_pipeline_id, 'Prospect', '#3b82f6', 0),
        (v_pipeline_id, 'Qualified', '#8b5cf6', 1),
        (v_pipeline_id, 'Proposal', '#f97316', 2),
        (v_pipeline_id, 'Negotiation', '#eab308', 3),
        (v_pipeline_id, 'Won', '#10b981', 4),
        (v_pipeline_id, 'Lost', '#ef4444', 5);

    RETURN v_pipeline_id;
END;
$$;

-- 4. Automatic User Profile & Pipeline Provisioning Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_first_user BOOLEAN;
    v_role public.app_role;
    v_full_name TEXT;
    v_company TEXT;
BEGIN
    -- Extract full name and company from metadata if available
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    v_company := COALESCE(NEW.raw_user_meta_data->>'company', 'My Company');

    -- Create Profile
    INSERT INTO public.profiles (user_id, full_name, company)
    VALUES (NEW.id, v_full_name, v_company)
    ON CONFLICT (user_id) DO NOTHING;

    -- Check if first user in system
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first_user;
    IF v_is_first_user THEN
        v_role := 'admin'::public.app_role;
    ELSE
        v_role := 'rep'::public.app_role;
    END IF;

    -- Assign role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Automatically seed default sales pipeline
    PERFORM public.seed_default_pipeline(NEW.id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Deal Audit Log and Notification Automation Trigger
CREATE OR REPLACE FUNCTION public.log_deal_changes_and_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_new_stage_name TEXT;
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.owner_id);

    -- Track Stage Changes
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        INSERT INTO public.deal_audit_log (deal_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, v_actor_id, 'stage_id', OLD.stage_id::text, NEW.stage_id::text);

        -- Lookup new stage name for notification
        SELECT name INTO v_new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;

        IF v_new_stage_name = 'Won' THEN
            INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
            VALUES (
                NEW.owner_id,
                'Deal Won!',
                'Congratulations! Deal "' || NEW.title || '" marked as Won ($' || COALESCE(NEW.value, 0)::text || ').',
                'success',
                NEW.id::text,
                'deal'
            );
        ELSIF v_new_stage_name = 'Lost' THEN
            INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
            VALUES (
                NEW.owner_id,
                'Deal Lost',
                'Deal "' || NEW.title || '" moved to Lost.',
                'warning',
                NEW.id::text,
                'deal'
            );
        END IF;
    END IF;

    -- Track Value Changes
    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO public.deal_audit_log (deal_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, v_actor_id, 'value', OLD.value::text, NEW.value::text);
    END IF;

    -- Track Owner Reassignment & Notify New Owner
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        INSERT INTO public.deal_audit_log (deal_id, user_id, field, old_value, new_value)
        VALUES (NEW.id, v_actor_id, 'owner_id', OLD.owner_id::text, NEW.owner_id::text);

        INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
        VALUES (
            NEW.owner_id,
            'New Deal Assigned',
            'You have been assigned as the owner of deal "' || NEW.title || '".',
            'info',
            NEW.id::text,
            'deal'
        );
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

-- 6. Atomic Stage Reordering RPC
CREATE OR REPLACE FUNCTION public.reorder_pipeline_stages(p_stages JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item JSONB;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_stages)
    LOOP
        UPDATE public.pipeline_stages
        SET position = (item->>'position')::INTEGER
        WHERE id = (item->>'id')::UUID;
    END LOOP;
END;
$$;

-- 7. High-Performance Dashboard Analytics RPC (Single Postgres Call)
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
    p_period_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_since TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_since := NOW() - (p_period_days || ' days')::INTERVAL;

    WITH filtered_deals AS (
        SELECT
            d.id,
            d.title,
            COALESCE(d.value, 0) as value,
            d.probability,
            d.stage_id,
            s.name as stage_name,
            s.color as stage_color,
            s.position as stage_position,
            d.created_at,
            d.close_date
        FROM public.deals d
        JOIN public.pipeline_stages s ON s.id = d.stage_id
        WHERE d.created_at >= v_since
    ),
    summary AS (
        SELECT
            COUNT(*)::INT AS total_deals,
            COALESCE(SUM(value), 0)::NUMERIC(14,2) AS total_value,
            COUNT(*) FILTER (WHERE stage_name = 'Won')::INT AS won_deals,
            COALESCE(SUM(value) FILTER (WHERE stage_name = 'Won'), 0)::NUMERIC(14,2) AS won_value,
            COUNT(*) FILTER (WHERE stage_name = 'Lost')::INT AS lost_deals,
            COUNT(*) FILTER (WHERE stage_name IN ('Won', 'Lost'))::INT AS closed_deals
        FROM filtered_deals
    ),
    stage_breakdown AS (
        SELECT
            s.id,
            s.name,
            s.color,
            s.position,
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
        'win_rate', CASE
            WHEN s.closed_deals > 0 THEN ROUND((s.won_deals::NUMERIC / s.closed_deals::NUMERIC) * 100, 1)
            ELSE 0
        END,
        'stages', (SELECT jsonb_agg(sb) FROM stage_breakdown sb)
    )
    INTO v_result
    FROM summary s;

    RETURN v_result;
END;
$$;

-- 8. High-Performance Global Search RPC (GIN-Powered across all tables)
CREATE OR REPLACE FUNCTION public.global_search(
    p_query TEXT,
    p_limit INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pattern TEXT;
    v_deals JSONB;
    v_contacts JSONB;
    v_companies JSONB;
    v_activities JSONB;
    v_tasks JSONB;
BEGIN
    v_pattern := '%' || p_query || '%';

    -- Deals
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_deals FROM (
        SELECT id, title, value FROM public.deals
        WHERE title ILIKE v_pattern
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    -- Contacts
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_contacts FROM (
        SELECT id, first_name, last_name, email FROM public.contacts
        WHERE (first_name || ' ' || last_name || ' ' || COALESCE(email, '')) ILIKE v_pattern
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    -- Companies
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_companies FROM (
        SELECT id, name, industry FROM public.companies
        WHERE name ILIKE v_pattern
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    -- Activities
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_activities FROM (
        SELECT id, title, type FROM public.activities
        WHERE title ILIKE v_pattern
        ORDER BY created_at DESC LIMIT p_limit
    ) sub;

    -- Tasks
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_tasks FROM (
        SELECT id, title, priority, completed FROM public.tasks
        WHERE title ILIKE v_pattern
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
