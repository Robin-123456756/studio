import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gwId = Number(url.searchParams.get("gw_id") ?? "");
  if (!Number.isFinite(gwId)) {
    return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Return roster player ids for this GW
  const { data, error } = await supabase
    .from("user_rosters")
    .select("player_id, is_starting_9, is_captain, is_vice_captain, bench_order")
    .eq("user_id", auth.user.id)
    .eq("gameweek_id", gwId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If no roster for this GW, try rolling over from the most recent previous GW
  let rows = data ?? [];
  let rolledOverFromGw: number | null = null;

  if (rows.length === 0) {
    const { data: prev, error: prevErr } = await supabase
      .from("user_rosters")
      .select("gameweek_id")
      .eq("user_id", auth.user.id)
      .lt("gameweek_id", gwId)
      .order("gameweek_id", { ascending: false })
      .limit(1);

    if (!prevErr && prev && prev.length > 0) {
      const prevGwId = prev[0].gameweek_id;
      const { data: prevRows, error: prevRowsErr } = await supabase
        .from("user_rosters")
        .select("player_id, is_starting_9, is_captain, is_vice_captain, bench_order")
        .eq("user_id", auth.user.id)
        .eq("gameweek_id", prevGwId);

      if (!prevRowsErr && prevRows && prevRows.length > 0) {
        rows = prevRows;
        rolledOverFromGw = prevGwId;
      }
    }
  }

  const squadIds = rows.map((r) => String(r.player_id));
  const startingIds = rows
    .filter((r) => r.is_starting_9)
    .map((r) => String(r.player_id));

  const captainId =
    rows.find((r) => r.is_captain)?.player_id !== undefined
      ? String(rows.find((r) => r.is_captain)?.player_id)
      : null;
  const viceId =
    rows.find((r) => r.is_vice_captain)?.player_id !== undefined
      ? String(rows.find((r) => r.is_vice_captain)?.player_id)
      : null;

  // Build bench order: sort bench rows by bench_order ASC, return ordered IDs
  const benchOrder = rows
    .filter((r: any) => !r.is_starting_9 && r.bench_order != null)
    .sort((a: any, b: any) => (a.bench_order ?? 99) - (b.bench_order ?? 99))
    .map((r: any) => String(r.player_id));

  // Fetch team name from fantasy_teams
  let teamName: string | null = null;
  try {
    const { data: ftRow } = await supabase
      .from("fantasy_teams")
      .select("name")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (ftRow?.name) teamName = ftRow.name;
  } catch { /* ignore */ }

  return NextResponse.json({ gwId, squadIds, startingIds, captainId, viceId, rolledOverFromGw, benchOrder, teamName });
}
