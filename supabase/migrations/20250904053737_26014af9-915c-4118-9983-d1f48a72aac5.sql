-- Make email nullable in candidates table
ALTER TABLE public.candidates 
ALTER COLUMN email DROP NOT NULL;