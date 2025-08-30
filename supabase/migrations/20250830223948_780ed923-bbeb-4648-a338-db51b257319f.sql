-- Create organizations table for multi-tenancy
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_domain TEXT,
  settings JSONB DEFAULT '{"timezone": "UTC", "workingHours": {"start": "09:00", "end": "17:00"}, "maxConcurrentCalls": 10}'::jsonb,
  twilio_config JSONB,
  elevenlabs_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add organization membership table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'recruiter',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Add organization_id to existing tables
ALTER TABLE public.roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.candidates ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.screens ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Create scheduled calls table
CREATE TABLE public.scheduled_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create analytics events table
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  event_type TEXT NOT NULL,
  event_category TEXT,
  event_data JSONB,
  screen_id UUID REFERENCES public.screens(id),
  role_id UUID REFERENCES public.roles(id),
  candidate_id UUID REFERENCES public.candidates(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call logs table for telephony
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id UUID NOT NULL REFERENCES public.screens(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  call_sid TEXT,
  phone_number TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound',
  status TEXT,
  duration_seconds INTEGER,
  cost DECIMAL(10,4),
  recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for organizations
CREATE POLICY "Users can view their organizations" 
ON public.organizations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = organizations.id 
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admin users can update their organizations" 
ON public.organizations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = organizations.id 
    AND organization_members.user_id = auth.uid()
    AND organization_members.role = 'admin'
  )
);

-- RLS policies for organization members
CREATE POLICY "Users can view members of their organizations" 
ON public.organization_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Admin users can manage organization members" 
ON public.organization_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid()
    AND om.role = 'admin'
  )
);

-- RLS policies for scheduled calls
CREATE POLICY "Users can view scheduled calls in their organization" 
ON public.scheduled_calls 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = scheduled_calls.organization_id 
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage scheduled calls in their organization" 
ON public.scheduled_calls 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = scheduled_calls.organization_id 
    AND organization_members.user_id = auth.uid()
  )
);

-- RLS policies for analytics events
CREATE POLICY "Users can view analytics in their organization" 
ON public.analytics_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = analytics_events.organization_id 
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create analytics events in their organization" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = analytics_events.organization_id 
    AND organization_members.user_id = auth.uid()
  )
);

-- RLS policies for call logs
CREATE POLICY "Users can view call logs in their organization" 
ON public.call_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = call_logs.organization_id 
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create call logs in their organization" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_members.organization_id = call_logs.organization_id 
    AND organization_members.user_id = auth.uid()
  )
);

-- Update existing RLS policies to support organization context
DROP POLICY IF EXISTS "Users can view their own roles" ON public.roles;
CREATE POLICY "Users can view roles in their organization" 
ON public.roles 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create their own roles" ON public.roles;
CREATE POLICY "Users can create roles in their organization" 
ON public.roles 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own roles" ON public.roles;
CREATE POLICY "Users can update roles in their organization" 
ON public.roles 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own roles" ON public.roles;
CREATE POLICY "Users can delete roles in their organization" 
ON public.roles 
FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Similar updates for candidates and screens
DROP POLICY IF EXISTS "Users can view their own candidates" ON public.candidates;
CREATE POLICY "Users can view candidates in their organization" 
ON public.candidates 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create their own candidates" ON public.candidates;
CREATE POLICY "Users can create candidates in their organization" 
ON public.candidates 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own candidates" ON public.candidates;
CREATE POLICY "Users can update candidates in their organization" 
ON public.candidates 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own candidates" ON public.candidates;
CREATE POLICY "Users can delete candidates in their organization" 
ON public.candidates 
FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Update screens policies
DROP POLICY IF EXISTS "Users can view their own screens" ON public.screens;
CREATE POLICY "Users can view screens in their organization" 
ON public.screens 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create their own screens" ON public.screens;
CREATE POLICY "Users can create screens in their organization" 
ON public.screens 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own screens" ON public.screens;
CREATE POLICY "Users can update screens in their organization" 
ON public.screens 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own screens" ON public.screens;
CREATE POLICY "Users can delete screens in their organization" 
ON public.screens 
FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Create function to auto-assign organization to new records
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create triggers for timestamp updates on new tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_calls_updated_at
  BEFORE UPDATE ON public.scheduled_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();