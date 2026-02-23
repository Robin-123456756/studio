import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — fetch activity feed
export async function GET(req: Request) {
  try {
    const supabase = getSupabase();
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
