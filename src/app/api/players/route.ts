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
    const dynamicPoints = url.searchParams.get("dynamic_points") === "1";

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

    // Optionally compute dynamic total_points from player_stats
    let totalsMap = new Map<string, { points: number; goals: number; assists: number; appearances: number }>();
    if (dynamicPoints) {
      const playerIds = (data ?? []).map((p: any) => p.id);
      if (playerIds.length > 0) {
        const { data: statsData } = await supabase
          .from("player_stats")
          .select("player_id, points, goals, assists")
          .in("player_id", playerIds);

        for (const s of statsData ?? []) {
          const pid = s.player_id;
          const existing = totalsMap.get(pid) ?? { points: 0, goals: 0, assists: 0, appearances: 0 };
          existing.points += s.points ?? 0;
          existing.goals += s.goals ?? 0;
          existing.assists += s.assists ?? 0;
          existing.appearances += 1;
          totalsMap.set(pid, existing);
        }
      }
    }

    const players = (data ?? []).map((p: any) => {
      const totals = dynamicPoints ? totalsMap.get(p.id) : null;
      return {
        id: p.id,
        name: p.name ?? p.web_name ?? "—",
        webName: p.web_name ?? null,
        position: p.position,
        price: p.now_cost ?? null,
        points: totals ? totals.points : (p.total_points ?? null),
        avatarUrl: p.avatar_url ?? null,
        isLady: p.is_lady ?? null,
        teamId: p.team_id,
        teamName: p.teams?.name ?? "—",
        teamShort: p.teams?.short_name ?? "—",
        teamUuid: p.teams?.team_uuid ?? null,
        ...(totals ? {
          totalGoals: totals.goals,
          totalAssists: totals.assists,
          appearances: totals.appearances,
        } : {}),
      };
    });

    return NextResponse.json({ players });
  } catch (e: any) {
    console.log("❌ ROUTE CRASH", e);
    return NextResponse.json(
      { error: String(e?.message ?? e), stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const { name, web_name, position, now_cost, team_id, is_lady } = body;

    if (!name || !position || !team_id) {
      return NextResponse.json(
        { error: "name, position, and team_id are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        name,
        web_name: web_name || name.split(" ").pop(),
        position,
        now_cost: now_cost || 5.0,
        team_id: parseInt(team_id),
        is_lady: is_lady || false,
        total_points: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to add player" },
      { status: 500 }
    );
  }
}
