-- Create demo organization and update demo user provisioning
-- This migration sets up initial organization data for testing

-- Update the handle_new_user function to create organization and membership
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter'));
  
  -- Check if user has an organization in metadata
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
    -- User is joining existing organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES ((NEW.raw_user_meta_data->>'organization_id')::UUID, NEW.id, 'recruiter');
  ELSE
    -- Create new organization for the user
    INSERT INTO public.organizations (name, company_domain)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Demo Company'),
      COALESCE(NEW.raw_user_meta_data->>'company_domain', 'demo.com')
    )
    RETURNING id INTO new_org_id;
    
    -- Add user as admin of new organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR each ROW EXECUTE PROCEDURE public.handle_new_user();