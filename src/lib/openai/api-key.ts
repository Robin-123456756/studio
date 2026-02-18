const INVALID_KEY_MESSAGE =
  "Invalid OPENAI_API_KEY. Ensure it is a single key value (no spaces, no extra env assignments).";

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (/\s/.test(key) || key.includes("NEXTAUTH_SECRET=")) {
    throw new Error(INVALID_KEY_MESSAGE);
  }

  return key;
}
