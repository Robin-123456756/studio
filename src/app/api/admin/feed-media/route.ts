import { NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { sendPushToAll } from "@/lib/push-notifications";
import { buildFeedMediaPush } from "@/lib/push-message-builders";
import { scaffoldMatchDay } from "@/lib/match-day-planner";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const VALID_CATEGORIES = [
  "announcement", "matchday", "player_spotlight", "deadline", "general",
  "breaking", "transfer_news", "match_report",
] as const;
const VALID_LAYOUTS = ["hero", "split", "feature", "gallery", "video", "quick"] as const;
const VALID_STATUSES = ["draft", "review", "approved", "published", "scheduled"] as const;

/** Upload a file to Supabase Storage and return its public URL */
async function uploadFile(
  supabase: ReturnType<typeof getSupabaseServerOrThrow>,
  bucket: string,
  file: File | Blob,
  prefix: string
): Promise<string> {
  const ext = file instanceof File ? (file.name.split(".").pop() || "bin") : "jpg";
  const filePath = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType: file instanceof File ? file.type : "image/jpeg", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/** Resolve admin user ID from session */
async function resolveAdminId(
  supabase: ReturnType<typeof getSupabaseServerOrThrow>,
  session: any
): Promise<number | null> {
  const adminUsername = session?.user?.name || session?.user?.userId;
  if (!adminUsername) return null;
  const { data } = await supabase
    .from("admin_users")
    .select("id")
    .eq("username", adminUsername)
    .single();
  return data?.id ?? null;
}

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

/** POST /api/admin/feed-media — create a new feed media item (or scaffold match day) */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Match Day Planner: scaffold 4 drafts from a match
  if (action === "scaffold-matchday") {
    const supabase = getSupabaseServerOrThrow();
    const body = await req.json();
    const matchId = body.match_id;
    if (!matchId) return apiError("match_id required", "MISSING_MATCH_ID", 400);

    const { data: match } = await supabase
      .from("matches")
      .select(`
        id, gameweek_id, kickoff_time,
        home_team:teams!matches_home_team_uuid_fkey(name, short_name),
        away_team:teams!matches_away_team_uuid_fkey(name, short_name)
      `)
      .eq("id", matchId)
      .maybeSingle();

    if (!match) return apiError("Match not found", "MATCH_NOT_FOUND", 404);

    const home = match.home_team as any;
    const away = match.away_team as any;
    const drafts = scaffoldMatchDay({
      id: match.id,
      gameweek_id: match.gameweek_id,
      kickoff_time: match.kickoff_time,
      home_team: home?.name || "Home",
      away_team: away?.name || "Away",
      home_short: home?.short_name || "HOM",
      away_short: away?.short_name || "AWY",
    });

    const { data: inserted, error: insertErr } = await supabase
      .from("feed_media")
      .insert(drafts.map((d) => ({ ...d, image_url: null })))
      .select("id, title, status");

    if (insertErr) return apiError("Failed to scaffold", "SCAFFOLD_FAILED", 500, insertErr);
    return NextResponse.json({ items: inserted, count: inserted?.length ?? 0 }, { status: 201 });
  }

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("feed-media-upload", userId, RATE_LIMIT_HEAVY);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const video = formData.get("video") as File | null;
    const thumbnail = formData.get("thumbnail") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const body = (formData.get("body") as string | null)?.trim() || null;
    const category = (formData.get("category") as string | null) || "general";
    const layout = (formData.get("layout") as string | null) || "hero";
    const isPinned = formData.get("is_pinned") === "true";
    const gameweekId = formData.get("gameweek_id") as string | null;
    const status = (formData.get("status") as string | null) || "published";
    const publishAt = (formData.get("publish_at") as string | null) || null;
    const galleryCount = parseInt((formData.get("gallery_count") as string | null) || "0", 10);
    const sendPush = formData.get("send_push") === "true";
    const seriesId = formData.get("series_id") as string | null;
    const seriesOrder = formData.get("series_order") as string | null;

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category as any)) {
      return NextResponse.json({ error: `Invalid category.` }, { status: 400 });
    }
    if (!VALID_LAYOUTS.includes(layout as any)) {
      return NextResponse.json({ error: `Invalid layout.` }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status as any)) {
      return NextResponse.json({ error: `Invalid status.` }, { status: 400 });
    }
    if (status === "scheduled" && !publishAt) {
      return NextResponse.json({ error: "Scheduled items require a publish date & time." }, { status: 400 });
    }

    // Upload image
    let imageUrl: string | null = null;
    if (file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Invalid image type "${file.type}". Allowed: JPEG, PNG, WebP.` }, { status: 400 });
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: `Image too large. Max: 3MB.` }, { status: 400 });
      }
      imageUrl = await uploadFile(supabase, "feed-media", file, "img");
    }

    // Upload video
    let videoUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    if (video) {
      if (!ALLOWED_VIDEO_TYPES.includes(video.type)) {
        return NextResponse.json({ error: `Invalid video type. Allowed: MP4, WebM.` }, { status: 400 });
      }
      if (video.size > MAX_VIDEO_SIZE) {
        return NextResponse.json({ error: `Video too large. Max: 50MB.` }, { status: 400 });
      }
      videoUrl = await uploadFile(supabase, "feed-media", video, "vid");
    }
    if (thumbnail) {
      if (!ALLOWED_IMAGE_TYPES.includes(thumbnail.type)) {
        return NextResponse.json({ error: "Invalid thumbnail type." }, { status: 400 });
      }
      if (thumbnail.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "Thumbnail too large. Max: 3MB." }, { status: 400 });
      }
      thumbnailUrl = await uploadFile(supabase, "feed-media", thumbnail, "thumb");
    }

    // Upload gallery images (capped at 10)
    const mediaUrls: string[] = [];
    const safeGalleryCount = Math.min(galleryCount, 10);
    for (let i = 0; i < safeGalleryCount; i++) {
      const gFile = formData.get(`gallery_${i}`) as File | null;
      if (gFile && ALLOWED_IMAGE_TYPES.includes(gFile.type) && gFile.size <= MAX_IMAGE_SIZE) {
        const url = await uploadFile(supabase, "feed-media", gFile, `gal${i}`);
        mediaUrls.push(url);
      }
    }

    const createdBy = await resolveAdminId(supabase, session!);

    const insertData: Record<string, any> = {
      title,
      body,
      image_url: imageUrl,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      category,
      layout,
      is_pinned: isPinned,
      status,
      publish_at: status === "scheduled" && publishAt ? publishAt : null,
      gameweek_id: gameweekId ? parseInt(gameweekId, 10) : null,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      created_by: createdBy,
      series_id: seriesId ? parseInt(seriesId, 10) : null,
      series_order: seriesOrder ? parseInt(seriesOrder, 10) : 0,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("feed_media")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return apiError("Failed to save feed item", "FEED_MEDIA_INSERT_FAILED", 500, insertError);
    }

    // Fire-and-forget push notification if toggled on and status is published
    if (sendPush && status === "published" && title) {
      sendPushToAll(buildFeedMediaPush(title, category)).catch(() => {});
    }

    return NextResponse.json({ item: inserted }, { status: 201 });
  } catch (e: unknown) {
    return apiError("Failed to create feed media", "FEED_MEDIA_CREATE_FAILED", 500, e);
  }
}

/** PUT /api/admin/feed-media — update an existing feed media item */
export async function PUT(req: Request) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const formData = await req.formData();
    const id = formData.get("id") as string | null;
    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const itemId = parseInt(id, 10);

    // Handle reactivate
    const reactivate = formData.get("reactivate") === "true";
    if (reactivate) {
      const { error } = await supabase
        .from("feed_media")
        .update({ is_active: true })
        .eq("id", itemId);
      if (error) {
        return apiError("Failed to reactivate", "FEED_MEDIA_REACTIVATE_FAILED", 500, error);
      }
      return NextResponse.json({ success: true });
    }

    // Build update object
    const updates: Record<string, any> = {};

    const title = (formData.get("title") as string | null)?.trim();
    if (title) updates.title = title;

    const body = formData.get("body") as string | null;
    if (body !== null) updates.body = body.trim() || null;

    const category = formData.get("category") as string | null;
    if (category && VALID_CATEGORIES.includes(category as any)) updates.category = category;

    const layout = formData.get("layout") as string | null;
    if (layout && VALID_LAYOUTS.includes(layout as any)) updates.layout = layout;

    const isPinned = formData.get("is_pinned");
    if (isPinned !== null) updates.is_pinned = isPinned === "true";

    const status = formData.get("status") as string | null;
    if (status && VALID_STATUSES.includes(status as any)) updates.status = status;

    const publishAt = formData.get("publish_at") as string | null;
    if (status === "scheduled" && !publishAt) {
      return NextResponse.json({ error: "Scheduled items require a publish date & time." }, { status: 400 });
    }
    if (status) {
      updates.publish_at = status === "scheduled" && publishAt ? publishAt : null;
    }

    const gameweekId = formData.get("gameweek_id") as string | null;
    if (gameweekId !== null) {
      updates.gameweek_id = gameweekId ? parseInt(gameweekId, 10) : null;
    }

    // Handle new image upload
    const file = formData.get("file") as File | null;
    if (file && ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE) {
      updates.image_url = await uploadFile(supabase, "feed-media", file, "img");
    }

    // Handle new video upload
    const video = formData.get("video") as File | null;
    if (video && ALLOWED_VIDEO_TYPES.includes(video.type) && video.size <= MAX_VIDEO_SIZE) {
      updates.video_url = await uploadFile(supabase, "feed-media", video, "vid");
    }

    const thumbnail = formData.get("thumbnail") as File | null;
    if (thumbnail && ALLOWED_IMAGE_TYPES.includes(thumbnail.type) && thumbnail.size <= MAX_IMAGE_SIZE) {
      updates.thumbnail_url = await uploadFile(supabase, "feed-media", thumbnail, "thumb");
    }

    // Gallery images (capped at 10)
    const galleryCount = Math.min(
      parseInt((formData.get("gallery_count") as string | null) || "0", 10),
      10
    );
    if (galleryCount > 0) {
      const mediaUrls: string[] = [];
      for (let i = 0; i < galleryCount; i++) {
        const gFile = formData.get(`gallery_${i}`) as File | null;
        if (gFile && ALLOWED_IMAGE_TYPES.includes(gFile.type) && gFile.size <= MAX_IMAGE_SIZE) {
          const url = await uploadFile(supabase, "feed-media", gFile, `gal${i}`);
          mediaUrls.push(url);
        }
      }
      if (mediaUrls.length > 0) updates.media_urls = mediaUrls;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    // Version history: snapshot current row before updating
    const { data: current } = await supabase
      .from("feed_media")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (current) {
      const editedBy = await resolveAdminId(supabase, session!);
      await supabase.from("feed_media_versions").insert({
        feed_media_id: itemId,
        title: current.title,
        body: current.body,
        category: current.category,
        layout: current.layout,
        snapshot: current,
        edited_by: editedBy,
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("feed_media")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (updateError) {
      return apiError("Failed to update feed item", "FEED_MEDIA_UPDATE_FAILED", 500, updateError);
    }

    return NextResponse.json({ item: updated });
  } catch (e: unknown) {
    return apiError("Failed to update feed media", "FEED_MEDIA_UPDATE_FAILED", 500, e);
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
