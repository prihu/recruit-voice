
-- Clean up duplicate active screens by marking older duplicates as 'failed'
-- Keep the most recent screen (b3d41f61-e4b6-44f5-8dba-871b563f6e8f) and fail the older ones
UPDATE screens 
SET status = 'failed', 
    outcome = 'incomplete',
    reasons = ARRAY['Marked as duplicate - superseded by newer screening'],
    updated_at = NOW()
WHERE id IN (
  'f141ec69-cb8e-467c-96d7-270e55227ceb',
  '515dbaa5-1b4f-4058-812b-8043f0991a19'
);

-- Now add the unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_screens_candidate_role_active 
ON screens(candidate_id, role_id) 
WHERE status NOT IN ('completed', 'failed');
