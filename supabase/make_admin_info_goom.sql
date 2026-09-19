-- ==============================================================================
-- Make info.goom@gmail.com a PLATFORM ADMIN
-- Steps:
--   1. Open: https://supabase.com/dashboard/project/czuwelxmgjwbzwrqqlfv/sql/new
--   2. Paste this entire script and click Run
-- ==============================================================================

-- 1. Ensure app_role enum exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'rep');
    END IF;
END $$;

-- 2. If info.goom@gmail.com already exists, promote to admin immediately
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE lower(email) = 'info.goom@gmail.com'
    LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        DELETE FROM public.user_roles WHERE user_id = target_user_id;

        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin'::public.app_role)
        ON CONFLICT (user_id, role) DO NOTHING;

        INSERT INTO public.profiles (user_id, full_name, company)
        VALUES (target_user_id, 'Goom Admin', 'Goom CRM')
        ON CONFLICT (user_id) DO UPDATE
        SET full_name = COALESCE(public.profiles.full_name, 'Goom Admin');

        RAISE NOTICE 'SUCCESS: info.goom@gmail.com (id: %) is now ADMIN.', target_user_id;
    ELSE
        RAISE NOTICE 'INFO: info.goom@gmail.com not registered yet. Sign up at the app first, then re-run OR the trigger below will auto-promote on signup.';
    END IF;
END $$;

-- 3. Update handle_new_user trigger to auto-grant admin to info.goom@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_full_name TEXT;
    v_company   TEXT;
    v_role      public.app_role;
    v_is_first  BOOLEAN;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    v_company := COALESCE(NEW.raw_user_meta_data->>'company', 'Goom CRM');

    INSERT INTO public.profiles (user_id, full_name, company)
    VALUES (NEW.id, v_full_name, v_company)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first;
    IF lower(NEW.email) IN ('info.goom@gmail.com', 'bethebayou@gmail.com') OR v_is_first THEN
        v_role := 'admin'::public.app_role;
    ELSE
        v_role := 'rep'::public.app_role;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role)
    ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role;

    PERFORM public.seed_default_pipeline(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify: list all admins
SELECT u.id, u.email, r.role, p.full_name, u.created_at
FROM auth.users u
LEFT JOIN public.user_roles r ON u.id = r.user_id
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE r.role = 'admin'
ORDER BY u.created_at;
