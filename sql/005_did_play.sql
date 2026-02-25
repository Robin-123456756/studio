-- Migration 005: Add did_play column to player_stats
-- Tracks whether a player appeared in a match for this gameweek.
-- Used by the scoring engine for auto-substitution logic.

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS did_play BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN player_stats.did_play IS 'Whether the player appeared in a match this GW. Used for auto-sub logic.';
