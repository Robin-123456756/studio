import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { BUDGET_TOTAL } from "@/lib/constants";
import { validateSquadComposition } from "@/lib/roster-validation";
import { parseBody } from "@/lib/validate";
import { rateLimitResponse } from "@/lib/rate-limit";

const RATE_LIMIT_10 = { maxRequests: 10, windowMs: 60 * 1000 };

const SaveRosterSchema = z.object({
  gameweekId: z.number().int().positive(),
  squadIds: z.array(z.string().min(1)).min(1).max(17),
  startingIds: z.array(z.string()).optional(),
  captainId: z.string().nullable().optional(),
  viceId: z.string().nullable().optional(),
  chip: z.enum(["bench_boost", "triple_captain", "wildcard", "free_hit"]).nullable().optional(),
  teamName: z.string().max(30).nullable().optional(),
  benchOrder: z.array(z.string()).nullable().optional(),
  squadOnly: z.boolean().optional(),
  transfers: z.array(z.object({ outId: z.string(), inId: z.string() })).optional(),
});

export const dynamic = "force-dynamic";

type Body = {
  gameweekId: number;
  squadIds: string[];      // 17
  startingIds?: string[];  // 10 (optional for squad-only saves)
  captainId?: string | null;
  viceId?: string | null;
  chip?: string | null;    // bench_boost | triple_captain | wildcard | free_hit
  teamName?: string | null;
  benchOrder?: string[] | null;  // ordered bench player IDs (1st sub first)
  squadOnly?: boolean;     // true = save squad IDs only, skip starting/captain validation
  transfers?: { outId: string; inId: string }[];  // FPL-style slot inheritance mapping
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

  // Rate limit: 10 saves per minute
  const rl = rateLimitResponse("roster-save", userId, RATE_LIMIT_10);
  if (rl) return rl;

  // Use admin client for writes (RLS may restrict user_rosters inserts)
  const admin = getSupabaseServerOrThrow();

  const rawBody = await req.json();
  const validated = parseBody(SaveRosterSchema, rawBody);
  if (!validated.success) return validated.error;
  const body = validated.data as Body;
  const { gameweekId, squadIds, startingIds, captainId, viceId, chip, teamName, benchOrder, squadOnly, transfers } = body;

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
    .select("id, now_cost, position, is_lady, team_id, teams:teams!players_team_id_fkey(name, short_name)")
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
  let startingStrIds = (startingIds ?? []).map(String);
  let capStr = captainId ? String(captainId) : null;
  let viceStr = viceId ? String(viceId) : null;

  // Squad-only saves (from transfers page): preserve existing lineup data from DB.
  // FPL-style slot inheritance: transferred-in player inherits the outgoing player's
  // starting/captain/vice/bench_order slot instead of defaulting to bench.
  const inheritedBenchOrder = new Map<string, number>();

  if (squadOnly) {
    // Try current GW roster first, then fall back to current_squads (FPL pattern:
    // your current team is always available regardless of gameweek state)
    let existingRoster: { player_id: string; is_starting_9?: boolean; is_starting?: boolean; is_captain: boolean; is_vice_captain: boolean; bench_order: number | null }[] = [];

    const { data: gwRoster } = await admin
      .from("user_rosters")
      .select("player_id, is_starting_9, is_captain, is_vice_captain, bench_order")
      .eq("user_id", userId)
      .eq("gameweek_id", Number(gameweekId));

    if (gwRoster && gwRoster.length > 0) {
      existingRoster = gwRoster;
    } else {
      // No roster for this GW yet (first save of new GW) — use current_squads
      const { data: currentSquad } = await admin
        .from("current_squads")
        .select("player_id, is_starting, is_captain, is_vice_captain, bench_order")
        .eq("user_id", userId);

      if (currentSquad && currentSquad.length > 0) {
        existingRoster = currentSquad.map((r) => ({
          player_id: r.player_id,
          is_starting_9: r.is_starting,
          is_captain: r.is_captain,
          is_vice_captain: r.is_vice_captain,
          bench_order: r.bench_order,
        }));
      }
    }

    if (existingRoster.length > 0) {
      // Build lookup: playerId → existing roster row
      const oldRowByPid = new Map<string, typeof existingRoster[0]>();
      for (const r of existingRoster) {
        oldRowByPid.set(String(r.player_id), r);
      }

      // Build transfer mapping: inId → outId (so we know which slot to inherit)
      const transferMap = new Map<string, string>();
      if (Array.isArray(transfers)) {
        for (const t of transfers) {
          transferMap.set(String(t.inId), String(t.outId));
        }
      }

      // For each player in the new squad, determine their lineup status:
      // - Kept player → preserve their existing slot
      // - Transferred-in player → inherit outgoing player's slot
      // - No mapping / no old roster → default to bench
      const resolvedStarting: string[] = [];
      let resolvedCap: string | null = null;
      let resolvedVice: string | null = null;

      for (const pid of uniqueSquadIds) {
        // Check if this player was in the old roster (kept player)
        let sourceRow = oldRowByPid.get(pid);

        // If not, check if they're a transfer-in and inherit the out player's slot
        if (!sourceRow) {
          const outId = transferMap.get(pid);
          if (outId) sourceRow = oldRowByPid.get(outId);
        }

        if (sourceRow) {
          if (sourceRow.is_starting_9) resolvedStarting.push(pid);
          if (sourceRow.is_captain) resolvedCap = pid;
          if (sourceRow.is_vice_captain) resolvedVice = pid;
          if (!sourceRow.is_starting_9 && sourceRow.bench_order != null) {
            inheritedBenchOrder.set(pid, sourceRow.bench_order);
          }
        }
      }

      startingStrIds = resolvedStarting;
      capStr = resolvedCap;
      viceStr = resolvedVice;
    }
  } else {
    const compositionError = validateSquadComposition(players, startingStrIds, capStr, viceStr);
    if (compositionError) {
      return NextResponse.json({ error: compositionError }, { status: 400 });
    }
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

  // Build bench_order lookup: benchOrder = ["id_a","id_b",...] → id_a=1, id_b=2, ...
  const benchOrderArr = Array.isArray(benchOrder) ? benchOrder.map(String) : [];

  const rows = uniqueSquadIds.map((pid) => {
    const isStarter = startingSet.has(pid);
    let bench_order: number | null = null;
    if (!isStarter) {
      if (benchOrderArr.length > 0) {
        // Explicit bench order provided (from pick-team page)
        const idx = benchOrderArr.indexOf(pid);
        bench_order = idx >= 0 ? idx + 1 : null;
      } else {
        // Inherited bench order from slot inheritance (squad-only saves)
        bench_order = inheritedBenchOrder.get(pid) ?? null;
      }
    }
    return {
      user_id: userId,
      player_id: pid,
      gameweek_id: Number(gameweekId),
      is_starting_9: isStarter,
      is_captain: capStr === pid,
      is_vice_captain: viceStr === pid,
      multiplier: capStr === pid ? captainMultiplier : 1,
      active_chip: activeChip,
      bench_order,
    };
  });

  // ── Atomic roster save via Postgres function ──
  // Wraps flag-clear + upsert + stale-row-delete in a single transaction so
  // a failed upsert can't leave the roster with cleared captain/vice flags.
  const { error: rpcErr } = await admin.rpc("save_user_roster", {
    p_user_id: userId,
    p_gameweek_id: Number(gameweekId),
    p_rows: rows,
  });

  if (rpcErr) {
    console.error("RPC ERROR /api/rosters/save", rpcErr);
    return NextResponse.json({ error: "Failed to save roster" }, { status: 500 });
  }

  // ── Sync current_squads (persistent ownership table) ──
  const currentSquadRows = uniqueSquadIds.map((pid) => {
    const isStarter = startingSet.has(pid);
    let bench_order: number | null = null;
    if (!isStarter && benchOrderArr.length > 0) {
      const idx = benchOrderArr.indexOf(pid);
      bench_order = idx >= 0 ? idx + 1 : null;
    }
    return {
      user_id: userId,
      player_id: pid,
      is_starting: isStarter,
      is_captain: capStr === pid,
      is_vice_captain: viceStr === pid,
      bench_order,
    };
  });

  // Upsert new squad rows, then remove stale players
  await admin
    .from("current_squads")
    .upsert(currentSquadRows, { onConflict: "user_id,player_id" })
    .then(({ error }) => {
      if (error) console.error("CURRENT_SQUADS UPSERT WARNING", error);
    });

  await admin
    .from("current_squads")
    .delete()
    .eq("user_id", userId)
    .not("player_id", "in", `(${uniqueSquadIds.join(",")})`)
    .then(({ error }) => {
      if (error) console.error("CURRENT_SQUADS CLEANUP WARNING", error);
    });

  return NextResponse.json({ ok: true, inserted: rows.length });
}
