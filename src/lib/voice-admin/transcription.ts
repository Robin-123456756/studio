import OpenAI, { toFile } from "openai";

// Lazy init — avoid crashing at build time when env var is missing
let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

/**
 * Transcribe audio buffer using OpenAI Whisper.
 *
 * Cost: ~$0.006 per minute of audio
 * Max file size: 25MB
 * Supported formats: webm, mp3, mp4, mpeg, mpga, m4a, wav, flac, ogg
 *
 * We use `toFile()` from the OpenAI SDK to convert the Buffer
 * directly into a File-like object — no temp files needed.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  // Map mime type to file extension
  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/wav": "wav",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };

  const ext = extMap[mimeType] || "webm";
  const filename = `recording.${ext}`;

  // Convert Buffer to a File-like object using the SDK helper
  const file = await toFile(audioBuffer, filename, { type: mimeType });

  const response = await getOpenAI().audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "en",
    response_format: "verbose_json",
    temperature: 0.0,
    // Prompt helps Whisper with domain-specific vocabulary
    prompt:
      "Football match statistics: goals, assists, clean sheets, yellow cards, red cards, penalties, own goals. " +
      "Premier League player names: Haaland, Salah, Saka, Palmer, Watkins, Son, Bruno Fernandes, Raya, Foden, Rice.",
  });

  return {
    text: response.text,
    language: (response as any).language || "en",
    duration: (response as any).duration || 0,
  };
}