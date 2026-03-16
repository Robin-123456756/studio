/**
 * Match Day Planner
 *
 * Given a match, generates 4 draft feed_media objects:
 *   1. Pre-match preview (kickoff - 2h)
 *   2. Live update (kickoff)
 *   3. Post-match report (kickoff + 2h)
 *   4. Fantasy recap (kickoff + 4h)
 */

type MatchInput = {
  id: number;
  gameweek_id: number;
  kickoff_time: string;
  home_team: string;
  away_team: string;
  home_short: string;
  away_short: string;
};

type DraftPost = {
  title: string;
  body: string;
  category: string;
  layout: string;
  status: string;
  publish_at: string;
  gameweek_id: number;
  is_pinned: boolean;
};

function offsetTime(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("en-UG", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
    hour12: true,
  });
}

export function scaffoldMatchDay(match: MatchInput): DraftPost[] {
  const { home_team, away_team, home_short, away_short, kickoff_time, gameweek_id } = match;
  const kickoffLabel = formatKickoff(kickoff_time);

  return [
    {
      title: `Preview: ${home_short} vs ${away_short} — ${kickoffLabel}`,
      body: [
        `<b>${home_team} vs ${away_team}</b>`,
        `<br>Kickoff: ${kickoffLabel} EAT`,
        `<br><br>Key matchup coming up! Who are you captaining?`,
      ].join("\n"),
      category: "matchday",
      layout: "quick",
      status: "scheduled",
      publish_at: offsetTime(kickoff_time, -2),
      gameweek_id,
      is_pinned: false,
    },
    {
      title: `LIVE: ${home_short} vs ${away_short} kicks off!`,
      body: [
        `<b>${home_team} vs ${away_team} is underway!</b>`,
        `<br>Follow along for live updates.`,
      ].join("\n"),
      category: "matchday",
      layout: "quick",
      status: "scheduled",
      publish_at: kickoff_time,
      gameweek_id,
      is_pinned: false,
    },
    {
      title: `Report: ${home_short} vs ${away_short}`,
      body: [
        `<b>${home_team} vs ${away_team} — Full Time</b>`,
        `<br>Score and key moments to be filled in after the match.`,
      ].join("\n"),
      category: "match_report",
      layout: "quick",
      status: "draft",
      publish_at: offsetTime(kickoff_time, 2),
      gameweek_id,
      is_pinned: false,
    },
    {
      title: `Fantasy Impact: ${home_short} vs ${away_short}`,
      body: [
        `<b>Fantasy takeaways from ${home_team} vs ${away_team}</b>`,
        `<br>Top fantasy performers and points hauls to be added.`,
      ].join("\n"),
      category: "player_spotlight",
      layout: "quick",
      status: "draft",
      publish_at: offsetTime(kickoff_time, 4),
      gameweek_id,
      is_pinned: false,
    },
  ];
}
