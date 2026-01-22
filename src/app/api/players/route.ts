// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseOrError() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      supabase: null as any,
      error: "Invalid NEXT_PUBLIC_SUPABASE_URL. It must start with http:// or https://",
    };
  }
  if (!key) {
    return {
      supabase: null as any,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.",
    };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  return { supabase, error: null as string | null };
}

/**
 * GET /api/players
 * Optional query params:
 *   - team_id=TEAM_CODE   (e.g. AUS, BAR, etc.)
 *   - limit=50
 */
export async function GET(req: Request) {
  const { supabase, error: envError } = getSupabaseOrError();
  if (envError) {
    return NextResponse.json({ error: envError }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const teamId = (searchParams.get("team_id") || "").trim(); // this is your team_code
  const limit = Number(searchParams.get("limit") || "200");

  let query = supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
