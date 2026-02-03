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

export async function saveRosterToDb(payload: {
  gameweekId: number;
  squadIds: string[];
  startingIds: string[];
  captainId: string | null;
  viceId: string | null;
}) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const res = await fetch("/api/rosters/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Failed to save roster");

  return json;
}
export async function updateRosterInDb(opts: any) {
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
