-- Insert the demo organization
INSERT INTO public.organizations (id, name, company_domain, settings)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'Demo Company',
  'demo.recruiterscreen.ai',
  '{"timezone": "Asia/Kolkata", "workingHours": {"end": "18:00", "start": "09:00"}, "maxConcurrentCalls": 10}'::jsonb
) ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    company_domain = EXCLUDED.company_domain,
    settings = EXCLUDED.settings;