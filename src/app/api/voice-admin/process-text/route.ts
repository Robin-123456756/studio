import { NextResponse } from "next/server";
import { processTextInput } from "@/lib/voice-admin/pipeline";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const { error: authErr, session } = await requireAdminSession();
    if (authErr) return authErr;

    // Rate limit: 5 text processing calls per minute
    const adminKey = session?.user?.email ?? "admin";
    const rl = rateLimitResponse("voice-process-text", adminKey, RATE_LIMIT_HEAVY);
    if (rl) return rl;
    const body = await request.json();
    const { text, matchId } = body;
    if (!text || !matchId) {
      return NextResponse.json({ error: "text and matchId are required" }, { status: 400 });
    }
    const supabase = getSupabaseServerOrThrow();
    const { data: match } = await supabase
      .from("matches")
      .select("id, home_team_uuid, away_team_uuid")
      .eq("id", matchId)
      .single();
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Fetch player names for GPT interpretation
    const teamUuids = [match.home_team_uuid, match.away_team_uuid].filter(Boolean);
    const playerNames: string[] = [];
    if (teamUuids.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select("name, web_name")
        .in("team_id", teamUuids);
      for (const p of players ?? []) {
        if (p.name) playerNames.push(p.name);
        if (p.web_name && p.web_name !== p.name) playerNames.push(p.web_name);
      }
    }

    const matchIdNum = Number(matchId);
    if (!Number.isFinite(matchIdNum)) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const result = await processTextInput(text, matchIdNum, playerNames);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return apiError("Failed to process text input", "PROCESS_TEXT_FAILED", 500, error);
  }
}
