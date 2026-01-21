// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = getSupabaseServerOrThrow();

  const { searchParams } = new URL(req.url);
  const teamId = (searchParams.get("team_id") || "").trim();

  let q = supabase.from("players").select("*").order("created_at", { ascending: false });

  if (teamId) q = q.eq("team_id", teamId);

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ players: data ?? [] });
}
