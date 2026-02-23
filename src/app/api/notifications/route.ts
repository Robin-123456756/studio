import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? `${DEFAULT_LIMIT}`, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

async function parseBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// GET - fetch notifications + unread count
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const { searchParams } = new URL(req.url);

    const limit = parseLimit(searchParams.get("limit"));
    const userId = searchParams.get("userId") || searchParams.get("user_id");

    let notificationsQuery = supabase
      .from("notifications")
      .select("id, title, message, type, is_read, link, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) {
      notificationsQuery = notificationsQuery.eq("user_id", userId);
    }

    const { data: notifications, error: notificationsError } = await notificationsQuery;
    if (notificationsError) throw notificationsError;

    let unreadQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);

    if (userId) {
      unreadQuery = unreadQuery.eq("user_id", userId);
    }

    const { count: unreadCount, error: unreadError } = await unreadQuery;
    if (unreadError) throw unreadError;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount ?? 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { notifications: [], unreadCount: 0, error: error?.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PUT - mark one or all notifications as read
export async function PUT(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const body = await parseBody(req);
    const action = body?.action;
    const userId = body?.userId || body?.user_id;

    if (action === "mark_read") {
      const id = Number.parseInt(String(body?.id), 10);
      if (Number.isNaN(id)) {
        return NextResponse.json({ error: "Valid notification id is required" }, { status: 400 });
      }

      let updateQuery = supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .select("id")
        .limit(1);

      if (userId) {
        updateQuery = updateQuery.eq("user_id", userId);
      }

      const { data, error } = await updateQuery;
      if (error) throw error;
      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, id });
    }

    if (action === "mark_all_read") {
      const ids = Array.isArray(body?.ids)
        ? body.ids
            .map((id: any) => Number.parseInt(String(id), 10))
            .filter((id: number) => !Number.isNaN(id))
        : [];

      let updateQuery = supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false)
        .select("id");

      if (userId) {
        updateQuery = updateQuery.eq("user_id", userId);
      }
      if (ids.length > 0) {
        updateQuery = updateQuery.in("id", ids);
      }

      const { data, error } = await updateQuery;
      if (error) throw error;

      return NextResponse.json({ success: true, updated: data?.length || 0 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update notifications" },
      { status: 500 }
    );
  }
}
