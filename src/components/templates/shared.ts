/* ── Shared brand constants & types for sports graphic templates ─────── */

/** Budo League brand palette */
export const BRAND = {
  purple: "#37003C",
  purpleLight: "#5A1060",
  red: "#C8102E",
  redLight: "#E8304A",
  gold: "#FFD700",
  green: "#00E676",
  white: "#FFFFFF",
  offWhite: "#F8F9FA",
  dark: "#0A0A0A",
  darkCard: "#111827",
  muted: "#6B7280",
  gradient: "linear-gradient(135deg, #37003C 0%, #5A1060 50%, #C8102E 100%)",
  gradientDark: "linear-gradient(180deg, #0A0A0A 0%, #1A0A20 50%, #37003C 100%)",
} as const;

/** Logo path (transparent version for overlays) */
export const LOGO_URL = "/tbl-logo-transparent.png";

/** Common inline styles for template containers */
export const BASE_CONTAINER: React.CSSProperties = {
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  color: BRAND.white,
  overflow: "hidden",
  position: "relative",
};

/* ── Data types used by templates ─────────────────────────────────────── */

export type TemplateTeam = {
  name: string;
  shortName: string;
  logoUrl: string;
};

export type TemplateMatch = {
  id: string;
  kickoffTime: string;
  homeTeam: TemplateTeam;
  awayTeam: TemplateTeam;
  homeGoals: number | null;
  awayGoals: number | null;
  isPlayed: boolean;
  venue?: string;
};

export type TemplateMatchEvent = {
  playerName: string;
  goals: number;
  assists: number;
  isLady: boolean;
};

export type TemplatePlayer = {
  id: string;
  name: string;
  webName: string | null;
  position: string;
  avatarUrl: string | null;
  isLady: boolean;
  teamName: string;
  teamShort: string;
  teamLogoUrl: string;
  totalPoints: number;
  totalGoals: number;
  totalAssists: number;
  appearances: number;
  price: number | null;
  ownership: number;
};

export type TemplateStandingsRow = {
  rank: number;
  teamName: string;
  logoUrl: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  movement: number; // positive = up, negative = down, 0 = same
};

export type TemplateFantasyEntry = {
  rank: number;
  teamName: string;
  managerName?: string;
  totalPoints: number;
  movement: number;
};

/** All template type IDs */
export type TemplateTypeId =
  | "matchday"
  | "score_result"
  | "player_spotlight"
  | "leaderboard"
  | "transfer";

/** Template type metadata */
export type TemplateTypeMeta = {
  id: TemplateTypeId;
  label: string;
  description: string;
  icon: string;
  /** Default canvas dimensions */
  width: number;
  height: number;
};

/** Registry of all template types */
export const TEMPLATE_TYPES: TemplateTypeMeta[] = [
  {
    id: "matchday",
    label: "Matchday",
    description: "Fixture announcement with teams & kickoff",
    icon: "⚽",
    width: 1080,
    height: 1080,
  },
  {
    id: "score_result",
    label: "Score Result",
    description: "Post-match result with scorers",
    icon: "📊",
    width: 1080,
    height: 1080,
  },
  {
    id: "player_spotlight",
    label: "Player Spotlight",
    description: "Player card with photo & season stats",
    icon: "⭐",
    width: 1080,
    height: 1350,
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "League standings table",
    icon: "🏆",
    width: 1080,
    height: 1350,
  },
  {
    id: "transfer",
    label: "Transfer",
    description: "Player transfer announcement",
    icon: "🔄",
    width: 1080,
    height: 1080,
  },
];
