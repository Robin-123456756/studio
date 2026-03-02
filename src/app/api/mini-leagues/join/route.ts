import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { normalizeInviteCode } from "@/lib/invite-code";

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
      .select("id, name")
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
      const { error: joinErr } = await sb
        .from("mini_league_members")
        .insert({ league_id: league.id, user_id: userId });

      if (joinErr) {
        return NextResponse.json({ error: joinErr.message }, { status: 500 });
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
