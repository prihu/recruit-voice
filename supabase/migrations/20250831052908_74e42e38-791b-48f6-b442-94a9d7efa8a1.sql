-- Create helper functions to avoid RLS recursion on organization_members
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Replace recursive RLS policies on organization_members
DROP POLICY IF EXISTS "Users can view members of their organizations" ON public.organization_members;
DROP POLICY IF EXISTS "Admin users can manage organization members" ON public.organization_members;

CREATE POLICY "Users can view members of their organizations"
ON public.organization_members
FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "Admin users can manage organization members"
ON public.organization_members
FOR ALL
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));