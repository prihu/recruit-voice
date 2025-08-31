-- Create an RPC to ensure the current authenticated user has an organization and membership
-- Returns the ensured organization_id
CREATE OR REPLACE FUNCTION public.ensure_demo_org_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Try to find existing membership
  SELECT organization_id INTO org_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF org_id IS NULL THEN
    -- Create a demo organization
    INSERT INTO public.organizations (name, company_domain)
    VALUES ('Demo Company', 'demo.com')
    RETURNING id INTO org_id;

    -- Add the user as admin of the new organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, auth.uid(), 'admin');

    -- Ensure the user has a profile (best-effort)
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid()
    ) THEN
      INSERT INTO public.profiles (user_id, role)
      VALUES (auth.uid(), 'recruiter');
    END IF;
  END IF;

  RETURN org_id;
END;
$$;