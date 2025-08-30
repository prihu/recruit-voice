-- Seed demo data for roles
INSERT INTO public.roles (id, user_id, title, summary, location, salary_min, salary_max, salary_currency, status, voice_enabled, questions, faq, rules, voice_settings, call_window) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', auth.uid(), 'Senior Python Engineer', 'We are looking for an experienced Python developer to join our backend team. You will be working on scalable microservices and data processing pipelines.', 'Bangalore, India', 80000, 120000, 'USD', 'active', true, 
   '[{"id": "q1", "question": "Can you describe your experience with Python and how many years you have been working with it?", "required": true, "order": 1}, 
     {"id": "q2", "question": "Have you worked with microservices architecture? Can you give an example?", "required": true, "order": 2},
     {"id": "q3", "question": "What is your experience with data processing frameworks like Apache Spark or Pandas?", "required": true, "order": 3},
     {"id": "q4", "question": "Are you comfortable working from our Whitefield office 3 days a week?", "required": true, "order": 4},
     {"id": "q5", "question": "What are your salary expectations for this role?", "required": true, "order": 5}]'::jsonb,
   '[{"question": "Is remote work available?", "answer": "We follow a hybrid model with 3 days in office and 2 days remote."},
     {"question": "What is the team size?", "answer": "You will be joining a team of 8 backend engineers."},
     {"question": "Are there growth opportunities?", "answer": "Yes, we have a clear career progression path with regular performance reviews."}]'::jsonb,
   '[{"id": "r1", "rule": "Must have 5+ years Python experience", "weight": 25, "keywords": ["5 years", "five years", "senior", "experienced"]},
     {"id": "r2", "rule": "Experience with microservices", "weight": 25, "keywords": ["microservices", "distributed", "APIs", "REST"]},
     {"id": "r3", "rule": "Data processing knowledge", "weight": 20, "keywords": ["Spark", "Pandas", "ETL", "data pipeline"]},
     {"id": "r4", "rule": "Willing to work from office", "weight": 20, "keywords": ["yes", "office", "Whitefield", "commute"]},
     {"id": "r5", "rule": "Salary expectations match", "weight": 10, "keywords": ["80k", "100k", "negotiable"]}]'::jsonb,
   '{"voice": "Roger", "language": "en", "temperature": 0.7}'::jsonb,
   '{"timezone": "Asia/Kolkata", "allowedDays": [1, 2, 3, 4, 5], "maxAttempts": 3, "allowedHours": {"start": "09:00", "end": "18:00"}}'::jsonb),
  
  ('550e8400-e29b-41d4-a716-446655440001', auth.uid(), 'React Frontend Developer', 'Join our UI team to build beautiful, responsive web applications using React and TypeScript.', 'Koramangala, Bangalore', 60000, 90000, 'USD', 'active', true,
   '[{"id": "q1", "question": "How many years of experience do you have with React?", "required": true, "order": 1},
     {"id": "q2", "question": "Can you explain your experience with TypeScript?", "required": true, "order": 2},
     {"id": "q3", "question": "Have you worked with state management libraries like Redux or Zustand?", "required": true, "order": 3},
     {"id": "q4", "question": "Can you commute to Koramangala office daily?", "required": true, "order": 4},
     {"id": "q5", "question": "What salary range are you looking for?", "required": true, "order": 5}]'::jsonb,
   '[{"question": "What projects will I work on?", "answer": "You will work on our customer-facing dashboard and internal tools."},
     {"question": "Is there a learning budget?", "answer": "Yes, we provide annual learning budget of $2000."}]'::jsonb,
   '[{"id": "r1", "rule": "3+ years React experience", "weight": 30, "keywords": ["3 years", "three years", "React"]},
     {"id": "r2", "rule": "TypeScript proficiency", "weight": 25, "keywords": ["TypeScript", "typed", "interfaces"]},
     {"id": "r3", "rule": "State management experience", "weight": 20, "keywords": ["Redux", "Zustand", "Context", "state"]},
     {"id": "r4", "rule": "Location compatibility", "weight": 15, "keywords": ["yes", "Koramangala", "commute", "daily"]},
     {"id": "r5", "rule": "Salary match", "weight": 10, "keywords": ["60k", "70k", "80k", "negotiable"]}]'::jsonb,
   '{"voice": "Charlotte", "language": "en", "temperature": 0.8}'::jsonb,
   '{"timezone": "Asia/Kolkata", "allowedDays": [1, 2, 3, 4, 5], "maxAttempts": 3, "allowedHours": {"start": "10:00", "end": "19:00"}}'::jsonb),

  ('550e8400-e29b-41d4-a716-446655440002', auth.uid(), 'Product Manager', 'Lead product strategy and roadmap for our B2B SaaS platform.', 'HSR Layout, Bangalore', 100000, 150000, 'USD', 'active', true,
   '[{"id": "q1", "question": "Tell me about your product management experience", "required": true, "order": 1},
     {"id": "q2", "question": "Have you worked on B2B SaaS products before?", "required": true, "order": 2},
     {"id": "q3", "question": "How do you prioritize features and handle stakeholder requests?", "required": true, "order": 3},
     {"id": "q4", "question": "Are you comfortable with 2 days office from HSR Layout?", "required": true, "order": 4}]'::jsonb,
   '[{"question": "What is the product focus?", "answer": "HR Tech and recruitment automation tools."},
     {"question": "Team structure?", "answer": "You will work with 2 designers and 8 engineers."}]'::jsonb,
   '[{"id": "r1", "rule": "5+ years PM experience", "weight": 35, "keywords": ["5 years", "product manager", "PM"]},
     {"id": "r2", "rule": "B2B SaaS experience", "weight": 30, "keywords": ["B2B", "SaaS", "enterprise", "subscription"]},
     {"id": "r3", "rule": "Strategic thinking", "weight": 25, "keywords": ["prioritize", "roadmap", "strategy", "metrics"]},
     {"id": "r4", "rule": "Location fit", "weight": 10, "keywords": ["yes", "HSR", "office", "hybrid"]}]'::jsonb,
   '{"voice": "Sarah", "language": "en", "temperature": 0.6}'::jsonb,
   '{"timezone": "Asia/Kolkata", "allowedDays": [1, 2, 3, 4, 5], "maxAttempts": 2, "allowedHours": {"start": "11:00", "end": "20:00"}}'::jsonb);

