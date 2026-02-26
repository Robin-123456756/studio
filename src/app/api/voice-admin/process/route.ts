import { NextResponse } from "next/server";
import { processTextInput } from "@/lib/voice-admin/pipeline";
import { getOpenAIApiKey } from "@/lib/openai/api-key";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

/**
 * Fetch player names for both teams in a match.
 * Used to guide Whisper transcription and GPT interpretation.
 */
async function getMatchPlayerNames(matchId: number): Promise<string[]> {
  const supabase = getSupabaseServerOrThrow();
  const { data: match } = await supabase
    .from("matches")
    .select("home_team_uuid, away_team_uuid")
    .eq("id", matchId)
    .single();

  if (!match) return [];

  const teamUuids = [match.home_team_uuid, match.away_team_uuid].filter(Boolean);
  if (teamUuids.length === 0) return [];

  const { data: players } = await supabase
    .from("players")
    .select("name, web_name")
    .in("team_id", teamUuids);

  const names: string[] = [];
  for (const p of players ?? []) {
    if (p.name) names.push(p.name);
    if (p.web_name && p.web_name !== p.name) names.push(p.web_name);
  }
  return names;
}

export async function POST(request: Request) {
  try {
    const openAIApiKey = getOpenAIApiKey();

    const formData = await request.formData();
    const audio = formData.get("audio") as Blob | null;
    const matchId = formData.get("matchId") as string | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    // ── Step 0: Fetch player names for this match ─────
    const playerNames = await getMatchPlayerNames(parseInt(matchId));

    // ── Step 1: Whisper transcription ──────────────────
    const whisperForm = new FormData();
    // Convert web Blob to a File with proper name/type for OpenAI
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const audioBlob = new Blob([audioBuffer], { type: audio.type || "audio/webm" });
    const ext = audio.type?.includes("mp4") ? "mp4" : "webm";
    whisperForm.append("file", audioBlob, `recording.${ext}`);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");

    // Pass player names as vocabulary hint to Whisper
    const whisperPrompt = playerNames.length > 0
      ? `Football match statistics: goals, assists, clean sheets, yellow cards, red cards, penalties, own goals. Player names: ${playerNames.join(", ")}.`
      : "Football match statistics: goals, assists, clean sheets, yellow cards, red cards, penalties, own goals.";
    whisperForm.append("prompt", whisperPrompt);

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Whisper error: ${err?.error?.message || whisperRes.statusText}` },
        { status: 502 }
      );
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text?.trim();

    if (!transcript) {
      return NextResponse.json({ error: "Whisper returned empty transcript" }, { status: 422 });
    }

    // ── Step 2: Feed transcript into pipeline (with player names for GPT) ─
    const result = await processTextInput(transcript, parseInt(matchId), playerNames);

    return NextResponse.json({
      ...result,
      transcript,
      whisper: {
        model: "whisper-1",
        duration: whisperData.duration || null,
      },
    });
  } catch (error: any) {
    console.error("Voice process error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
