import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

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
    const limit = parseInt(searchParams.get("limit") || "50");
    const gw = searchParams.get("gw");

    let query = supabase
      .from("activity_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (gw) {
      query = query.eq("gameweek_id", parseInt(gw));
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ feed: data || [] });
  } catch {
    return NextResponse.json({ feed: [] });
  }
}
