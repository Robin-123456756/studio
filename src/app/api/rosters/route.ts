import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  // IMPORTANT in Next 15: cookies() can be async in your setup, so we await where used.
  // Here we return a function that builds client inside each handler.
}

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

  const squadIds = (data ?? []).map((r) => String(r.player_id));
  const startingIds = (data ?? [])
    .filter((r) => r.is_starting_9)
    .map((r) => String(r.player_id));

  const captainId =
    (data ?? []).find((r) => r.is_captain)?.player_id !== undefined
      ? String((data ?? []).find((r) => r.is_captain)?.player_id)
      : null;
  const viceId =
    (data ?? []).find((r) => r.is_vice_captain)?.player_id !== undefined
      ? String((data ?? []).find((r) => r.is_vice_captain)?.player_id)
      : null;

  return NextResponse.json({ gwId, squadIds, startingIds, captainId, viceId });
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

const rows = squadIds.map((playerId) => ({
  user_id: userId,
  player_id: playerId,
  gameweek_id: gwId,
  is_starting_9: startingSet.has(playerId),
  is_captain: cap === playerId,
  is_vice_captain: vice === playerId,
  multiplier: cap === playerId ? 2 : 1, // optional
}));

  const { error: insErr } = await supabase.from("user_rosters").insert(rows);

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
