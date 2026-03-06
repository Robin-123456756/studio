import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { generateInviteCode } from "@/lib/invite-code";
import { computeStandings } from "@/lib/leaderboard-utils";
import { generateAndSaveH2HFixtures } from "@/lib/h2h-utils";

export const dynamic = "force-dynamic";

/** GET — list leagues the current user belongs to, with their rank + movement */
export async function GET() {
  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = auth.user.id;
    const sb = getSupabaseServerOrThrow();

    // Fetch leagues user is a member of
    const { data: memberships, error: memErr } = await sb
      .from("mini_league_members")
      .select("league_id")
      .eq("user_id", userId);

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    const leagueIds = (memberships ?? []).map((m: any) => m.league_id);
    if (leagueIds.length === 0) {
      return NextResponse.json({ leagues: [] });
    }

    // Fetch league details
    const { data: leagues, error: lgErr } = await sb
      .from("mini_leagues")
      .select("id, name, invite_code, is_general, created_by, league_type")
      .in("id", leagueIds);

    if (lgErr) {
      return NextResponse.json({ error: lgErr.message }, { status: 500 });
    }

    // For each league, fetch members and compute user's rank + movement
    const result = await Promise.all(
      (leagues ?? []).map(async (league: any) => {
        const { data: members } = await sb
          .from("mini_league_members")
          .select("user_id")
          .eq("league_id", league.id);

        const memberIds = (members ?? []).map((m: any) => m.user_id);
        const standings = await computeStandings(sb, memberIds);

        const myEntry = standings.find((s) => s.userId === userId);

        return {
          id: league.id,
          name: league.name,
          inviteCode: league.invite_code,
          isGeneral: league.is_general,
          isCreator: league.created_by === userId,
          leagueType: league.league_type || "classic",
          memberCount: memberIds.length,
          rank: myEntry?.rank ?? null,
          totalPoints: myEntry?.totalPoints ?? 0,
          movement: myEntry?.movement ?? 0,
        };
      })
    );

    // Sort: general leagues last, then by name
    result.sort((a, b) => {
      if (a.isGeneral !== b.isGeneral) return a.isGeneral ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ leagues: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}

/** POST — create a new mini-league */
export async function POST(req: NextRequest) {
  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = auth.user.id;
    const sb = getSupabaseServerOrThrow();

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const leagueType = body.leagueType === "h2h" ? "h2h" : "classic";

    if (!name || name.length > 50) {
      return NextResponse.json(
        { error: "League name must be 1-50 characters" },
        { status: 400 }
      );
    }

    // Generate unique invite code (retry if collision)
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await sb
        .from("mini_leagues")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Insert league
    const { data: league, error: insertErr } = await sb
      .from("mini_leagues")
      .insert({
        name,
        created_by: userId,
        invite_code: inviteCode,
        is_general: false,
        league_type: leagueType,
      })
      .select("id, name, invite_code, league_type")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Auto-join creator
    await sb.from("mini_league_members").insert({
      league_id: league.id,
      user_id: userId,
    });

    return NextResponse.json({ league }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}
