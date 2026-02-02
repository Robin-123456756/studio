// =====================
// TYPES
// =====================
export type Team = {
  id: string;        // route slug "t-bifa"
  dbId: string;      // supabase teams.id (int4)
  name: string;      // full name "BIFA"
  shortName: string; // ✅ "BIF"
  players: Player[];
  logoUrl: string;
  wins: number;
  losses: number;
  draws: number;
  played?: number;
  gf?: number;
  ga?: number;
  gd?: number;
  lp?: number;
  pts?: number;
};

export type Player = {
  id: string;
  name: string;
  avatarUrl: string;
  position: "Forward" | "Midfielder" | "Defender" | "Goalkeeper";
  price: number;
  points: number;
  team: string;

  // ✅ needed to enforce "9 males + optional 1 lady on field"
  gender: "male" | "female";
};

// ✅ NEW: unlimited match-day squad
export type MatchDaySquad = {
  players: Player[]; // any number
};

// ✅ NEW: restricted on-field lineup
export type OnFieldLineup = {
  players: Player[]; // max 10 total (<=9 male, <=1 female)
};

export type Game = {
  id: string;
  date: string;
  time: string;
  venue: string;
  team1: Team;
  team2: Team;
  score1?: number;
  score2?: number;
  status: "scheduled" | "live" | "completed";

  // ✅ Lady participation (optional flags)
  // If you set onField1/onField2, we’ll detect from that first.
  // Otherwise you can set lady1/lady2 directly on a completed match.
  lady1?: boolean;
  lady2?: boolean;

  // ✅ optional: who is available vs who is currently fielded
  squad1?: MatchDaySquad;
  squad2?: MatchDaySquad;
  onField1?: OnFieldLineup;
  onField2?: OnFieldLineup;
};

export type FantasyTeam = {
  id: string;
  name: string;
  owner: string;
  players: Player[];
  points: number;
  rank: number;
};

// =====================
// RULE ENFORCEMENT HELPERS
// =====================
export function validateOnFieldLineup(team: Team, lineup: OnFieldLineup) {
  // All players must belong to the team
  const wrongTeam = lineup.players.filter((p) => p.team !== team.name);
  if (wrongTeam.length) {
    throw new Error(`Lineup has players not in team "${team.name}".`);
  }

  // No duplicates
  const ids = lineup.players.map((p) => p.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Lineup contains duplicate players.");
  }

  // Gender rule: <=9 males, <=1 female
  const males = lineup.players.filter((p) => p.gender === "male").length;
  const females = lineup.players.filter((p) => p.gender === "female").length;

  if (males > 9) throw new Error(`Too many male players on field: ${males} (max 9).`);
  if (females > 1) throw new Error(`Too many lady players on field: ${females} (max 1).`);

  // Total cap (optional safety)
  if (lineup.players.length > 10) {
    throw new Error(`Too many total players on field: ${lineup.players.length} (max 10).`);
  }

  return true;
}

// Groups players per team (fast lookup)
function groupPlayersByTeam(players: Player[]) {
  return players.reduce<Record<string, Player[]>>((acc, p) => {
    (acc[p.team] ??= []).push(p);
    return acc;
  }, {});
}

// Convenience: auto-pick a legal on-field lineup from a team’s squad
// - Picks up to 9 male + up to 1 female (lady) from available squad players
export function autoPickOnFieldLineup(team: Team, squad: MatchDaySquad): OnFieldLineup {
  const males = squad.players.filter((p) => p.team === team.name && p.gender === "male").slice(0, 9);
  const lady = squad.players.filter((p) => p.team === team.name && p.gender === "female").slice(0, 1);
  const lineup: OnFieldLineup = { players: [...males, ...lady] };
  validateOnFieldLineup(team, lineup);
  return lineup;
}

// =====================
// STANDINGS COMPUTATION (GD + LP from matches)
// =====================
type TeamStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  lp: number;
};

function hasLady(lineup?: OnFieldLineup) {
  return !!lineup?.players?.some((p) => p.gender === "female");
}

function getLadyPlayed(game: Game, side: 1 | 2) {
  // Prefer onField detection (best source of truth)
  if (side === 1) {
    if (game.onField1) return hasLady(game.onField1);
    return !!game.lady1;
  }
  if (game.onField2) return hasLady(game.onField2);
  return !!game.lady2;
}