-- Seed demo candidates
INSERT INTO public.candidates (id, user_id, name, email, phone, skills, exp_years, location_pref, salary_expectation, language) VALUES
  ('c1000000-0000-0000-0000-000000000001', auth.uid(), 'Priya Sharma', 'priya.sharma@email.com', '+91-9876543210', ARRAY['Python', 'Django', 'PostgreSQL', 'Docker', 'AWS'], 6, 'Bangalore', 95000, 'en'),
  ('c1000000-0000-0000-0000-000000000002', auth.uid(), 'Rahul Verma', 'rahul.verma@email.com', '+91-9876543211', ARRAY['React', 'TypeScript', 'Node.js', 'GraphQL'], 4, 'Bangalore', 75000, 'en'),
  ('c1000000-0000-0000-0000-000000000003', auth.uid(), 'Anjali Patel', 'anjali.patel@email.com', '+91-9876543212', ARRAY['Product Management', 'Agile', 'JIRA', 'Analytics'], 7, 'Bangalore', 130000, 'en'),
  ('c1000000-0000-0000-0000-000000000004', auth.uid(), 'Arjun Kumar', 'arjun.kumar@email.com', '+91-9876543213', ARRAY['Python', 'FastAPI', 'Redis', 'Kubernetes'], 5, 'Remote', 110000, 'en'),
  ('c1000000-0000-0000-0000-000000000005', auth.uid(), 'Sneha Reddy', 'sneha.reddy@email.com', '+91-9876543214', ARRAY['React', 'Redux', 'CSS', 'Jest'], 3, 'Koramangala', 65000, 'en'),
  ('c1000000-0000-0000-0000-000000000006', auth.uid(), 'Vikram Singh', 'vikram.singh@email.com', '+91-9876543215', ARRAY['Python', 'Machine Learning', 'Pandas', 'Spark'], 8, 'Whitefield', 125000, 'en'),
  ('c1000000-0000-0000-0000-000000000007', auth.uid(), 'Neha Gupta', 'neha.gupta@email.com', '+91-9876543216', ARRAY['JavaScript', 'Vue.js', 'HTML', 'CSS'], 2, 'HSR Layout', 50000, 'en'),
  ('c1000000-0000-0000-0000-000000000008', auth.uid(), 'Karthik Nair', 'karthik.nair@email.com', '+91-9876543217', ARRAY['Product Strategy', 'User Research', 'Figma'], 6, 'Bangalore', 120000, 'en'),
  ('c1000000-0000-0000-0000-000000000009', auth.uid(), 'Divya Iyer', 'divya.iyer@email.com', '+91-9876543218', ARRAY['Python', 'Flask', 'MongoDB', 'Microservices'], 5, 'Electronic City', 90000, 'en'),
  ('c1000000-0000-0000-0000-000000000010', auth.uid(), 'Aditya Rao', 'aditya.rao@email.com', '+91-9876543219', ARRAY['React', 'Next.js', 'Tailwind', 'TypeScript'], 4, 'Indiranagar', 80000, 'en');

