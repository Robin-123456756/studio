import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";
import { sendPushToAll } from "@/lib/push-notifications";
import { buildBroadcastPush } from "@/lib/push-message-builders";

export const dynamic = "force-dynamic";

/** POST /api/admin/notifications/send — send notification to all fantasy managers */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("notifications-send", userId, RATE_LIMIT_HEAVY);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { title, message, type, link } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const validTypes = ["info", "warning", "success", "match_update", "deadline"];
    const notifType = validTypes.includes(type) ? type : "info";

    // Get all unique user IDs from fantasy_teams
    const { data: managers, error: mError } = await supabase
      .from("fantasy_teams")
      .select("user_id");

    if (mError) {
      return NextResponse.json({ error: mError.message }, { status: 500 });
    }

    const uniqueUserIds = [...new Set((managers ?? []).map((m: any) => m.user_id))];

    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ error: "No managers found to notify." }, { status: 400 });
    }

    // Insert one notification per user
    const rows = uniqueUserIds.map((uid) => ({
      user_id: uid,
      title: title.trim(),
      message: message.trim(),
      type: notifType,
      link: link?.trim() || null,
      is_read: false,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Also send web push notification (fire-and-forget)
    sendPushToAll(buildBroadcastPush(title.trim(), message.trim())).catch(() => {});

    return NextResponse.json({ sent: uniqueUserIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to send notifications" }, { status: 500 });
  }
}

/** GET /api/admin/notifications/send — get manager count for preview */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { data: managers } = await supabase
      .from("fantasy_teams")
      .select("user_id");

    const uniqueCount = new Set((managers ?? []).map((m: any) => m.user_id)).size;
    return NextResponse.json({ managerCount: uniqueCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