function computeStandings(allTeams: Team[], games: Game[]) {
  const stats = new Map<string, TeamStats>();

  for (const t of allTeams) {
    stats.set(t.id, { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, lp: 0 });
  }

  const playedGames = games.filter(
    (g) =>
      (g.status === "completed" || g.status === "live") &&
      typeof g.score1 === "number" &&
      typeof g.score2 === "number"
  );

  for (const g of playedGames) {
    const s1 = stats.get(g.team1.id);
    const s2 = stats.get(g.team2.id);
    if (!s1 || !s2) continue;

    // Played count
    s1.played += 1;
    s2.played += 1;

    // GF/GA
    s1.gf += g.score1!;
    s1.ga += g.score2!;
    s2.gf += g.score2!;
    s2.ga += g.score1!;

    // W/D/L
    if (g.score1! > g.score2!) {
      s1.wins += 1;
      s2.losses += 1;
    } else if (g.score1! < g.score2!) {
      s2.wins += 1;
      s1.losses += 1;
    } else {
      s1.draws += 1;
      s2.draws += 1;
    }

    // ✅ LP: +1 if a lady played for that team in that match
    if (getLadyPlayed(g, 1)) s1.lp += 1;
    if (getLadyPlayed(g, 2)) s2.lp += 1;
  }

  const computed: Team[] = allTeams.map((t) => {
    const s = stats.get(t.id)!;
    const gd = s.gf - s.ga;
    const pts = s.wins * 3 + s.draws + s.lp;

    return {
      ...t,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      played: s.played,
      gf: s.gf,
      ga: s.ga,
      gd,
      lp: s.lp,
      pts,
    };
  });

  // Sort: Pts desc, then GD desc, then Wins desc, then GF desc (common tie-break)
  computed.sort((a, b) => {
    const ptsA = a.pts ?? (a.wins * 3 + a.draws + (a.lp ?? 0));
    const ptsB = b.pts ?? (b.wins * 3 + b.draws + (b.lp ?? 0));
    if (ptsB !== ptsA) return ptsB - ptsA;

    const gdA = a.gd ?? 0;
    const gdB = b.gd ?? 0;
    if (gdB !== gdA) return gdB - gdA;

    if (b.wins !== a.wins) return b.wins - a.wins;

    const gfA = a.gf ?? 0;
    const gfB = b.gf ?? 0;
    return gfB - gfA;
  });

  return computed;
}

// =====================
// PLAYERS (sample — expand as you like)
// NOTE: team names must match the Team.name EXACTLY (Masappe, Komunoballo, etc.)
// =====================
const allPlayers: Player[] = [
  // Bifa
  { id: "p1", name: "Kenji Tanaka", avatarUrl: "https://picsum.photos/seed/p1/100/100", position: "Forward", price: 11.5, points: 58, team: "Bifa", gender: "male" },
  { id: "p2", name: "Haru Ito", avatarUrl: "https://picsum.photos/seed/p2/100/100", position: "Defender", price: 6.2, points: 41, team: "Bifa", gender: "male" },
  { id: "p3", name: "Riku Nakamura", avatarUrl: "https://picsum.photos/seed/p3/100/100", position: "Midfielder", price: 8.8, points: 51, team: "Bifa", gender: "male" },
  { id: "p13", name: "Amina Nansubuga", avatarUrl: "https://picsum.photos/seed/p13/100/100", position: "Forward", price: 7.4, points: 22, team: "Bifa", gender: "female" },

  // Komunoballo (✅ corrected spelling)
  { id: "p4", name: "Yuki Yamamoto", avatarUrl: "https://picsum.photos/seed/p4/100/100", position: "Midfielder", price: 10.1, points: 62, team: "Komunoballo", gender: "male" },
  { id: "p5", name: "Sora Kobayashi", avatarUrl: "https://picsum.photos/seed/p5/100/100", position: "Goalkeeper", price: 5.5, points: 35, team: "Komunoballo", gender: "male" },
  { id: "p6", name: "Asahi Watanabe", avatarUrl: "https://picsum.photos/seed/p6/100/100", position: "Forward", price: 9.5, points: 45, team: "Komunoballo", gender: "male" },
  { id: "p14", name: "Joy Achieng", avatarUrl: "https://picsum.photos/seed/p14/100/100", position: "Midfielder", price: 6.8, points: 18, team: "Komunoballo", gender: "female" },

  // Accumulators
  { id: "p7", name: "Ren Mori", avatarUrl: "https://picsum.photos/seed/p7/100/100", position: "Forward", price: 9.2, points: 48, team: "Accumulators", gender: "male" },
  { id: "p8", name: "Kaito Abe", avatarUrl: "https://picsum.photos/seed/p8/100/100", position: "Defender", price: 5.1, points: 29, team: "Accumulators", gender: "male" },
  { id: "p9", name: "Itsuki Sasaki", avatarUrl: "https://picsum.photos/seed/p9/100/100", position: "Midfielder", price: 7.3, points: 33, team: "Accumulators", gender: "male" },
  { id: "p15", name: "Sarah Atim", avatarUrl: "https://picsum.photos/seed/p15/1006666/100", position: "Defender", price: 5.9, points: 15, team: "Accumulators", gender: "female" },

  // Masappe (✅ corrected spelling)
  { id: "p10", name: "Hinata Saito", avatarUrl: "https://picsum.photos/seed/p10/100/100", position: "Midfielder", price: 6.9, points: 25, team: "Masappe", gender: "male" },
  { id: "p11", name: "Eita Hashimoto", avatarUrl: "https://picsum.photos/seed/p11/100/100", position: "Forward", price: 8.1, points: 31, team: "Masappe", gender: "male" },
  { id: "p12", name: "Yuto Fujita", avatarUrl: "https://picsum.photos/seed/p12/100/100", position: "Defender", price: 4.8, points: 19, team: "Masappe", gender: "male" },
  { id: "p16", name: "Blessing Namutebi", avatarUrl: "https://picsum.photos/seed/p16/100/100", position: "Goalkeeper", price: 5.0, points: 12, team: "Masappe", gender: "female" },
];

