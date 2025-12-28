// src/app/api/admin/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // important for API routes using env at runtime
export const revalidate = 0;

function requireAdmin(req: Request) {
  const token = req.headers.get("x-admin-password") || "";
  const expected = process.env.ADMIN_PASSWORD || "";
  return expected.length > 0 && token === expected;
}

function getSupabaseOrError() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Validate env safely (prevents build from crashing with a thrown error)
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
 * GET /api/admin/players
 * Optional query params:
 *  - team_id=...
 *  - limit=50
 */
export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, error: envError } = getSupabaseOrError();
  if (envError) {
    return NextResponse.json({ error: envError }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const teamId = (searchParams.get("team_id") || "").trim();
  const limit = Number(searchParams.get("limit") || "200");

  let query = supabase.from("players").select("*").order("created_at", { ascending: false }).limit(limit);

  if (teamId) query = query.eq("team_id", teamId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}

/**
 * POST /api/admin/players
 * body: { name, position, team_id|teamId, avatar_url?, price?, points? }
 */
export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, error: envError } = getSupabaseOrError();
  if (envError) {
    return NextResponse.json({ error: envError }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const position = String(body.position ?? "").trim();

  // Accept both team_id and teamId from your frontend
  const team_id = String(body.team_id ?? body.teamId ?? "").trim();

  const avatar_url = body.avatar_url ? String(body.avatar_url).trim() : null;
  const price = Number(body.price ?? 0);
  const points = Number(body.points ?? 0);

  if (!name || !position || !team_id) {
    return NextResponse.json(
      { error: "name, position, team_id required" },
      { status: 400 }
    );
  }

  if (Number.isNaN(price) || Number.isNaN(points)) {
    return NextResponse.json(
      { error: "price and points must be numbers" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("players")
    .insert([{ name, position, team_id, avatar_url, price, points }])
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ player: data }, { status: 201 });
}
