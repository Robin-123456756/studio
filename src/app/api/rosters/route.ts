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
    .select("player_id, is_starting_9, is_captain, is_vice_captain")
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
        .select("player_id, is_starting_9, is_captain, is_vice_captain")
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

  return NextResponse.json({ gwId, squadIds, startingIds, captainId, viceId, rolledOverFromGw });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const gwId = Number(body?.gwId ?? "");
  const squadIds: string[] = Array.isArray(body?.squadIds) ? body.squadIds : [];
  const startingIds: string[] = Array.isArray(body?.startingIds) ? body.startingIds : [];

  if (!Number.isFinite(gwId)) {
    return NextResponse.json({ error: "gwId is required" }, { status: 400 });
  }
  if (squadIds.length === 0) {
    return NextResponse.json({ error: "squadIds is required" }, { status: 400 });
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

  // Replace roster for this gw
  const userId = auth.user.id;

  const { error: delErr } = await supabase
    .from("user_rosters")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", gwId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const startingSet = new Set(startingIds);

  const cap = body?.captainId ?? null;
  const vice = body?.viceId ?? null;

  // Captain gets 2x multiplier
  // (lady 2x is already applied at the base scoring level, not here)
  const rows = squadIds.map((playerId) => ({
    user_id: userId,
    player_id: playerId,
    gameweek_id: gwId,
    is_starting_9: startingSet.has(playerId),
    is_captain: cap === playerId,
    is_vice_captain: vice === playerId,
    multiplier: cap === playerId ? 2 : 1,
  }));

  const { error: insErr } = await supabase.from("user_rosters").insert(rows);

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
