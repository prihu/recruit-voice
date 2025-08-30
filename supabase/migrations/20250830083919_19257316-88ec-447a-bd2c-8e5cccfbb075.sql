-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  role TEXT DEFAULT 'recruiter',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create roles table for job positions
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  summary TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  voice_enabled BOOLEAN DEFAULT true,
  voice_agent_id TEXT,
  voice_settings JSONB DEFAULT '{"voice": "alloy", "language": "en", "temperature": 0.8}'::jsonb,
  questions JSONB DEFAULT '[]'::jsonb,
  faq JSONB DEFAULT '[]'::jsonb,
  rules JSONB DEFAULT '[]'::jsonb,
  call_window JSONB DEFAULT '{"timezone": "UTC", "allowedHours": {"start": "09:00", "end": "17:00"}, "allowedDays": [1,2,3,4,5], "maxAttempts": 3}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  skills TEXT[],
  exp_years INTEGER,
  location_pref TEXT,
  salary_expectation INTEGER,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create screens table for screening sessions
CREATE TABLE public.screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'incomplete')),
  screening_type TEXT DEFAULT 'voice' CHECK (screening_type IN ('voice', 'text', 'phone')),
  attempts INTEGER DEFAULT 0,
  transcript JSONB,
  audio_url TEXT,
  recording_url TEXT,
  answers JSONB,
  score NUMERIC(5,2),
  outcome TEXT CHECK (outcome IN ('pass', 'fail', 'incomplete')),
  reasons TEXT[],
  duration_seconds INTEGER,
  ai_summary TEXT,
  ai_recommendations JSONB,
  voice_analytics JSONB,
  session_id TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create screening_events table for detailed event tracking
CREATE TABLE public.screening_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID REFERENCES public.screens(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_roles_user_id ON public.roles(user_id);
CREATE INDEX idx_roles_status ON public.roles(status);
CREATE INDEX idx_candidates_user_id ON public.candidates(user_id);
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_screens_user_id ON public.screens(user_id);
CREATE INDEX idx_screens_role_id ON public.screens(role_id);
CREATE INDEX idx_screens_candidate_id ON public.screens(candidate_id);
CREATE INDEX idx_screens_status ON public.screens(status);
CREATE INDEX idx_screening_events_screen_id ON public.screening_events(screen_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_events ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Roles policies
CREATE POLICY "Users can view their own roles" ON public.roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own roles" ON public.roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roles" ON public.roles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roles" ON public.roles
  FOR DELETE USING (auth.uid() = user_id);

-- Candidates policies
CREATE POLICY "Users can view their own candidates" ON public.candidates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own candidates" ON public.candidates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidates" ON public.candidates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own candidates" ON public.candidates
  FOR DELETE USING (auth.uid() = user_id);

-- Screens policies
CREATE POLICY "Users can view their own screens" ON public.screens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own screens" ON public.screens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own screens" ON public.screens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own screens" ON public.screens
  FOR DELETE USING (auth.uid() = user_id);

-- Screening events policies
CREATE POLICY "Users can view events for their screens" ON public.screening_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.screens
      WHERE screens.id = screening_events.screen_id
      AND screens.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create events for their screens" ON public.screening_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.screens
      WHERE screens.id = screening_events.screen_id
      AND screens.user_id = auth.uid()
    )
  );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_screens_updated_at BEFORE UPDATE ON public.screens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for screens table
ALTER PUBLICATION supabase_realtime ADD TABLE public.screens;

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();