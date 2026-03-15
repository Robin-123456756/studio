-- Feed Media Manager Upgrade: layout, status, video, gallery, analytics
-- Originally applied manually; now tracked as a proper migration.

-- Phase 1: Layout + rich content
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS layout TEXT DEFAULT 'hero';
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;

-- Phase 2: Video support
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';

-- Phase 4: Gallery / multi-image
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS media_urls JSONB;

-- Phase 5: Analytics
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- RPC for atomic view count increment (Phase 5)
CREATE OR REPLACE FUNCTION increment_feed_view_count(item_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE feed_media
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = item_id AND is_active = true;
END;
$$;

-- Index for faster public feed queries
CREATE INDEX IF NOT EXISTS idx_feed_media_active_status
  ON feed_media (is_active, status, is_pinned DESC, created_at DESC);

-- Index for scheduled items auto-publish
CREATE INDEX IF NOT EXISTS idx_feed_media_scheduled
  ON feed_media (status, publish_at)
  WHERE status = 'scheduled' AND is_active = true;
