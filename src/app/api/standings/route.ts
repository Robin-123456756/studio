import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  teamId: string;
  name: string;
  logoUrl: string;
  PL: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  LP: number;
  Pts: number;
};

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const fromGw = Number(url.searchParams.get("from_gw") || "1");
    const toGwParam = url.searchParams.get("to_gw");
    const toGw = toGwParam ? Number(toGwParam) : NaN;

    // If to_gw not provided: find latest played/final match gw
    let toGwResolved = Number.isFinite(toGw) ? toGw : null;

    if (!toGwResolved) {
      const { data: latestPlayed, error: latestErr } = await supabase
        .from("matches")
        .select("gameweek_id")
        .or("is_played.eq.true,is_final.eq.true")
        .order("gameweek_id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) {
        return NextResponse.json({ error: latestErr.message }, { status: 500 });
      }

      toGwResolved = latestPlayed?.gameweek_id ?? null;
    }

    // Load all teams (so table shows even if some teams haven't played)
    const { data: teams, error: teamsErr } = await supabase
      .from("teams")
      .select("team_uuid,name,logo_url")
      .order("name", { ascending: true });

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 });
    }

    const rowsMap = new Map<string, Row>();
    for (const t of teams ?? []) {
      rowsMap.set(t.team_uuid, {
        teamId: t.team_uuid,
        name: t.name ?? "Team",
        logoUrl: t.logo_url ?? "/placeholder-team.png",
        PL: 0,
        W: 0,
        D: 0,
        L: 0,
        GF: 0,
        GA: 0,
        GD: 0,
        LP: 0,
        Pts: 0,
      });
    }

    // If we still don't have a resolved toGw, return zeros
    if (!toGwResolved) {
      return NextResponse.json({
        rows: Array.from(rowsMap.values()),
        range: { from_gw: fromGw, to_gw: null },
      });
    }

    // IMPORTANT: use your real column names: home_team_uuid / away_team_uuid
    let matchesQuery = supabase
      .from("matches")
      .select(
        `
        id,
        gameweek_id,
        home_goals,
        away_goals,
        is_played,
        is_final,
        home_team_uuid,
        away_team_uuid
      `
      )
      .or("is_played.eq.true,is_final.eq.true")
      .order("gameweek_id", { ascending: true });

    if (Number.isFinite(fromGw)) matchesQuery = matchesQuery.gte("gameweek_id", fromGw);
    if (Number.isFinite(toGwResolved)) matchesQuery = matchesQuery.lte("gameweek_id", toGwResolved);

    const { data: matches, error: matchesErr } = await matchesQuery;
    if (matchesErr) {
      return NextResponse.json({ error: matchesErr.message }, { status: 500 });
    }

    // ── Lady points detection ──
    // Check BOTH player_stats AND player_match_events for lady players.
    // Voice admin writes to player_match_events; manual/CSV writes to player_stats.

    // Source 1: player_stats (gameweek_id is a direct column)
    const { data: playerStats } = await supabase
      .from("player_stats")
      .select("gameweek_id, player_id");

    // Source 2: player_match_events → join via matches to get gameweek_id
    const { data: pmeData } = await supabase
      .from("player_match_events")
      .select("player_id, match_id, matches!inner(gameweek_id)");

    // Combine all player IDs from both sources
    const allPlayerIds = new Set<string>();
    for (const s of playerStats ?? []) allPlayerIds.add(s.player_id);
    for (const e of pmeData ?? []) allPlayerIds.add(e.player_id);

    const playerLadyLookup = new Map<
      string,
      { isLady: boolean; teamUuid: string | null }
    >();

    if (allPlayerIds.size > 0) {
      const { data: playersData } = await supabase
        .from("players")
        .select("id, is_lady, teams:teams!players_team_id_fkey(team_uuid)")
        .in("id", [...allPlayerIds]);

      for (const p of playersData ?? []) {
        const teamUuid = (p as any).teams?.team_uuid ?? null;
        playerLadyLookup.set(p.id, {
          isLady: p.is_lady ?? false,
          teamUuid,
        });
      }
    }

    // Build a set of "gwId:teamUuid" keys where a lady player was fielded
    const ladyPlayedSet = new Set<string>();

    // From player_stats
    for (const s of playerStats ?? []) {
      const p = playerLadyLookup.get(s.player_id);
      if (p?.isLady && p.teamUuid) {
        ladyPlayedSet.add(`${s.gameweek_id}:${p.teamUuid}`);
      }
    }

    // From player_match_events (voice admin data)
    for (const e of pmeData ?? []) {
      const p = playerLadyLookup.get(e.player_id);
      const gwId = (e as any).matches?.gameweek_id;
      if (p?.isLady && p.teamUuid && gwId) {
        ladyPlayedSet.add(`${gwId}:${p.teamUuid}`);
      }
    }

    for (const m of matches ?? []) {
      const homeId = m.home_team_uuid;
      const awayId = m.away_team_uuid;
      if (!homeId || !awayId) continue;

      const home = rowsMap.get(homeId);
      const away = rowsMap.get(awayId);
      if (!home || !away) continue;

      const hg = typeof m.home_goals === "number" ? m.home_goals : 0;
      const ag = typeof m.away_goals === "number" ? m.away_goals : 0;

      home.PL += 1;
      away.PL += 1;

      home.GF += hg;
      home.GA += ag;

      away.GF += ag;
      away.GA += hg;

      if (hg > ag) {
        home.W += 1;
        away.L += 1;
      } else if (hg < ag) {
        away.W += 1;
        home.L += 1;
      } else {
        home.D += 1;
        away.D += 1;
      }

      // Lady points: +1 if a lady player was fielded for that team in that gameweek
      if (ladyPlayedSet.has(`${m.gameweek_id}:${homeId}`)) home.LP += 1;
      if (ladyPlayedSet.has(`${m.gameweek_id}:${awayId}`)) away.LP += 1;
    }

    for (const r of rowsMap.values()) {
      r.GD = r.GF - r.GA;
      r.Pts = r.W * 3 + r.D + r.LP;
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) => {
      if (b.Pts !== a.Pts) return b.Pts - a.Pts;
      if (b.GD !== a.GD) return b.GD - a.GD;
      if (b.GF !== a.GF) return b.GF - a.GF;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      { rows, range: { from_gw: fromGw, to_gw: toGwResolved } },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
