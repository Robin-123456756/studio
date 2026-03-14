-- BPS (Bonus Points System) rules table
-- Separate scoring weights used to rank players within a match for automatic bonus allocation (3/2/1)

CREATE TABLE IF NOT EXISTS bps_rules (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  position TEXT,         -- NULL or 'ALL' means applies to all positions
  bps_value INT NOT NULL,
  description TEXT
);

-- Seed BPS weights (FPL-inspired, scaled for Budo League)
INSERT INTO bps_rules (action, position, bps_value, description) VALUES
  ('appearance', 'ALL', 2, 'Played in the match (starter)'),
  ('sub_appearance', 'ALL', 1, 'Came off the bench'),
  ('goal', 'FWD', 12, 'Goal scored by forward'),
  ('goal', 'MID', 18, 'Goal scored by midfielder'),
  ('goal', 'DEF', 24, 'Goal scored by defender'),
  ('goal', 'GK', 24, 'Goal scored by goalkeeper'),
  ('assist', NULL, 9, 'Assist'),
  ('clean_sheet', 'GK', 12, 'Clean sheet — goalkeeper'),
  ('clean_sheet', 'DEF', 12, 'Clean sheet — defender'),
  ('clean_sheet', 'MID', 3, 'Clean sheet — midfielder'),
  ('pen_save', NULL, 15, 'Penalty saved'),
  ('save_3', NULL, 6, 'Every 3+ saves by GK'),
  ('yellow', NULL, -3, 'Yellow card'),
  ('red', NULL, -9, 'Red card'),
  ('own_goal', NULL, -6, 'Own goal'),
  ('pen_miss', NULL, -6, 'Penalty missed');
