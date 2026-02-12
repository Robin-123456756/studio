import Anthropic from "@anthropic-ai/sdk";
import { VOICE_ADMIN_SYSTEM_PROMPT } from "./system-prompt";
import type { AIInterpretation, StatAction } from "./types";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const VALID_ACTIONS = new Set<StatAction>([
  "appearance", "goal", "assist", "clean_sheet",
  "own_goal", "pen_miss", "pen_save", "save_3",
  "yellow", "red",
]);

/**
 * Parse a voice transcript into structured fantasy soccer stat entries.
 * Uses Claude (Anthropic) for natural language understanding.
 */
export async function interpretTranscript(
  transcript: string
): Promise<AIInterpretation> {
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    temperature: 0,
    system: VOICE_ADMIN_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: transcript },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.substring(0, 200)}`);
  }

  // Validate structure
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error("AI response missing valid confidence score");
  }

  if (!Array.isArray(parsed.entries)) {
    throw new Error("AI response missing entries array");
  }

  for (const entry of parsed.entries) {
    if (!entry.player_name || typeof entry.player_name !== "string") {
      throw new Error("Each entry must have a player_name string");
    }
    if (!Array.isArray(entry.actions) || entry.actions.length === 0) {
      throw new Error(`Entry for "${entry.player_name}" has no actions`);
    }
    for (const action of entry.actions) {
      if (!VALID_ACTIONS.has(action.action)) {
        throw new Error(`Invalid action "${action.action}"`);
      }
      if (!Number.isInteger(action.quantity) || action.quantity < 1) {
        throw new Error(`Invalid quantity for ${entry.player_name}.${action.action}`);
      }
    }
  }

  return {
    ...parsed,
    raw_ai_response: raw,
  } as AIInterpretation;
}