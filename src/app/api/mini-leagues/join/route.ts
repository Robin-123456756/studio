import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { normalizeInviteCode } from "@/lib/invite-code";
import { generateAndSaveH2HFixtures } from "@/lib/h2h-utils";
import { rateLimitResponse } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

const RATE_LIMIT_JOIN = { maxRequests: 10, windowMs: 60 * 1000 };
const RATE_LIMIT_JOIN_FAIL = { maxRequests: 10, windowMs: 15 * 60 * 1000 };

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

    // Rate limit: 10 join attempts per minute
    const rl = rateLimitResponse("join-league", userId, RATE_LIMIT_JOIN);
    if (rl) return rl;

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
      return apiError("Failed to look up league", "LEAGUE_LOOKUP_FAILED", 500, lgErr);
    }
    if (!league) {
      // Brute force protection: tighter limit on failed lookups (10 per 15 min)
      const failRl = rateLimitResponse("join-fail", userId, RATE_LIMIT_JOIN_FAIL);
      if (failRl) return failRl;
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
        return apiError("Failed to join league", "LEAGUE_JOIN_FAILED", 500, joinErr);
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
  } catch (e: unknown) {
    return apiError("Failed to join league", "LEAGUE_JOIN_CRASHED", 500, e);
  }
}
