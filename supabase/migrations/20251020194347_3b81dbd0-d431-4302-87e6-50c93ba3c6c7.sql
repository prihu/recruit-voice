-- Allow NULL for outcome column to support pending/failed statuses
ALTER TABLE screens ALTER COLUMN outcome DROP NOT NULL;

-- Update existing records with status='pending' or 'failed' to have NULL outcome
UPDATE screens 
SET outcome = NULL 
WHERE status IN ('pending', 'failed');

-- Update existing completed screens with no answers to 'incomplete'
UPDATE screens 
SET outcome = 'incomplete' 
WHERE status = 'completed' 
  AND (answers IS NULL OR answers = '[]'::jsonb OR answers = '{}'::jsonb)
  AND outcome IS NOT NULL;

-- Add comment for outcome column to document the logic
COMMENT ON COLUMN screens.outcome IS 'Screening outcome: "pass" (completed & passed), "fail" (completed & failed), "incomplete" (connected but not completed), NULL (pending/failed status)';

-- Add comment for call_connected to clarify meaning
COMMENT ON COLUMN screens.call_connected IS 'Whether the phone call was answered (agent message delivered), not necessarily that candidate engaged';

-- Add comment for candidate_responded
COMMENT ON COLUMN screens.candidate_responded IS 'Whether the candidate actually spoke during the call';