import type { ResolvedEntry, StatAction } from "./types";

// ── Range limits per action ─────────────────────────────────
const ACTION_LIMITS: Record<StatAction, { min: number; max: number; label: string }> = {
  appearance:  { min: 1, max: 1,  label: "Appearance" },
  goal:        { min: 1, max: 10, label: "Goals" },
  assist:      { min: 1, max: 10, label: "Assists" },
  clean_sheet: { min: 1, max: 1,  label: "Clean Sheet" },
  own_goal:    { min: 1, max: 5,  label: "Own Goals" },
  pen_miss:    { min: 1, max: 5,  label: "Penalties Missed" },
  pen_save:    { min: 1, max: 5,  label: "Penalties Saved" },
  save_3:      { min: 1, max: 10, label: "3+ Saves" },
  yellow:      { min: 1, max: 1,  label: "Yellow Card" },
  red:         { min: 1, max: 1,  label: "Red Card" },
};

// ── Position-action compatibility ───────────────────────────
const POSITION_WARNINGS: Record<string, StatAction[]> = {
  GKP: ["goal", "assist"],            // Unusual but valid
  DEF: [],                             // All actions valid for defenders
  MID: ["pen_save", "save_3"],         // Only GKPs typically save
  FWD: ["clean_sheet", "pen_save", "save_3"], // Forwards don't get CS or saves
};

export interface ValidationWarning {
  type: "range" | "dedup" | "position" | "conflict" | "missing_match";
  severity: "error" | "warning" | "info";
  player: string;
  message: string;
  action?: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationWarning[];
}

/**
 * Validate a set of resolved entries before committing.
 * Returns errors (must fix) and warnings (can override).
 */
export function validateEntries(
  entries: ResolvedEntry[],
  matchId: number | null,
  existingEvents?: Array<{ player_id: string; action: string; quantity: number }>
): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationWarning[] = [];

  // ── Check: match selected ───────────────────────────────
  if (!matchId) {
    errors.push({
      type: "missing_match",
      severity: "error",
      player: "",
      message: "No match selected. Please select a match before committing.",
    });
  }

  // ── Check: no entries ───────────────────────────────────
  if (entries.length === 0) {
    errors.push({
      type: "missing_match",
      severity: "error",
      player: "",
      message: "No player entries to commit.",
    });
    return { valid: false, warnings, errors };
  }

  for (const entry of entries) {
    const playerName = entry.player?.web_name || entry.spoken_name;
    const position = entry.player?.position || "MID";

    for (const action of entry.actions) {
      // ── Range check ───────────────────────────────────
      const limits = ACTION_LIMITS[action.action as StatAction];
      if (limits) {
        if (action.quantity > limits.max) {
          errors.push({
            type: "range",
            severity: "error",
            player: playerName,
            action: action.action,
            message: `${playerName}: ${limits.label} quantity ${action.quantity} exceeds max (${limits.max})`,
          });
        }
        if (action.quantity < limits.min) {
          errors.push({
            type: "range",
            severity: "error",
            player: playerName,
            action: action.action,
            message: `${playerName}: ${limits.label} quantity ${action.quantity} below min (${limits.min})`,
          });
        }
      }

      // ── Position compatibility ────────────────────────
      const posWarnings = POSITION_WARNINGS[position] || [];
      if (posWarnings.includes(action.action as StatAction)) {
        warnings.push({
          type: "position",
          severity: "warning",
          player: playerName,
          action: action.action,
          message: `${playerName} (${position}) with "${action.action}" — unusual for this position`,
        });
      }
    }

    // ── Conflict: yellow + red in same entry ──────────────
    const hasYellow = entry.actions.some((a) => a.action === "yellow");
    const hasRed = entry.actions.some((a) => a.action === "red");
    if (hasYellow && hasRed) {
      warnings.push({
        type: "conflict",
        severity: "warning",
        player: playerName,
        message: `${playerName} has both yellow and red cards — is this a second yellow leading to red? If so, only log the red card.`,
      });
    }

    // ── Conflict: clean_sheet + goals conceded ────────────
    const hasCleanSheet = entry.actions.some((a) => a.action === "clean_sheet");
    const hasOwnGoal = entry.actions.some((a) => a.action === "own_goal");
    if (hasCleanSheet && hasOwnGoal) {
      errors.push({
        type: "conflict",
        severity: "error",
        player: playerName,
        message: `${playerName} cannot have both a clean sheet and an own goal in the same match.`,
      });
    }

    // ── Dedup check against existing events ───────────────
    if (existingEvents && existingEvents.length > 0) {
      for (const action of entry.actions) {
        const existing = existingEvents.find(
          (e) =>
            e.player_id === entry.player?.id &&
            e.action === action.action
        );
        if (existing) {
          warnings.push({
            type: "dedup",
            severity: "warning",
            player: playerName,
            action: action.action,
            message: `${playerName} already has "${action.action}" (×${existing.quantity}) for this match. This will add ${action.quantity} more.`,
          });
        }
      }
    }
  }

  // ── Dedup: same player appearing twice in this batch ────
  const playerIds = entries
    .map((e) => e.player?.id)
    .filter(Boolean);
  const seen = new Set<string>();
  for (const id of playerIds) {
    if (id && seen.has(id)) {
      const name = entries.find((e) => e.player?.id === id)?.player?.web_name || id;
      warnings.push({
        type: "dedup",
        severity: "warning",
        player: name,
        message: `${name} appears multiple times in this batch. Their actions will be combined.`,
      });
    }
    if (id) seen.add(id);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Quick sanity check — returns true if entries look reasonable.
 */
export function quickCheck(entries: ResolvedEntry[]): boolean {
  if (entries.length === 0) return false;
  if (entries.length > 30) return false; // Suspiciously many players in one command
  for (const entry of entries) {
    if (!entry.player?.id) return false;
    const totalActions = entry.actions.reduce((s, a) => s + a.quantity, 0);
    if (totalActions > 20) return false; // Suspiciously many actions for one player
  }
  return true;
}