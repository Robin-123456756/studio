// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function positionFull(pos?: string | null) {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "defender" || p === "df") return "Defender";
  if (p === "mid" || p === "midfielder" || p === "mf") return "Midfielder";
  if (p === "fwd" || p === "forward" || p === "fw" || p === "striker") return "Forward";
  return pos ?? "—";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // team_id is UUID now
  const teamUuid = (searchParams.get("team_id") || "").trim() || null;

  let query = supabase
  .from("players")
  .select(`
  id,
  name,
  web_name,
  position,
  team_id,
  now_cost,
  total_points,
  avatar_url,
  is_lady,
  teams:teams!players_team_id_fkey (
    team_uuid,
    name,
    short_name
  )
`)


  if (teamUuid) query = query.eq("team_id", teamUuid);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const players = (data ?? []).map((p: any) => ({
    id: String(p.id),
    name: p.name ?? p.web_name ?? "—",
    webName: p.web_name ?? null,
    position: positionFull(p.position),
    price: Number(p.now_cost ?? 0),
    points: Number(p.total_points ?? 0),
    avatarUrl: p.avatar_url ?? null,
    isLady: !!p.is_lady,

    teamId: p.team_id,
    teamName: p.teams?.name ?? "—",        // ✅ FIXED
    teamShort: p.teams?.short_name ?? "—", // ✅ FIXED
  }));

  return NextResponse.json({ players });
}
