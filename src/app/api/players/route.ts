import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    const idsParam = url.searchParams.get("ids");
    const dynamicPoints = url.searchParams.get("dynamic_points") === "1";

    let query = supabase
      .from("players")
      .select(
        `
        id,
        name,
        web_name,
        position,
        now_cost,
        total_points,
        avatar_url,
        is_lady,
        team_id,
        teams:teams!players_team_id_fkey (
          name,
          short_name,
          team_uuid
        )
      `
      )
      .order("name", { ascending: true });

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) query = query.in("id", ids);
    }

    if (teamId) query = query.eq("team_id", teamId);

    const { data, error } = await query;

    if (error) {
      console.log("SUPABASE ERROR /api/players", error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    const playerIds = (data ?? []).map((p: any) => String(p.id));
    const ownershipMap = new Map<string, number>();

    const { count: managerCount } = await supabase
      .from("fantasy_teams")
      .select("user_id", { count: "exact", head: true });
    const registeredManagers = typeof managerCount === "number" ? managerCount : 0;

    if (playerIds.length > 0) {
      let currentGwId: number | null = null;

      const { data: currentGw } = await supabase
        .from("gameweeks")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();

      if (currentGw?.id) {
        currentGwId = Number(currentGw.id);
      } else {
        const { data: latestGw } = await supabase
          .from("gameweeks")
          .select("id")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        currentGwId = latestGw?.id ? Number(latestGw.id) : null;
      }

      if (currentGwId) {
        const { data: rosterRows } = await supabase
          .from("user_rosters")
          .select("player_id,user_id")
          .eq("gameweek_id", currentGwId)
          .in("player_id", playerIds);

        const ownersByPlayer = new Map<string, Set<string>>();
        const activeUsers = new Set<string>();

        for (const row of rosterRows ?? []) {
          const pid = String((row as any).player_id);
          const uid = String((row as any).user_id);
          if (!ownersByPlayer.has(pid)) ownersByPlayer.set(pid, new Set<string>());
          ownersByPlayer.get(pid)!.add(uid);
          activeUsers.add(uid);
        }

        // If nobody has fully registered a fantasy team yet, use active roster users.
        const denominator = registeredManagers > 0 ? registeredManagers : activeUsers.size;

        for (const pid of playerIds) {
          const selectedCount = ownersByPlayer.get(pid)?.size ?? 0;
          const ownershipPct =
            denominator > 0 ? Math.round((selectedCount / denominator) * 1000) / 10 : 0;
          ownershipMap.set(pid, ownershipPct);
        }
      }
    }

    let totalsMap = new Map<
      string,
      { points: number; goals: number; assists: number; appearances: number }
    >();
    // Form = total points / number of gameweeks played
    const formMap = new Map<string, string>();
    if (playerIds.length > 0) {
      const { data: allStats } = await supabase
        .from("player_stats")
        .select("player_id, points, gameweek_id")
        .in("player_id", playerIds);

      if (allStats && allStats.length > 0) {
        const playerData = new Map<string, { total: number; gws: Set<number> }>();

        for (const s of allStats) {
          const pid = String((s as any).player_id);
          const gwId = (s as any).gameweek_id;
          const pts = (s as any).points ?? 0;

          const existing = playerData.get(pid) ?? { total: 0, gws: new Set() };
          existing.total += pts;
          existing.gws.add(gwId);
          playerData.set(pid, existing);
        }

        for (const [pid, { total, gws }] of playerData) {
          const gwCount = gws.size;
          formMap.set(pid, gwCount > 0 ? (total / gwCount).toFixed(1) : "0.0");
        }
      }
    }

    if (dynamicPoints) {
      if (playerIds.length > 0) {
        const { data: statsData } = await supabase
          .from("player_stats")
          .select("player_id, points, goals, assists")
          .in("player_id", playerIds);

        for (const s of statsData ?? []) {
          const pid = String((s as any).player_id);
          const existing = totalsMap.get(pid) ?? {
            points: 0,
            goals: 0,
            assists: 0,
            appearances: 0,
          };
          existing.points += (s as any).points ?? 0;
          existing.goals += (s as any).goals ?? 0;
          existing.assists += (s as any).assists ?? 0;
          existing.appearances += 1;
          totalsMap.set(pid, existing);
        }
      }
    }

    const players = (data ?? []).map((p: any) => {
      const pid = String(p.id);
      const totals = dynamicPoints ? totalsMap.get(pid) : null;
      const isLady = p.is_lady ?? false;
      const ladyMultiplier = isLady ? 2 : 1;
      const rawPoints = totals ? totals.points : p.total_points ?? 0;
      return {
        id: p.id,
        name: p.name ?? p.web_name ?? "--",
        webName: p.web_name ?? null,
        position: p.position,
        price: p.now_cost ?? null,
        points: rawPoints * ladyMultiplier,
        rawPoints,
        pointsMultiplier: ladyMultiplier,
        avatarUrl: p.avatar_url ?? null,
        isLady,
        teamId: p.team_id,
        teamName: p.teams?.name ?? "--",
        teamShort: p.teams?.short_name ?? "--",
        teamUuid: p.teams?.team_uuid ?? null,
        ownership: ownershipMap.get(pid) ?? 0,
        form_last5: formMap.get(pid) ?? null,
        ...(totals
          ? {
              totalGoals: totals.goals,
              totalAssists: totals.assists,
              appearances: totals.appearances,
            }
          : {}),
      };
    });

    return NextResponse.json(
      { players },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e: any) {
    console.log("ROUTE CRASH /api/players", e);
    return NextResponse.json(
      { error: String(e?.message ?? e), stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const { name, web_name, position, now_cost, team_id, is_lady } = body;

    if (!name || !position || !team_id) {
      return NextResponse.json(
        { error: "name, position, and team_id are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        name,
        web_name: web_name || name.split(" ").pop(),
        position,
        now_cost: now_cost || 5.0,
        team_id,
        is_lady: is_lady || false,
        total_points: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to add player" },
      { status: 500 }
    );
  }
}
