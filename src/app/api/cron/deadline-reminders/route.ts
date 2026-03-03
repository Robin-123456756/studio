import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { sendPushToUsers } from "@/lib/push-notifications";
import { buildDeadlineReminderPush } from "@/lib/push-message-builders";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: Send deadline reminders ~24h before gameweek deadlines.
 * Runs once daily at 8am Kampala time (5:00 UTC).
 * Only targets managers who haven't saved picks for that gameweek yet.
 * Protected by CRON_SECRET (Vercel auto-sends this for cron jobs).
 */
export async function GET(req: Request) {
  // ── Auth: verify CRON_SECRET ──
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerOrThrow();
    const now = new Date();

    // 1. Fetch non-finalized gameweeks with a future deadline
    // Gameweeks with a future deadline that haven't been fully reminded yet
    const { data: gameweeks, error: gwErr } = await supabase
      .from("gameweeks")
      .select("id, deadline_time, reminder_24h_sent_at")
      .gt("deadline_time", now.toISOString());

    if (gwErr || !gameweeks) {
      return NextResponse.json(
        { error: gwErr?.message ?? "Failed to fetch gameweeks" },
        { status: 500 }
      );
    }

    const reminded: Record<string, number> = {};

    for (const gw of gameweeks) {
      const deadline = new Date(gw.deadline_time);
      const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Send 24h reminder if deadline is within 24h and not yet sent
      if (hoursUntil > 24 || gw.reminder_24h_sent_at) continue;

      // 2. Find all fantasy managers
      const { data: allTeams } = await supabase
        .from("fantasy_teams")
        .select("user_id");

      if (!allTeams || allTeams.length === 0) continue;

      const allUserIds = allTeams.map((t) => t.user_id);

      // 3. Find users who HAVE saved picks for this GW
      const { data: submitters } = await supabase
        .from("user_rosters")
        .select("user_id")
        .eq("gameweek_id", gw.id);

      const submitterSet = new Set(
        (submitters ?? []).map((r) => r.user_id)
      );

      // 4. Non-submitters = all managers minus those who saved picks
      const nonSubmitters = allUserIds.filter((uid) => !submitterSet.has(uid));

      if (nonSubmitters.length === 0) {
        // Everyone has submitted — still stamp to prevent re-checking
        await supabase
          .from("gameweeks")
          .update({ reminder_24h_sent_at: now.toISOString() })
          .eq("id", gw.id);
        continue;
      }

      // 5. Send push and stamp
      const payload = buildDeadlineReminderPush(gw.id, "24h");
      await sendPushToUsers(nonSubmitters, payload);

      await supabase
        .from("gameweeks")
        .update({ reminder_24h_sent_at: now.toISOString() })
        .eq("id", gw.id);

      reminded[`GW${gw.id}_24h`] = nonSubmitters.length;
    }

    return NextResponse.json({
      ok: true,
      checked: gameweeks.length,
      reminded,
    });
  } catch (err: any) {
    console.error("Cron deadline-reminders error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
