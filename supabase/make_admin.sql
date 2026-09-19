-- ==============================================================================
-- Elevate User to Admin / Auto-Grant Admin to bethebayou@gmail.com
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project: czuwelxmgjwbzwrqqlfv
-- 3. Go to SQL Editor -> "New Query"
-- 4. Paste this entire script and click "Run"
-- ==============================================================================

-- 1. Ensure public.app_role enum exists with 'admin'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN 
        CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'rep'); 
    END IF; 
END $$;

-- 2. If bethebayou@gmail.com is already registered in auth.users, promote them to admin now:
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE lower(email) = 'bethebayou@gmail.com' 
    LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        -- Delete any non-admin role
        DELETE FROM public.user_roles 
        WHERE user_id = target_user_id;

        -- Insert admin role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin'::public.app_role)
        ON CONFLICT (user_id, role) DO NOTHING;

        -- Ensure profile exists
        INSERT INTO public.profiles (user_id, full_name, company)
        VALUES (target_user_id, 'Bethe Bayou', 'Goom CRM')
        ON CONFLICT (user_id) DO UPDATE 
        SET full_name = COALESCE(public.profiles.full_name, 'Bethe Bayou');

        RAISE NOTICE 'SUCCESS: bethebayou@gmail.com (id: %) is now an ADMIN in public.user_roles.', target_user_id;
    ELSE
        RAISE NOTICE 'INFO: bethebayou@gmail.com has not registered in auth.users yet. The trigger configured below will automatically assign them ADMIN role as soon as they sign up!';
    END IF;
END $$;

-- 3. Update the handle_new_user trigger so that bethebayou@gmail.com 
--    is ALWAYS granted the 'admin' role automatically on registration:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_full_name TEXT;
    v_company TEXT;
    v_role public.app_role;
    v_is_first_user BOOLEAN;
BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    v_company := COALESCE(NEW.raw_user_meta_data->>'company', 'Goom CRM');

    INSERT INTO public.profiles (user_id, full_name, company)
    VALUES (NEW.id, v_full_name, v_company)
    ON CONFLICT (user_id) DO NOTHING;

    -- If bethebayou@gmail.com OR the first user in the database, grant 'admin'
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first_user;
    IF lower(NEW.email) = 'bethebayou@gmail.com' OR v_is_first_user THEN 
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

-- Ensure the trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verification Query: View all current workspace admins
SELECT 
    u.id AS user_id,
    u.email,
    r.role,
    p.full_name,
    u.created_at
FROM auth.users u
LEFT JOIN public.user_roles r ON u.id = r.user_id
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE r.role = 'admin' OR lower(u.email) = 'bethebayou@gmail.com';
