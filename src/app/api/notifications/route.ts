import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

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
    // Auth: verify the caller is signed in
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const supabase = getSupabaseServerOrThrow();
    const { searchParams } = new URL(req.url);

    const limit = parseLimit(searchParams.get("limit"));
    // Use authenticated user's ID instead of trusting query param
    const userId = auth.user.id;

    // BOLA: always scope to authenticated user (no conditional — userId is always set after auth check)
    const notificationsQuery = supabase
      .from("notifications")
      .select("id, title, message, type, is_read, link, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    const { data: notifications, error: notificationsError } = await notificationsQuery;
    if (notificationsError) throw notificationsError;

    const unreadQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("user_id", userId);

    const { count: unreadCount, error: unreadError } = await unreadQuery;
    if (unreadError) throw unreadError;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount ?? 0,
    });
  } catch (error: unknown) {
    return apiError("Failed to fetch notifications", "NOTIFICATIONS_GET_FAILED", 500, error);
  }
}

// PUT - mark one or all notifications as read
export async function PUT(req: Request) {
  try {
    // Auth: verify the caller is signed in
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const supabase = getSupabaseServerOrThrow();
    const body = await parseBody(req);
    const action = body?.action;
    // Use authenticated user's ID instead of trusting body param
    const userId = auth.user.id;

    if (action === "mark_read") {
      const id = Number.parseInt(String(body?.id), 10);
      if (Number.isNaN(id)) {
        return NextResponse.json({ error: "Valid notification id is required" }, { status: 400 });
      }

      // BOLA: always scope to authenticated user
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", userId)
        .select("id")
        .limit(1);
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

      // BOLA: always scope to authenticated user
      let updateQuery = supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false)
        .eq("user_id", userId)
        .select("id");

      if (ids.length > 0) {
        updateQuery = updateQuery.in("id", ids);
      }

      const { data, error } = await updateQuery;
      if (error) throw error;

      return NextResponse.json({ success: true, updated: data?.length || 0 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    return apiError("Failed to update notifications", "NOTIFICATIONS_PUT_FAILED", 500, error);
  }
}
