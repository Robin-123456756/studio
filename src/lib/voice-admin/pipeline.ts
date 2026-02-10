import { transcribeAudio } from "./transcription";
import { interpretTranscript } from "./interpreter";
import { matchPlayers } from "./fuzzy-match";
import { calcTotalPoints } from "./points-calculator";
import { writeToDatabase } from "./db-writer";
import type {
  PipelineResult,
  PipelineStep,
  ResolvedEntry,
  UnresolvedEntry,
} from "./types";

/**
 * MASTER PIPELINE: Voice Audio → Structured Preview
 *
 * 1. Transcribe audio (Whisper)
 * 2. Interpret transcript (GPT-4o)
 * 3. Match player names (Fuzzy against your Supabase players table)
 * 4. Calculate points (from your scoring_rules table)
 * 5. Return preview for admin confirmation
 */
export async function processVoiceInput(
  audioBuffer: Buffer,
  mimeType: string,
  matchId: number
): Promise<PipelineResult> {
  const startTime = Date.now();
  const steps: PipelineStep[] = [];

  // STEP 1: TRANSCRIBE
  const transcription = await transcribeAudio(audioBuffer, mimeType);
  steps.push({
    name: "transcription",
    duration: Date.now() - startTime,
    result: transcription.text,
  });

  // STEP 2: AI INTERPRET
  const step2Start = Date.now();
  const interpretation = await interpretTranscript(transcription.text);
  steps.push({
    name: "interpretation",
    duration: Date.now() - step2Start,
    confidence: interpretation.confidence,
    entryCount: interpretation.entries.length,
  });

  if (interpretation.confidence < 0.7) {
    return {
      status: "low_confidence",
      transcript: transcription.text,
      matchId,
      interpretation: {
        confidence: interpretation.confidence,
        ambiguities: interpretation.ambiguities || [],
        warnings: interpretation.warnings || [],
      },
      resolved: [],
      unresolved: [],
      summary: { totalPlayers: 0, resolvedCount: 0, unresolvedCount: 0, totalPoints: 0 },
      pipeline: { totalDuration: Date.now() - startTime, steps },
      message: "The AI is not confident about this input. Please try again.",
    };
  }

  // STEP 3: FUZZY MATCH PLAYERS
  const step3Start = Date.now();
  const playerNames = interpretation.entries.map((e) => e.player_name);
  const matchResults = await matchPlayers(playerNames);
  steps.push({ name: "fuzzy_match", duration: Date.now() - step3Start });

  // STEP 4: CALCULATE POINTS & BUILD PREVIEW
  const resolved: ResolvedEntry[] = [];
  const unresolved: UnresolvedEntry[] = [];

  for (const entry of interpretation.entries) {
    const matchResult = matchResults[entry.player_name];

    if (matchResult.match && matchResult.confidence >= 0.6) {
      const points = await calcTotalPoints(entry.actions, matchResult.match.position);

      resolved.push({
        spoken_name: entry.player_name,
        player: matchResult.match,
        actions: entry.actions,
        pointsBreakdown: points.breakdown,
        totalPoints: points.total,
        matchConfidence: matchResult.confidence,
        matchStrategy: matchResult.strategy,
      });
    } else {
      unresolved.push({
        spoken_name: entry.player_name,
        actions: entry.actions,
        candidates: matchResult.candidates,
        confidence: matchResult.confidence,
        strategy: matchResult.strategy,
      });
    }
  }

  return {
    status: unresolved.length > 0 ? "needs_resolution" : "ready",
    transcript: transcription.text,
    matchId,
    interpretation: {
      confidence: interpretation.confidence,
      ambiguities: interpretation.ambiguities || [],
      warnings: interpretation.warnings || [],
    },
    resolved,
    unresolved,
    summary: {
      totalPlayers: interpretation.entries.length,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
      totalPoints: resolved.reduce((sum, e) => sum + e.totalPoints, 0),
    },
    pipeline: { totalDuration: Date.now() - startTime, steps },
  };
}

/**
 * Process typed text input (skips Whisper step).
 */
export async function processTextInput(
  text: string,
  matchId: number
): Promise<PipelineResult> {
  const startTime = Date.now();

  const interpretation = await interpretTranscript(text);

  if (interpretation.confidence < 0.7) {
    return {
      status: "low_confidence",
      transcript: text,
      matchId,
      interpretation: {
        confidence: interpretation.confidence,
        ambiguities: interpretation.ambiguities || [],
        warnings: interpretation.warnings || [],
      },
      resolved: [],
      unresolved: [],
      summary: { totalPlayers: 0, resolvedCount: 0, unresolvedCount: 0, totalPoints: 0 },
      pipeline: { totalDuration: Date.now() - startTime, steps: [] },
      message: "Could not confidently parse the input.",
    };
  }

  const playerNames = interpretation.entries.map((e) => e.player_name);
  const matchResults = await matchPlayers(playerNames);

  const resolved: ResolvedEntry[] = [];
  const unresolved: UnresolvedEntry[] = [];

  for (const entry of interpretation.entries) {
    const matchResult = matchResults[entry.player_name];

    if (matchResult.match && matchResult.confidence >= 0.6) {
      const points = await calcTotalPoints(entry.actions, matchResult.match.position);
      resolved.push({
        spoken_name: entry.player_name,
        player: matchResult.match,
        actions: entry.actions,
        pointsBreakdown: points.breakdown,
        totalPoints: points.total,
        matchConfidence: matchResult.confidence,
        matchStrategy: matchResult.strategy,
      });
    } else {
      unresolved.push({
        spoken_name: entry.player_name,
        actions: entry.actions,
        candidates: matchResult.candidates,
        confidence: matchResult.confidence,
      });
    }
  }

  return {
    status: unresolved.length > 0 ? "needs_resolution" : "ready",
    transcript: text,
    matchId,
    interpretation: {
      confidence: interpretation.confidence,
      ambiguities: interpretation.ambiguities || [],
      warnings: interpretation.warnings || [],
    },
    resolved,
    unresolved,
    summary: {
      totalPlayers: interpretation.entries.length,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
      totalPoints: resolved.reduce((sum, e) => sum + e.totalPoints, 0),
    },
    pipeline: { totalDuration: Date.now() - startTime, steps: [] },
  };
}

/**
 * PHASE 2: Commit confirmed entries directly to DB.
 */
export async function commitToDB({
  matchId,
  entries,
  adminId,
  transcript,
  aiInterpretation,
}: {
  matchId: number;
  entries: ResolvedEntry[];
  adminId: number;
  transcript: string;
  aiInterpretation: object;
}) {
  return writeToDatabase({
    matchId,
    entries,
    adminId,
    transcript,
    aiInterpretation,
    inputMethod: "voice",
  });
}