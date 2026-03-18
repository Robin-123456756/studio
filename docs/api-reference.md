# API Reference

Snapshot of the current App Router API surface in `src/app/api`.

Auth modes:
- `public-or-internal`: no session requirement in the route itself
- `user-supabase`: end-user Supabase session required
- `admin-nextauth`: admin NextAuth session required
- `cron-bearer`: bearer secret required

## Public Or Internal
- `/api/auth/[...nextauth]` — `GET, POST` — `public-or-internal` — NextAuth handler
- `/api/fantasy-leaderboard` — `GET` — `public-or-internal` — leaderboard utils
- `/api/feed-media` — `GET, POST` — `public-or-internal` — `feed_media`, `rpc:increment_feed_view_count`
- `/api/feed-media/[id]` — `GET` — `public-or-internal` — `feed_media`
- `/api/fixtures` — `GET` — `public-or-internal` — `matches`, `teams`, `gameweeks`
- `/api/gameweeks/current` — `GET` — `public-or-internal` — `gameweeks`, `matches`
- `/api/matches` — `GET` — `public-or-internal` — `matches`, `teams`, `player_match_events`, `players`
- `/api/matches/[id]` — `GET` — `public-or-internal` — `matches`, `teams`, `gameweeks`, `player_match_events`, `players`
- `/api/og/feed` — `GET` — `public-or-internal` — `feed_media`
- `/api/player-stats` — `GET` — `public-or-internal` — `player_stats`, `players`, `matches`, `player_match_events`
- `/api/players` — `GET, POST` — `public-or-internal` for `GET`, admin-hardened for `POST` — `players`, `fantasy_teams`, `matches`, `current_squads`, `player_stats`, `player_price_history`
- `/api/results` — `GET` — `public-or-internal` — `matches`, `teams`
- `/api/rosters/highest` — `GET` — `public-or-internal` — `gameweeks`, `user_rosters`, `matches`, `player_match_events`, `player_stats`, `players`, `fantasy_teams`
- `/api/search` — `GET` — `public-or-internal` — `teams`, `players`, `matches`
- `/api/standings` — `GET` — `public-or-internal` — `matches`, `teams`, `player_stats`, `player_match_events`, `players`
- `/api/teams` — `GET` — `public-or-internal` — `teams`
- `/api/teams/[teamId]` — `GET` — `public-or-internal` — `teams`
- `/api/teams/player-counts` — `GET` — `public-or-internal` — `players`
- `/api/transfers/activity` — `GET` — `public-or-internal` — `user_transfers`, `players`, `fantasy_teams`
- `/api/v1/feed` — `GET` — `public-or-internal` — `api_keys`, `feed_media`

## User Supabase
- `/api/activity-feed` — `GET` — `user-supabase` — `activity_feed`
- `/api/chips` — `GET` — `user-supabase` — `user_chips`
- `/api/cup` — `GET` — `user-supabase` — `cup_rounds`, `cup_matches`, `fantasy_teams`
- `/api/dream-team` — `GET` — `user-supabase` — `gameweeks`, `matches`, `player_match_events`, `players`
- `/api/fantasy-gw-details` — `GET` — `user-supabase` — `user_rosters`, `matches`, `players`, `player_match_events`, `player_stats`, `user_transfer_state`, `fantasy_teams`
- `/api/free-hit-backup` — `GET, POST, DELETE` — `user-supabase` — `free_hit_backups`, `user_rosters`, `current_squads`
- `/api/mini-leagues` — `GET, POST` — `user-supabase` — `mini_league_members`, `mini_leagues`
- `/api/mini-leagues/join` — `POST` — `user-supabase` — `mini_leagues`, `mini_league_members`
- `/api/mini-leagues/[id]` — `GET, PATCH` — `user-supabase` — `mini_league_members`, `mini_leagues`
- `/api/mini-leagues/[id]/leave` — `DELETE` — `user-supabase` — `mini_leagues`, `mini_league_members`
- `/api/notifications` — `GET, PUT` — `user-supabase` — `notifications`
- `/api/push/subscribe` — `POST, DELETE` — `user-supabase` — `push_subscriptions`
- `/api/reviews` — `GET, POST` — `user-supabase` — `reviews`
- `/api/rosters` — `GET` — `user-supabase` — `user_rosters`, `fantasy_teams`
- `/api/rosters/current` — `GET` — `user-supabase` — `gameweeks`, `user_rosters`, `current_squads`
- `/api/rosters/save` — `POST` — `user-supabase` — `fantasy_teams`, `gameweeks`, `players`, `user_rosters`, `current_squads`, `user_chips`
- `/api/scoring-rules` — `GET` — `user-supabase` — `scoring_rules`
- `/api/transfers` — `GET, POST` — `user-supabase` — `user_transfer_state`, `user_chips`, `user_transfers`, `gameweeks`, `players`
- `/api/transfers/history` — `GET` — `user-supabase` — `user_transfers`, `players`, `user_transfer_state`

