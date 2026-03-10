-- Add summary_sent_at column to gameweeks for GW summary push deduplication
-- NULL = summary not yet sent, timestamptz = when it was sent
ALTER TABLE gameweeks ADD COLUMN IF NOT EXISTS summary_sent_at timestamptz DEFAULT NULL;
