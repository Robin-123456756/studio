-- Migration: user_chips table + active_chip column on user_rosters
-- Each chip can only be used once per season (UNIQUE on user_id + chip).

CREATE TABLE IF NOT EXISTS user_chips (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
  chip TEXT NOT NULL CHECK (chip IN ('bench_boost','triple_captain','wildcard','free_hit')),
  activated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, chip)  -- each chip used once per season
);

-- Allow the roster save route to tag rows with the active chip
ALTER TABLE user_rosters
  ADD COLUMN IF NOT EXISTS active_chip TEXT DEFAULT NULL;
