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

    // Determine latest played gameweek if to_gw not provided
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

    // Load teams for complete table (even if no matches yet)
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
        home_team_uid,
        away_team_uid
      `
      )
      .or("is_played.eq.true,is_final.eq.true")
      .order("gameweek_id", { ascending: true });

    if (Number.isFinite(fromGw)) {
      matchesQuery = matchesQuery.gte("gameweek_id", fromGw);
    }
    if (Number.isFinite(toGwResolved)) {
      matchesQuery = matchesQuery.lte("gameweek_id", toGwResolved);
    }

    const { data: matches, error: matchesErr } = await matchesQuery;
    if (matchesErr) {
      return NextResponse.json({ error: matchesErr.message }, { status: 500 });
    }

    // Fetch player_stats joined with players for lady detection
    const { data: playerStats } = await supabase
      .from("player_stats")
      .select(
        `
        gameweek_id,
        player_id,
        players:player_id (
          is_lady,
          team_id,
          teams:teams!players_team_id_fkey ( team_uuid )
        )
      `
      );

    // Build lookup: Set<"gwId:teamUuid"> where a lady player has stats
    const ladyPlayedSet = new Set<string>();
    for (const s of playerStats ?? []) {
      const p = (s as any).players;
      if (p?.is_lady && p?.teams?.team_uuid) {
        ladyPlayedSet.add(`${s.gameweek_id}:${p.teams.team_uuid}`);
      }
    }

    for (const m of matches ?? []) {
      const homeId = m.home_team_uid;
      const awayId = m.away_team_uid;

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

      // Lady points: +1 if a lady player has a player_stats entry for this GW + team
      if (ladyPlayedSet.has(`${m.gameweek_id}:${homeId}`)) home.LP += 1;
      if (ladyPlayedSet.has(`${m.gameweek_id}:${awayId}`)) away.LP += 1;
    }

    // finalize GD + points
    for (const r of rowsMap.values()) {
      r.GD = r.GF - r.GA;
      r.Pts = r.W * 3 + r.D + r.LP;
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) => {
      if (b.Pts !== a.Pts) return b.Pts - a.Pts;
      if (b.GD !== a.GD) return b.GD - a.GD;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      rows,
      range: { from_gw: fromGw, to_gw: toGwResolved },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
