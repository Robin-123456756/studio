-- ============================================================
-- Mini-Leagues: tables, indexes, RLS, seed data, auto-join trigger
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create tables
CREATE TABLE mini_leagues (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  is_general  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mini_league_members (
  league_id  INT NOT NULL REFERENCES mini_leagues(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

-- 2. Indexes
CREATE INDEX idx_mini_leagues_invite_code ON mini_leagues(invite_code);
CREATE INDEX idx_mlm_user_id ON mini_league_members(user_id);

-- 3. RLS (service-role full access — API routes use service key)
ALTER TABLE mini_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON mini_leagues
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON mini_league_members
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Seed the "Overall" general league
--    (uses a deterministic invite code that won't be shared)
INSERT INTO mini_leagues (name, created_by, invite_code, is_general)
SELECT
  'Budo League',
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  'OVERALL0',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM mini_leagues WHERE is_general = true
);

-- 5. Auto-join ALL existing users to the Overall league
INSERT INTO mini_league_members (league_id, user_id)
SELECT ml.id, u.id
FROM mini_leagues ml
CROSS JOIN auth.users u
WHERE ml.is_general = true
  AND NOT EXISTS (
    SELECT 1 FROM mini_league_members mlm
    WHERE mlm.league_id = ml.id AND mlm.user_id = u.id
  );

-- 6. Trigger: auto-join new users to all general leagues
CREATE OR REPLACE FUNCTION auto_join_general_leagues()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO mini_league_members (league_id, user_id)
  SELECT id, NEW.id
  FROM mini_leagues
  WHERE is_general = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_join_general_leagues ON auth.users;
CREATE TRIGGER trg_auto_join_general_leagues
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_join_general_leagues();
