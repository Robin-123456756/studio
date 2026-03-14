"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { ArrowLeft, ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import {
  normalizePosition,
  shortName,
  getKitColor,
  groupByPosition,
  splitStartingAndBench,
  Kit,
} from "@/lib/pitch-helpers";

// ── Types ──

type ApiGameweek = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

type PlayerInfo = {
  id: string;
  name: string;
  webName?: string | null;
  position?: string | null;
  teamShort?: string | null;
  teamName?: string | null;
  isLady?: boolean | null;
  price?: number | null;
};

type PlayerStat = {
  playerId: string;
  gameweekId: number;
  points: number;
  goals: number;
  penalties: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  playerName: string;
};

type SquadPlayer = PlayerInfo & {
  gwPoints: number;
  stat: PlayerStat | null;
};

type AutoSub = { outId: string; inId: string; reason: string };

// ── Helpers ──

function pointsPlateColor(pts: number): string {
  if (pts >= 9) return "linear-gradient(180deg, #FFD700, #e6c200)";
  if (pts >= 5) return "linear-gradient(180deg, #059669, #047857)";
  if (pts >= 2) return "linear-gradient(180deg, #37003C, #2d0032)";
  return "linear-gradient(180deg, #6b7280, #555)";
}

function pointsPlateTextColor(pts: number): string {
  if (pts >= 9) return "#1a1a2e";
  return "#fff";
}

// ── Chip Banner ──

