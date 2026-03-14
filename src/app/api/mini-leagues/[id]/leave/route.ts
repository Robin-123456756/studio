import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** DELETE — leave a league (cannot leave general leagues) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = auth.user.id;
    const sb = getSupabaseServerOrThrow();

    const leagueId = Number(id);
    if (!Number.isFinite(leagueId)) {
      return NextResponse.json({ error: "Invalid league ID" }, { status: 400 });
    }

    // Check league exists and is not general
    const { data: league } = await sb
      .from("mini_leagues")
      .select("id, is_general")
      .eq("id", leagueId)
      .single();

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }
    if (league.is_general) {
      return NextResponse.json(
        { error: "You cannot leave a general league" },
        { status: 400 }
      );
    }

    // BOLA: Verify user is actually a member before deleting
    const { data: membership } = await sb
      .from("mini_league_members")
      .select("league_id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this league" }, { status: 403 });
    }

    // Delete membership
    const { error: delErr } = await sb
      .from("mini_league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);

    if (delErr) {
      return apiError("Failed to leave league", "LEAGUE_LEAVE_FAILED", 500, delErr);
    }

    return NextResponse.json({ left: true });
  } catch (e: unknown) {
    return apiError("Failed to leave league", "LEAGUE_LEAVE_CRASHED", 500, e);
  }
}
