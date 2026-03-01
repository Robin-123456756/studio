import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/users — list all fantasy managers with stats */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    // Get current GW
    const { data: currentGw } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();
    const currentGwId = currentGw?.id ?? null;

    // Parallel fetches
    const [teamsRes, scoresRes, transfersRes, chipsRes] = await Promise.all([
      supabase.from("fantasy_teams").select("user_id, name"),
      supabase.from("user_weekly_scores").select("user_id, gameweek_id, total_weekly_points"),
      supabase.from("user_transfers").select("user_id"),
      supabase.from("user_chips").select("user_id, chip"),
    ]);

    const teams = teamsRes.data ?? [];
    const scores = scoresRes.data ?? [];
    const transfers = transfersRes.data ?? [];
    const chips = chipsRes.data ?? [];

    // Aggregate scores per user
    const scoreMap = new Map<string, { total: number; currentGw: number; gwCount: number }>();
    for (const s of scores) {
      const uid = (s as any).user_id;
      const pts = (s as any).total_weekly_points || 0;
      const gwId = (s as any).gameweek_id;
      const existing = scoreMap.get(uid) || { total: 0, currentGw: 0, gwCount: 0 };
      existing.total += pts;
      existing.gwCount++;
      if (gwId === currentGwId) existing.currentGw = pts;
      scoreMap.set(uid, existing);
    }

    // Count transfers per user
    const transferMap = new Map<string, number>();
    for (const t of transfers) {
      const uid = (t as any).user_id;
      transferMap.set(uid, (transferMap.get(uid) || 0) + 1);
    }

    // Count chips per user
    const chipMap = new Map<string, number>();
    for (const c of chips) {
      const uid = (c as any).user_id;
      chipMap.set(uid, (chipMap.get(uid) || 0) + 1);
    }

    // Build user list from fantasy_teams
    const teamUserIds = new Set(teams.map((t: any) => t.user_id));
    const users = teams.map((t: any) => {
      const uid = t.user_id;
      const s = scoreMap.get(uid) || { total: 0, currentGw: 0, gwCount: 0 };
      return {
        userId: uid,
        teamName: t.name || "Unnamed Team",
        totalPoints: s.total,
        currentGwPoints: s.currentGw,
        gwsPlayed: s.gwCount,
        transfersUsed: transferMap.get(uid) || 0,
        chipsUsed: chipMap.get(uid) || 0,
      };
    });

    // Also include signups from auth.users who haven't created a fantasy team yet
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        if (!teamUserIds.has(u.id)) {
          users.push({
            userId: u.id,
            teamName: u.email || u.phone || "New signup (no team)",
            totalPoints: 0,
            currentGwPoints: 0,
            gwsPlayed: 0,
            transfersUsed: 0,
            chipsUsed: 0,
          });
        }
      }
    }

    // Sort by total points desc (new signups will be at the bottom with 0)
    users.sort((a: any, b: any) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ users, currentGwId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load users" }, { status: 500 });
  }
}
