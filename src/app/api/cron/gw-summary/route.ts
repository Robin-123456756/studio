import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { sendPushToUsers } from "@/lib/push-notifications";
import { buildGwSummaryPush } from "@/lib/push-message-builders";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: Send personalized GW summary push notifications
 * after a gameweek is finalized.
 *
 * Runs periodically (e.g., every hour or after admin finalizes).
 * Detects finalized GWs that haven't had summaries sent yet
 * (using `summary_sent_at` column on gameweeks table).
 *
 * Each manager gets: "GW5 Complete! You scored 54 pts — Rank: 3rd of 12"
 *
 * Protected by CRON_SECRET (Vercel auto-sends this for cron jobs).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerOrThrow();

    // 1. Find finalized GWs that haven't had summaries sent
    const { data: gameweeks, error: gwErr } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("finalized", true)
      .is("summary_sent_at", null);

    if (gwErr) throw gwErr;
    if (!gameweeks || gameweeks.length === 0) {
      return NextResponse.json({ ok: true, message: "No finalized GWs pending summary" });
    }

    const results: Record<string, number> = {};

    for (const gw of gameweeks) {
      const gwId = gw.id;

      // 2. Get scores from user_weekly_scores (calculated by scoring engine,
      //    includes auto-subs, captain, chips — matches what users see in-app)
      const { data: weeklyScores } = await supabase
        .from("user_weekly_scores")
        .select("user_id, total_weekly_points")
        .eq("gameweek_id", gwId);

      if (!weeklyScores || weeklyScores.length === 0) {
        // No scores calculated yet — skip without stamping so we retry next run
        continue;
      }

      const managerScores: { userId: string; points: number }[] =
        weeklyScores.map((s) => ({
          userId: s.user_id,
          points: s.total_weekly_points ?? 0,
        }));

      // 5. Sort by points desc to determine rank
      managerScores.sort((a, b) => b.points - a.points);

      let currentRank = 1;
      for (let i = 0; i < managerScores.length; i++) {
        if (i > 0 && managerScores[i].points < managerScores[i - 1].points) {
          currentRank = i + 1;
        }
        managerScores[i] = { ...managerScores[i], ...{ rank: currentRank } };
      }

      const totalManagers = managerScores.length;

      // 6. Send personalized push to each manager
      for (const ms of managerScores) {
        const rank = (ms as any).rank as number;
        const payload = buildGwSummaryPush(gwId, ms.points, rank, totalManagers);
        await sendPushToUsers([ms.userId], payload);
      }

      // 7. Stamp the GW so we don't re-send
      await supabase
        .from("gameweeks")
        .update({ summary_sent_at: new Date().toISOString() })
        .eq("id", gwId);

      results[`GW${gwId}`] = totalManagers;
    }

    return NextResponse.json({ ok: true, sent: results });
  } catch (err: any) {
    console.error("Cron gw-summary error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
