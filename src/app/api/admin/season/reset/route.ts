import { NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_DESTRUCTIVE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/admin/season/reset — reset all season data */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("season-reset", userId, RATE_LIMIT_DESTRUCTIVE);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { confirmation } = body;

    if (confirmation !== "RESET SEASON") {
      return NextResponse.json(
        { error: 'You must type "RESET SEASON" to confirm.' },
        { status: 400 }
      );
    }

    // Delete transactional data in order (respecting FK constraints)
    const deletions = [
      supabase.from("user_rosters").delete().neq("user_id", ""),
      supabase.from("user_weekly_scores").delete().neq("user_id", ""),
      supabase.from("user_chips").delete().neq("user_id", ""),
      supabase.from("user_transfers").delete().neq("user_id", ""),
      supabase.from("user_transfer_state").delete().neq("user_id", ""),
      supabase.from("player_stats").delete().neq("player_id", ""),
      supabase.from("player_match_events").delete().neq("player_id", ""),
      supabase.from("voice_audit_log").delete().neq("id", ""),
      supabase.from("activity_feed").delete().neq("id", ""),
    ];

    const results = await Promise.all(deletions);
    const errors = results.filter((r) => r.error).map((r) => r.error?.message);

    // Reset player total points
    await supabase.from("players").update({ total_points: 0 }).neq("id", "");

    // Reset gameweek flags
    await supabase.from("gameweeks").update({ is_current: false, finalized: false }).neq("id", 0);

    return NextResponse.json({
      success: true,
      errors: errors.length > 0 ? errors : undefined,
      message: "Season data has been reset.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Reset failed" }, { status: 500 });
  }
}
