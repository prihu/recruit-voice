-- Fix security warnings for functions with mutable search_path
-- Set search_path to public schema for all functions

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.get_user_organization_id() SET search_path = public;