import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { autoAssignBonus } from "@/lib/bonus-calculator";
import { apiError } from "@/lib/api-error";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/match-appearances?gw_id=3
 *
 * Returns matches for the GW with players grouped by team,
 * each player annotated with whether they have existing events
 * or a did_play flag, so the admin can mark appearances.
 */
export async function GET(req: Request) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);
    const gwIdParam = url.searchParams.get("gw_id");
    const gwId = gwIdParam ? Number(gwIdParam) : NaN;

    if (!Number.isFinite(gwId)) {
      return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
    }

    // 1. Fetch matches for this GW
    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("id, home_team_uuid, away_team_uuid, home_goals, away_goals, is_played, kickoff_time")
      .eq("gameweek_id", gwId)
      .order("kickoff_time", { ascending: true });

    if (matchErr) {
      return apiError("Failed to fetch matches", "APPEARANCES_MATCH_FETCH_FAILED", 500, matchErr);
    }
    if (!matches || matches.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 2. Collect all team UUIDs from matches
    const teamUuids = [
      ...new Set(matches.flatMap((m) => [m.home_team_uuid, m.away_team_uuid].filter(Boolean))),
    ];

    // 3. Fetch teams (UUID → name, short_name)
    const { data: teams } = await supabase
      .from("teams")
      .select("id, team_uuid, name, short_name")
      .in("team_uuid", teamUuids);

    const teamByUuid = new Map<string, { id: number; team_uuid: string; name: string; short_name: string }>();
    for (const t of teams ?? []) {
      teamByUuid.set(t.team_uuid, t);
    }

    // 4. Fetch players for all teams in these matches (team_id is UUID)
    const { data: players } = await supabase
      .from("players")
      .select("id, name, web_name, position, team_id, is_lady")
      .in("team_id", teamUuids)
      .order("position", { ascending: true });

    // Group players by UUID team_id
    const playersByTeamId = new Map<string, typeof players>();
    for (const p of players ?? []) {
      const tid = String(p.team_id);
      if (!playersByTeamId.has(tid)) playersByTeamId.set(tid, []);
      playersByTeamId.get(tid)!.push(p);
    }

    // 5. Fetch existing player_stats.did_play for this GW
    const allPlayerIds = (players ?? []).map((p) => String(p.id));
    const { data: statsRows } = await supabase
      .from("player_stats")
      .select("player_id, did_play")
      .eq("gameweek_id", gwId)
      .in("player_id", allPlayerIds);

    const didPlayFromStats = new Set<string>();
    for (const s of statsRows ?? []) {
      if (s.did_play) didPlayFromStats.add(String(s.player_id));
    }

    // 6. Fetch player_match_events for this GW's matches (players with events definitely played)
    const matchIds = matches.map((m) => m.id);
    const events = await fetchAllRows((from, to) =>
      supabase
        .from("player_match_events")
        .select("player_id, match_id, action")
        .in("match_id", matchIds)
        .range(from, to)
    );

    // Map: player_id → set of match_ids where they have events
    const eventsMap = new Map<string, Set<number>>();
    // Map: "playerId__matchId" → "started" | "sub" (from appearance/sub_appearance events)
    const appearanceStatusMap = new Map<string, "started" | "sub">();
    for (const e of events ?? []) {
      const pid = String(e.player_id);
      if (!eventsMap.has(pid)) eventsMap.set(pid, new Set());
      eventsMap.get(pid)!.add(e.match_id);
      if (e.action === "appearance") {
        appearanceStatusMap.set(`${pid}__${e.match_id}`, "started");
      } else if (e.action === "sub_appearance") {
        appearanceStatusMap.set(`${pid}__${e.match_id}`, "sub");
      }
    }

    // 7. Build response grouped by match → home/away team → players
    const result = matches.map((match) => {
      const homeTeam = teamByUuid.get(match.home_team_uuid);
      const awayTeam = teamByUuid.get(match.away_team_uuid);

      function buildTeamPlayers(team: typeof homeTeam, matchId: number) {
        if (!team) return { teamUuid: null, teamName: "Unknown", shortName: "???", players: [] };
        const teamPlayers = playersByTeamId.get(team.team_uuid) ?? [];
        return {
          teamUuid: team.team_uuid,
          teamName: team.name,
          shortName: team.short_name,
          players: teamPlayers.map((p) => {
            const pid = String(p.id);
            const hasEvents = eventsMap.get(pid)?.has(matchId) ?? false;
            const markedDidPlay = didPlayFromStats.has(pid);
            // Determine appearance status from events
            const statusKey = `${pid}__${matchId}`;
            const evtStatus = appearanceStatusMap.get(statusKey);
            // Default: if has events but no explicit appearance status, assume "started" (legacy)
            let status: "started" | "sub" | "not_played" = "not_played";
            if (evtStatus) {
              status = evtStatus;
            } else if (hasEvents || markedDidPlay) {
              status = "started";
            }

            return {
              id: pid,
              name: p.web_name || p.name,
              position: p.position,
              isLady: p.is_lady,
              hasEvents,
              markedDidPlay,
              didPlay: hasEvents || markedDidPlay,
              status,             // "started" | "sub" | "not_played"
            };
          }),
        };
      }

      return {
        matchId: match.id,
        homeGoals: match.home_goals,
        awayGoals: match.away_goals,
        isPlayed: match.is_played,
        homeTeam: buildTeamPlayers(homeTeam, match.id),
        awayTeam: buildTeamPlayers(awayTeam, match.id),
      };
    });

    return NextResponse.json({ gwId, matches: result });
  } catch (e: unknown) {
    return apiError("Failed to load match appearances", "APPEARANCES_GET_FAILED", 500, e);
  }
}

