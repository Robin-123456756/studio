import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { BUDGET_TOTAL } from "@/lib/constants";
import { validateSquadComposition } from "@/lib/roster-validation";

export const dynamic = "force-dynamic";

type Body = {
  gameweekId: number;
  squadIds: string[];      // 17
  startingIds: string[];   // 10
  captainId: string | null;
  viceId: string | null;
  chip?: string | null;    // bench_boost | triple_captain | wildcard | free_hit
  teamName?: string | null;
};

const VALID_CHIPS = ["bench_boost", "triple_captain", "wildcard", "free_hit"];

export async function POST(req: Request) {
  // ── Fix 1: Auth — derive userId from session cookie ──
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = auth.user.id;

  // Use admin client for writes (RLS may restrict user_rosters inserts)
  const admin = getSupabaseServerOrThrow();

  const body = (await req.json()) as Body;
  const { gameweekId, squadIds, startingIds, captainId, viceId, chip, teamName } = body;

  // Upsert team name if provided
  if (teamName && typeof teamName === "string") {
    const name = teamName.trim().slice(0, 30) || "My Team";
    await admin
      .from("fantasy_teams")
      .upsert({ user_id: userId, name }, { onConflict: "user_id" });
  }

  if (!gameweekId) return NextResponse.json({ error: "Missing gameweekId" }, { status: 400 });
  if (!Array.isArray(squadIds) || squadIds.length < 1)
    return NextResponse.json({ error: "Squad cannot be empty" }, { status: 400 });

  // ── Fix 2: Deadline enforcement ──
  const { data: gw, error: gwErr } = await admin
    .from("gameweeks")
    .select("*")
    .eq("id", Number(gameweekId))
    .single();

  if (gwErr || !gw) {
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  }
  const gwFinished = Boolean(
    (gw as any).finalized ?? (gw as any).is_finished ?? (gw as any).is_final ?? false
  );
  if (gwFinished) {
    return NextResponse.json({ error: "Gameweek is finished" }, { status: 403 });
  }
  if (gw.deadline_time) {
    const deadline = new Date(gw.deadline_time);
    if (Date.now() > deadline.getTime()) {
      return NextResponse.json({ error: "Deadline has passed" }, { status: 403 });
    }
  }

  // ── Fix 3: Budget validation ──
  const uniqueSquadIds = [...new Set(squadIds.map(String))];

  const { data: players, error: playersErr } = await admin
    .from("players")
    .select("id, now_cost, position, is_lady, team_id")
    .in("id", uniqueSquadIds);

  if (playersErr) {
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
  if (!players || players.length !== uniqueSquadIds.length) {
    const found = new Set((players ?? []).map((p) => p.id));
    const missing = uniqueSquadIds.filter((id) => !found.has(id));
    return NextResponse.json(
      { error: `Invalid player IDs: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const totalCost = players.reduce((sum, p) => sum + (p.now_cost ?? 0), 0);
  if (totalCost > BUDGET_TOTAL) {
    return NextResponse.json(
      { error: `Squad cost ${totalCost.toFixed(1)}m exceeds budget of ${BUDGET_TOTAL}m` },
      { status: 400 },
    );
  }

  // ── Fix 4: Squad composition validation ──
  const startingStrIds = (startingIds ?? []).map(String);
  const capStr = captainId ? String(captainId) : null;
  const viceStr = viceId ? String(viceId) : null;

  const compositionError = validateSquadComposition(players, startingStrIds, capStr, viceStr);
  if (compositionError) {
    return NextResponse.json({ error: compositionError }, { status: 400 });
  }

  // ── Fix 5: Chip validation & recording ──
  let activeChip: string | null = null;
  if (chip && typeof chip === "string") {
    if (!VALID_CHIPS.includes(chip)) {
      return NextResponse.json({ error: `Invalid chip: ${chip}` }, { status: 400 });
    }

    // Check if already used this season
    const { data: usedChip } = await admin
      .from("user_chips")
      .select("id")
      .eq("user_id", userId)
      .eq("chip", chip)
      .maybeSingle();

    if (usedChip) {
      return NextResponse.json(
        { error: `${chip.replace("_", " ")} has already been used this season` },
        { status: 400 },
      );
    }

    activeChip = chip;

    // Record chip usage
    const { error: chipErr } = await admin
      .from("user_chips")
      .insert({ user_id: userId, gameweek_id: Number(gameweekId), chip });

    if (chipErr) {
      console.error("CHIP INSERT ERROR", chipErr);
      return NextResponse.json({ error: "Failed to record chip usage" }, { status: 500 });
    }
  }

  // ── Build roster rows ──
  const startingSet = new Set(startingStrIds);
  const captainMultiplier = activeChip === "triple_captain" ? 3 : 2;

  const rows = uniqueSquadIds.map((pid) => ({
    user_id: userId,
    player_id: pid,
    gameweek_id: Number(gameweekId),
    is_starting_9: startingSet.has(pid),
    is_captain: capStr === pid,
    is_vice_captain: viceStr === pid,
    multiplier: capStr === pid ? captainMultiplier : 1,
    active_chip: activeChip,
  }));

  // ── Delete + Insert roster ──
  const { error: delErr } = await admin
    .from("user_rosters")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", Number(gameweekId));

  if (delErr) {
    console.error("CLEANUP ERROR /api/rosters/save", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const { error: insertErr } = await admin
    .from("user_rosters")
    .upsert(rows, { onConflict: "user_id,player_id,gameweek_id" });

  if (insertErr) {
    console.error("INSERT ERROR /api/rosters/save", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