function ChipBanner({ chip }: { chip: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    bench_boost: {
      bg: "linear-gradient(135deg, #059669, #10B981)",
      text: "BENCH BOOST ACTIVE \u2014 All 17 players score",
    },
    triple_captain: {
      bg: "linear-gradient(135deg, #D97706, #F59E0B)",
      text: "TRIPLE CAPTAIN \u2014 Captain gets 3x points",
    },
    wildcard: {
      bg: "linear-gradient(135deg, #7C3AED, #A855F7)",
      text: "WILDCARD ACTIVE",
    },
    free_hit: {
      bg: "linear-gradient(135deg, #2563EB, #3B82F6)",
      text: "FREE HIT ACTIVE",
    },
  };

  const c = config[chip];
  if (!c) return null;

  return (
    <div
      style={{
        background: c.bg,
        color: "#fff",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 800,
        textAlign: "center",
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {c.text}
    </div>
  );
}

// ── Points Player Card ──

function PointsPlayerCard({
  player,
  isCaptain,
  isVice,
  isTripleCaptain,
  isActivatedVice,
  autoSubStatus,
  multiplier = 1,
  onClick,
}: {
  player: SquadPlayer;
  isCaptain: boolean;
  isVice: boolean;
  isTripleCaptain?: boolean;
  isActivatedVice?: boolean;
  autoSubStatus?: "subbed-in" | "subbed-out" | null;
  multiplier?: number;
  onClick: () => void;
}) {
  const displayName = shortName(player.name, player.webName);
  const isGK = normalizePosition(player.position) === "Goalkeeper";
  const kitColor = getKitColor(player.teamShort);
  const pts = player.gwPoints * multiplier;
  const cardW = 60;
  const sz = 42;

  return (
    <button
      type="button"
      onClick={onClick}
      className="active:scale-[0.96] transition-transform duration-150 relative"
    >
      {/* Captain / Triple Captain badge */}
      {isCaptain && (
        <span
          style={{
            position: "absolute", top: -6, left: -6, zIndex: 4,
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            color: "#000", fontSize: isTripleCaptain ? 8 : 10, fontWeight: 900,
            width: 18, height: 18, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >{isTripleCaptain ? "TC" : "C"}</span>
      )}
      {/* Vice captain badge — gold gradient when activated */}
      {isVice && (
        <span
          style={{
            position: "absolute", top: -6, left: -6, zIndex: 4,
            background: isActivatedVice
              ? "linear-gradient(135deg, #FFD700, #FFA500)"
              : "linear-gradient(135deg, #f5e6c8, #ddd0b0)",
            color: "#000", fontSize: 9, fontWeight: 900,
            width: 18, height: 18, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: isActivatedVice ? "2px solid #fff" : "2px solid #37003C",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >V</span>
      )}
      {/* Lady star badge */}
      {player.isLady && (
        <span
          style={{
            position: "absolute", top: -6, right: -6, zIndex: 4,
            background: "linear-gradient(135deg, #FF69B4, #FF1493)", color: "#fff", fontSize: 11,
            width: 18, height: 18, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >{"\u2605"}</span>
      )}

      <div
        className="flex flex-col items-center"
        style={{
          width: cardW,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        {/* Kit section */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(100,100,100,0.22) 100%)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "3px 6px 0",
            backdropFilter: "blur(2px)",
          }}
        >
          <Kit color={kitColor} isGK={isGK} size={sz} />
        </div>

        {/* Name plate */}
        <div
          style={{
            background: isCaptain
              ? "linear-gradient(135deg, #FFD700, #FFA500)"
              : isActivatedVice
                ? "linear-gradient(135deg, #FFD700, #FFA500)"
                : "#f5e6c8",
            color: "#1a1a2e",
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 4px",
            textAlign: "center",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
        </div>

        {/* Points plate */}
        <div
          style={{
            background: pointsPlateColor(pts),
            color: pointsPlateTextColor(pts),
            fontSize: 11,
            fontWeight: 800,
            padding: "2px 4px",
            textAlign: "center",
            width: "100%",
          }}
        >
          {pts} pts
        </div>
      </div>

      {/* Auto-sub pill */}
      {autoSubStatus === "subbed-in" && (
        <div
          style={{
            position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
            zIndex: 5, background: "#059669", color: "#fff",
            fontSize: 8, fontWeight: 800, padding: "1px 5px",
            borderRadius: 8, whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          {"\u2191"} IN
        </div>
      )}
      {autoSubStatus === "subbed-out" && (
        <div
          style={{
            position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
            zIndex: 5, background: "#DC2626", color: "#fff",
            fontSize: 8, fontWeight: 800, padding: "1px 5px",
            borderRadius: 8, whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          {"\u2193"} OUT
        </div>
      )}
    </button>
  );
}

// ── Auto-Subs Summary ──

function AutoSubsSummary({
  autoSubs,
  playerMap,
}: {
  autoSubs: AutoSub[];
  playerMap: Map<string, SquadPlayer>;
}) {
  if (autoSubs.length === 0) return null;

  return (
    <div
      style={{
        margin: "8px 0",
        padding: "10px 12px",
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#37003C",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Auto-Substitutions
      </div>
      {autoSubs.map((sub, i) => {
        const outPlayer = playerMap.get(sub.outId);
        const inPlayer = playerMap.get(sub.inId);
        const outName = outPlayer
          ? shortName(outPlayer.name, outPlayer.webName)
          : sub.outId;
        const inName = inPlayer
          ? shortName(inPlayer.name, inPlayer.webName)
          : sub.inId;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 0",
              fontSize: 12,
              borderTop: i > 0 ? "1px solid #f0f0f0" : undefined,
            }}
          >
            <span style={{ color: "#DC2626", fontWeight: 700 }}>{"\u2193"}</span>
            <span style={{ color: "#666", fontWeight: 600 }}>{outName}</span>
            <span style={{ color: "#aaa", fontSize: 10 }}>{"\u2192"}</span>
            <span style={{ color: "#059669", fontWeight: 700 }}>{"\u2191"}</span>
            <span style={{ color: "#333", fontWeight: 600 }}>{inName}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Points Breakdown Bottom Sheet ──

// ── Scoring rules lookup helper ──

type ScoringRulesMap = Record<string, number>;

function lookupActionPoints(
  rules: ScoringRulesMap | null,
  action: string,
  position: string | null | undefined,
  isLady: boolean | null | undefined,
  fallback: number,
): number {
  if (!rules) return fallback;
  const pos = normalizePosition(position).toUpperCase();
  const specific = rules[`${action}:${pos}`];
  const base = specific !== undefined ? specific : (rules[`${action}:ALL`] ?? fallback);
  // Lady 2x on positive actions only
  return (isLady && base > 0) ? base * 2 : base;
}

function PointsBreakdown({
  player,
  isCaptain,
  multiplier,
  captainActivated,
  scoringRules,
  onClose,
}: {
  player: SquadPlayer;
  isCaptain: boolean;
  multiplier: number;
  captainActivated: "captain" | "vice" | "none";
  scoringRules: ScoringRulesMap | null;
  onClose: () => void;
}) {
  const stat = player.stat;
  const rawPts = stat?.points ?? 0;
  const displayName = shortName(player.name, player.webName);
  const pos = player.position;
  const lady = player.isLady;

  // Determine caption label
  let captainLabel = "";
  if (isCaptain && captainActivated === "captain") {
    captainLabel = multiplier === 3 ? " \u00B7 Captain (x3)" : " \u00B7 Captain (x2)";
  } else if (isCaptain && captainActivated === "vice") {
    captainLabel = multiplier === 3
      ? " \u00B7 Vice-Captain (acting x3)"
      : " \u00B7 Vice-Captain (acting x2)";
  }

  const rows: { label: string; value: string; pts: number }[] = [];

  if (stat) {
    if (stat.goals > 0) rows.push({ label: stat.penalties > 0 ? `Goals scored (${stat.penalties}P)` : "Goals scored", value: String(stat.goals), pts: stat.goals * lookupActionPoints(scoringRules, "goal", pos, lady, 5) });
    if (stat.assists > 0) rows.push({ label: "Assists", value: String(stat.assists), pts: stat.assists * lookupActionPoints(scoringRules, "assist", pos, lady, 3) });
    if (stat.cleanSheet) rows.push({ label: "Clean sheet", value: "Yes", pts: lookupActionPoints(scoringRules, "clean_sheet", pos, lady, 4) });
    if (stat.yellowCards > 0) rows.push({ label: "Yellow cards", value: String(stat.yellowCards), pts: stat.yellowCards * lookupActionPoints(scoringRules, "yellow", pos, lady, -1) });
    if (stat.redCards > 0) rows.push({ label: "Red cards", value: String(stat.redCards), pts: stat.redCards * lookupActionPoints(scoringRules, "red", pos, lady, -3) });
    if (stat.ownGoals > 0) rows.push({ label: "Own goals", value: String(stat.ownGoals), pts: stat.ownGoals * lookupActionPoints(scoringRules, "own_goal", pos, lady, -2) });
    if ((stat as any).bonus > 0) rows.push({ label: "Bonus", value: String((stat as any).bonus), pts: (stat as any).bonus });
  }

  if (rows.length === 0 && rawPts > 0) {
    rows.push({ label: "Points", value: "--", pts: rawPts });
  }
  if (rows.length === 0 && rawPts === 0) {
    rows.push({ label: "No stats recorded", value: "--", pts: 0 });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md rounded-t-2xl bg-white animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <div className="text-base font-bold text-gray-900">{displayName}</div>
            <div className="text-xs text-gray-500">
              {player.teamShort ?? "--"} &middot; {normalizePosition(player.position)}
              {captainLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Breakdown table */}
        <div className="px-5 pb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="py-2 text-left font-semibold">Stat</th>
                <th className="py-2 text-center font-semibold">Value</th>
                <th className="py-2 text-right font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-700">{r.label}</td>
                  <td className="py-2.5 text-center text-gray-600">{r.value}</td>
                  <td className={cn(
                    "py-2.5 text-right font-semibold",
                    r.pts > 0 ? "text-emerald-600" : r.pts < 0 ? "text-red-500" : "text-gray-500"
                  )}>
                    {r.pts > 0 ? `+${r.pts}` : r.pts}
                  </td>
                </tr>
              ))}
              {/* Captain multiplier row */}
              {multiplier > 1 && rawPts > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-700">
                    {captainActivated === "vice"
                      ? `Vice-Captain (acting x${multiplier})`
                      : `Captain (x${multiplier})`}
                  </td>
                  <td className="py-2.5 text-center text-gray-600">x{multiplier}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-600">
                    +{rawPts * (multiplier - 1)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td className="py-3 font-bold text-gray-900">Total</td>
                <td />
                <td className="py-3 text-right text-lg font-extrabold text-gray-900">
                  {rawPts * multiplier}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Pitch View ──

function PointsPitch({
  squad,
  startingIds,
  captainId,
  viceId,
  multipliers,
  isTripleCaptain,
  captainActivated,
  subbedOutIds,
  subbedInIds,
  onSelectPlayer,
}: {
  squad: SquadPlayer[];
  startingIds: string[];
  captainId: string | null;
  viceId: string | null;
  multipliers: Record<string, number>;
  isTripleCaptain?: boolean;
  captainActivated?: "captain" | "vice" | "none";
  subbedOutIds?: Set<string>;
  subbedInIds?: Set<string>;
  onSelectPlayer: (player: SquadPlayer) => void;
}) {
  const normalized = squad.map((p) => ({
    ...p,
    position: normalizePosition(p.position),
  }));
  const { starting, bench } = splitStartingAndBench(normalized, startingIds);
  const g = groupByPosition(starting);

  const getAutoSubStatus = (id: string): "subbed-in" | "subbed-out" | null => {
    if (subbedInIds?.has(id)) return "subbed-in";
    if (subbedOutIds?.has(id)) return "subbed-out";
    return null;
  };

  const renderCard = (p: SquadPlayer & { position?: string | null }) => (
    <div key={p.id} className="rounded-lg p-1">
      <PointsPlayerCard
        player={p}
        isCaptain={captainId === p.id}
        isVice={viceId === p.id}
        isTripleCaptain={isTripleCaptain && captainId === p.id}
        isActivatedVice={captainActivated === "vice" && viceId === p.id}
        autoSubStatus={getAutoSubStatus(p.id)}
        multiplier={multipliers[p.id] ?? 1}
        onClick={() => onSelectPlayer(p)}
      />
    </div>
  );

  return (
    <div className="-mx-4 space-y-0 overflow-visible">
      {/* Pitch View */}
      <div
        style={{
          background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
          position: "relative",
          padding: "4px 8px 8px",
          overflow: "visible",
        }}
      >
        {/* Pitch markings */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 120, height: 120, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.35)" }} />
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 70, borderBottom: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 30, borderBottom: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 70, borderTop: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 30, borderTop: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />

        {/* Branding Bar */}
        <div style={{ display: "flex", height: 22, marginBottom: 2, marginLeft: -12, marginRight: -12 }}>
          <div
            style={{
              flex: 1,
              background: "linear-gradient(90deg, #C8102E, #8B0000)",
              display: "flex", alignItems: "center", paddingLeft: 16,
              fontSize: 11, fontWeight: 800, color: "#fff",
              textTransform: "uppercase", letterSpacing: 1,
            }}
          >
            Budo League
          </div>
          <div
            style={{
              flex: 1,
              background: "linear-gradient(90deg, #8B0000, #C8102E)",
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingRight: 16, fontSize: 11, fontWeight: 800, color: "#fff",
              textTransform: "uppercase", letterSpacing: 1,
            }}
          >
            Fantasy
          </div>
        </div>

        {/* GK Row */}
        <div style={{ position: "relative", padding: "2px 0 4px" }}>
          <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
            {g.Goalkeepers.map((p) => renderCard(p as SquadPlayer))}
          </div>
        </div>

        {/* DEF Row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "2px 4px 4px", position: "relative", zIndex: 1 }}>
          {g.Defenders.map((p) => renderCard(p as SquadPlayer))}
        </div>

        {/* MID Row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "2px 4px 4px", position: "relative", zIndex: 1 }}>
          {g.Midfielders.map((p) => renderCard(p as SquadPlayer))}
        </div>

        {/* FWD Row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "2px 4px 2px", position: "relative", zIndex: 1 }}>
          {g.Forwards.map((p) => renderCard(p as SquadPlayer))}
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div
          style={{
            background: "linear-gradient(180deg, #e0f7f0, #c8ece0)",
            padding: "8px 8px 12px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#37003C", letterSpacing: 1 }}>
              SUBSTITUTES
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4, padding: "0 4px" }}>
            {bench.map((p) => renderCard(p as SquadPlayer))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── List View ──

function PointsListView({
  squad,
  startingIds,
  captainId,
  viceId,
  multipliers,
  isTripleCaptain,
  captainActivated,
  subbedOutIds,
  subbedInIds,
  autoSubs,
  isHighestView,
  playerMap,
  onSelectPlayer,
}: {
  squad: SquadPlayer[];
  startingIds: string[];
  captainId: string | null;
  viceId: string | null;
  multipliers: Record<string, number>;
  isTripleCaptain?: boolean;
  captainActivated?: "captain" | "vice" | "none";
  subbedOutIds?: Set<string>;
  subbedInIds?: Set<string>;
  autoSubs: AutoSub[];
  isHighestView: boolean;
  playerMap: Map<string, SquadPlayer>;
  onSelectPlayer: (player: SquadPlayer) => void;
}) {
  const normalized = squad.map((p) => ({
    ...p,
    position: normalizePosition(p.position),
  }));
  const { starting, bench } = splitStartingAndBench(normalized, startingIds);
  const g = groupByPosition(starting);

  const sections = [
    { title: "Goalkeepers", players: g.Goalkeepers },
    { title: "Defenders", players: g.Defenders },
    { title: "Midfielders", players: g.Midfielders },
    { title: "Forwards", players: g.Forwards },
  ];

  const getAutoSubStatus = (id: string): "subbed-in" | "subbed-out" | null => {
    if (subbedInIds?.has(id)) return "subbed-in";
    if (subbedOutIds?.has(id)) return "subbed-out";
    return null;
  };

  const renderPlayerRow = (p: SquadPlayer & { position?: string | null }, isBench?: boolean) => {
    const displayName = shortName(p.name, p.webName);
    const isCap = captainId === p.id;
    const isVc = viceId === p.id;
    const isGK = normalizePosition(p.position) === "Goalkeeper";
    const kitColor = getKitColor(p.teamShort);
    const mult = multipliers[p.id] ?? 1;
    const pts = p.gwPoints * mult;
    const subStatus = getAutoSubStatus(p.id);
    const isActivatedVice = captainActivated === "vice" && viceId === p.id;

    return (
      <div key={p.id} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button
          type="button"
          onClick={() => onSelectPlayer(p)}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            background: subStatus === "subbed-in"
              ? "rgba(5,150,105,0.06)"
              : subStatus === "subbed-out"
                ? "rgba(220,38,38,0.06)"
                : "transparent",
            width: "100%",
            cursor: "pointer",
            border: "none",
            textAlign: "left",
          }}
        >
          {/* Info icon */}
          <div style={{
            width: 20, height: 20, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: 15,
              fontWeight: 400,
              color: "hsl(var(--muted-foreground))",
              opacity: 0.6,
              lineHeight: 1,
            }}>i</span>
          </div>

          {/* Kit */}
          <div style={{ marginLeft: 6, marginRight: 10, flexShrink: 0 }}>
            <Kit color={kitColor} isGK={isGK} size={36} />
          </div>

          {/* Player name + team */}
          <div style={{
            flex: 1, minWidth: 0,
            paddingRight: 8,
            borderRight: "1px solid hsl(var(--border))",
            marginRight: 8,
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              lineHeight: 1.3,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {displayName}
              {p.isLady && (
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: "#FF69B4", border: "1px solid #FF1493",
                  marginLeft: 3, verticalAlign: "middle",
                }} />
              )}
              {isCap && (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 16, height: 16, borderRadius: "50%",
                  background: isTripleCaptain
                    ? "linear-gradient(135deg, #C8102E, #8B0000)"
                    : "linear-gradient(135deg, #FFD700, #FFA500)",
                  color: isTripleCaptain ? "#fff" : "#000",
                  fontSize: isTripleCaptain ? 7 : 9,
                  fontWeight: 900,
                }}>{isTripleCaptain ? "TC" : "C"}</span>
              )}
              {isVc && (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 16, height: 16, borderRadius: "50%",
                  background: isActivatedVice
                    ? "linear-gradient(135deg, #FFD700, #FFA500)"
                    : "linear-gradient(135deg, #f5e6c8, #ddd0b0)",
                  border: isActivatedVice ? "none" : "1px solid hsl(var(--border))",
                  color: "#000", fontSize: 9, fontWeight: 900,
                }}>V</span>
              )}
              {/* Auto-sub indicator */}
              {subStatus === "subbed-in" && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: "#059669",
                  background: "rgba(5,150,105,0.15)", padding: "1px 4px",
                  borderRadius: 4, marginLeft: 2,
                }}>{"\u2191"} IN</span>
              )}
              {subStatus === "subbed-out" && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: "#DC2626",
                  background: "rgba(220,38,38,0.15)", padding: "1px 4px",
                  borderRadius: 4, marginLeft: 2,
                }}>{"\u2193"} OUT</span>
              )}
            </div>
            <div style={{
              fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 400,
              marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {p.teamShort ?? "--"}
            </div>
          </div>

          {/* GW Points */}
          <div style={{ width: 50, textAlign: "right", flexShrink: 0 }}>
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              color: pts > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
            }}>
              {pts}
            </span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="-mx-2 rounded-xl border bg-card overflow-hidden">
      {/* Column Headers */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          padding: "16px 16px 10px",
          borderBottom: "1px solid hsl(var(--border))",
        }}
      >
        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-foreground))", textAlign: "left" }}>
          Player
        </div>
        <div style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>
          Pts
        </div>
      </div>

      {/* Starters by position */}
      {sections.map((section) => (
        <div key={section.title}>
          {section.players.length > 0 && (
            <>
              <div style={{ padding: "16px 16px 8px", borderTop: "1px solid hsl(var(--border))" }}>
                <h2 style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "hsl(var(--foreground))",
                }}>
                  {section.title}
                </h2>
              </div>
              {section.players.map((p) => renderPlayerRow(p as SquadPlayer))}
            </>
          )}
        </div>
      ))}

      {/* Substitutes */}
      {bench.length > 0 && (
        <>
          <div style={{ padding: "16px 16px 8px", borderTop: "2px solid hsl(var(--border))" }}>
            <h2 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "hsl(var(--foreground))",
            }}>
              Substitutes
            </h2>
          </div>
          {bench.map((p) => renderPlayerRow(p as SquadPlayer, true))}
        </>
      )}

      {/* Auto-subs summary */}
      {!isHighestView && autoSubs.length > 0 && (
        <div className="px-4 pb-3">
          <AutoSubsSummary autoSubs={autoSubs} playerMap={playerMap} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

function PointsPage() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const isHighestView = viewParam === "highest";
  const isManagerView = viewParam === "manager";
  const managerUserId = searchParams.get("user_id");
  const gwIdParam = searchParams.get("gw_id");

  const [userId, setUserId] = React.useState<string | null>(null);
  const [allGWs, setAllGWs] = React.useState<ApiGameweek[]>([]);
  const [currentGwId, setCurrentGwId] = React.useState<number | null>(null);
  const [selectedGwId, setSelectedGwId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Roster data
  const [squad, setSquad] = React.useState<SquadPlayer[]>([]);
  const [startingIds, setStartingIds] = React.useState<string[]>([]);
  const [captainId, setCaptainId] = React.useState<string | null>(null);
  const [viceId, setViceId] = React.useState<string | null>(null);
  const [multipliers, setMultipliers] = React.useState<Record<string, number>>({});
  const [totalGwPoints, setTotalGwPoints] = React.useState(0);

  // Scoring engine details
  const [autoSubs, setAutoSubs] = React.useState<AutoSub[]>([]);
  const [activeChip, setActiveChip] = React.useState<string | null>(null);
  const [transferCost, setTransferCost] = React.useState(0);
  const [captainActivated, setCaptainActivated] = React.useState<"captain" | "vice" | "none">("none");
  const [captainMultiplier, setCaptainMultiplier] = React.useState(2);

  // Highest / manager view info
  const [highestUserName, setHighestUserName] = React.useState<string | null>(null);
  const [managerName, setManagerName] = React.useState<string | null>(null);

  // Header stats
  const [teamName, setTeamName] = React.useState<string | null>(null);
  const [averagePoints, setAveragePoints] = React.useState<number | null>(null);
  const [highestPoints, setHighestPoints] = React.useState<number | null>(null);
  const [gwRank, setGwRank] = React.useState<number | null>(null);
  const [totalManagers, setTotalManagers] = React.useState<number | null>(null);
  const [highestUserId, setHighestUserId] = React.useState<string | null>(null);
  const [usedTransfers, setUsedTransfers] = React.useState(0);

  // Scoring rules (loaded once for PointsBreakdown)
  const [scoringRules, setScoringRules] = React.useState<ScoringRulesMap | null>(null);

  // View tab
  const [tab, setTab] = React.useState<"pitch" | "list">("pitch");

  // Bottom sheet
  const [selectedPlayer, setSelectedPlayer] = React.useState<SquadPlayer | null>(null);

  // Backfilled GW indicator (pre-signup GWs using first squad)
  const [isBackfilled, setIsBackfilled] = React.useState(false);

  // Computed sets for auto-sub indicators
  const subbedOutIds = React.useMemo(
    () => new Set(autoSubs.map((s) => s.outId)),
    [autoSubs]
  );
  const subbedInIds = React.useMemo(
    () => new Set(autoSubs.map((s) => s.inId)),
    [autoSubs]
  );

  // Player map for auto-sub summary names
  const playerMap = React.useMemo(() => {
    const m = new Map<string, SquadPlayer>();
    for (const p of squad) m.set(p.id, p);
    return m;
  }, [squad]);

  // Get user session + scoring rules
  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user.id ?? null);
    })();
    // Load scoring rules (fire-and-forget, used for PointsBreakdown display)
    (async () => {
      try {
        const res = await fetch("/api/scoring-rules", { credentials: "same-origin" });
        const json = await res.json();
        if (res.ok && json.rules) setScoringRules(json.rules);
      } catch { /* fallback to hardcoded values */ }
    })();
  }, []);

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");

        const all: ApiGameweek[] = json.all ?? [];
        const curId = json.current?.id ?? null;

        // FPL-style: show all GWs up to and including current (0 pts if unplayed)
        const navigable = all.filter((g) => curId != null && g.id <= curId);
        setAllGWs(navigable);

        setCurrentGwId(curId);

        // Honour ?gw_id= from the URL (e.g. "Highest →" link from another GW)
        const urlGwId = gwIdParam ? Number(gwIdParam) : NaN;
        const validUrlGw = Number.isFinite(urlGwId) && navigable.some((g) => g.id === urlGwId);
        setSelectedGwId(validUrlGw ? urlGwId : curId);
      } catch (e: any) {
        setError(e?.message || "Failed to load gameweeks");
      }
    })();
  }, []);

  // Sync selectedGwId when URL ?gw_id= changes via client-side navigation.
  // The mount effect above sets it once; this handles subsequent param changes
  // without a full remount (e.g. navigating between "Highest" links for different GWs).
  // NOTE: selectedGwId is intentionally NOT in the deps — we only react to URL
  // changes, not to arrow/selector navigation. Including it would snap the user
  // back to the URL's gw_id every time they used the in-page arrows.
  React.useEffect(() => {
    if (allGWs.length === 0) return; // gameweeks not loaded yet
    const urlGwId = gwIdParam ? Number(gwIdParam) : NaN;
    if (!Number.isFinite(urlGwId)) return; // no gw_id in URL — leave as-is
    const valid = allGWs.some((g) => g.id === urlGwId);
    if (valid) setSelectedGwId(urlGwId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gwIdParam, allGWs]);

  // Load data for selected GW
  React.useEffect(() => {
    if (!userId || selectedGwId === null) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        {
          // ── All views use /api/fantasy-gw-details (one scoring source of truth) ──
          //
          // Highest view: the URL may contain a user_id from the "Highest →" link,
          // but that user_id is only valid for the GW that was showing when the link
          // was clicked. If the user navigated to a different GW via arrows/selector,
          // we must re-discover the highest scorer for the NEW GW.
          const urlGwId = gwIdParam ? Number(gwIdParam) : null;
          const gwMatchesUrl = urlGwId === selectedGwId;
          const highestTargetId =
            isHighestView && managerUserId && gwMatchesUrl
              ? managerUserId
              : null;

          let gwDetailsUrl: string;
          if (highestTargetId) {
            gwDetailsUrl = `/api/fantasy-gw-details?gw_id=${selectedGwId}&user_id=${highestTargetId}`;
          } else if (isManagerView && managerUserId) {
            gwDetailsUrl = `/api/fantasy-gw-details?gw_id=${selectedGwId}&user_id=${managerUserId}`;
          } else {
            gwDetailsUrl = `/api/fantasy-gw-details?gw_id=${selectedGwId}`;
          }
          let res = await fetch(gwDetailsUrl, { cache: "no-store" });
          let json = await res.json();
          if (!res.ok) throw new Error(json?.error || "Failed to load scoring details");

          if (cancelled) return;

          // Highest view without a known target: we fetched our own data to discover
          // the highest scorer, now re-fetch with their user_id for full details.
          if (isHighestView && !highestTargetId) {
            if (!json.highestUserId) {
              // No matches processed yet — nothing to show
              throw new Error("No scores available for this gameweek yet");
            }
            const highestUrl = `/api/fantasy-gw-details?gw_id=${selectedGwId}&user_id=${json.highestUserId}`;
            res = await fetch(highestUrl, { cache: "no-store" });
            json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to load highest scorer");
            if (cancelled) return;
          }

          const squadIds: string[] = json.squadIds ?? [];

          if (squadIds.length === 0) {
            setSquad([]); setStartingIds([]); setCaptainId(null);
            setViceId(null); setMultipliers({}); setTotalGwPoints(0);
            setAutoSubs([]); setActiveChip(null); setTransferCost(0);
            setCaptainActivated("none"); setCaptainMultiplier(2);
            setIsBackfilled(false); setTeamName(null);
            setAveragePoints(null); setHighestPoints(null);
            setGwRank(null); setTotalManagers(null);
            setHighestUserId(null); setUsedTransfers(0);
            setLoading(false);
            return;
          }

          // Build SquadPlayer list from API response
          const squadPlayers: SquadPlayer[] = (json.players ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            webName: p.webName,
            position: p.position,
            teamShort: p.teamShort,
            isLady: p.isLady,
            gwPoints: p.gwPoints ?? 0,
            stat: p.stat
              ? {
                  playerId: p.id,
                  gameweekId: json.gwId,
                  points: p.gwPoints ?? 0,
                  goals: p.stat.goals ?? 0,
                  penalties: p.stat.penalties ?? 0,
                  assists: p.stat.assists ?? 0,
                  cleanSheet: p.stat.cleanSheet ?? false,
                  yellowCards: p.stat.yellowCards ?? 0,
                  redCards: p.stat.redCards ?? 0,
                  ownGoals: p.stat.ownGoals ?? 0,
                  playerName: p.name,
                }
              : null,
          }));

          // Build multiplier map: captain gets captainMultiplier, activated vice gets it too
          const mults: Record<string, number> = {};
          const capId = json.captainId;
          const vcId = json.viceId;
          const capMult = json.captainMultiplier ?? 2;

          if (json.captainActivated === "captain" && capId) {
            mults[capId] = capMult;
          } else if (json.captainActivated === "vice" && vcId) {
            mults[vcId] = capMult;
          }

          // Use effectiveStartingIds (accounts for auto-subs)
          const effectiveIds: string[] = json.effectiveStartingIds ?? json.originalStartingIds ?? [];

          if (cancelled) return;
          setSquad(squadPlayers);
          setStartingIds(effectiveIds);
          setCaptainId(capId ?? null);
          setViceId(vcId ?? null);
          setMultipliers(mults);
          setTotalGwPoints(json.totalPoints ?? 0);
          setAutoSubs(json.autoSubs ?? []);
          setActiveChip(json.activeChip ?? null);
          setTransferCost(json.transferCost ?? 0);
          setCaptainActivated(json.captainActivated ?? "none");
          setCaptainMultiplier(capMult);
          setIsBackfilled(json.isBackfilled ?? false);
          setTeamName(json.teamName ?? null);
          setAveragePoints(json.averagePoints ?? null);
          setHighestPoints(json.highestPoints ?? null);
          setGwRank(json.gwRank ?? null);
          setTotalManagers(json.totalManagers ?? null);
          setHighestUserId(json.highestUserId ?? null);
          setUsedTransfers(json.usedTransfers ?? 0);
          if (isHighestView) {
            setHighestUserName(json.teamName ?? "Top Scorer");
          }
          if (isManagerView && json.managerTeamName) {
            setManagerName(json.managerTeamName);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // gwIdParam is read inside the loader (to check if URL user_id is stale)
    // but should NOT be a trigger — selectedGwId is the source of truth for
    // which GW to fetch. Including gwIdParam would cause a double-fetch on
    // every "Highest →" click (gwIdParam and selectedGwId update separately).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedGwId, isHighestView, isManagerView, managerUserId]);

  // GW navigation
  const canGoPrev = allGWs.length > 0 && selectedGwId !== null && allGWs[0]?.id < selectedGwId;
  const canGoNext = allGWs.length > 0 && selectedGwId !== null && allGWs[allGWs.length - 1]?.id > selectedGwId;

  const goPrev = () => {
    if (!canGoPrev || selectedGwId === null) return;
    const idx = allGWs.findIndex((g) => g.id === selectedGwId);
    if (idx > 0) setSelectedGwId(allGWs[idx - 1].id);
  };
  const goNext = () => {
    if (!canGoNext || selectedGwId === null) return;
    const idx = allGWs.findIndex((g) => g.id === selectedGwId);
    if (idx >= 0 && idx < allGWs.length - 1) setSelectedGwId(allGWs[idx + 1].id);
  };

  // Net points after transfer cost
  const netPoints = totalGwPoints - transferCost;

  // Share GW score card
  const shareGwScore = React.useCallback(async () => {
    const starters = squad.filter((p) => startingIds.includes(p.id));
    const topScorer = starters.length > 0
      ? starters.reduce((best, p) => (p.gwPoints > best.gwPoints ? p : best), starters[0])
      : null;

    const chipLabel = activeChip
      ? ` [${activeChip.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}]`
      : "";

    const lines = [
      `Budo League Fantasy - Gameweek ${selectedGwId}${chipLabel}`,
      `${"─".repeat(30)}`,
      `Score: ${totalGwPoints} pts${transferCost > 0 ? ` (${netPoints} net after -${transferCost} transfers)` : ""}`,
    ];

    if (topScorer && topScorer.gwPoints > 0) {
      const name = shortName(topScorer.name, topScorer.webName);
      lines.push(`Top player: ${name} (${topScorer.gwPoints} pts)`);
    }

    const captainPlayer = squad.find((p) => p.id === captainId);
    if (captainPlayer) {
      const cName = shortName(captainPlayer.name, captainPlayer.webName);
      const cLabel = captainMultiplier === 3 ? "Triple Captain" : "Captain";
      lines.push(`${cLabel}: ${cName} (${captainPlayer.gwPoints} pts)`);
    }

    lines.push("", "budoleague.vercel.app");

    const text = lines.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err: any) {
        // User cancelled — don't fall through to WhatsApp
        if (err?.name === "AbortError") return;
        // Real share failure — fall through to clipboard + WhatsApp
      }
    }

    // Fallback: copy to clipboard + open WhatsApp
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  }, [squad, startingIds, captainId, activeChip, selectedGwId, totalGwPoints, netPoints, transferCost, captainMultiplier]);

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-gradient-to-br from-[#062C30] via-[#0D5C63] to-[#14919B]",
            "shadow-[0_8px_30px_rgba(180,155,80,0.35)]"
          )}
        >
          <div className="p-4 text-white">
            {/* Back button + share */}
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard/fantasy"
                className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20"
                aria-label="Back to Fantasy"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex-1" />
              {!loading && squad.length > 0 && !isManagerView && (
                <button
                  type="button"
                  onClick={shareGwScore}
                  className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 active:bg-white/30 transition"
                  aria-label="Share score"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Team name — centered like FPL */}
            <div className="text-center mb-2">
              <div className="text-base font-bold">
                {isHighestView
                  ? highestUserName ?? "Top Scorer"
                  : isManagerView
                    ? managerName ?? "Manager"
                    : teamName ?? "My Team"}
              </div>
            </div>

            {/* GW selector */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev}
                className={cn(
                  "h-8 w-8 rounded-full grid place-items-center transition",
                  canGoPrev ? "bg-white/15 hover:bg-white/25 active:bg-white/30" : "opacity-30 cursor-default"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {allGWs.length > 1 ? (
                <select
                  value={selectedGwId ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setSelectedGwId(v);
                  }}
                  className="bg-white/15 text-white text-sm font-bold rounded-lg px-3 py-1.5 text-center appearance-none cursor-pointer hover:bg-white/25 transition border-0 outline-none"
                >
                  {allGWs.map((g) => (
                    <option key={g.id} value={g.id} className="text-black">
                      Gameweek {g.id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-center text-sm font-bold">
                  Gameweek {selectedGwId ?? "--"}
                </div>
              )}

              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className={cn(
                  "h-8 w-8 rounded-full grid place-items-center transition",
                  canGoNext ? "bg-white/15 hover:bg-white/25 active:bg-white/30" : "opacity-30 cursor-default"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Row 1: Average | Total Pts (gross) | Highest → — all on same basis */}
            <div className="flex items-center justify-center gap-3 pb-2">
              {/* Average */}
              <div className="flex-1 text-center">
                <div className="text-2xl font-extrabold tabular-nums">
                  {loading ? "--" : (averagePoints ?? "--")}
                </div>
                <div className="text-[11px] font-semibold text-white/60 mt-0.5">
                  Average
                </div>
              </div>

              {/* Total Pts — highlighted teal box (gross, comparable with avg/highest) */}
              <div
                className="flex-shrink-0 rounded-xl px-5 py-2 text-center"
                style={{
                  background: "linear-gradient(135deg, #0D5C63, #14919B)",
                  boxShadow: "0 4px 16px rgba(13,92,99,0.4)",
                  minWidth: 100,
                }}
              >
                <div className="text-3xl font-extrabold tabular-nums">
                  {loading ? "--" : totalGwPoints}
                </div>
                <div className="text-[11px] font-bold text-white/80 mt-0.5">
                  Total Pts
                </div>
              </div>

              {/* Highest — tappable when data exists, plain text otherwise */}
              {!loading && highestUserId ? (
                <Link
                  href={`/dashboard/fantasy/points?view=highest&gw_id=${selectedGwId}&user_id=${highestUserId}`}
                  className="flex-1 text-center group"
                >
                  <div className="text-2xl font-extrabold tabular-nums">
                    {highestPoints ?? "--"}
                  </div>
                  <div className="text-[11px] font-semibold text-white/60 mt-0.5 flex items-center justify-center gap-0.5">
                    Highest
                    <ChevronRight className="h-3 w-3 opacity-60 group-hover:opacity-100 transition" />
                  </div>
                </Link>
              ) : (
                <div className="flex-1 text-center">
                  <div className="text-2xl font-extrabold tabular-nums">
                    {loading ? "--" : (highestPoints ?? "--")}
                  </div>
                  <div className="text-[11px] font-semibold text-white/60 mt-0.5">
                    Highest
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: GW Rank | Transfers (with net after deduction) */}
            {!loading && !isHighestView && (
              <div className="flex items-center justify-between px-2 pb-3">
                {/* GW Rank */}
                <div className="text-[11px] font-semibold text-white/60">
                  {gwRank != null && totalManagers != null ? (
                    <>GW Rank: <span className="text-white font-bold">#{gwRank}</span> of {totalManagers}</>
                  ) : null}
                </div>

                {/* Transfers + net deduction */}
                <div className="text-[11px] font-semibold text-white/60">
                  {transferCost > 0 ? (
                    <>
                      {usedTransfers} transfer{usedTransfers !== 1 ? "s" : ""}
                      <span className="text-red-300 ml-1">(-{transferCost})</span>
                      <span className="text-white font-bold ml-1">{netPoints} net</span>
                    </>
                  ) : usedTransfers > 0 ? (
                    <>{usedTransfers} transfer{usedTransfers !== 1 ? "s" : ""}</>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pitch / List tabs */}
      {!loading && !error && squad.length > 0 && (
        <div className="flex items-center justify-center mt-2">
          <div className="inline-flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab("pitch")}
              className={cn(
                "px-5 py-1.5 rounded-md text-sm font-semibold transition",
                tab === "pitch" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
            >
              Pitch View
            </button>
            <button
              type="button"
              onClick={() => setTab("list")}
              className={cn(
                "px-5 py-1.5 rounded-md text-sm font-semibold transition",
                tab === "list" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
            >
              List View
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-2">
        {loading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Loading points...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-sm text-red-500">
            {error}
          </div>
        ) : squad.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-sm text-muted-foreground">
              No roster found for Gameweek {selectedGwId}
            </div>
            <Link
              href="/dashboard/fantasy/pick-team"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D5C63] px-4 py-2 text-sm font-semibold text-white"
            >
              Pick Your Team
            </Link>
          </div>
        ) : (
          <>
            {/* Chip banner — show for all views */}
            {activeChip && <ChipBanner chip={activeChip} />}

            {/* Top Team summary card (highest view enrichment) */}
            {isHighestView && squad.length > 0 && (() => {
              // Use the actual activated captain (respects vice-captain fallback)
              const effectiveCaptainId = captainActivated === "vice" ? viceId : captainId;
              const effectiveCaptainPlayer = effectiveCaptainId
                ? squad.find((p) => p.id === effectiveCaptainId)
                : null;
              const captainHaul = effectiveCaptainPlayer
                ? effectiveCaptainPlayer.gwPoints * (captainActivated !== "none" ? captainMultiplier : 1)
                : 0;
              const captainLabel = captainActivated === "vice" ? "Vice-Captain" : "Captain";

              const starters = squad.filter((p) => startingIds.includes(p.id));
              const biggestHaul = starters.length > 0
                ? starters.reduce((best, p) => (p.gwPoints > best.gwPoints ? p : best), starters[0])
                : null;
              const aboveAvg = averagePoints != null ? totalGwPoints - averagePoints : null;
              return (
                <div
                  style={{
                    margin: "0 0 2px",
                    padding: "12px 16px",
                    background: "linear-gradient(135deg, #062C30, #0D5C63)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-bold">{highestUserName ?? "Top Scorer"}</div>
                      <div className="text-[11px] text-white/60">GW {selectedGwId} Top Team</div>
                    </div>
                    {aboveAvg != null && aboveAvg > 0 && (
                      <div
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                        style={{ background: "rgba(5,150,105,0.3)", color: "#6EE7B7" }}
                      >
                        +{aboveAvg} above avg
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 text-[11px] text-white/70">
                    {effectiveCaptainPlayer && captainActivated !== "none" && (
                      <div>
                        <span className="text-white/50">{captainLabel}: </span>
                        <span className="text-white font-semibold">
                          {shortName(effectiveCaptainPlayer.name, effectiveCaptainPlayer.webName)}
                          {" "}({captainHaul} pts)
                        </span>
                      </div>
                    )}
                    {biggestHaul && biggestHaul.id !== effectiveCaptainId && biggestHaul.gwPoints > 0 && (
                      <div>
                        <span className="text-white/50">Biggest haul: </span>
                        <span className="text-white font-semibold">
                          {shortName(biggestHaul.name, biggestHaul.webName)}
                          {" "}({biggestHaul.gwPoints} pts)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Backfill banner for pre-signup GWs */}
            {isBackfilled && (
              <div
                style={{
                  background: "linear-gradient(135deg, #0D5C63, #14919B)",
                  color: "#fff",
                  padding: "10px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                Based on your first squad — points are not added to your season total
              </div>
            )}

            {/* Pitch view */}
            {tab === "pitch" && (
              <>
                <PointsPitch
                  squad={squad}
                  startingIds={startingIds}
                  captainId={captainId}
                  viceId={viceId}
                  multipliers={multipliers}
                  isTripleCaptain={activeChip === "triple_captain"}
                  captainActivated={captainActivated}
                  subbedOutIds={subbedOutIds}
                  subbedInIds={subbedInIds}
                  onSelectPlayer={setSelectedPlayer}
                />

                {/* Auto-subs summary */}
                {!isHighestView && autoSubs.length > 0 && (
                  <div className="px-4">
                    <AutoSubsSummary autoSubs={autoSubs} playerMap={playerMap} />
                  </div>
                )}
              </>
            )}

            {/* List view */}
            {tab === "list" && (
              <PointsListView
                squad={squad}
                startingIds={startingIds}
                captainId={captainId}
                viceId={viceId}
                multipliers={multipliers}
                isTripleCaptain={activeChip === "triple_captain"}
                captainActivated={captainActivated}
                subbedOutIds={subbedOutIds}
                subbedInIds={subbedInIds}
                autoSubs={autoSubs}
                isHighestView={isHighestView}
                playerMap={playerMap}
                onSelectPlayer={setSelectedPlayer}
              />
            )}
          </>
        )}
      </div>

      {/* Points Breakdown Bottom Sheet */}
      {selectedPlayer && (
        <PointsBreakdown
          player={selectedPlayer}
          isCaptain={
            (captainActivated === "captain" && captainId === selectedPlayer.id) ||
            (captainActivated === "vice" && viceId === selectedPlayer.id)
          }
          multiplier={
            (() => {
              if (captainActivated === "captain" && captainId === selectedPlayer.id) return captainMultiplier;
              if (captainActivated === "vice" && viceId === selectedPlayer.id) return captainMultiplier;
              return 1;
            })()
          }
          captainActivated={captainActivated}
          scoringRules={scoringRules}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

// ── Auth Wrapper ──

export default function PointsRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return (
    <React.Suspense fallback={<div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">Loading...</div>}>
      <PointsPage />
    </React.Suspense>
  );
}
