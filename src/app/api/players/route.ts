import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id"); // team_uuid
    const idsParam = url.searchParams.get("ids");   // NEW

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
        team_id,
        teams:teams!players_team_id_fkey (
          name,
          short_name,
          team_uuid
        )
      `)
      .order("name", { ascending: true });

      if (idsParam) {
    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) query = query.in("id", ids);
  }


    if (teamId) query = query.eq("team_id", teamId);
    query = query.order("name", { ascending: true });
    const { data, error } = await query;

    if (error) {
      console.log("❌ SUPABASE ERROR", error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    const players = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name ?? p.web_name ?? "—", // full name first
      webName: p.web_name ?? null, // optional: keep we name if you ever want it
      position: p.position,
      price: p.now_cost ?? null,
      points: p.total_points ?? null,
      avatarUrl: p.avatar_url ?? null,
      isLady: p.is_lady ?? null,
      teamId: p.team_id,
      teamName: p.teams?.name ?? "—",
      teamShort: p.teams?.short_name ?? "—",
    }));

    return NextResponse.json({ players });
  } catch (e: any) {
    console.log("❌ ROUTE CRASH", e);
    return NextResponse.json(
      { error: String(e?.message ?? e), stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
