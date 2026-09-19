-- ==============================================================================
-- 05: Storage Buckets & Realtime Publications
-- ==============================================================================

-- 1. Avatars Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Storage Policies for Avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2. Realtime Publication Setup
DO $$
BEGIN
    -- Enable REPLICA IDENTITY FULL on tables requiring complete row diffs
    ALTER TABLE public.deals REPLICA IDENTITY FULL;
    ALTER TABLE public.activities REPLICA IDENTITY FULL;
    ALTER TABLE public.tasks REPLICA IDENTITY FULL;
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
    ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;

    -- Add to publication if not already present
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
