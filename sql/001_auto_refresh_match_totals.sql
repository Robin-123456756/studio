-- ============================================================
-- Auto-refresh materialized view on player_match_events changes
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- 1. Create the trigger function
--    Calls the existing refresh_match_totals() RPC after any
--    INSERT / UPDATE / DELETE on player_match_events.
CREATE OR REPLACE FUNCTION trigger_refresh_match_totals()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_match_totals();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS trg_refresh_match_totals ON player_match_events;

-- 3. Create statement-level trigger
--    FOR EACH STATEMENT fires once per SQL statement (not per row),
--    so a batch INSERT of 10 rows only refreshes once.
CREATE TRIGGER trg_refresh_match_totals
  AFTER INSERT OR UPDATE OR DELETE ON player_match_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_match_totals();
