import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET — fetch activity feed
export async function GET(req: Request) {
  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const supabase = getSupabaseServerOrThrow();
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;
    const gw = searchParams.get("gw");

    let query = supabase
      .from("activity_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (gw) {
      const gwNum = Number(gw);
      if (!Number.isFinite(gwNum)) {
        return NextResponse.json({ error: "Invalid gameweek" }, { status: 400 });
      }
      query = query.eq("gameweek_id", gwNum);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ feed: data || [] });
  } catch (e: unknown) {
    return apiError("Failed to load activity feed", "ACTIVITY_FEED_FAILED", 500, e);
  }
}
