"use client";

import * as React from "react";

// =====================
// SHARED TYPES
// =====================
export type PitchPlayer = {
  id: string;
  name: string;
  webName?: string | null;
  position?: string | null;
  teamName?: string | null;
  teamShort?: string | null;
  avatarUrl?: string | null;
  price?: number | null;
  points?: number | null;
  isLady?: boolean;
  nextOpponent?: string | null;
};

// =====================
// CONSTANTS
// =====================
export const BUDGET_TOTAL = 100; // UGX 100m

export const TEAM_LOGOS: Record<string, string> = {
  accumulators: "/logos/t-accumulators.png",
  basunzi: "/logos/t-basunzi.png",
  bifa: "/logos/t-bifa.png",
  trotballo: "/logos/t-trotballo.png",
  dujay: "/logos/t-dujay.png",
  "night prep": "/logos/t-night-prep.png",
  "peaky blinders": "/logos/t-peaky-blinders.png",
  komunoballo: "/logos/t-komunoballo.png",
  masappe: "/logos/t-masappe.png",
  "midnight express": "/logos/t-midnight-express.png",
  centurions: "/logos/t-centurions.png",
  jubilewos: "/logos/t-jubilewos.png",
  endgame: "/logos/t-endgame.png",
  abachuba: "/logos/t-abachuba.png",
  abacuba: "/logos/t-abachuba.png",
  thazobalo: "/logos/t-thazobalo.png",
  thazoballo: "/logos/t-thazobalo.png",
  quadballo: "/logos/t-quadballo.png",
};

export const TEAM_SHORT_LOGOS: Record<string, string> = {
  ACC: "/logos/t-accumulators.png",
  BAS: "/logos/t-basunzi.png",
  BIF: "/logos/t-bifa.png",
  TRO: "/logos/t-trotballo.png",
  DUJ: "/logos/t-dujay.png",
  NIG: "/logos/t-night-prep.png",
  PEA: "/logos/t-peaky-blinders.png",
  KOM: "/logos/t-komunoballo.png",
  MAS: "/logos/t-masappe.png",
  MID: "/logos/t-midnight-express.png",
  CEN: "/logos/t-centurions.png",
  JUB: "/logos/t-jubilewos.png",
  END: "/logos/t-endgame.png",
  ABA: "/logos/t-abachuba.png",
  THA: "/logos/t-thazobalo.png",
  QUA: "/logos/t-quadballo.png",
};

export const TEAM_KIT_COLORS: Record<string, string> = {
  ACC: "#DB0007",
  BAS: "#034694",
  BIF: "#FF7B00",
  TRO: "#00B140",
  DUJ: "#7B2D8E",
  NIG: "#2D2D2D",
  PEA: "#132257",
  KOM: "#FDBE11",
  MAS: "#EF0107",
  MID: "#003399",
  CEN: "#00A650",
  JUB: "#FF5722",
  END: "#C8102E",
  ABA: "#1EB980",
  THA: "#A855F7",
  QUA: "#06B6D4",
};

// =====================
// UTILITY FUNCTIONS
// =====================
export function normalizePosition(pos?: string | null) {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "defender" || p === "df") return "Defender";
  if (p === "mid" || p === "midfielder" || p === "mf") return "Midfielder";
  if (p === "fwd" || p === "forward" || p === "fw" || p === "striker") return "Forward";
  return (pos ?? "Midfielder") as string;
}

export function shortPos(pos?: string | null) {
  const p = normalizePosition(pos);
  if (p === "Goalkeeper") return "GK";
  if (p === "Defender") return "DEF";
  if (p === "Midfielder") return "MID";
  if (p === "Forward") return "FWD";
  return "--";
}

export function shortName(name?: string | null, webName?: string | null) {
  if (webName && webName.trim().length > 0) return webName.trim();
  const raw = (name ?? "").trim();
  if (!raw) return "--";
  const parts = raw.split(" ").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : raw;
}

export function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

