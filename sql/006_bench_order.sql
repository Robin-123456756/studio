-- Migration 006: Add bench_order column to user_rosters
-- NULL = starter (in starting XI)
-- 1..7 = bench priority order (1 = first sub candidate)

ALTER TABLE user_rosters ADD COLUMN IF NOT EXISTS bench_order INTEGER DEFAULT NULL;

COMMENT ON COLUMN user_rosters.bench_order IS 'Bench priority order (1=first sub). NULL for starters.';
