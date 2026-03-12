import { describe, it, expect } from "vitest";
import { generateInviteCode, normalizeInviteCode } from "./invite-code";

const VALID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CONFUSING_CHARS = ["0", "O", "1", "I", "L"];

describe("generateInviteCode", () => {
  it("returns format XXXX-XXXX", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("is 9 chars total (4 + dash + 4)", () => {
    expect(generateInviteCode()).toHaveLength(9);
  });

  it("only uses non-confusing characters", () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode().replace("-", "");
      for (const ch of code) {
        expect(VALID_CHARS).toContain(ch);
      }
      for (const bad of CONFUSING_CHARS) {
        expect(code).not.toContain(bad);
      }
    }
  });

  it("generates unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    // With 24^8 ≈ 110B combinations, 100 codes should all be unique
    expect(codes.size).toBe(100);
  });
});

describe("normalizeInviteCode", () => {
  it("uppercases lowercase input", () => {
    expect(normalizeInviteCode("abcd1234")).toBe("ABCD-1234");
  });

  it("strips whitespace", () => {
    expect(normalizeInviteCode("  ABCD1234  ")).toBe("ABCD-1234");
  });

  it("inserts dash for 8-char input without one", () => {
    expect(normalizeInviteCode("ABCD5678")).toBe("ABCD-5678");
  });

  it("preserves already-formatted code", () => {
    expect(normalizeInviteCode("ABCD-5678")).toBe("ABCD-5678");
  });

  it("strips non-alphanumeric characters", () => {
    expect(normalizeInviteCode("AB-CD-56-78")).toBe("ABCD-5678");
  });

  it("returns raw cleaned string if not 8 chars", () => {
    expect(normalizeInviteCode("ABC")).toBe("ABC");
    expect(normalizeInviteCode("ABCDEFGHIJK")).toBe("ABCDEFGHIJK");
  });

  it("handles empty string", () => {
    expect(normalizeInviteCode("")).toBe("");
  });

  it("handles mixed case with spaces and dashes", () => {
    expect(normalizeInviteCode("  ab cd - 12 34 ")).toBe("ABCD-1234");
  });
});
