/**
 * Audio transcription stub.
 * Use browser-side Web Speech API for transcription,
 * then send text to processTextInput() instead.
 */

interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

export async function transcribeAudio(
  _audioBuffer: Buffer,
  _mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  throw new Error(
    "Server-side audio transcription is not configured. " +
    "Use the /api/voice-admin/process-text endpoint with browser-side speech recognition instead."
  );
}