export function getTeamLogo(teamName?: string | null, teamShort?: string | null) {
  const short = (teamShort ?? "").trim().toUpperCase();
  if (short && TEAM_SHORT_LOGOS[short]) return TEAM_SHORT_LOGOS[short];

  const nameKey = (teamName ?? "").trim().toLowerCase();
  if (nameKey && TEAM_LOGOS[nameKey]) return TEAM_LOGOS[nameKey];

  return null;
}

export function getKitColor(teamShort?: string | null): string {
  if (!teamShort) return "#666666";
  return TEAM_KIT_COLORS[teamShort.toUpperCase()] || "#666666";
}

export function groupByPosition<T extends { position?: string | null }>(players: T[]) {
  return {
    Goalkeepers: players.filter((p) => p.position === "Goalkeeper"),
    Defenders: players.filter((p) => p.position === "Defender"),
    Midfielders: players.filter((p) => p.position === "Midfielder"),
    Forwards: players.filter((p) => p.position === "Forward"),
  };
}

export function splitStartingAndBench<T extends { id: string }>(players: T[], startingIds: string[]) {
  const startingSet = new Set(startingIds);
  const starting = players.filter((p) => startingSet.has(p.id));
  const bench = players.filter((p) => !startingSet.has(p.id));
  return { starting, bench };
}

// =====================
// SVG KIT COMPONENT
// =====================
export function Kit({ color = "#EF0107", isGK = false, size = 56 }: { color?: string; isGK?: boolean; size?: number }) {
  const id = React.useId();
  if (isGK) {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
        <defs>
          <linearGradient id={`${id}-gk`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="50%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <rect x="10" y="8" width="40" height="36" rx="4" fill={`url(#${id}-gk)`} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        <rect x="4" y="8" width="12" height="20" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <rect x="44" y="8" width="12" height="20" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <rect x="18" y="40" width="24" height="16" rx="2" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
        <path d="M25 8 Q30 12 35 8" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
        <line x1="10" y1="20" x2="50" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        <rect x="22" y="22" width="16" height="10" rx="1" fill="rgba(255,255,255,0.25)" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
      <defs>
        <linearGradient id={`${id}-out`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="30%" stopColor={color} />
          <stop offset="50%" stopColor="rgba(255,255,255,0.15)" stopOpacity="0.3" />
          <stop offset="70%" stopColor={color} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <rect x="12" y="10" width="36" height="30" rx="4" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
      <rect x="12" y="10" width="36" height="30" rx="4" fill={`url(#${id}-out)`} />
      <rect x="4" y="10" width="14" height="18" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
      <rect x="42" y="10" width="14" height="18" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
      <rect x="18" y="38" width="24" height="16" rx="2" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
      <path d="M25 10 Q30 14 35 10" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" />
      <line x1="12" y1="22" x2="48" y2="22" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
    </svg>
  );
}

// =====================
// EMPTY SLOT COMPONENT
// =====================
export function EmptySlot({ position, small = false }: { position: string; small?: boolean }) {
  const isGK = position === "GK";
  const sz = small ? 48 : 56;
  const ghostColor = isGK ? "#8B7355" : "#4a4a5a";

  return (
    <div className="flex flex-col items-center" style={{ minWidth: small ? 64 : 72 }}>
      <div className="relative" style={{ opacity: 0.85 }}>
        <Kit color={ghostColor} isGK={isGK} size={sz} />
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00ff87, #04f5ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,255,135,0.6)",
            border: "2px solid #fff",
          }}
        >
          <span style={{ color: "#000", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>+</span>
        </div>
      </div>
      <div
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,240,0.9))",
          color: "#666",
          fontSize: small ? 10 : 11,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: "4px 4px 0 0",
          marginTop: -4,
          textAlign: "center",
          minWidth: small ? 62 : 72,
          boxShadow: "0 -1px 3px rgba(0,0,0,0.1)",
        }}
      >
        {position}
      </div>
      <div
        style={{
          background: "linear-gradient(180deg, #555, #444)",
          color: "#ccc",
          fontSize: small ? 9 : 10,
          fontWeight: 600,
          padding: "2px 10px",
          borderRadius: "0 0 4px 4px",
          textAlign: "center",
          minWidth: small ? 62 : 72,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        ---
      </div>
    </div>
  );
}