// =====================
// TEAMS + LOGOS (make sure logos are in public/logos)
// =====================
const teamDefs = [
  { id: "t-accumulators", name: "Accumulators", shortName: "ACC", dbId: "070f07c8-c8c1-4a43-9503-350f98bc2fe4" , logoUrl: "/logos/t-accumulators.png" },
  { id: "t-basunzi", name: "Basunzi", shortName: "BAS", dbId: "79db061d-0130-4a1b-a115-abd6b17c7857", logoUrl: "/logos/t-basunzi.png" },
  { id: "t-bifa", name: "BIFA", shortName: "BIF", dbId: "6b4c6306-4e96-449b-9103-01ef39cd7c21", logoUrl: "/logos/t-bifa.png" },

  { id: "t-trotballo", name: "Trotballo", shortName: "TRO", dbId: "692cd38f-516d-4e05-95ee-fd5d0e986c19", logoUrl: "/logos/t-trotballo.png" },
  { id: "t-dujay", name: "Dujay", shortName: "DUJ", dbId: "0276c44a-b612-472a-94c2-6751cd543b94", logoUrl: "/logos/t-dujay.png" },
  { id: "t-night-prep", name: "Night prep", shortName: "NIG", dbId: "4a4ad9ec-b96b-4326-8c7e-a70a32cb979b", logoUrl: "/logos/t-night-prep.png" },

  { id: "t-peaky-blinders", name: "Peaky blinders", shortName: "PEA", dbId: "9cfb61bb-4af9-475d-87fe-d9251280abd6", logoUrl: "/logos/t-peaky-blinders.png" },
  { id: "t-komunoballo", name: "Komunoballo", shortName: "KOM", dbId: "e57b846b-5ff0-4a91-a895-d5ce9be8c26c", logoUrl: "/logos/t-komunoballo.png" },
  { id: "t-masappe", name: "Masappe", shortName: "MAS", dbId: "a4cb90ce-9d8e-44e4-867b-3fa113ac5e95", logoUrl: "/logos/t-masappe.png" },

  { id: "t-midnight-express", name: "Midnight Express", shortName: "MID", dbId: "cc1bb524-93a1-4433-8af3-71124544faaf", logoUrl: "/logos/t-midnight-express.png" },
  { id: "t-centurions", name: "Centurions", shortName: "CEN", dbId: "846ab602-c8f9-4b97-b4fc-7541b5a7d841", logoUrl: "/logos/t-centurions.png" },
  { id: "t-jubilewos", name: "Jubilewos", shortName: "JUB", dbId: "36d62ea2-47b6-44f3-bd3d-7c7fa627992e", logoUrl: "/logos/t-jubilewos.png" },

  { id: "t-endgame", name: "Endgame", shortName: "END", dbId: "9ccc3f8d-d9a1-4f26-ad59-a6ada4af8ba6", logoUrl: "/logos/t-endgame.png" },
  { id: "t-abacuba", name: "Abacuba", shortName: "ABA", dbId: "5c5c8d3f-d293-497d-9c97-814368021972", logoUrl: "/logos/t-abacuba.png" },
  { id: "t-thazoballo", name: "Thazoballo", shortName: "THA", dbId: "2a3b1a03-6b2a-450c-84a4-641e17bb5b0c", logoUrl: "/logos/t-thazoballo.png" },

  { id: "t-quadballo", name: "Quadballo", shortName: "QUA", dbId: "8283b272-4205-4e1e-b80c-562a290d9808", logoUrl: "/logos/t-quadballo.png" },
] as const;

