import { NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 3 * 1024 * 1024; // 3 MB
const VALID_CATEGORIES = [
  "announcement",
  "matchday",
  "player_spotlight",
  "deadline",
  "general",
] as const;

/** GET /api/admin/feed-media — list all feed media (admin view, includes inactive) */
export async function GET() {
  const { session, error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  const { data, error } = await supabase
    .from("feed_media")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return apiError("Failed to load feed media", "FEED_MEDIA_LIST_FAILED", 500, error);
  }

  return NextResponse.json({ items: data ?? [] });
}

/** POST /api/admin/feed-media — upload image + create feed media item */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("feed-media-upload", userId, RATE_LIMIT_HEAVY);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const body = (formData.get("body") as string | null)?.trim() || null;
    const category = (formData.get("category") as string | null) || "general";
    const isPinned = formData.get("is_pinned") === "true";
    const gameweekId = formData.get("gameweek_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category as any)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 3MB.` },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("feed-media")
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return apiError("Failed to upload image", "FEED_MEDIA_UPLOAD_FAILED", 500, uploadError);
    }

    const { data: publicUrlData } = supabase.storage
      .from("feed-media")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    // Resolve admin user ID from session
    const adminUsername = (session!.user as any).name || (session!.user as any).userId;
    let createdBy: number | null = null;
    if (adminUsername) {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("id")
        .eq("username", adminUsername)
        .single();
      createdBy = adminRow?.id ?? null;
    }

    // Insert feed_media row
    const { data: inserted, error: insertError } = await supabase
      .from("feed_media")
      .insert({
        title,
        body,
        image_url: imageUrl,
        category,
        is_pinned: isPinned,
        gameweek_id: gameweekId ? parseInt(gameweekId, 10) : null,
        created_by: createdBy,
      })
      .select()
      .single();

    if (insertError) {
      return apiError("Failed to save feed item", "FEED_MEDIA_INSERT_FAILED", 500, insertError);
    }

    return NextResponse.json({ item: inserted }, { status: 201 });
  } catch (e: unknown) {
    return apiError("Failed to create feed media", "FEED_MEDIA_CREATE_FAILED", 500, e);
  }
}

/** DELETE /api/admin/feed-media?id=N — soft-delete (deactivate) a feed media item */
export async function DELETE(req: Request) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter." }, { status: 400 });
  }

  const supabase = getSupabaseServerOrThrow();

  const { error } = await supabase
    .from("feed_media")
    .update({ is_active: false })
    .eq("id", parseInt(id, 10));

  if (error) {
    return apiError("Failed to delete feed item", "FEED_MEDIA_DELETE_FAILED", 500, error);
  }

  return NextResponse.json({ success: true });
}
