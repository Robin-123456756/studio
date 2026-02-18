// ============================================================
// VOICE ADMIN MODULE — TYPE DEFINITIONS
// ============================================================

export type StatAction =
  | "appearance"
  | "goal"
  | "assist"
  | "clean_sheet"
  | "own_goal"
  | "pen_miss"
  | "pen_save"
  | "save_3"
  | "yellow"
  | "red";

export type PlayerPosition = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";

export type InputMethod = "voice" | "manual" | "csv" | "api";

// --- AI Interpreter Output ---

export interface AIAction {
  action: StatAction;
  quantity: number;
}

export interface AIEntry {
  player_name: string;
  actions: AIAction[];
}

export interface AIInterpretation {
  confidence: number;
  fixture_context: string | null;
  entries: AIEntry[];
  ambiguities: string[];
  warnings: string[];
  raw_ai_response?: string;
}

// --- Fuzzy Match ---

export interface MatchedPlayer {
  id: string; // UUID
  name: string;
  web_name: string | null;
  position: string;
  team_name: string;
  is_lady: boolean;
}

export interface FuzzyMatchResult {
  match: MatchedPlayer | null;
  candidates: MatchedPlayer[];
  confidence: number;
  strategy: string;
}

// --- Points Calculation ---

export interface PointsBreakdownItem {
  action: StatAction;
  quantity: number;
  points_per_unit: number;
  subtotal: number;
}

// --- Resolved Entry (ready for commit) ---

export interface ResolvedEntry {
  spoken_name: string;
  player: MatchedPlayer;
  actions: AIAction[];
  pointsBreakdown: PointsBreakdownItem[];
  totalPoints: number;
  matchConfidence: number;
  matchStrategy: string;
}

export interface UnresolvedEntry {
  spoken_name: string;
  actions: AIAction[];
  candidates: MatchedPlayer[];
  confidence: number;
  strategy?: string;
}

// --- Pipeline Result ---

export interface PipelineStep {
  name: string;
  duration: number;
  result?: string;
  confidence?: number;
  entryCount?: number;
}

export interface PipelineResult {
  status: "ready" | "needs_resolution" | "low_confidence";
  transcript: string;
  matchId: number;
  interpretation: {
    confidence: number;
    ambiguities: string[];
    warnings: string[];
  };
  resolved: ResolvedEntry[];
  unresolved: UnresolvedEntry[];
  summary: {
    totalPlayers: number;
    resolvedCount: number;
    unresolvedCount: number;
    totalPoints: number;
  };
  pipeline: {
    totalDuration: number;
    steps: PipelineStep[];
  };
  message?: string;
}

// --- Commit Results ---

export interface DBWriteResult {
  success: boolean;
  eventIds: number[];
  auditLogId: number;
  eventCount: number;
  playerCount: number;
}

export interface CSVExportResult {
  filePath: string;
  filename: string;
  rowCount: number;
  playerCount: number;
}