-- Seed demo screening sessions
INSERT INTO public.screens (id, user_id, role_id, candidate_id, status, attempts, score, outcome, screening_type, scheduled_at, started_at, completed_at, 
  transcript, answers, reasons, ai_summary) VALUES
  
  -- Completed successful screening for Python role
  ('s1000000-0000-0000-0000-000000000001', auth.uid(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'c1000000-0000-0000-0000-000000000001', 'completed', 1, 85, 'pass', 'voice',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '15 minutes',
   '[{"speaker": "agent", "text": "Hello Priya, thank you for taking my call. I am calling regarding the Senior Python Engineer position. Do you have 10 minutes to discuss?", "timestamp": "00:00"},
     {"speaker": "candidate", "text": "Yes, absolutely! I am very interested in this opportunity.", "timestamp": "00:15"},
     {"speaker": "agent", "text": "Great! Can you describe your experience with Python and how many years you have been working with it?", "timestamp": "00:20"},
     {"speaker": "candidate", "text": "I have been working with Python for over 6 years now. Started with Django web development and moved into data engineering and microservices.", "timestamp": "00:25"},
     {"speaker": "agent", "text": "Excellent! Have you worked with microservices architecture?", "timestamp": "00:45"},
     {"speaker": "candidate", "text": "Yes, extensively. In my current role, I designed and implemented a microservices architecture using FastAPI and Docker, handling over 1 million requests daily.", "timestamp": "00:50"}]'::jsonb,
   '{"q1": "6 years with Python, Django and data engineering", "q2": "Yes, designed microservices with FastAPI handling 1M requests daily", "q3": "Expert in Pandas and PySpark for ETL pipelines", "q4": "Yes, can commute to Whitefield 3 days a week", "q5": "Looking for 95-100k USD"}'::jsonb,
   ARRAY['Strong Python experience (6+ years)', 'Proven microservices architecture skills', 'Excellent data processing knowledge', 'Location compatible', 'Salary expectations within range'],
   'Priya is an excellent fit with 6 years of Python experience, strong microservices background, and data processing expertise. Available for hybrid work from Whitefield.'),

  -- Completed but failed screening
  ('s1000000-0000-0000-0000-000000000002', auth.uid(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'c1000000-0000-0000-0000-000000000007', 'completed', 1, 35, 'fail', 'voice',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes',
   '[{"speaker": "agent", "text": "Hello Neha, calling about the Senior Python Engineer role. Do you have time to talk?", "timestamp": "00:00"},
     {"speaker": "candidate", "text": "Sure, I can talk.", "timestamp": "00:10"},
     {"speaker": "agent", "text": "Can you describe your Python experience?", "timestamp": "00:15"},
     {"speaker": "candidate", "text": "I mainly work with JavaScript and Vue.js. I have done some Python scripts but not professionally.", "timestamp": "00:20"}]'::jsonb,
   '{"q1": "Limited Python, mainly JavaScript", "q2": "No microservices experience", "q3": "No data processing experience", "q4": "Yes, can work from office", "q5": "Looking for 50k"}'::jsonb,
   ARRAY['Insufficient Python experience', 'No microservices background', 'Lacks required technical skills'],
   'Neha does not meet the technical requirements. Primary experience is in JavaScript/Vue.js with minimal Python exposure.'),

  -- In progress screening
  ('s1000000-0000-0000-0000-000000000003', auth.uid(), '550e8400-e29b-41d4-a716-446655440001', 'c1000000-0000-0000-0000-000000000002', 'in_progress', 1, NULL, NULL, 'voice',
   NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', NULL, NULL, NULL, NULL, NULL),

  -- Scheduled screening
  ('s1000000-0000-0000-0000-000000000004', auth.uid(), '550e8400-e29b-41d4-a716-446655440001', 'c1000000-0000-0000-0000-000000000005', 'scheduled', 0, NULL, NULL, 'voice',
   NOW() + INTERVAL '2 hours', NULL, NULL, NULL, NULL, NULL, NULL),

  -- Another successful screening
  ('s1000000-0000-0000-0000-000000000005', auth.uid(), '550e8400-e29b-41d4-a716-446655440002', 'c1000000-0000-0000-0000-000000000003', 'completed', 1, 92, 'pass', 'voice',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '12 minutes',
   '[{"speaker": "agent", "text": "Hello Anjali, thank you for your time. Calling about the Product Manager position.", "timestamp": "00:00"},
     {"speaker": "candidate", "text": "Hi! Yes, I have been expecting your call. Very excited about this role!", "timestamp": "00:10"},
     {"speaker": "agent", "text": "Tell me about your product management experience.", "timestamp": "00:15"},
     {"speaker": "candidate", "text": "I have 7 years as a Product Manager, last 4 years focused on B2B SaaS platforms in the HR tech space.", "timestamp": "00:20"}]'::jsonb,
   '{"q1": "7 years PM experience, 4 in B2B SaaS", "q2": "Yes, built HR tech SaaS platform", "q3": "Use RICE framework and data-driven prioritization", "q4": "Happy with hybrid model from HSR"}'::jsonb,
   ARRAY['Extensive PM experience', 'Perfect B2B SaaS background', 'Strong strategic thinking', 'Great communication skills'],
   'Anjali is an ideal candidate with 7 years PM experience and specific B2B SaaS expertise in HR tech.'),

  -- Failed after retry
  ('s1000000-0000-0000-0000-000000000006', auth.uid(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'c1000000-0000-0000-0000-000000000004', 'completed', 2, 55, 'maybe', 'voice',
   NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours' + INTERVAL '11 minutes',
   '[{"speaker": "agent", "text": "Hi Arjun, calling about the Python Engineer role.", "timestamp": "00:00"},
     {"speaker": "candidate", "text": "Yes, interested to know more.", "timestamp": "00:10"}]'::jsonb,
   '{"q1": "5 years Python experience", "q2": "Some microservices work", "q3": "Basic Pandas knowledge", "q4": "Prefer remote only", "q5": "Want 110k minimum"}'::jsonb,
   ARRAY['Good Python experience', 'Location preference mismatch', 'Salary slightly high'],
   'Arjun has technical skills but prefers remote work which may not align with hybrid requirement.');

-- Update the sequences if needed
SELECT setval('public.roles_id_seq', COALESCE((SELECT MAX(id) FROM public.roles), 1), true);
SELECT setval('public.candidates_id_seq', COALESCE((SELECT MAX(id) FROM public.candidates), 1), true);
SELECT setval('public.screens_id_seq', COALESCE((SELECT MAX(id) FROM public.screens), 1), true);