import { supabase } from "@/lib/supabaseClient";

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

export async function upsertTeamName(teamName: string) {
  const uid = await requireUserId();
  const name = teamName.trim().slice(0, 30) || "My Team";

  const { error } = await supabase
    .from("fantasy_teams")
    .upsert({ user_id: uid, name }, { onConflict: "user_id" });

  if (error) throw error;
}

export async function saveRosterToDb(opts: {
  gameweekId: number;
  squadIds: string[];      // all picked players (e.g., 15)
  startingIds: string[];   // starting 9 ids
  captainId?: string | null;
  viceId?: string | null;
}) {
  const uid = await requireUserId();
  const { gameweekId, squadIds, startingIds } = opts;

  const cap = opts.captainId ?? null;
  const vice = opts.viceId ?? null;

  // Always ensure captain/vice are in starting list
  const startingSet = new Set(startingIds);
  if (cap) startingSet.add(cap);
  if (vice) startingSet.add(vice);

  const finalStarting = Array.from(startingSet);

  // OPTIONAL: hard guard before DB triggers
  if (finalStarting.length > 9) {
    throw new Error("Starting lineup cannot exceed 9 players.");
  }

  // 1) delete existing roster for this user+gw
  {
    const { error } = await supabase
      .from("user_rosters")
      .delete()
      .eq("user_id", uid)
      .eq("gameweek_id", gameweekId);

    if (error) throw error;
  }

  // 2) insert fresh rows
  const rows = squadIds.map((playerId) => ({
    user_id: uid,
    gameweek_id: gameweekId,
    player_id: playerId,
    is_starting_9: finalStarting.includes(playerId),
    is_captain: cap === playerId,
    is_vice_captain: vice === playerId,
  }));

  const { error } = await supabase.from("user_rosters").insert(rows);
  if (error) throw error;
}

export async function loadRosterFromDb(gameweekId: number) {
  const uid = await requireUserId();

  const [{ data: team, error: teamErr }, { data: roster, error: rosterErr }] =
    await Promise.all([
      supabase.from("fantasy_teams").select("name").eq("user_id", uid).maybeSingle(),
      supabase
        .from("user_rosters")
        .select("player_id, is_starting_9, is_captain, is_vice_captain")
        .eq("user_id", uid)
        .eq("gameweek_id", gameweekId),
    ]);

  if (teamErr) throw teamErr;
  if (rosterErr) throw rosterErr;

  const squadIds = (roster ?? []).map((r) => String(r.player_id));
  const startingIds = (roster ?? [])
    .filter((r) => r.is_starting_9)
    .map((r) => String(r.player_id));

  const captainId =
    (roster ?? []).find((r) => r.is_captain)?.player_id
      ? String((roster ?? []).find((r) => r.is_captain)!.player_id)
      : null;

  const viceId =
    (roster ?? []).find((r) => r.is_vice_captain)?.player_id
      ? String((roster ?? []).find((r) => r.is_vice_captain)!.player_id)
      : null;

  return {
    teamName: team?.name ?? "My Team",
    squadIds,
    startingIds,
    captainId,
    viceId,
  };
}