## Admin NextAuth
- `/api/admin/ai-content` — `POST` — `admin-nextauth` — AI admin actions
- `/api/admin/analytics` — `GET` — `admin-nextauth` — `user_weekly_scores`, `player_stats`, `user_transfers`, `user_chips`, `user_rosters`, `players`, `teams`
- `/api/admin/audit-log` — `GET` — `admin-nextauth` — `voice_audit_log`, `activity_feed`
- `/api/admin/bonus-points` — `GET` — `admin-nextauth` — bonus point admin actions
- `/api/admin/cup/draw` — `POST` — `admin-nextauth` — `cup_rounds`, `user_weekly_scores`, `cup_matches`
- `/api/admin/data-health` — `GET` — `admin-nextauth` — `gameweeks`, `matches`, `players`, `teams`
- `/api/admin/feed-media` — `GET, POST, PUT, DELETE` — `admin-nextauth` — `admin_users`, `feed_media`, `matches`, `feed_media_versions`, storage bucket `feed-media`
- `/api/admin/feed-media/analytics` — `GET` — `admin-nextauth` — `feed_media`, `feed_media_views`, `rpc:get_hourly_view_distribution`
- `/api/admin/feed-media/versions` — `GET` — `admin-nextauth` — `feed_media_versions`
- `/api/admin/feed-series` — `GET, POST, DELETE` — `admin-nextauth` — `feed_media_series`
- `/api/admin/feed-templates` — `GET, POST, DELETE` — `admin-nextauth` — `feed_templates`, `admin_users`
- `/api/admin/fixtures` — `GET, POST, PATCH, DELETE` — `admin-nextauth` — `teams`, `matches`, `league_events`
- `/api/admin/gameweeks` — `GET, POST, PATCH, DELETE` — `admin-nextauth` — `gameweeks`
- `/api/admin/gw-status` — `GET` — `admin-nextauth` — `gameweeks`, `matches`, `user_rosters`, `player_stats`
- `/api/admin/match-appearances` — `GET, POST` — `admin-nextauth` — `matches`, `teams`, `players`, `player_stats`, `player_match_events`, `scoring_rules`
- `/api/admin/match-end` — `POST` — `admin-nextauth` — `matches`
- `/api/admin/matches` — `POST` — `admin-nextauth` — `matches`
- `/api/admin/match-minutes` — `POST` — `admin-nextauth` — `matches`
- `/api/admin/match-scorers` — `GET, PUT` — `admin-nextauth` — `player_match_events`, `players`, `matches`, `player_stats`
- `/api/admin/match-scores` — `GET, PUT` — `admin-nextauth` — `matches`, `teams`, `scoring_rules`, `players`, `player_match_events`, `player_stats`, `rpc:recalculate_all_player_points`
- `/api/admin/match-start` — `POST` — `admin-nextauth` — `matches`
- `/api/admin/notifications/send` — `POST, GET` — `admin-nextauth` — `fantasy_teams`, `notifications`
- `/api/admin/players` — `GET, PATCH, DELETE` — `admin-nextauth` — `players`, `player_price_history`
- `/api/admin/players/dashboard-stats` — `GET` — `admin-nextauth` — `players`, `teams`, `matches`, `fantasy_squads`, `player_match_events`
- `/api/admin/players/import` — `POST` — `admin-nextauth` — `players`
- `/api/admin/players/upload-avatar` — `POST` — `admin-nextauth` — storage bucket `player-avatars`, `players`
- `/api/admin/season/backup` — `POST` — `admin-nextauth` — `players`, `teams`, `gameweeks`, `matches`, `player_stats`, `player_match_events`, `user_rosters`, `user_weekly_scores`, `user_chips`, `user_transfers`, `user_transfer_state`, `voice_audit_log`, `activity_feed`
- `/api/admin/season/reset` — `POST` — `admin-nextauth` — `current_squads`, `user_rosters`, `user_weekly_scores`, `user_chips`, `user_transfers`, `user_transfer_state`, `player_stats`, `player_match_events`, `voice_audit_log`, `activity_feed`, `players`, `gameweeks`
- `/api/admin/season/stats` — `GET` — `admin-nextauth` — `gameweeks`, `matches`, `players`, `teams`, `fantasy_teams`, `user_weekly_scores`
- `/api/admin/teams` — `GET, POST, PATCH, DELETE` — `admin-nextauth` — `teams`, `players`
- `/api/admin/users` — `GET` — `admin-nextauth` — `gameweeks`, `fantasy_teams`, `user_weekly_scores`, `user_transfers`, `user_chips`
- `/api/admin/users/[userId]` — `GET, PATCH` — `admin-nextauth` — `gameweeks`, `fantasy_teams`, `user_rosters`, `user_transfers`, `user_chips`, `user_weekly_scores`, `players`
- `/api/data-health/fix-clean-sheets` — `POST` — `admin-nextauth` — `matches`, `players`, `player_match_events`, `player_stats`
- `/api/voice-admin/audit` — `GET` — `admin-nextauth` — voice admin audit actions
- `/api/voice-admin/calculate-scores` — `POST` — `admin-nextauth` — `rpc:refresh_match_totals`
- `/api/voice-admin/check-dupes` — `POST` — `admin-nextauth` — `player_match_events`
- `/api/voice-admin/commit-db` — `POST` — `admin-nextauth` — DB commit pipeline
- `/api/voice-admin/commit-manual` — `POST` — `admin-nextauth` — `admin_users`, `players`, `matches`, `player_match_events`, `player_stats`, `voice_audit_log`, `rpc:increment_player_points`
- `/api/voice-admin/export-csv` — `GET` — `admin-nextauth` — `player_match_events`
- `/api/voice-admin/matches` — `GET` — `admin-nextauth` — `matches`, `teams`
- `/api/voice-admin/match-players` — `GET` — `admin-nextauth` — `matches`, `teams`, `players`
- `/api/voice-admin/match-totals` — `GET` — `admin-nextauth` — `player_match_totals`
- `/api/voice-admin/player-search` — `GET` — `admin-nextauth` — `rpc:match_player_fuzzy`
- `/api/voice-admin/process` — `POST` — `admin-nextauth` — `matches`, `players`
- `/api/voice-admin/process-text` — `POST` — `admin-nextauth` — `matches`, `players`
- `/api/voice-admin/undo` — `POST` — `admin-nextauth` — undo pipeline

## Cron Bearer
- `/api/cron/auto-archive` — `GET` — `cron-bearer` — `app_settings`, `feed_media`
- `/api/cron/auto-content` — `GET` — `cron-bearer` — auto content pipelines
- `/api/cron/auto-content-deadline` — `GET` — `cron-bearer` — deadline content pipeline
- `/api/cron/deadline-reminders` — `GET` — `cron-bearer` — `gameweeks`, `fantasy_teams`, `user_rosters`
- `/api/cron/gw-summary` — `GET` — `cron-bearer` — `gameweeks`, `user_weekly_scores`
