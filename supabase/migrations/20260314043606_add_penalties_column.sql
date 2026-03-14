-- Add penalties tracking to player_match_events and player_stats
-- A penalty goal is a goal with penalties > 0; constraint ensures penalties <= quantity

ALTER TABLE player_match_events
  ADD COLUMN IF NOT EXISTS penalties INT NOT NULL DEFAULT 0;

ALTER TABLE player_match_events
  ADD CONSTRAINT chk_penalties_lte_quantity
  CHECK (penalties <= quantity);

ALTER TABLE player_stats
  ADD COLUMN IF NOT EXISTS penalties INT NOT NULL DEFAULT 0;
