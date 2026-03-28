import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";
import { loadScoringRules, lookupPoints, norm } from "@/lib/scoring-engine";

export async function GET(request: Request) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();

    // Get all committed events for this match
    const { data: events, error } = await supabase
      .from("player_match_events")
      .select(`
        id,
        match_id,
        player_id,
        action,
        quantity,
        points_awarded,
        input_method,
        voice_transcript,
       players (
          id,
          name,
          web_name,
          position,
          is_lady,
          team_id,
          teams:team_id (
            name,
            short_name
          )
        )
      `)
      .eq("match_id", Number(matchId))
      .order("id", { ascending: true });

    if (error) throw error;

    if (!events || events.length === 0) {
      return NextResponse.json({ error: "No events found for this match" }, { status: 404 });
    }

    const rules = await loadScoringRules();

    function calcEventPoints(e: any, p: any): number {
      if (e.action === "bonus") return e.points_awarded ?? 0;
      return lookupPoints(rules, e.action, norm(p.position), p.is_lady ?? false);
    }

    // Build CSV
    const header = "Player,Position,Team,Action,Quantity,Points";
    const rows = events.map((e: any) => {
      const p: any = Array.isArray(e.players) ? e.players[0] : e.players || {};
      const team = Array.isArray(p.teams) ? p.teams[0] : p.teams;
      return [
        `"${p.web_name || p.name || "Unknown"}"`,
        p.position || "?",
        `"${team?.short_name || team?.name || ""}"`,
        e.action,
        e.quantity,
        calcEventPoints(e, p),
      ].join(",");
    });

    // Summary — total points per player
    const playerTotals: Record<string, { name: string; position: string; team: string; points: number }> = {};
    for (const e of events) {
      const p: any = Array.isArray(e.players) ? e.players[0] : e.players || {};
      const key = e.player_id;
      if (!playerTotals[key]) {
        const team = Array.isArray(p.teams) ? p.teams[0] : p.teams;
        playerTotals[key] = {
          name: p.web_name || p.name || "Unknown",
          position: p.position || "?",
          team: team?.short_name || team?.name || "",
          points: 0,
        };
      }
      playerTotals[key].points += calcEventPoints(e, p);
    }

    const summaryHeader = "\n\nSUMMARY\nPlayer,Position,Team,Total Points";
    const summaryRows = Object.values(playerTotals)
      .sort((a, b) => b.points - a.points)
      .map(p => `"${p.name}",${p.position},"${p.team}",${p.points}`);

    const csv = `Budo League — Match ${matchId}\n\n${header}\n${rows.join("\n")}${summaryHeader}\n${summaryRows.join("\n")}`;

    const filename = `budo-match-${matchId}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    return apiError("Export failed", "CSV_EXPORT_FAILED", 500, error);
  }
}
