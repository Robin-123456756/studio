import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,                 // server-only env var
  process.env.SUPABASE_SERVICE_ROLE_KEY!     // server secret
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("team_id"); // UUID string

  let query = supabase
    .from("players")
    .select(`
      id,
      name,
      web_name,
      position,
      now_cost,
      total_points,
      avatar_url,
      is_lady,
      team_id,
      teams:team_id (
        name,
        short_name
      )
    `)
    .order("name", { ascending: true });

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.web_name ?? p.name,
    position: p.position,
    price: p.now_cost,
    points: p.total_points,
    avatarUrl: p.avatar_url,
    isLady: p.is_lady,
    teamId: p.team_id,
    teamShort: p.teams?.short_name ?? "—",
    teamName: p.teams?.name ?? "—",
  }));

  return NextResponse.json({ players });
}
