import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

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

    // Delete membership
    const { error: delErr } = await sb
      .from("mini_league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ left: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}
