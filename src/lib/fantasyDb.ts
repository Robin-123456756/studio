import { supabase } from "@/lib/supabaseClient";

const MAX_SQUAD = 17;
const MAX_STARTING = 9;

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

function uniq(ids: string[]) {
  const clean = ids.map(String);
  return Array.from(new Set(clean));
}

export async function saveRosterToDb(opts: {
  gameweekId: number;
  squadIds: string[];      // all picked players (17)
  startingIds: string[];   // starting 9 ids
  captainId?: string | null;
  viceId?: string | null;
}) {
  const uid = await requireUserId();
  const { gameweekId } = opts;

  // 1) sanitize + enforce uniqueness
  const squadIds = uniq(opts.squadIds);
  const startingIds = uniq(opts.startingIds);

  if (squadIds.length !== MAX_SQUAD) {
    throw new Error(`Squad must be exactly ${MAX_SQUAD} players.`);
  }

  // 2) captain/vice rules: must be within starting list
  const cap = opts.captainId ?? null;
  const vice = opts.viceId ?? null;

  const startingSet = new Set(startingIds);
  if (cap) startingSet.add(cap);
  if (vice) startingSet.add(vice);

  const finalStarting = Array.from(startingSet);

  // 3) starting limit
  if (finalStarting.length > MAX_STARTING) {
    throw new Error(`Starting lineup cannot exceed ${MAX_STARTING} players.`);
  }

  // 4) delete existing roster for this user+gw
  {
    const { error } = await supabase
      .from("user_rosters")
      .delete()
      .eq("user_id", uid)
      .eq("gameweek_id", gameweekId);

    if (error) throw error;
  }

  // 5) insert fresh rows
  const rows = squadIds.map((playerId) => ({
    user_id: uid,
    gameweek_id: gameweekId,
    player_id: playerId,

    // keep your DB column name
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

  const capRow = (roster ?? []).find((r) => r.is_captain);
  const viceRow = (roster ?? []).find((r) => r.is_vice_captain);

  return {
    teamName: team?.name ?? "My Team",
    squadIds,
    startingIds,
    captainId: capRow ? String(capRow.player_id) : null,
    viceId: viceRow ? String(viceRow.player_id) : null,
  };
}
