import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { loadScoringRules, lookupPoints } from "@/lib/scoring-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/dream-team?gw_id=N
 *
 * Returns the best possible XI from ALL players for a given gameweek,
 * based on actual GW points (with lady 2x multiplier on positive actions).
 * Picks the highest-scoring valid formation using game rules:
 * 1 GK, 2-3 DEF, 3-5 MID, 2-3 FWD (total 10 outfield + 1 GK = 11).
 * Must include at least 1 lady forward (matching the mandatory lady rule).
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
    const events = await fetchAllRows((from, to) =>
      supabase
        .from("player_match_events")
        .select("player_id, action, points_awarded, quantity")
        .in("match_id", gwMatchIds)
        .range(from, to)
    );

    // Collect unique player IDs from events
    const eventPlayerIds = new Set<string>();
    for (const e of events) eventPlayerIds.add(String(e.player_id));

    if (eventPlayerIds.size === 0) {
      return NextResponse.json({ error: "No player data for this gameweek" }, { status: 404 });
    }

    // 3. Get player metadata for all players who have events
    const playerIds = [...eventPlayerIds];

    const [{ data: playerData }, rules] = await Promise.all([
      supabase
        .from("players")
        .select(`
          id, name, web_name, position, is_lady, avatar_url, now_cost, team_id,
          teams:teams!players_team_id_fkey (name, short_name, team_uuid)
        `)
        .in("id", playerIds),
      loadScoringRules(),
    ]);

    // Build metadata lookup for lady status + position
    const metaMap = new Map<string, { position: string; isLady: boolean }>();
    for (const p of playerData ?? []) {
      metaMap.set(String(p.id), {
        position: normalizePos((p as any).position),
        isLady: (p as any).is_lady ?? false,
      });
    }

    // Compute points using lookupPoints (applies lady 2x on positive actions)
    // Same pattern as scoring-engine: bonus uses stored points_awarded, others use rules
    const pointsMap = new Map<string, number>();
    for (const e of events) {
      const pid = String(e.player_id);
      const meta = metaMap.get(pid);
      const position = meta?.position ?? "Forward";
      const isLady = meta?.isLady ?? false;
      const pts = e.action === "bonus"
        ? (e.points_awarded ?? 0) * (e.quantity ?? 1)
        : lookupPoints(rules, e.action, position, isLady) * (e.quantity ?? 1);
      pointsMap.set(pid, (pointsMap.get(pid) ?? 0) + pts);
    }

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

    // Starting 10: 1 GK + 9 outfield (DEF 2-3, MID 3-5, FWD 2-3, exactly 1 lady FWD)
    // Matches roster-validation.ts and pick-team auto-pick formations
    const ladyFwds = fwds.filter((p) => p.isLady);
    const nonLadyFwds = fwds.filter((p) => !p.isLady);

    type Formation = { def: number; mid: number; maleFwd: number; totalFwd: number };
    const validFormations: Formation[] = [
      { def: 2, mid: 5, maleFwd: 1, totalFwd: 2 }, // 2-5-2
      { def: 2, mid: 4, maleFwd: 2, totalFwd: 3 }, // 2-4-3
      { def: 3, mid: 4, maleFwd: 1, totalFwd: 2 }, // 3-4-2
      { def: 3, mid: 3, maleFwd: 2, totalFwd: 3 }, // 3-3-3
    ];

    let bestXI: PlayerWithPoints[] = [];
    let bestTotal = -1;

    for (const f of validFormations) {
      if (gks.length < 1 || defs.length < f.def || mids.length < f.mid) continue;
      if (ladyFwds.length < 1 || nonLadyFwds.length < f.maleFwd) continue;

      const xi = [
        gks[0],
        ...defs.slice(0, f.def),
        ...mids.slice(0, f.mid),
        ...nonLadyFwds.slice(0, f.maleFwd),
        ladyFwds[0],
      ];

      if (xi.length !== 10) continue;

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
  } catch (e: unknown) {
    return apiError("Failed to fetch dream team", "DREAM_TEAM_FETCH_FAILED", 500, e);
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
