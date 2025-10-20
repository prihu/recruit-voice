-- Add call quality metrics columns to screens table
ALTER TABLE screens 
  ADD COLUMN IF NOT EXISTS conversation_turns INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidate_responded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_response_time_seconds INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN screens.conversation_turns IS 'Total number of conversation turns (agent + candidate messages)';
COMMENT ON COLUMN screens.candidate_responded IS 'Whether the candidate spoke at least once during the call';
COMMENT ON COLUMN screens.call_connected IS 'Whether this was a real conversation (2+ turns with candidate response)';
COMMENT ON COLUMN screens.first_response_time_seconds IS 'Time in seconds until candidate first responded';