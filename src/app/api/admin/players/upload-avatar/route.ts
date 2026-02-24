import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

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
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 2MB.` },
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
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("player-avatars")
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Update player record
    const { error: updateError } = await supabase
      .from("players")
      .update({ avatar_url: avatarUrl })
      .eq("id", playerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ avatarUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
  }
}
