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

export async function saveRosterToDb(payload: {
  gameweekId: number;
  squadIds: string[];
  startingIds: string[];
  captainId: string | null;
  viceId: string | null;
  chip?: string | null;
  teamName?: string | null;
}) {
  // Ensure IDs are consistently typed — userId derived server-side from cookie
  const body = {
    gameweekId: Number(payload.gameweekId),
    squadIds: payload.squadIds.map(String),
    startingIds: payload.startingIds.map(String),
    captainId: payload.captainId ? String(payload.captainId) : null,
    viceId: payload.viceId ? String(payload.viceId) : null,
    chip: payload.chip ?? null,
    teamName: payload.teamName ?? null,
  };

  const res = await fetch("/api/rosters/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Failed to save roster");

  return json;
}
export async function updateRosterInDb() {
  throw new Error("updateRosterInDb not yet implemented");
}

export async function loadRosterFromDb(gwId: number) {
  const res = await fetch(`/api/rosters?gw_id=${gwId}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Failed to load roster");

  return {
    squadIds: json.squadIds ?? [],
    startingIds: json.startingIds ?? [],
    captainId: json.captainId ?? null,
    viceId: json.viceId ?? null,
    teamName: json.teamName ?? null,
  };
}
