-- ==============================================================================
-- 06: Beta Tester Feedback Table & Policies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL,
    comment TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Admin triage
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or anon) can submit beta feedback
DROP POLICY IF EXISTS "Anyone can submit beta feedback" ON public.feedback;
CREATE POLICY "Anyone can submit beta feedback"
    ON public.feedback FOR INSERT
    TO public
    WITH CHECK (true);

-- Authenticated users can view feedback (admins can triage, users can see their own)
DROP POLICY IF EXISTS "Authenticated users can view feedback" ON public.feedback;
CREATE POLICY "Authenticated users can view feedback"
    ON public.feedback FOR SELECT
    TO authenticated
    USING (true);

-- Admins or creators can update feedback status
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback"
    ON public.feedback FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Realtime notification for new beta feedback
DO $$
BEGIN
    ALTER TABLE public.feedback REPLICA IDENTITY FULL;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
