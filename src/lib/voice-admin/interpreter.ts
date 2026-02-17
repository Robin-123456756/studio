import OpenAI from "openai";
import { VOICE_ADMIN_SYSTEM_PROMPT } from "./system-prompt";
import type { AIInterpretation, StatAction } from "./types";

// Lazy init — avoid crashing at build time when env var is missing
let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const VALID_ACTIONS = new Set<StatAction>([
  "appearance", "goal", "assist", "clean_sheet",
  "own_goal", "pen_miss", "pen_save", "save_3",
  "yellow", "red",
]);

/**
 * Parse a voice transcript into structured fantasy soccer stat entries.
 * 
 * Uses GPT-4o Mini with JSON mode — much cheaper than GPT-4o
 * and more than capable of extracting player names + actions.
 * 
 * Cost: ~$0.0003 per command (vs $0.01 with GPT-4o)
 */
export async function interpretTranscript(
  transcript: string
): Promise<AIInterpretation> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",           // ← Cheap & fast, perfect for extraction
    temperature: 0.0,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VOICE_ADMIN_SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  const raw = response.choices[0].message.content || "{}";

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned invalid JSON: ${raw.substring(0, 200)}`);
  }

  // ── Validate response structure ─────────────────────────
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