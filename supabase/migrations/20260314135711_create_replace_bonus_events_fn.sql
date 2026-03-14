-- Atomic bonus replacement function
-- Deletes old bonus events, inserts new ones, and recalculates total_points
-- for all affected players — all in a single transaction.

CREATE OR REPLACE FUNCTION replace_bonus_events(
  p_match_id INT,
  p_new_bonuses JSONB  -- [{"player_id": "uuid", "bonus": 3}, ...]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_ids TEXT[];
  new_ids TEXT[];
  all_ids TEXT[];
  bonus_row JSONB;
  pid TEXT;
BEGIN
  -- 1. Collect old bonus player IDs
  SELECT COALESCE(array_agg(player_id::TEXT), '{}')
    INTO affected_ids
    FROM player_match_events
   WHERE match_id = p_match_id AND action = 'bonus';

  -- 2. Collect new bonus player IDs
  SELECT COALESCE(array_agg(elem->>'player_id'), '{}')
    INTO new_ids
    FROM jsonb_array_elements(p_new_bonuses) AS elem;

  -- 3. Merge into unique set
  SELECT ARRAY(SELECT DISTINCT unnest(affected_ids || new_ids))
    INTO all_ids;

  -- 4. Delete old bonus events
  DELETE FROM player_match_events
   WHERE match_id = p_match_id AND action = 'bonus';

  -- 5. Insert new bonus events
  FOR bonus_row IN SELECT * FROM jsonb_array_elements(p_new_bonuses)
  LOOP
    INSERT INTO player_match_events (match_id, player_id, action, quantity, points_awarded, input_method)
    VALUES (
      p_match_id,
      (bonus_row->>'player_id')::UUID,
      'bonus',
      1,
      (bonus_row->>'bonus')::INT,
      'auto'
    );
  END LOOP;

  -- 6. Recalculate total_points for all affected players from full event history
  FOREACH pid IN ARRAY all_ids
  LOOP
    UPDATE players
       SET total_points = COALESCE((
             SELECT SUM(COALESCE(points_awarded, 0) * COALESCE(quantity, 1))
               FROM player_match_events
              WHERE player_id = pid::UUID
           ), 0)
     WHERE id = pid::UUID;
  END LOOP;
END;
$$;
