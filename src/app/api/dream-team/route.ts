import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dream-team?gw_id=N
 *
 * Returns the best possible XI from ALL players for a given gameweek,
 * based on actual GW points. Picks the highest-scoring valid formation:
 * 1 GK, 3-5 DEF, 3-5 MID, 1-3 FWD (total 10 outfield + 1 GK = 11).
 *
 * Note: This is the "best possible team anyone could have picked", not
 * any single manager's actual team.
 */
export async function GET(req: Request) {
  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    // Resolve GW
    const gwIdParam = url.searchParams.get("gw_id");
    let gwId = gwIdParam ? Number(gwIdParam) : NaN;

    if (!Number.isFinite(gwId)) {
      const { data: current } = await supabase
        .from("gameweeks")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();
      gwId = current?.id ?? NaN;
    }

    if (!Number.isFinite(gwId)) {
      return NextResponse.json({ error: "No gameweek found" }, { status: 400 });
    }

    // 1. Get all matches for this GW
    const { data: gwMatches } = await supabase
      .from("matches")
      .select("id")
      .eq("gameweek_id", gwId);
    const gwMatchIds = (gwMatches ?? []).map((m: any) => m.id);

    if (gwMatchIds.length === 0) {
      return NextResponse.json({ error: "No matches played this gameweek" }, { status: 404 });
    }

    // 2. Get all player_match_events for this GW
    const { data: events } = await supabase
      .from("player_match_events")
      .select("player_id, points_awarded, quantity")
      .in("match_id", gwMatchIds);

    const pointsMap = new Map<string, number>();
    for (const e of events ?? []) {
      const pid = String(e.player_id);
      const pts = (e.points_awarded ?? 0) * (e.quantity ?? 1);
      pointsMap.set(pid, (pointsMap.get(pid) ?? 0) + pts);
    }

    // 3. Get player metadata for all players who have events
    const playerIds = [...pointsMap.keys()];
    if (playerIds.length === 0) {
      return NextResponse.json({ error: "No player data for this gameweek" }, { status: 404 });
    }

    const { data: playerData } = await supabase
      .from("players")
      .select(`
        id, name, web_name, position, is_lady, avatar_url, now_cost, team_id,
        teams:teams!players_team_id_fkey (name, short_name, team_uuid)
      `)
      .in("id", playerIds);

    type PlayerWithPoints = {
      id: string;
      name: string;
      webName: string | null;
      position: string;
      isLady: boolean;
      avatarUrl: string | null;
      price: number | null;
      teamName: string;
      teamShort: string;
      teamUuid: string | null;
      gwPoints: number;
    };

    const players: PlayerWithPoints[] = (playerData ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.name ?? p.web_name ?? "--",
      webName: p.web_name ?? null,
      position: normalizePos(p.position),
      isLady: p.is_lady ?? false,
      avatarUrl: p.avatar_url ?? null,
      price: p.now_cost ?? null,
      teamName: p.teams?.name ?? "--",
      teamShort: p.teams?.short_name ?? "--",
      teamUuid: p.teams?.team_uuid ?? null,
      gwPoints: pointsMap.get(String(p.id)) ?? 0,
    }));

    // 4. Pick the best XI
    // Sort each position group by points desc
    const gks = players.filter((p) => p.position === "Goalkeeper").sort((a, b) => b.gwPoints - a.gwPoints);
    const defs = players.filter((p) => p.position === "Defender").sort((a, b) => b.gwPoints - a.gwPoints);
    const mids = players.filter((p) => p.position === "Midfielder").sort((a, b) => b.gwPoints - a.gwPoints);
    const fwds = players.filter((p) => p.position === "Forward").sort((a, b) => b.gwPoints - a.gwPoints);

    // Try all valid formations: 1 GK + DEF(3-5) + MID(3-5) + FWD(1-3) = 11
    type Formation = [number, number, number]; // [DEF, MID, FWD]
    const validFormations: Formation[] = [];
    for (let d = 3; d <= 5; d++) {
      for (let m = 3; m <= 5; m++) {
        for (let f = 1; f <= 3; f++) {
          if (d + m + f === 10) validFormations.push([d, m, f]);
        }
      }
    }

    let bestXI: PlayerWithPoints[] = [];
    let bestTotal = -1;

    for (const [nDef, nMid, nFwd] of validFormations) {
      if (gks.length < 1 || defs.length < nDef || mids.length < nMid || fwds.length < nFwd) continue;

      const xi = [
        gks[0],
        ...defs.slice(0, nDef),
        ...mids.slice(0, nMid),
        ...fwds.slice(0, nFwd),
      ];

      const total = xi.reduce((sum, p) => sum + p.gwPoints, 0);
      if (total > bestTotal) {
        bestTotal = total;
        bestXI = xi;
      }
    }

    if (bestXI.length === 0) {
      return NextResponse.json({ error: "Not enough players to form a valid XI" }, { status: 404 });
    }

    // Find the "star player" (highest individual score)
    const starPlayer = bestXI.reduce((best, p) => (p.gwPoints > best.gwPoints ? p : best), bestXI[0]);

    const res = NextResponse.json({
      gwId,
      totalPoints: bestTotal,
      starPlayerId: starPlayer.id,
      players: bestXI,
    });
    res.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}

function normalizePos(pos: string | null | undefined): string {
  if (!pos) return "Forward";
  const p = pos.toLowerCase().trim();
  if (p.includes("goal") || p === "gk" || p === "keeper") return "Goalkeeper";
  if (p.includes("def") || p === "cb" || p === "lb" || p === "rb") return "Defender";
  if (p.includes("mid") || p === "cm" || p === "cdm" || p === "cam") return "Midfielder";
  return "Forward";
}
