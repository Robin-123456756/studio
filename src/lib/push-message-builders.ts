import type { PushPayload } from "./push-notifications";

interface MatchContext {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

/** "KICK OFF! Night Prep vs Basunzi" */
export function buildMatchStartedPush(ctx: MatchContext): PushPayload {
  return {
    title: "KICK OFF!",
    body: `${ctx.homeTeam} vs ${ctx.awayTeam}`,
    tag: `match-${ctx.matchId}`,
    data: { link: "/dashboard" },
  };
}

/** "HALF TIME — Night Prep 1-0 Basunzi" */
export function buildHalfTimePush(ctx: MatchContext): PushPayload {
  return {
    title: "HALF TIME",
    body: `${ctx.homeTeam} ${ctx.homeGoals}-${ctx.awayGoals} ${ctx.awayTeam}`,
    tag: `match-${ctx.matchId}`,
    data: { link: "/dashboard" },
  };
}

/** "GOAL! Nakato (assist: Kato) — Night Prep 1-0 Basunzi" */
export function buildGoalPush(
  ctx: MatchContext,
  scorer: string,
  assister?: string
): PushPayload {
  const assistText = assister ? ` (assist: ${assister})` : "";
  return {
    title: `GOAL! ${scorer}${assistText}`,
    body: `${ctx.homeTeam} ${ctx.homeGoals}-${ctx.awayGoals} ${ctx.awayTeam}`,
    tag: `match-${ctx.matchId}`,
    data: { link: "/dashboard" },
  };
}

/** "Yellow card: Player X — Night Prep vs Basunzi" */
export function buildCardPush(
  ctx: MatchContext,
  player: string,
  cardType: "yellow" | "red"
): PushPayload {
  const label = cardType === "red" ? "RED CARD" : "Yellow card";
  return {
    title: `${label}: ${player}`,
    body: `${ctx.homeTeam} vs ${ctx.awayTeam}`,
    tag: `match-${ctx.matchId}-card`,
    data: { link: "/dashboard" },
  };
}

/** Generic broadcast push (for admin notifications) */
export function buildBroadcastPush(title: string, message: string): PushPayload {
  return {
    title,
    body: message,
    tag: "broadcast",
    data: { link: "/dashboard" },
  };
}

/** GW summary push — "GW5 complete! You scored 54 pts (Rank: 3rd)" */
export function buildGwSummaryPush(
  gameweekId: number,
  totalPoints: number,
  rank: number,
  totalManagers: number,
): PushPayload {
  const ordinal = (() => {
    const mod100 = rank % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
    const mod10 = rank % 10;
    if (mod10 === 1) return `${rank}st`;
    if (mod10 === 2) return `${rank}nd`;
    if (mod10 === 3) return `${rank}rd`;
    return `${rank}th`;
  })();
  return {
    title: `GW${gameweekId} Complete!`,
    body: `You scored ${totalPoints} pts — Rank: ${ordinal} of ${totalManagers}`,
    tag: `gw-summary-${gameweekId}`,
    data: { link: "/dashboard/fantasy/points" },
  };
}

/** Feed-media push — notify all users of a new post */
export function buildFeedMediaPush(title: string, category: string): PushPayload {
  const label = category === "breaking" ? "BREAKING" : "New Post";
  return {
    title: label,
    body: title,
    tag: "feed-media",
    data: { link: "/dashboard" },
  };
}

/** Deadline reminder push — "Gameweek 5 deadline in 24 hours!" */
export function buildDeadlineReminderPush(
  gameweekId: number,
  reminderType: "24h" | "1h"
): PushPayload {
  const timeLabel = reminderType === "24h" ? "24 hours" : "1 hour";
  return {
    title: "\u23F0 Deadline Reminder",
    body: `Gameweek ${gameweekId} deadline in ${timeLabel}! Set your picks now.`,
    tag: `deadline-${gameweekId}-${reminderType}`,
    data: { link: "/dashboard/fantasy/pick-team" },
  };
}
