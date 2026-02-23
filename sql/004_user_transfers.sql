-- Migration: user_transfers + user_transfer_state tables
-- Tracks each individual transfer and per-gameweek transfer budget.

CREATE TABLE IF NOT EXISTS user_transfers (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
  player_out_id TEXT NOT NULL,
  player_in_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_transfer_state (
  user_id TEXT NOT NULL,
  gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
  free_transfers INTEGER NOT NULL DEFAULT 1,
  used_transfers INTEGER NOT NULL DEFAULT 0,
  wildcard_active BOOLEAN NOT NULL DEFAULT false,
  free_hit_active BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, gameweek_id)
);
