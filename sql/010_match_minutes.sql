-- Add minutes column to matches for live match tracking (FPL-style)
-- NULL = not started or not tracked, 0 = kickoff, 30 = half time, 60 = full time
ALTER TABLE matches ADD COLUMN IF NOT EXISTS minutes smallint DEFAULT NULL;
