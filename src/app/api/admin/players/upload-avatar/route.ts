import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB

/** POST /api/admin/players/upload-avatar — upload player photo */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("avatar-upload", userId, RATE_LIMIT_HEAVY);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const playerId = formData.get("playerId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP.` },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 3MB.` },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${playerId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("player-avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return apiError("Failed to upload avatar", "AVATAR_UPLOAD_STORAGE_FAILED", 500, uploadError);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("player-avatars")
      .getPublicUrl(filePath);

    // Append cache-bust param so browsers/CDN always fetch the fresh image
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    // Update player record
    const { error: updateError } = await supabase
      .from("players")
      .update({ avatar_url: avatarUrl })
      .eq("id", playerId);

    if (updateError) {
      return apiError("Failed to update player avatar URL", "AVATAR_UPDATE_FAILED", 500, updateError);
    }

    return NextResponse.json({ avatarUrl });
  } catch (e: unknown) {
    return apiError("Failed to upload avatar", "AVATAR_UPLOAD_FAILED", 500, e);
  }
}
