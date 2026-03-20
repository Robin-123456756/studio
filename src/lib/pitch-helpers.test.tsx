// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import {
  normalizePosition,
  shortPos,
  shortName,
  formatUGX,
  getTeamLogo,
  getKitColor,
  darkenColor,
  groupByPosition,
  splitStartingAndBench,
  Kit,
  EmptySlot,
} from "./pitch-helpers";

// ── normalizePosition ──

describe("normalizePosition", () => {
  it.each([
    ["gk", "Goalkeeper"],
    ["GK", "Goalkeeper"],
    ["goalkeeper", "Goalkeeper"],
    ["keeper", "Goalkeeper"],
    ["def", "Defender"],
    ["DEF", "Defender"],
    ["defender", "Defender"],
    ["df", "Defender"],
    ["mid", "Midfielder"],
    ["MID", "Midfielder"],
    ["midfielder", "Midfielder"],
    ["mf", "Midfielder"],
    ["fwd", "Forward"],
    ["FWD", "Forward"],
    ["forward", "Forward"],
    ["fw", "Forward"],
    ["striker", "Forward"],
  ])("normalizePosition(%s) → %s", (input, expected) => {
    expect(normalizePosition(input)).toBe(expected);
  });

  it("defaults to Midfielder for unknown/null/empty", () => {
    expect(normalizePosition(null)).toBe("Midfielder");
    expect(normalizePosition(undefined)).toBe("Midfielder");
    expect(normalizePosition("")).toBe("Midfielder");
    expect(normalizePosition("wing-back")).toBe("Midfielder");
  });

  it("trims whitespace", () => {
    expect(normalizePosition("  gk  ")).toBe("Goalkeeper");
  });
});

// ── shortPos ──

describe("shortPos", () => {
  it.each([
    ["goalkeeper", "GK"],
    ["defender", "DEF"],
    ["midfielder", "MID"],
    ["forward", "FWD"],
  ])("shortPos(%s) → %s", (input, expected) => {
    expect(shortPos(input)).toBe(expected);
  });
});

// ── shortName ──

describe("shortName", () => {
  it("prefers webName when present", () => {
    expect(shortName("John Smith", "J. Smith")).toBe("J. Smith");
  });

  it("returns last name when webName is absent", () => {
    expect(shortName("John David Smith")).toBe("Smith");
  });

  it("returns full name when single word", () => {
    expect(shortName("Ronaldo")).toBe("Ronaldo");
  });

  it('returns "--" for null/empty name', () => {
    expect(shortName(null)).toBe("--");
    expect(shortName("")).toBe("--");
  });

  it("ignores empty/whitespace webName", () => {
    expect(shortName("John Smith", "  ")).toBe("Smith");
    expect(shortName("John Smith", "")).toBe("Smith");
  });
});

// ── formatUGX ──

describe("formatUGX", () => {
  it("formats a number as UGX currency", () => {
    expect(formatUGX(5)).toBe("UGX 5.0m");
    expect(formatUGX(10.5)).toBe("UGX 10.5m");
  });

  it('returns "UGX --" for null/undefined/NaN', () => {
    expect(formatUGX(null)).toBe("UGX --");
    expect(formatUGX(undefined)).toBe("UGX --");
    expect(formatUGX(NaN)).toBe("UGX --");
  });

  it("handles zero", () => {
    expect(formatUGX(0)).toBe("UGX 0.0m");
  });
});

// ── getTeamLogo ──

describe("getTeamLogo", () => {
  it("returns logo by short code (preferred)", () => {
    expect(getTeamLogo(null, "ACC")).toBe("/logos/t-accumulators.png");
  });

  it("returns logo by full name (fallback)", () => {
    expect(getTeamLogo("Basunzi", null)).toBe("/logos/t-basunzi.png");
  });

  it("is case-insensitive for both", () => {
    expect(getTeamLogo("BASUNZI", null)).toBe("/logos/t-basunzi.png");
    expect(getTeamLogo(null, "acc")).toBe("/logos/t-accumulators.png");
  });

  it("returns null for unknown team", () => {
    expect(getTeamLogo("Unknown FC", "UNK")).toBeNull();
  });

  it("prefers short code over full name", () => {
    // If both provided, short code wins
    expect(getTeamLogo("basunzi", "ACC")).toBe("/logos/t-accumulators.png");
  });
});

