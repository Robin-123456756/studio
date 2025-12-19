// =====================
// TYPES
// =====================
export type Team = {
  id: string;
  name: string;
  players: Player[];
  logoUrl: string;
  wins: number;
  losses: number;
  draws: number;
};

export type Player = {
  id: string;
  name: string;
  avatarUrl: string;
  position: "Forward" | "Midfielder" | "Defender" | "Goalkeeper";
  price: number;
  points: number;
  team: string;

  // ✅ NEW: needed to enforce "9 males + optional 1 lady on field"
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

  // ✅ NEW (optional): who is available vs who is currently fielded
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
  { id: "p15", name: "Sarah Atim", avatarUrl: "https://picsum.photos/seed/p15/100/100", position: "Defender", price: 5.9, points: 15, team: "Accumulators", gender: "female" },

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
  { id: "t-bifa", name: "Bifa", logoUrl: "/logos/t-bifa.png" },
  { id: "t-komunoballo", name: "Komunoballo", logoUrl: "/logos/t-komunoballo.png" },
  { id: "t-accumulators", name: "Accumulators", logoUrl: "/logos/t-accumulators.png" },
  { id: "t-masappe", name: "Masappe", logoUrl: "/logos/t-masappe.png" },

  { id: "t-centurions", name: "Centurions", logoUrl: "/logos/t-centurions.png" },
  { id: "t-jubilewos", name: "Jubilewos", logoUrl: "/logos/t-jubilewos.png" },
  { id: "t-basunzi", name: "Basunzi", logoUrl: "/logos/t-basunzi.png" },
  { id: "t-dujay", name: "Dujay", logoUrl: "/logos/t-dujay.png" },

  { id: "t-quadballo", name: "Quadballo", logoUrl: "/logos/t-quadballo.png" },
  { id: "t-thazobalo", name: "Thazobalo", logoUrl: "/logos/t-thazobalo.png" },
  { id: "t-midnight-express", name: "Midnight Express", logoUrl: "/logos/t-midnight-express.png" },
  { id: "t-abachuba", name: "Abachuba", logoUrl: "/logos/t-abachuba.png" },

  { id: "t-endgame", name: "Endgame", logoUrl: "/logos/t-endgame.png" },
  { id: "t-peaky-blinders", name: "Peaky blinders", logoUrl: "/logos/t-peaky-blinders.png" },
  { id: "t-night-prep", name: "Night prep", logoUrl: "/logos/t-night-prep.png" },
  { id: "t-trotballo", name: "Trotballo", logoUrl: "/logos/t-trotballo.png" },
] as const;

const playersByTeam = groupPlayersByTeam(allPlayers);

export const teams: Team[] = teamDefs.map((t) => ({
  id: t.id,
  name: t.name,
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
// =====================
export const recentScores: Game[] = [
  { id: "g5", date: "2024-08-11", time: "14:00", venue: "Pitch A", team1: teams[0], team2: teams[2], score1: 2, score2: 1, status: "completed" },
  { id: "g6", date: "2024-08-11", time: "14:00", venue: "Pitch B", team1: teams[1], team2: teams[3], score1: 0, score2: 0, status: "completed" },
];

// =====================
// STANDINGS
// =====================
export const standings = [...teams].sort(
  (a, b) => b.wins * 3 + b.draws - (a.wins * 3 + a.draws)
);

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

