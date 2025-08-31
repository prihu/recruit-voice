-- Add agent management fields to roles table
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS agent_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS agent_last_used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS agent_sync_status TEXT DEFAULT 'pending' CHECK (agent_sync_status IN ('pending', 'synced', 'failed', 'archived')),
ADD COLUMN IF NOT EXISTS agent_error_message TEXT,
ADD COLUMN IF NOT EXISTS evaluation_criteria TEXT;

-- Create agent archive log table for tracking archived agents
CREATE TABLE IF NOT EXISTS public.agent_archive_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reason TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Enable RLS on agent_archive_log
ALTER TABLE public.agent_archive_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent_archive_log
CREATE POLICY "Users can view archive logs in their organization" 
ON public.agent_archive_log 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create archive logs in their organization" 
ON public.agent_archive_log 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_agent_last_used_at ON public.roles(agent_last_used_at);
CREATE INDEX IF NOT EXISTS idx_roles_agent_sync_status ON public.roles(agent_sync_status);
CREATE INDEX IF NOT EXISTS idx_agent_archive_log_role_id ON public.agent_archive_log(role_id);
CREATE INDEX IF NOT EXISTS idx_agent_archive_log_organization_id ON public.agent_archive_log(organization_id);