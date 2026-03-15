-- Create the feed_media table (base schema)
CREATE TABLE IF NOT EXISTS feed_media (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  gameweek_id INTEGER,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Base index for public feed queries
CREATE INDEX IF NOT EXISTS idx_feed_media_active_created
  ON feed_media (is_active, is_pinned DESC, created_at DESC);