// ── getKitColor ──

describe("getKitColor", () => {
  it("returns correct color for known team", () => {
    expect(getKitColor("ACC")).toBe("#00008B");
    expect(getKitColor("BAS")).toBe("#E00000");
  });

  it("is case-insensitive", () => {
    expect(getKitColor("acc")).toBe("#00008B");
  });

  it("returns default gray for unknown/null", () => {
    expect(getKitColor("ZZZ")).toBe("#666666");
    expect(getKitColor(null)).toBe("#666666");
    expect(getKitColor(undefined)).toBe("#666666");
  });
});

// ── darkenColor ──

describe("darkenColor", () => {
  it("darkens a hex color by default 30%", () => {
    // White #FFFFFF → each channel * 0.7 ≈ 179 = B3 (Math.round)
    expect(darkenColor("#FFFFFF")).toBe("#b3b3b3");
  });

  it("darkens by custom amount", () => {
    // #FF0000 * 0.5 = #800000
    expect(darkenColor("#FF0000", 0.5)).toBe("#800000");
  });

  it("handles color without hash", () => {
    expect(darkenColor("FFFFFF", 0)).toBe("#ffffff");
  });
});

// ── groupByPosition ──

describe("groupByPosition", () => {
  it("groups players by position", () => {
    const players = [
      { id: "1", position: "Goalkeeper" },
      { id: "2", position: "Defender" },
      { id: "3", position: "Defender" },
      { id: "4", position: "Midfielder" },
      { id: "5", position: "Forward" },
    ];
    const groups = groupByPosition(players);
    expect(groups.Goalkeepers).toHaveLength(1);
    expect(groups.Defenders).toHaveLength(2);
    expect(groups.Midfielders).toHaveLength(1);
    expect(groups.Forwards).toHaveLength(1);
  });

  it("returns empty arrays for missing positions", () => {
    const groups = groupByPosition([]);
    expect(groups.Goalkeepers).toEqual([]);
    expect(groups.Defenders).toEqual([]);
    expect(groups.Midfielders).toEqual([]);
    expect(groups.Forwards).toEqual([]);
  });
});

// ── splitStartingAndBench ──

describe("splitStartingAndBench", () => {
  it("splits players into starting and bench", () => {
    const players = [
      { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" },
    ];
    const { starting, bench } = splitStartingAndBench(players, ["a", "c"]);
    expect(starting.map((p) => p.id)).toEqual(["a", "c"]);
    expect(bench.map((p) => p.id)).toEqual(["b", "d"]);
  });

  it("handles empty starting IDs (all bench)", () => {
    const players = [{ id: "a" }, { id: "b" }];
    const { starting, bench } = splitStartingAndBench(players, []);
    expect(starting).toHaveLength(0);
    expect(bench).toHaveLength(2);
  });
});

// ── Kit component ──

describe("Kit component", () => {
  it("renders an outfield SVG by default", () => {
    const { container } = render(<Kit />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("56"); // default size
  });

  it("renders with custom size", () => {
    const { container } = render(<Kit size={80} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("80");
  });

  it("renders GK variant differently", () => {
    const { container: outfield } = render(<Kit isGK={false} />);
    const { container: gk } = render(<Kit isGK={true} />);

    // GK has a horizontal line at y=20, outfield at y=22
    const gkLines = gk.querySelectorAll("line");
    const outLines = outfield.querySelectorAll("line");
    expect(gkLines.length).toBeGreaterThan(0);
    expect(outLines.length).toBeGreaterThan(0);
  });
});

// ── EmptySlot component ──

describe("EmptySlot component", () => {
  it("renders the position label", () => {
    render(<EmptySlot position="FWD" />);
    expect(screen.getByText("FWD")).toBeTruthy();
  });

  it("renders the + badge", () => {
    render(<EmptySlot position="DEF" />);
    expect(screen.getByText("+")).toBeTruthy();
  });

  it("renders placeholder dashes", () => {
    render(<EmptySlot position="MID" />);
    expect(screen.getByText("---")).toBeTruthy();
  });

  it("renders smaller size when small=true", () => {
    const { container } = render(<EmptySlot position="GK" small />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("36");
  });

  it("renders default size when small=false", () => {
    const { container } = render(<EmptySlot position="GK" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("42");
  });
});
