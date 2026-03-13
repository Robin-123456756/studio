import { computeDenseRank } from "./rank-utils";

describe("computeDenseRank", () => {
  it("returns null for empty pool", () => {
    expect(computeDenseRank([], 50)).toBeNull();
  });

  it("ranks the top scorer as #1", () => {
    expect(computeDenseRank([100, 80, 60], 100)).toBe(1);
  });

  it("ranks tied scores with the same rank", () => {
    expect(computeDenseRank([100, 100, 80], 100)).toBe(1);
    expect(computeDenseRank([100, 100, 80], 80)).toBe(2);
  });

  it("uses dense rank (no gaps after ties)", () => {
    // [100, 100, 90, 80] → distinct [100, 90, 80]
    // 100 → rank 1, 90 → rank 2, 80 → rank 3
    const pool = [100, 100, 90, 80];
    expect(computeDenseRank(pool, 100)).toBe(1);
    expect(computeDenseRank(pool, 90)).toBe(2);
    expect(computeDenseRank(pool, 80)).toBe(3);
  });

  it("handles score below entire pool (last place + 1)", () => {
    expect(computeDenseRank([100, 80, 60], 30)).toBe(4);
  });

  it("handles score between existing scores", () => {
    // distinct [100, 80, 60] → 85 is below 100, above 80 → rank 1?
    // No: findIndex(s <= 85) → s=100 no, s=80 yes → idx 1 → rank 2
    expect(computeDenseRank([100, 80, 60], 85)).toBe(2);
  });

  it("handles single-manager pool", () => {
    expect(computeDenseRank([50], 50)).toBe(1);
    expect(computeDenseRank([50], 30)).toBe(2);
  });

  it("handles all identical scores", () => {
    expect(computeDenseRank([70, 70, 70], 70)).toBe(1);
    expect(computeDenseRank([70, 70, 70], 40)).toBe(2);
  });

  it("handles zero scores", () => {
    expect(computeDenseRank([0, 0, 0], 0)).toBe(1);
    expect(computeDenseRank([10, 0, 0], 0)).toBe(2);
  });

  it("handles negative scores (transfer deductions would not apply here, but still)", () => {
    expect(computeDenseRank([10, 5, -2], -2)).toBe(3);
    expect(computeDenseRank([10, 5, -2], -5)).toBe(4);
  });
});
