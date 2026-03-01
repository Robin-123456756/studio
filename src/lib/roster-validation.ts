/**
 * Server-side squad composition validation.
 * Mirrors the client-side rules so users can't bypass them via API.
 */

type PlayerRow = {
  id: string;
  position: string | null;
  is_lady: boolean | null;
  team_id: string | null;
  team_name?: string | null;
  team_short?: string | null;
  teams?:
    | {
        name?: string | null;
        short_name?: string | null;
      }
    | {
        name?: string | null;
        short_name?: string | null;
      }[]
    | null;
  now_cost: number | null;
};

function norm(pos: string | null | undefined): string {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "GK";
  if (p === "def" || p === "defender" || p === "df") return "DEF";
  if (p === "mid" || p === "midfielder" || p === "mf") return "MID";
  if (p === "fwd" || p === "forward" || p === "fw" || p === "striker") return "FWD";
  return "MID";
}

function teamKey(p: PlayerRow): string | null {
  const teamRel =
    Array.isArray(p.teams) ? (p.teams[0] ?? null) : p.teams ?? null;

  if (p.team_id != null) {
    const id = String(p.team_id).trim();
    if (id.length > 0) return id;
  }

  const fallback = String(
    teamRel?.short_name ??
      teamRel?.name ??
      p.team_short ??
      p.team_name ??
      "",
  )
    .trim()
    .toLowerCase();

  return fallback.length > 0 ? fallback : null;
}

export function validateSquadComposition(
  players: PlayerRow[],
  startingIds: string[],
  captainId: string | null,
  viceId: string | null,
): string | null {
  // --- Full squad checks ---
  if (players.length !== 17) {
    return `Squad must have exactly 17 players (got ${players.length}).`;
  }

  const byPos = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) {
    const pos = norm(p.position);
    byPos[pos as keyof typeof byPos]++;
  }
  if (byPos.GK !== 2) return `Squad must have exactly 2 goalkeepers (got ${byPos.GK}).`;

  // Lady forwards in full squad: exactly 2
  const ladyFwds = players.filter(
    (p) => p.is_lady && norm(p.position) === "FWD",
  );
  if (ladyFwds.length !== 2) {
    return `Squad must have exactly 2 lady forwards (got ${ladyFwds.length}).`;
  }

  // Max 3 per real team
  const teamCounts = new Map<string, number>();
  for (const p of players) {
    const key = teamKey(p);
    if (!key) continue;
    teamCounts.set(key, (teamCounts.get(key) ?? 0) + 1);
  }
  for (const [, count] of teamCounts) {
    if (count > 3) {
      return `Max 3 players per team allowed in your full squad (found ${count}).`;
    }
  }

  // --- Starting 10 checks ---
  const startingSet = new Set(startingIds);
  if (startingSet.size !== 10) {
    return `Must have exactly 10 starting players (got ${startingSet.size}).`;
  }

  // All starting players must be in the squad
  for (const sid of startingIds) {
    if (!players.find((p) => p.id === sid)) {
      return `Starting player ${sid} is not in the squad.`;
    }
  }

  const startingPlayers = players.filter((p) => startingSet.has(p.id));
  const startingTeamCounts = new Map<string, number>();
  for (const p of startingPlayers) {
    const key = teamKey(p);
    if (!key) continue;
    startingTeamCounts.set(key, (startingTeamCounts.get(key) ?? 0) + 1);
  }
  for (const [, count] of startingTeamCounts) {
    if (count > 3) {
      return `Max 3 players per team allowed in the starting lineup (found ${count}).`;
    }
  }

  const sPos = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of startingPlayers) {
    const pos = norm(p.position);
    sPos[pos as keyof typeof sPos]++;
  }

  if (sPos.GK !== 1) return `Starting 10 must have exactly 1 goalkeeper (got ${sPos.GK}).`;
  if (sPos.DEF < 2 || sPos.DEF > 3) return `Starting 10 must have 2-3 defenders (got ${sPos.DEF}).`;
  if (sPos.MID < 3 || sPos.MID > 5) return `Starting 10 must have 3-5 midfielders (got ${sPos.MID}).`;
  if (sPos.FWD < 2 || sPos.FWD > 3) return `Starting 10 must have 2-3 forwards (got ${sPos.FWD}).`;

  // Lady rules for starting 10
  const startingLadyFwd = startingPlayers.filter(
    (p) => p.is_lady && norm(p.position) === "FWD",
  );
  if (startingLadyFwd.length !== 1) {
    return `Starting 10 must have exactly 1 lady forward (got ${startingLadyFwd.length}).`;
  }
  const startingLadyNonFwd = startingPlayers.filter(
    (p) => p.is_lady && norm(p.position) !== "FWD",
  );
  if (startingLadyNonFwd.length > 0) {
    return `Starting 10 cannot include lady non-forward players.`;
  }

  // --- Captain / Vice checks ---
  if (!captainId) return "Captain is required.";
  if (!viceId) return "Vice-captain is required.";
  if (captainId === viceId) return "Captain and vice-captain must be different players.";
  if (!startingSet.has(captainId)) return "Captain must be in the starting 10.";
  if (!startingSet.has(viceId)) return "Vice-captain must be in the starting 10.";

  return null; // valid
}
