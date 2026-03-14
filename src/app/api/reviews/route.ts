import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";
import { rateLimitResponse, RATE_LIMIT_STANDARD } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseServerOrThrow();

    const { data, error } = await supabase
      .from("reviews")
      .select("id, name, rating, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return apiError("Failed to fetch reviews", "REVIEWS_FETCH_FAILED", 500, error);
    }

    return NextResponse.json({ reviews: data ?? [] });
  } catch (e: unknown) {
    return apiError("Failed to fetch reviews", "REVIEWS_FETCH_ERROR", 500, e);
  }
}

const REVIEW_RATE_LIMIT = { maxRequests: 3, windowMs: 60 * 1000 }; // 3 per min per IP

export async function POST(req: Request) {
  try {
    // Phase 1.3: Use auth to get real user_id instead of trusting body.userId
    const supabase = await supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null; // anonymous reviews allowed

    // Phase 3: Rate limit by user or IP
    const rateLimitKey = userId ?? req.headers.get("x-forwarded-for") ?? "anon";
    const blocked = rateLimitResponse("reviews", rateLimitKey, REVIEW_RATE_LIMIT);
    if (blocked) return blocked;

    const admin = getSupabaseServerOrThrow();
    const body = await req.json();

    const message = String(body?.message ?? "").trim();
    const rating = body?.rating ?? null;

    if (!message || message.length < 5) {
      return NextResponse.json({ error: "Message is too short." }, { status: 400 });
    }

    // rating optional, but if present validate
    const ratingNum =
      rating === null || rating === undefined || rating === ""
        ? null
        : Number(rating);

    if (ratingNum !== null && !(ratingNum >= 1 && ratingNum <= 5)) {
      return NextResponse.json({ error: "Rating must be 1 to 5." }, { status: 400 });
    }

    const payload = {
      user_id: userId,              // from auth token, not body
      name: body?.name ?? null,
      email: body?.email ?? null,
      rating: ratingNum,
      message,
      page: body?.page ?? "Reviews",
      device: body?.device ?? null,
    };

    const { error } = await admin.from("reviews").insert(payload);

    if (error) {
      return apiError("Failed to submit review", "REVIEW_INSERT_FAILED", 500, error);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return apiError("Failed to submit review", "REVIEW_POST_ERROR", 500, e);
  }
}
