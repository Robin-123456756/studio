-- ============================================================
-- Fix: Allow exactly 3 players from the same team (block 4+)
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================
-- The previous trigger used >= 3 which blocked at exactly 3.
-- This fix changes it to > 3 so exactly 3 is allowed.

CREATE OR REPLACE FUNCTION check_squad_team_limit()
RETURNS trigger AS $$
DECLARE
  team_count INTEGER;
  player_team_id INTEGER;
BEGIN
  -- Get the team_id of the player being inserted/updated
  SELECT team_id INTO player_team_id
  FROM players
  WHERE id = NEW.player_id;

  IF player_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count how many players from this team are already in the user's roster
  -- for this gameweek (including the new row being inserted)
  SELECT COUNT(*) INTO team_count
  FROM user_rosters ur
  JOIN players p ON p.id = ur.player_id
  WHERE ur.user_id = NEW.user_id
    AND ur.gameweek_id = NEW.gameweek_id
    AND p.team_id = player_team_id
    AND ur.player_id != NEW.player_id;

  -- Block only if adding this player would exceed 3 (i.e. already 3 others)
  IF team_count >= 3 THEN
    RAISE EXCEPTION 'Squad Limit Reached! You can only have 3 players from the same real-world team.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
