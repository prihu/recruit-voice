-- Phase 1: Critical indexes for session_id lookup performance
CREATE INDEX IF NOT EXISTS idx_screens_session_id ON screens(session_id);

-- Index for organization + status filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_screens_org_status ON screens(organization_id, status);

-- Phase 3: Time tracking for Time-to-First-Interview metric
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_interview_at TIMESTAMPTZ;