-- Remove unused voice_settings column from roles table
ALTER TABLE public.roles DROP COLUMN IF EXISTS voice_settings;

-- Remove unused elevenlabs_config column from organizations table  
ALTER TABLE public.organizations DROP COLUMN IF EXISTS elevenlabs_config;