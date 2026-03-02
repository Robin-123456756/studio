// Uppercase alphanumeric without confusing chars (0/O, 1/I/L)
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Normalize user input: strip whitespace, uppercase, ensure dash */
export function normalizeInviteCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return cleaned;
}
