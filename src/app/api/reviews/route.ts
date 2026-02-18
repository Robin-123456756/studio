import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reviews: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
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
      user_id: body?.userId ?? null,   // optional
      name: body?.name ?? null,        // optional
      email: body?.email ?? null,      // optional
      rating: ratingNum,
      message,
      page: body?.page ?? "Reviews",
      device: body?.device ?? null,
    };

    const { error } = await supabase.from("reviews").insert(payload);

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
