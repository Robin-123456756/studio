import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// GET /api/rosters?user_id=...&gameweek_id=...
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const url = new URL(req.url);

  const userId = url.searchParams.get("user_id");
  const gameweekId = url.searchParams.get("gameweek_id");

  if (!userId || !gameweekId) {
    return NextResponse.json({ error: "Missing user_id or gameweek_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_rosters")
    .select("*")
    .eq("user_id", userId)
    .eq("gameweek_id", Number(gameweekId))
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ roster: data ?? null });
}

// POST /api/rosters
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const body = await req.json();

  const { user_id, gameweek_id, squad_ids, starting_ids, captain_id, vice_id } = body;

  if (!user_id || !gameweek_id) {
    return NextResponse.json({ error: "Missing user_id or gameweek_id" }, { status: 400 });
  }

  const payload = {
    user_id,
    gameweek_id: Number(gameweek_id),
    squad_ids: squad_ids ?? [],
    starting_ids: starting_ids ?? [],
    captain_id: captain_id ?? null,
    vice_id: vice_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_rosters")
    .upsert(payload, { onConflict: "user_id,gameweek_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, roster: data });
}
