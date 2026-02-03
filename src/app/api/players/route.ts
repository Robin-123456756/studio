import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  // ✅ Use the URL env you already use across the app
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin(); // ✅ created at request-time

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    const idsParam = url.searchParams.get("ids");

    let query = supabase
      .from("players")
      .select(
        `
        id,
        name,
        web_name,
        position,
        now_cost,
        total_points,
        avatar_url,
        is_lady,
        team_id,
        teams:teams!players_team_id_fkey (
          name,
          short_name,
          team_uuid
        )
      `
      )
      .order("name", { ascending: true });

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) query = query.in("id", ids);
    }

    if (teamId) query = query.eq("team_id", teamId);

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
      name: p.name ?? p.web_name ?? "—", // ✅ full name first
      webName: p.web_name ?? null,
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
