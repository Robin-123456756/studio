import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { normalizeInviteCode } from "@/lib/invite-code";
import { generateAndSaveH2HFixtures } from "@/lib/h2h-utils";

export const dynamic = "force-dynamic";

/** POST — join a league via invite code (idempotent) */
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
    const code = normalizeInviteCode(String(body.code ?? ""));
    if (!code || code.length < 8) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
    }

    // Find league by invite code
    const { data: league, error: lgErr } = await sb
      .from("mini_leagues")
      .select("id, name, league_type")
      .eq("invite_code", code)
      .maybeSingle();

    if (lgErr) {
      return NextResponse.json({ error: lgErr.message }, { status: 500 });
    }
    if (!league) {
      return NextResponse.json({ error: "League not found. Check the invite code." }, { status: 404 });
    }

    // Check if already a member (idempotent)
    const { data: existing } = await sb
      .from("mini_league_members")
      .select("league_id")
      .eq("league_id", league.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      // H2H leagues capped at 20 members
      if (league.league_type === "h2h") {
        const { count } = await sb
          .from("mini_league_members")
          .select("*", { count: "exact", head: true })
          .eq("league_id", league.id);
        if ((count ?? 0) >= 20) {
          return NextResponse.json(
            { error: "This head-to-head league is full (max 20 managers)" },
            { status: 400 }
          );
        }
      }

      const { error: joinErr } = await sb
        .from("mini_league_members")
        .insert({ league_id: league.id, user_id: userId });

      if (joinErr) {
        return NextResponse.json({ error: joinErr.message }, { status: 500 });
      }

      // Regenerate H2H fixtures if this is an H2H league
      if (league.league_type === "h2h") {
        const { data: allMembers } = await sb
          .from("mini_league_members")
          .select("user_id")
          .eq("league_id", league.id);
        const allIds = (allMembers ?? []).map((m: any) => m.user_id);
        await generateAndSaveH2HFixtures(sb, league.id, allIds);
      }
    }

    return NextResponse.json({
      joined: true,
      league: { id: league.id, name: league.name },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}
