-- Create bulk_operations table for tracking bulk screening operations
CREATE TABLE public.bulk_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'bulk_screening',
  role_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_operations ENABLE ROW LEVEL SECURITY;

-- Create policies for bulk_operations
CREATE POLICY "Users can view bulk operations in their organization" 
ON public.bulk_operations 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create bulk operations in their organization" 
ON public.bulk_operations 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update bulk operations in their organization" 
ON public.bulk_operations 
FOR UPDATE 
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid()
));

-- Add bulk_operation_id to screens table
ALTER TABLE public.screens 
ADD COLUMN bulk_operation_id UUID REFERENCES public.bulk_operations(id);

-- Create index for better performance
CREATE INDEX idx_screens_bulk_operation_id ON public.screens(bulk_operation_id);
CREATE INDEX idx_bulk_operations_status ON public.bulk_operations(status);
CREATE INDEX idx_bulk_operations_organization ON public.bulk_operations(organization_id);

-- Create trigger for updating bulk_operations updated_at
CREATE TRIGGER update_bulk_operations_updated_at
BEFORE UPDATE ON public.bulk_operations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();