/**
 * POST /api/admin/match-appearances
 *
 * Body: { gameweekId: number, matchId: number, appearances: { playerId: string, status: "started" | "sub" | "not_played" }[] }
 *
 * For each player:
 *   - "started"    → did_play=true, appearance event (2 pts from scoring_rules)
 *   - "sub"        → did_play=true, sub_appearance event (1 pt from scoring_rules)
 *   - "not_played" → did_play=false, removes any appearance/sub_appearance events
 */
export async function POST(req: Request) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const supabase = getSupabaseServerOrThrow();
    const body = await req.json();
    const { gameweekId, matchId, appearances } = body as {
      gameweekId: number;
      matchId: number;
      appearances: { playerId: string; status: "started" | "sub" | "not_played" }[];
    };

    if (!gameweekId || !matchId || !Array.isArray(appearances)) {
      return NextResponse.json({ error: "gameweekId, matchId, and appearances[] required" }, { status: 400 });
    }

    // Load scoring rules for appearance points
    const { data: rules } = await supabase
      .from("scoring_rules")
      .select("action, position, points")
      .in("action", ["appearance", "sub_appearance"]);

    const appearancePts = rules?.find((r) => r.action === "appearance")?.points ?? 2;
    const subAppearancePts = rules?.find((r) => r.action === "sub_appearance")?.points ?? 1;

    const playerIds = appearances.map((a) => a.playerId);

    // 1. Remove existing appearance/sub_appearance events for these players in this match
    if (playerIds.length > 0) {
      await supabase
        .from("player_match_events")
        .delete()
        .eq("match_id", matchId)
        .in("action", ["appearance", "sub_appearance"])
        .in("player_id", playerIds);
    }

    // 2. Insert new appearance events for players who played
    const newEvents: { player_id: string; match_id: number; action: string; quantity: number; points_awarded: number }[] = [];
    for (const a of appearances) {
      if (a.status === "started") {
        newEvents.push({
          player_id: a.playerId,
          match_id: matchId,
          action: "appearance",
          quantity: 1,
          points_awarded: appearancePts,
        });
      } else if (a.status === "sub") {
        newEvents.push({
          player_id: a.playerId,
          match_id: matchId,
          action: "sub_appearance",
          quantity: 1,
          points_awarded: subAppearancePts,
        });
      }
    }

    if (newEvents.length > 0) {
      const { error: evtErr } = await supabase
        .from("player_match_events")
        .insert(newEvents);
      if (evtErr) {
        return apiError("Failed to insert appearance events", "APPEARANCES_EVENT_INSERT_FAILED", 500, evtErr);
      }
    }

    // 3. Upsert player_stats.did_play
    const statsRows = appearances.map((a) => ({
      player_id: a.playerId,
      gameweek_id: gameweekId,
      did_play: a.status !== "not_played",
    }));

    if (statsRows.length > 0) {
      const { error: statsErr } = await supabase
        .from("player_stats")
        .upsert(statsRows, { onConflict: "player_id,gameweek_id" });
      if (statsErr) {
        return apiError("Failed to update player stats", "APPEARANCES_STATS_UPDATE_FAILED", 500, statsErr);
      }
    }

    // 4. Recalculate bonus — appearances affect BPS rankings
    let bonusWarning: string | undefined;
    try {
      await autoAssignBonus(matchId);
    } catch (err: any) {
      bonusWarning = `Bonus recalculation failed: ${err?.message ?? "unknown error"}`;
      console.error(`[match-appearances] ${bonusWarning}`);
    }

    const startedCount = appearances.filter((a) => a.status === "started").length;
    const subCount = appearances.filter((a) => a.status === "sub").length;
    return NextResponse.json({
      success: true,
      startedCount,
      subCount,
      totalProcessed: appearances.length,
      bonusWarning,
    });
  } catch (e: unknown) {
    return apiError("Failed to save match appearances", "APPEARANCES_POST_FAILED", 500, e);
  }
}
