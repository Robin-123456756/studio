import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/transfers/activity?limit=30&gw_id=N
 * Public feed of recent transfers across all managers.
 * Returns enriched transfer data with player names and fantasy team names.
 */
export async function GET(req: Request) {
  try {
    const admin = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const limit = Math.min(
      Math.max(1, Number(url.searchParams.get("limit") ?? "30")),
      100
    );
    const gwIdRaw = url.searchParams.get("gw_id");
    const gwId =
      gwIdRaw != null && Number.isFinite(Number(gwIdRaw))
        ? Number(gwIdRaw)
        : null;

    // Use select("*") — the column names match the migration but PostgREST
    // schema cache can lag behind on explicit column lists
    let query = admin
      .from("user_transfers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (gwId != null && gwId >= 1) {
      query = query.eq("gameweek_id", gwId);
    }

    const { data: transfers, error: transferErr } = await query;

    if (transferErr) {
      console.error("TRANSFER ACTIVITY QUERY ERROR", transferErr);
      return NextResponse.json(
        { error: "Failed to load transfers" },
        { status: 500 }
      );
    }

    if (!transfers || transfers.length === 0) {
      return NextResponse.json(
        { transfers: [] },
        {
          headers: {
            "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    }

    // Collect unique player IDs and user IDs for batch lookups
    const playerIds = new Set<string>();
    const userIds = new Set<string>();

    for (const t of transfers) {
      if (t.out_player_id) playerIds.add(t.out_player_id);
      if (t.in_player_id) playerIds.add(t.in_player_id);
      if (t.user_id) userIds.add(t.user_id);
    }

    // Fetch players with team info
    const { data: players } = await admin
      .from("players")
      .select("id, name, web_name, position, team_id, teams:teams!players_team_id_fkey (short_name)")
      .in("id", [...playerIds]);

    const playerMap = new Map<
      string,
      { name: string; webName: string; position: string; teamShort: string }
    >();
    for (const p of players ?? []) {
      const team = p.teams as any;
      playerMap.set(p.id, {
        name: p.name ?? "",
        webName: p.web_name ?? p.name ?? "",
        position: p.position ?? "",
        teamShort: team?.short_name ?? "",
      });
    }

    // Fetch fantasy team names
    const { data: fantasyTeams } = await admin
      .from("fantasy_teams")
      .select("user_id, name")
      .in("user_id", [...userIds]);

    const teamNameMap = new Map<string, string>();
    for (const ft of fantasyTeams ?? []) {
      teamNameMap.set(ft.user_id, ft.name ?? "Unknown Manager");
    }

    // Build enriched response
    const enriched = transfers.map((t) => {
      const pOut = playerMap.get(t.out_player_id) ?? {
        name: "Unknown",
        webName: "Unknown",
        position: "",
        teamShort: "",
      };
      const pIn = playerMap.get(t.in_player_id) ?? {
        name: "Unknown",
        webName: "Unknown",
        position: "",
        teamShort: "",
      };

      return {
        id: t.id,
        managerTeam: teamNameMap.get(t.user_id) ?? "Unknown Manager",
        playerOut: {
          name: pOut.name,
          webName: pOut.webName,
          position: pOut.position,
          teamShort: pOut.teamShort,
        },
        playerIn: {
          name: pIn.name,
          webName: pIn.webName,
          position: pIn.position,
          teamShort: pIn.teamShort,
        },
        gameweekId: t.gameweek_id,
        createdAt: t.created_at,
      };
    });

    return NextResponse.json(
      { transfers: enriched },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("TRANSFER ACTIVITY ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
