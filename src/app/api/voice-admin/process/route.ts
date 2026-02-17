import { NextResponse } from "next/server";
import { processTextInput } from "@/lib/voice-admin/pipeline";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as Blob | null;
    const matchId = formData.get("matchId") as string | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    // ── Step 1: Whisper transcription ──────────────────
    const whisperForm = new FormData();
    // Convert web Blob to a File with proper name/type for OpenAI
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const audioBlob = new Blob([audioBuffer], { type: audio.type || "audio/webm" });
    const ext = audio.type?.includes("mp4") ? "mp4" : "webm";
    whisperForm.append("file", audioBlob, `recording.${ext}`);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

    // ── Step 2: Feed transcript into existing pipeline ─
    const result = await processTextInput(transcript, parseInt(matchId));

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