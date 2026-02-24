import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/users/[userId] — user detail */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();
  const { userId } = await params;

  try {
    // Get current GW
    const { data: currentGw } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();
    const currentGwId = currentGw?.id ?? null;

    const [teamRes, rosterRes, transfersRes, chipsRes, scoresRes] = await Promise.all([
      supabase.from("fantasy_teams").select("name").eq("user_id", userId).maybeSingle(),
      currentGwId
        ? supabase
            .from("user_rosters")
            .select("player_id, is_starting_9, is_captain, is_vice_captain, multiplier")
            .eq("user_id", userId)
            .eq("gameweek_id", currentGwId)
        : Promise.resolve({ data: [] }),
      supabase
        .from("user_transfers")
        .select("gameweek_id, player_out_id, player_in_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("user_chips").select("gameweek_id, chip, activated_at").eq("user_id", userId),
      supabase
        .from("user_weekly_scores")
        .select("gameweek_id, total_weekly_points")
        .eq("user_id", userId)
        .order("gameweek_id", { ascending: true }),
    ]);

    // Enrich roster with player names
    const rosterData = (rosterRes as any).data ?? [];
    let roster: any[] = [];
    if (rosterData.length > 0) {
      const playerIds = rosterData.map((r: any) => r.player_id);
      const { data: players } = await supabase
        .from("players")
        .select("id, name, web_name, position")
        .in("id", playerIds);

      const playerMap = new Map<string, any>();
      for (const p of players ?? []) playerMap.set(p.id, p);

      roster = rosterData.map((r: any) => {
        const p = playerMap.get(r.player_id);
        return {
          playerId: r.player_id,
          playerName: p?.web_name || p?.name || "Unknown",
          position: p?.position || "?",
          isStarting: !!r.is_starting_9,
          isCaptain: !!r.is_captain,
          isViceCaptain: !!r.is_vice_captain,
          multiplier: r.multiplier || 1,
        };
      });
    }

    return NextResponse.json({
      teamName: teamRes.data?.name || "Unnamed Team",
      roster,
      transfers: transfersRes.data ?? [],
      chips: chipsRes.data ?? [],
      gwScores: scoresRes.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load user" }, { status: 500 });
  }
}

/** PATCH /api/admin/users/[userId] — update team name */
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();
  const { userId } = await params;

  try {
    const body = await req.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("fantasy_teams")
      .update({ name: name.trim() })
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update" }, { status: 500 });
  }
}
