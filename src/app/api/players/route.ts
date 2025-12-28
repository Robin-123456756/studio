import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");

  let query = supabaseServer
    .from("players")
    .select("id,name,position,team_id,avatar_url,price,points,created_at")
    .order("created_at", { ascending: false });

  if (teamId) query = query.eq("team_id", teamId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
