-- Cup competition (knockout tournament)

CREATE TABLE IF NOT EXISTS cup_rounds (
  id SERIAL PRIMARY KEY,
  round_number INT NOT NULL,            -- 1 = first round, 2 = second round, etc.
  round_name TEXT NOT NULL,             -- "Round of 16", "Quarter-Final", "Semi-Final", "Final"
  gameweek_id INT REFERENCES gameweeks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cup_matches (
  id SERIAL PRIMARY KEY,
  round_id INT NOT NULL REFERENCES cup_rounds(id) ON DELETE CASCADE,
  user1_id UUID NOT NULL,               -- seeded/higher rank
  user2_id UUID,                        -- NULL = bye (user1 auto-advances)
  user1_points INT DEFAULT 0,
  user2_points INT DEFAULT 0,
  winner_id UUID,                       -- set after GW is finalized
  is_bye BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cup_matches_round ON cup_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_cup_matches_user1 ON cup_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_cup_matches_user2 ON cup_matches(user2_id);
