// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = getSupabaseServerOrThrow();

  const { searchParams } = new URL(req.url);
  const teamIdRaw = (searchParams.get("team_id") || "").trim();

  const teamId = teamIdRaw ? Number(teamIdRaw) : null;
  if (teamIdRaw && Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team_id" }, { status: 400 });
  }

  let query = supabase
    .from("players")
    .select(
      `
      id,
      name,
      web_name,
      position,
      team_id,
      now_cost,
      total_points,
      avatar_url,
      is_lady,
      teams:team_id (
        id,
        name,
        short_name
      )
    `
    )
    .order("web_name", { ascending: true });

  if (teamId !== null) query = query.eq("team_id", teamId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ✅ map into the UI shape your Fantasy/Pick pages expect
  const players = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.web_name ?? p.name,          // card name (use web_name)
    fullName: p.name ?? p.web_name,      // optional if you want both
    position: p.position,
    price: Number(p.now_cost ?? 0),
    points: Number(p.total_points ?? 0),
    avatarUrl: p.avatar_url,
    isLady: !!p.is_lady,
    teamId: p.team_id,
    teamName: p.teams?.name ?? null,       // ✅ full team name for list view
    teamShort: p.teams?.short_name ?? null // ✅ short code for pitch view
  }));

  return NextResponse.json({ players });
}
