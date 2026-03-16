-- Add display_size column to feed_media for admin-controlled card sizing.
-- Values: 'compact', 'standard' (default), 'featured'.
-- Column already exists in production (added via Supabase MCP apply_migration);
-- this file ensures local dev and fresh DBs stay in sync.
ALTER TABLE feed_media ADD COLUMN IF NOT EXISTS display_size TEXT DEFAULT 'standard';
