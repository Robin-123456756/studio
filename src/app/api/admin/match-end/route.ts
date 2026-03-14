import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** POST /api/admin/match-end — mark match as finished (Full Time) */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    const { data: match, error: fetchErr } = await supabase
      .from("matches")
      .select("id, is_played, is_final")
      .eq("id", matchId)
      .single();

    if (fetchErr || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (!match.is_played) {
      return NextResponse.json({ error: "Match has not started yet" }, { status: 400 });
    }

    if (match.is_final) {
      return NextResponse.json({ error: "Match is already finished" }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("matches")
      .update({ is_final: true, minutes: 60 })
      .eq("id", matchId);

    if (updateErr) {
      return apiError("Failed to end match", "MATCH_END_UPDATE_FAILED", 500, updateErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return apiError("Failed to end match", "MATCH_END_FAILED", 500, e);
  }
}
