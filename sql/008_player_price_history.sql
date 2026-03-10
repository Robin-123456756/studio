-- Track player price changes over time
CREATE TABLE IF NOT EXISTS player_price_history (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  old_price NUMERIC(6,1) NOT NULL,
  new_price NUMERIC(6,1) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pph_player_id ON player_price_history(player_id);
CREATE INDEX IF NOT EXISTS idx_pph_changed_at ON player_price_history(changed_at DESC);
