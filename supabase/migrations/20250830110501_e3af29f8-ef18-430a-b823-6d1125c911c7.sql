-- Create a demo user profile first if it doesn't exist
INSERT INTO public.profiles (user_id, full_name, company_name, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'Demo Recruiter', 'Demo Company', 'recruiter')
ON CONFLICT (user_id) DO NOTHING;

-- Clear existing demo data
DELETE FROM public.screens WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.candidates WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.roles WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Insert demo roles
INSERT INTO public.roles (user_id, title, summary, location, salary_min, salary_max, status, voice_enabled, questions, faq, rules) VALUES
('00000000-0000-0000-0000-000000000000', 'Senior Python Engineer', 'Looking for experienced Python developer for backend team', 'Bangalore, India', 80000, 120000, 'active', true, 
 '[{"id": "q1", "question": "How many years of Python experience do you have?", "required": true}]'::jsonb,
 '[{"question": "Is remote work available?", "answer": "Hybrid model with 3 days in office"}]'::jsonb,
 '[{"id": "r1", "rule": "Must have 5+ years Python", "weight": 50}]'::jsonb);

-- Insert demo candidates  
INSERT INTO public.candidates (user_id, name, email, phone, skills, exp_years, salary_expectation) VALUES
('00000000-0000-0000-0000-000000000000', 'Priya Sharma', 'priya@demo.com', '+91-9876543210', ARRAY['Python', 'Django'], 6, 95000),
('00000000-0000-0000-0000-000000000000', 'Rahul Verma', 'rahul@demo.com', '+91-9876543211', ARRAY['React', 'TypeScript'], 4, 75000);

-- Insert demo screens
INSERT INTO public.screens (user_id, role_id, candidate_id, status, score, outcome, ai_summary)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  r.id,
  c.id,
  'completed',
  85,
  'pass',
  'Strong candidate with relevant experience'
FROM public.roles r, public.candidates c
WHERE r.user_id = '00000000-0000-0000-0000-000000000000'
  AND c.user_id = '00000000-0000-0000-0000-000000000000'
  AND r.title = 'Senior Python Engineer'
  AND c.name = 'Priya Sharma';