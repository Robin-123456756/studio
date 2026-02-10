import OpenAI from "openai";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import os from "os";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

/**
 * Transcribe audio buffer using OpenAI Whisper.
 * Whisper API requires a file, so we write to a temp file first.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  const ext = mimeType.split("/")[1] || "webm";
  const tempPath = join(os.tmpdir(), `voice_${Date.now()}.${ext}`);

  try {
    writeFileSync(tempPath, audioBuffer);

    const file = new File(
      [new Uint8Array(audioBuffer)],
      `audio.${ext}`,
      { type: mimeType }
    );

    const response = await getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "en",
      response_format: "verbose_json",
      temperature: 0.0,
    });

    return {
      text: response.text,
      language: (response as any).language || "en",
      duration: (response as any).duration || 0,
    };
  } finally {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  }
}
