// src/app/api/gameweeks/current/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // Load all gameweeks so we can apply FPL-like selection logic safely.
  const { data: gameweeks, error } = await supabase
    .from("gameweeks")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return apiError("Failed to load gameweeks", "GAMEWEEKS_FETCH_FAILED", 500, error);
  }

  const gws = (gameweeks ?? []) as any[];
  const now = Date.now();

  const getDeadlineMs = (gw: any) => {
    const ts = gw?.deadline_time ? new Date(gw.deadline_time).getTime() : NaN;
    return Number.isFinite(ts) ? ts : NaN;
  };

  const isFinished = (gw: any) =>
    Boolean(gw?.finalized ?? gw?.is_finished ?? gw?.is_final ?? false);

  const isStarted = (gw: any) =>
    Boolean(gw?.is_started ?? (Number.isFinite(getDeadlineMs(gw)) && getDeadlineMs(gw) <= now));

  const flaggedCurrent = gws.find((g) => g?.is_current === true) ?? null;
  const flaggedNext = gws.find((g) => g?.is_next === true) ?? null;

  // Current (FPL-like):
  // 1) explicit is_current flag
  // 2) latest started and not finished
  // 3) earliest not finished
  // 4) fallback to last by id
  const current =
    flaggedCurrent ??
    [...gws]
      .filter((g) => isStarted(g) && !isFinished(g))
      .sort((a, b) => (getDeadlineMs(b) || b.id) - (getDeadlineMs(a) || a.id))[0] ??
    gws.find((g) => !isFinished(g)) ??
    (gws.length > 0 ? gws[gws.length - 1] : null);

  // 3) Next gameweek
  const currentId = current?.id ?? null;
  const next =
    (flaggedNext && flaggedNext?.id !== currentId ? flaggedNext : null) ??
    (currentId
      ? gws.find((g) => Number(g.id) > Number(currentId))
      : gws.find((g) => !isFinished(g))) ??
    null;

  // Check which GWs have at least one played/final match.
  // On query failure, default every GW to hasPlayedMatches: true so a
  // transient DB error doesn't blank the entire GW navigation.
  const gwIds = gws.map((g) => g.id);
  let gwsWithMatches: Set<number> | null = null;

  if (gwIds.length > 0) {
    const { data: playedMatches, error: matchErr } = await supabase
      .from("matches")
      .select("gameweek_id")
      .in("gameweek_id", gwIds)
      .or("is_played.eq.true,is_final.eq.true");

    if (!matchErr && playedMatches) {
      gwsWithMatches = new Set<number>();
      for (const m of playedMatches) {
        gwsWithMatches.add(m.gameweek_id);
      }
    }
  }

  const enrichedGws = gws.map((g) => ({
    ...g,
    hasPlayedMatches: gwsWithMatches ? gwsWithMatches.has(g.id) : true,
  }));

  return NextResponse.json({
    current: current ?? null,
    next: next ?? null,
    all: enrichedGws,
  });
}
