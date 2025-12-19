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
  position: string;
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
  status: 'scheduled' | 'live' | 'completed';
};

const players1: Player[] = [
  { id: 'p1', name: 'Kenji Tanaka', avatarUrl: 'https://picsum.photos/seed/p1/100/100', position: 'Forward' },
  { id: 'p2', name: 'Haru Ito', avatarUrl: 'https://picsum.photos/seed/p2/100/100', position: 'Defender' },
  { id: 'p9', name: 'Riku Nakamura', avatarUrl: 'https://picsum.photos/seed/p9/100/100', position: 'Midfielder' },
];

const players2: Player[] = [
    { id: 'p3', name: 'Yuki Yamamoto', avatarUrl: 'https://picsum.photos/seed/p3/100/100', position: 'Midfielder' },
    { id: 'p4', name: 'Sora Kobayashi', avatarUrl: 'https://picsum.photos/seed/p4/100/100', position: 'Goalkeeper' },
    { id: 'p10', name: 'Asahi Watanabe', avatarUrl: 'https://picsum.photos/seed/p10/100/100', position: 'Forward' },
];
const players3: Player[] = [
    { id: 'p5', name: 'Ren Mori', avatarUrl: 'https://picsum.photos/seed/p5/100/100', position: 'Forward' },
    { id: 'p6', name: 'Kaito Abe', avatarUrl: 'https://picsum.photos/seed/p6/100/100', position: 'Defender' },
    { id: 'p11', name: 'Itsuki Sasaki', avatarUrl: 'https://picsum.photos/seed/p11/100/100', position: 'Midfielder' },
];
const players4: Player[] = [
    { id: 'p7', name: 'Hinata Saito', avatarUrl: 'https://picsum.photos/seed/p7/100/100', position: 'Midfielder' },
    { id: 'p8', name: 'Eita Hashimoto', avatarUrl: 'https://picsum.photos/seed/p8/100/100', position: 'Forward' },
    { id: 'p12', name: 'Yuto Fujita', avatarUrl: 'https://picsum.photos/seed/p12/100/100', position: 'Defender' },
];

export const teams: Team[] = [
  { id: 't1', name: 'Golden Vipers', players: players1, logoUrl: 'https://picsum.photos/seed/vipers/200/200', wins: 5, losses: 1, draws: 1 },
  { id: 't2', name: 'Crimson Dragons', players: players2, logoUrl: 'https://picsum.photos/seed/dragons/200/200', wins: 4, losses: 2, draws: 1 },
  { id: 't3', name: 'Shadow Tigers', players: players3, logoUrl: 'https://picsum.photos/seed/tigers/200/200', wins: 3, losses: 3, draws: 1 },
  { id: 't4', name: 'Storm Wolves', players: players4, logoUrl: 'https://picsum.photos/seed/wolves/200/200', wins: 1, losses: 5, draws: 1 },
];

export const schedule: Game[] = [
    { id: 'g1', date: '2024-08-15', time: '18:00', venue: 'Main Arena', team1: teams[0], team2: teams[1], status: 'scheduled' },
    { id: 'g2', date: '2024-08-15', time: '20:00', venue: 'Main Arena', team1: teams[2], team2: teams[3], status: 'scheduled' },
    { id: 'g3', date: '2024-08-22', time: '18:00', venue: 'Side Court', team1: teams[0], team2: teams[2], status: 'scheduled' },
    { id: 'g4', date: '2024-08-22', time: '20:00', venue: 'Side Court', team1: teams[1], team2: teams[3], status: 'scheduled' },
    { id: 'g7', date: '2024-08-29', time: '19:00', venue: 'Main Arena', team1: teams[0], team2: teams[3], status: 'scheduled' },
    { id: 'g8', date: '2024-08-29', time: '21:00', venue: 'Main Arena', team1: teams[1], team2: teams[2], status: 'scheduled' },
];

export const recentScores: Game[] = [
    { id: 'g5', date: '2024-08-08', time: '18:00', venue: 'Main Arena', team1: teams[0], team2: teams[3], score1: 3, score2: 1, status: 'completed' },
    { id: 'g6', date: '2024-08-08', time: '20:00', venue: 'Main Arena', team1: teams[1], team2: teams[2], score1: 2, score2: 2, status: 'completed' },
];

export const standings = [...teams].sort((a, b) => (b.wins * 3 + b.draws) - (a.wins * 3 + a.draws));
