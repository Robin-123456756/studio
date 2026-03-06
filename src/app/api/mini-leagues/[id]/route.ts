import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { computeStandings } from "@/lib/leaderboard-utils";
import { computeH2HStandings } from "@/lib/h2h-utils";

export const dynamic = "force-dynamic";

/** GET — full standings for a specific league */
export async function GET(
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

    // Verify user is a member
    const { data: membership } = await sb
      .from("mini_league_members")
      .select("league_id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this league" }, { status: 403 });
    }

    // Fetch league details
    const { data: league, error: lgErr } = await sb
      .from("mini_leagues")
      .select("id, name, invite_code, is_general, created_by, league_type")
      .eq("id", leagueId)
      .single();

    if (lgErr || !league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // Fetch all members
    const { data: members } = await sb
      .from("mini_league_members")
      .select("user_id")
      .eq("league_id", leagueId);

    const memberIds = (members ?? []).map((m: any) => m.user_id);
    const leagueType = league.league_type || "classic";

    if (leagueType === "h2h") {
      const { standings: h2hStandings, currentGwFixtures } = await computeH2HStandings(sb, leagueId, memberIds);
      return NextResponse.json({
        league: {
          id: league.id,
          name: league.name,
          inviteCode: league.invite_code,
          isGeneral: league.is_general,
          isCreator: league.created_by === userId,
          leagueType: "h2h",
          memberCount: memberIds.length,
        },
        standings: h2hStandings,
        currentGwFixtures,
      });
    }

    const standings = await computeStandings(sb, memberIds);

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        inviteCode: league.invite_code,
        isGeneral: league.is_general,
        isCreator: league.created_by === userId,
        leagueType: "classic",
        memberCount: memberIds.length,
      },
      standings,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}

/** PATCH — rename league (creator only) */
export async function PATCH(
  req: NextRequest,
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

    // Verify creator
    const { data: league } = await sb
      .from("mini_leagues")
      .select("id, created_by")
      .eq("id", leagueId)
      .single();

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }
    if (league.created_by !== userId) {
      return NextResponse.json({ error: "Only the league creator can rename it" }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "Name must be 1-50 characters" }, { status: 400 });
    }

    const { error: updateErr } = await sb
      .from("mini_leagues")
      .update({ name })
      .eq("id", leagueId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true, name });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}
