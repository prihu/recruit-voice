-- Add extracted_data column to screens table for structured export data
ALTER TABLE screens 
ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Create index for faster queries on extracted data
CREATE INDEX IF NOT EXISTS idx_screens_extracted_data ON screens USING GIN (extracted_data);

-- Add comment for documentation
COMMENT ON COLUMN screens.extracted_data IS 'Structured data extracted from screening transcript for easy export';