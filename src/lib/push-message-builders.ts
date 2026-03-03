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
