import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const players = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.web_name ?? p.name,
    position: p.position,
    price: p.now_cost,
    points: p.total_points,
    avatarUrl: p.avatar_url,
    isLady: p.is_lady,

    // ✅ both versions
    teamShort: p.teams?.short_name ?? "—",
    teamName: p.teams?.name ?? "—",
  }));

  return NextResponse.json({ players });
}
