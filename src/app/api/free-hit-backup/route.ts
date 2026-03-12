import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/free-hit-backup?gw_id=N
 * Returns the Free Hit backup for the authenticated user and gameweek.
 */
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(req.url);
  const gwId = Number(url.searchParams.get("gw_id") ?? "");
  if (!Number.isFinite(gwId) || gwId < 1) {
    return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
  }

  const admin = getSupabaseServerOrThrow();
  const { data, error } = await admin
    .from("free_hit_backups")
    .select("squad_ids, starting_ids, captain_id, vice_captain_id, bench_order")
    .eq("user_id", auth.user.id)
    .eq("gameweek_id", gwId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ backup: null });
  }

  return NextResponse.json({
    backup: {
      squadIds: data.squad_ids ?? [],
      startingIds: data.starting_ids ?? [],
      captainId: data.captain_id ?? null,
      viceId: data.vice_captain_id ?? null,
      benchOrder: data.bench_order ?? [],
    },
  });
}

/**
 * POST /api/free-hit-backup
 * Body: { gameweekId }
 * Snapshots the user's CURRENT roster for the given GW into free_hit_backups.
 * Called when Free Hit is activated (before the user starts making changes).
 */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = auth.user.id;
  const admin = getSupabaseServerOrThrow();

  const body = await req.json().catch(() => null);
  const gameweekId = Number(body?.gameweekId ?? "");
  if (!Number.isFinite(gameweekId) || gameweekId < 1) {
    return NextResponse.json({ error: "gameweekId is required" }, { status: 400 });
  }

  // Fetch current roster for this GW (or rolled-over from previous)
  const { data: roster } = await admin
    .from("user_rosters")
    .select("player_id, is_starting_9, is_captain, is_vice_captain, bench_order")
    .eq("user_id", userId)
    .eq("gameweek_id", gameweekId);

  let rows = roster ?? [];

  // If no roster for this GW, try previous GW (rollover)
  if (rows.length === 0) {
    const { data: prev } = await admin
      .from("user_rosters")
      .select("gameweek_id")
      .eq("user_id", userId)
      .lt("gameweek_id", gameweekId)
      .order("gameweek_id", { ascending: false })
      .limit(1);

    if (prev && prev.length > 0) {
      const { data: prevRows } = await admin
        .from("user_rosters")
        .select("player_id, is_starting_9, is_captain, is_vice_captain, bench_order")
        .eq("user_id", userId)
        .eq("gameweek_id", prev[0].gameweek_id);

      rows = prevRows ?? [];
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No roster to backup" }, { status: 400 });
  }

  const squadIds = rows.map((r) => String(r.player_id));
  const startingIds = rows.filter((r) => r.is_starting_9).map((r) => String(r.player_id));
  const captainId = rows.find((r) => r.is_captain)?.player_id ?? null;
  const viceId = rows.find((r) => r.is_vice_captain)?.player_id ?? null;
  const benchOrder = rows
    .filter((r: any) => !r.is_starting_9 && r.bench_order != null)
    .sort((a: any, b: any) => (a.bench_order ?? 99) - (b.bench_order ?? 99))
    .map((r: any) => String(r.player_id));

  // Upsert backup (one per user per GW)
  const { error: upsertErr } = await admin
    .from("free_hit_backups")
    .upsert(
      {
        user_id: userId,
        gameweek_id: gameweekId,
        squad_ids: squadIds,
        starting_ids: startingIds,
        captain_id: captainId ? String(captainId) : null,
        vice_captain_id: viceId ? String(viceId) : null,
        bench_order: benchOrder,
      },
      { onConflict: "user_id,gameweek_id" }
    );

  if (upsertErr) {
    console.error("FREE HIT BACKUP UPSERT ERROR", upsertErr);
    return NextResponse.json({ error: "Failed to save backup" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, squadIds });
}

/**
 * DELETE /api/free-hit-backup?gw_id=N
 * Restores the backup roster and removes the backup row.
 * Called when Free Hit is deactivated (before deadline) or after GW ends.
 * Returns the restored squad so the client can update its state.
 */
export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = auth.user.id;
  const admin = getSupabaseServerOrThrow();

  const url = new URL(req.url);
  const gwId = Number(url.searchParams.get("gw_id") ?? "");
  if (!Number.isFinite(gwId) || gwId < 1) {
    return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
  }

  // Fetch backup
  const { data: backup, error: fetchErr } = await admin
    .from("free_hit_backups")
    .select("squad_ids, starting_ids, captain_id, vice_captain_id, bench_order")
    .eq("user_id", userId)
    .eq("gameweek_id", gwId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!backup || !backup.squad_ids || backup.squad_ids.length === 0) {
    return NextResponse.json({ error: "No backup found" }, { status: 404 });
  }

  const squadIds: string[] = backup.squad_ids;
  const startingIds: string[] = backup.starting_ids ?? [];
  const captainId: string | null = backup.captain_id ?? null;
  const viceId: string | null = backup.vice_captain_id ?? null;
  const benchOrderArr: string[] = backup.bench_order ?? [];

  // Rebuild roster rows from backup
  const startingSet = new Set(startingIds);
  const rows = squadIds.map((pid) => {
    const isStarter = startingSet.has(pid);
    let bench_order: number | null = null;
    if (!isStarter && benchOrderArr.length > 0) {
      const idx = benchOrderArr.indexOf(pid);
      bench_order = idx >= 0 ? idx + 1 : null;
    }
    return {
      user_id: userId,
      player_id: pid,
      gameweek_id: gwId,
      is_starting_9: isStarter,
      is_captain: captainId === pid,
      is_vice_captain: viceId === pid,
      multiplier: captainId === pid ? 2 : 1,
      active_chip: null,
      bench_order,
    };
  });

  // Upsert restored roster (safe order — upsert first, clean stale after)
  const { error: upsertErr } = await admin
    .from("user_rosters")
    .upsert(rows, { onConflict: "user_id,player_id,gameweek_id" });

  if (upsertErr) {
    console.error("FREE HIT RESTORE UPSERT ERROR", upsertErr);
    return NextResponse.json({ error: "Failed to restore roster" }, { status: 500 });
  }

  // Clean stale rows (players from the FH squad that aren't in the backup)
  const { error: cleanupErr } = await admin
    .from("user_rosters")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", gwId)
    .not("player_id", "in", `(${squadIds.join(",")})`);

  if (cleanupErr) {
    console.error("FREE HIT RESTORE CLEANUP WARNING", cleanupErr);
  }

  // Delete the backup row (it's been consumed)
  await admin
    .from("free_hit_backups")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", gwId);

  // ── Sync current_squads (persistent ownership table) ──
  const csRows = squadIds.map((pid) => {
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
      is_captain: captainId === pid,
      is_vice_captain: viceId === pid,
      bench_order,
    };
  });

  await admin
    .from("current_squads")
    .upsert(csRows, { onConflict: "user_id,player_id" })
    .then(({ error }) => {
      if (error) console.error("CURRENT_SQUADS UPSERT WARNING (free-hit restore)", error);
    });

  await admin
    .from("current_squads")
    .delete()
    .eq("user_id", userId)
    .not("player_id", "in", `(${squadIds.join(",")})`)
    .then(({ error }) => {
      if (error) console.error("CURRENT_SQUADS CLEANUP WARNING (free-hit restore)", error);
    });

  return NextResponse.json({
    ok: true,
    restored: {
      squadIds,
      startingIds,
      captainId,
      viceId,
      benchOrder: benchOrderArr,
    },
  });
}