const playersByTeam = groupPlayersByTeam(allPlayers);

export const teams = teamDefs.map((t) => ({
  id: t.id,
  dbId: t.dbId,
  name: t.name,
  shortName: t.shortName,
  logoUrl: t.logoUrl,
  players: playersByTeam[t.name] ?? [],
  wins: 0,
  losses: 0,
  draws: 0,
}));

// =====================
// SCHEDULE (example Sundays, Pitch A & Pitch B)
// =====================
export const schedule: Game[] = [
  // Sunday 1
  { id: "g1", date: "2024-08-18", time: "14:00", venue: "Pitch A", team1: teams[0], team2: teams[1], status: "scheduled" },
  { id: "g2", date: "2024-08-18", time: "14:00", venue: "Pitch B", team1: teams[2], team2: teams[3], status: "scheduled" },

  // Sunday 2
  { id: "g3", date: "2024-08-25", time: "14:00", venue: "Pitch A", team1: teams[4], team2: teams[5], status: "scheduled" },
  { id: "g4", date: "2024-08-25", time: "14:00", venue: "Pitch B", team1: teams[6], team2: teams[7], status: "scheduled" },
];

// Add squads/on-field lineups to a game (example for the first scheduled game)
const game1Team1Squad: MatchDaySquad = { players: teams[0].players };
const game1Team2Squad: MatchDaySquad = { players: teams[1].players };

schedule[0].squad1 = game1Team1Squad;
schedule[0].squad2 = game1Team2Squad;
schedule[0].onField1 = autoPickOnFieldLineup(teams[0], game1Team1Squad);
schedule[0].onField2 = autoPickOnFieldLineup(teams[1], game1Team2Squad);

// =====================
// RECENT SCORES (sample)
// ✅ Add lady1/lady2 OR add onField1/onField2 (either works)
// =====================
export const recentScores: Game[] = [
  {
    id: "g5",
    date: "2024-08-11",
    time: "14:00",
    venue: "Pitch A",
    team1: teams[0], // Bifa
    team2: teams[2], // Accumulators
    score1: 2,
    score2: 1,
    lady1: true,  // ✅ Bifa fielded a lady
    lady2: false, // ✅ Accumulators did not
    status: "completed",
  },
  {
    id: "g6",
    date: "2024-08-11",
    time: "14:00",
    venue: "Pitch B",
    team1: teams[1], // Komunoballo
    team2: teams[3], // Masappe
    score1: 0,
    score2: 0,
    lady1: true, // ✅ Komunoballo fielded a lady
    lady2: true, // ✅ Masappe fielded a lady
    status: "completed",
  },
];

// =====================
// STANDINGS (computed from scores)
// =====================
export const standings: Team[] = computeStandings(teams, [...schedule, ...recentScores]);

// =====================
// MY FANTASY TEAM
// =====================
export const myFantasyTeam: FantasyTeam = {
  id: "ft1",
  name: "Admin FC",
  owner: "League Admin",
  players: [
    allPlayers[0], // Bifa
    allPlayers[3], // Komunoballo
    allPlayers[6], // Accumulators
    allPlayers[9], // Masappe
  ],
  points: 219,
  rank: 12,
};

export const fantasyStandings = [
  { rank: 1, name: "FC Dynamo", owner: "John D.", points: 250 },
  { rank: 2, name: "Real Majestic", owner: "Jane S.", points: 245 },
  { rank: 12, name: "Admin FC", owner: "League Admin", points: 219 },
  { rank: 13, name: "The Wanderers", owner: "Mike R.", points: 218 },
];
