-- Create function to safely increment bulk operation counts
CREATE OR REPLACE FUNCTION public.increment_bulk_operation_count(
  operation_id UUID,
  count_type TEXT
)
RETURNS VOID AS $$
BEGIN
  IF count_type = 'completed_count' THEN
    UPDATE public.bulk_operations 
    SET completed_count = completed_count + 1,
        updated_at = NOW()
    WHERE id = operation_id;
  ELSIF count_type = 'failed_count' THEN
    UPDATE public.bulk_operations 
    SET failed_count = failed_count + 1,
        updated_at = NOW()
    WHERE id = operation_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;