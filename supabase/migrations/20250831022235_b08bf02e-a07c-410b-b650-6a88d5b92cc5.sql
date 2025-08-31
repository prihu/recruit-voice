-- Add fields for Indian context support
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IN',
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

-- Add language preference to candidates
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English';

-- Add fields for better analytics tracking
ALTER TABLE public.screens
ADD COLUMN IF NOT EXISTS response_completeness NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0;

-- Add index for better performance on analytics queries
CREATE INDEX IF NOT EXISTS idx_screens_organization_status ON public.screens(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_screens_outcome ON public.screens(outcome);
CREATE INDEX IF NOT EXISTS idx_screens_scheduled_at ON public.screens(scheduled_at);