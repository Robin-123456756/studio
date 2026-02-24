"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
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

// ── Points Player Card ──

function PointsPlayerCard({
  player,
  isCaptain,
  isVice,
  onClick,
}: {
  player: SquadPlayer;
  isCaptain: boolean;
  isVice: boolean;
  onClick: () => void;
}) {
  const displayName = shortName(player.name, player.webName);
  const isGK = normalizePosition(player.position) === "Goalkeeper";
  const kitColor = getKitColor(player.teamShort);
  const pts = player.gwPoints;
  const cardW = 60;
  const sz = 42;

  return (
    <button
      type="button"
      onClick={onClick}
      className="active:scale-[0.96] transition-transform duration-150 relative"
    >
      {/* Captain badge */}
      {isCaptain && (
        <span
          style={{
            position: "absolute", top: -6, left: -6, zIndex: 4,
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            color: "#000", fontSize: 10, fontWeight: 900,
            width: 18, height: 18, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >C</span>
      )}
      {/* Vice captain badge */}
      {isVice && (
        <span
          style={{
            position: "absolute", top: -6, left: -6, zIndex: 4,
            background: "linear-gradient(135deg, #f5e6c8, #ddd0b0)", color: "#000", fontSize: 9, fontWeight: 900,
            width: 18, height: 18, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #37003C",
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
        >★</span>
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

        {/* Points plate (replaces fixture plate) */}
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
    </button>
  );
}

// ── Points Breakdown Bottom Sheet ──

function PointsBreakdown({
  player,
  isCaptain,
  multiplier,
  onClose,
}: {
  player: SquadPlayer;
  isCaptain: boolean;
  multiplier: number;
  onClose: () => void;
}) {
  const stat = player.stat;
  const rawPts = stat?.points ?? 0;
  const displayName = shortName(player.name, player.webName);

  const rows: { label: string; value: string; pts: number }[] = [];

  if (stat) {
    if (stat.goals > 0) rows.push({ label: "Goals scored", value: String(stat.goals), pts: stat.goals * 5 });
    if (stat.assists > 0) rows.push({ label: "Assists", value: String(stat.assists), pts: stat.assists * 3 });
    if (stat.cleanSheet) rows.push({ label: "Clean sheet", value: "Yes", pts: 4 });
    if (stat.yellowCards > 0) rows.push({ label: "Yellow cards", value: String(stat.yellowCards), pts: stat.yellowCards * -1 });
    if (stat.redCards > 0) rows.push({ label: "Red cards", value: String(stat.redCards), pts: stat.redCards * -3 });
    if (stat.ownGoals > 0) rows.push({ label: "Own goals", value: String(stat.ownGoals), pts: stat.ownGoals * -2 });
  }

  // If there are no breakdown rows but points exist, show a generic row
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
              {isCaptain && " \u00B7 Captain (x2)"}
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
                  <td className="py-2.5 text-gray-700">Captain (x{multiplier})</td>
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
  onSelectPlayer,
}: {
  squad: SquadPlayer[];
  startingIds: string[];
  captainId: string | null;
  viceId: string | null;
  multipliers: Record<string, number>;
  onSelectPlayer: (player: SquadPlayer) => void;
}) {
  const normalized = squad.map((p) => ({
    ...p,
    position: normalizePosition(p.position),
  }));
  const { starting, bench } = splitStartingAndBench(normalized, startingIds);
  const g = groupByPosition(starting);

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
        {/* Goal line - top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
        {/* Goal line - bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
        {/* Sideline - left */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
        {/* Sideline - right */}
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
        {/* Center circle */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 120, height: 120, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)" }} />
        {/* Center spot */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
        {/* Halfway line */}
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.35)" }} />
        {/* Penalty area top */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 70, borderBottom: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
        {/* Goal area top */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 30, borderBottom: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
        {/* Penalty area bottom */}
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 70, borderTop: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
        {/* Goal area bottom */}
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
            {g.Goalkeepers.map((p) => (
              <div key={p.id} className="rounded-lg p-1">
                <PointsPlayerCard
                  player={p as SquadPlayer}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                  onClick={() => onSelectPlayer(p as SquadPlayer)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* DEF Row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "2px 4px 4px", position: "relative", zIndex: 1 }}>
          {g.Defenders.map((p) => (
            <div key={p.id} className="rounded-lg p-1">
              <PointsPlayerCard
                player={p as SquadPlayer}
                isCaptain={captainId === p.id}
                isVice={viceId === p.id}
                onClick={() => onSelectPlayer(p as SquadPlayer)}
              />
            </div>
          ))}
        </div>

        {/* MID Row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "2px 4px 4px", position: "relative", zIndex: 1 }}>
          {g.Midfielders.map((p) => (
            <div key={p.id} className="rounded-lg p-1">
              <PointsPlayerCard
                player={p as SquadPlayer}
                isCaptain={captainId === p.id}
                isVice={viceId === p.id}
                onClick={() => onSelectPlayer(p as SquadPlayer)}
              />
            </div>
          ))}
        </div>

        {/* FWD Row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "2px 4px 2px", position: "relative", zIndex: 1 }}>
          {g.Forwards.map((p) => (
            <div key={p.id} className="rounded-lg p-1">
              <PointsPlayerCard
                player={p as SquadPlayer}
                isCaptain={captainId === p.id}
                isVice={viceId === p.id}
                onClick={() => onSelectPlayer(p as SquadPlayer)}
              />
            </div>
          ))}
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
            {bench.map((p) => (
              <div key={p.id} className="rounded-lg p-0.5">
                <PointsPlayerCard
                  player={p as SquadPlayer}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                  onClick={() => onSelectPlayer(p as SquadPlayer)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

function PointsPage() {
  const searchParams = useSearchParams();
  const isHighestView = searchParams.get("view") === "highest";

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

  // Highest view info
  const [highestUserName, setHighestUserName] = React.useState<string | null>(null);

  // Bottom sheet
  const [selectedPlayer, setSelectedPlayer] = React.useState<SquadPlayer | null>(null);

  // Get user session
  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user.id ?? null);
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
        setAllGWs(all);

        const curId = json.current?.id ?? null;
        setCurrentGwId(curId);
        setSelectedGwId(curId);
      } catch (e: any) {
        setError(e?.message || "Failed to load gameweeks");
      }
    })();
  }, []);

  // Load roster + stats for selected GW
  React.useEffect(() => {
    if (!userId || selectedGwId === null) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch roster — for highest view, use dedicated API that computes top scorer
        let rosterJson: any;

        if (isHighestView) {
          const highestRes = await fetch(
            `/api/rosters/highest?gw_id=${selectedGwId}`,
            { cache: "no-store" }
          );
          rosterJson = await highestRes.json();
          if (!highestRes.ok) throw new Error(rosterJson?.error || "No rosters found");
          setHighestUserName(rosterJson.teamName ?? "Top Scorer");
          // API may have fallen back to an earlier GW — sync the header
          if (rosterJson.gwId && rosterJson.gwId !== selectedGwId) {
            setSelectedGwId(rosterJson.gwId);
            return; // will re-trigger this effect with the correct GW
          }
        } else {
          const rosterRes = await fetch(
            `/api/rosters/current?user_id=${userId}&gw_id=${selectedGwId}`,
            { cache: "no-store" }
          );
          rosterJson = await rosterRes.json();
          if (!rosterRes.ok) throw new Error(rosterJson?.error || "Failed to load roster");
        }

        if (cancelled) return;

        const squadIds: string[] = rosterJson?.squadIds ?? [];
        const sIds: string[] = rosterJson?.startingIds?.length > 0
          ? rosterJson.startingIds
          : squadIds;
        const capId: string | null = rosterJson?.captainId ?? null;
        const vcId: string | null = rosterJson?.viceId ?? null;
        const mults: Record<string, number> = rosterJson?.multiplierByPlayer ?? {};

        if (squadIds.length === 0) {
          setSquad([]);
          setStartingIds([]);
          setCaptainId(null);
          setViceId(null);
          setMultipliers({});
          setTotalGwPoints(0);
          setLoading(false);
          return;
        }

        // 2. Fetch player info + stats in parallel
        const [playersRes, statsRes] = await Promise.all([
          fetch(`/api/players?ids=${squadIds.join(",")}`, { cache: "no-store" }),
          fetch(`/api/player-stats?gw_id=${selectedGwId}`, { cache: "no-store" }),
        ]);

        const playersJson = await playersRes.json();
        const statsJson = await statsRes.json();

        if (cancelled) return;

        if (!playersRes.ok) throw new Error(playersJson?.error || "Failed to load players");

        const players: PlayerInfo[] = (playersJson.players ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          webName: p.webName,
          position: p.position,
          teamShort: p.teamShort,
          teamName: p.teamName,
          isLady: p.isLady,
          price: p.price,
        }));

        // Build stats map: playerId → merged stat for this GW
        const statsMap = new Map<string, PlayerStat>();
        for (const s of statsJson.stats ?? []) {
          const pid = String(s.playerId);
          const existing = statsMap.get(pid);
          if (existing) {
            // Merge multiple stat rows for same player+GW
            existing.points += s.points ?? 0;
            existing.goals += s.goals ?? 0;
            existing.assists += s.assists ?? 0;
            existing.cleanSheet = existing.cleanSheet || s.cleanSheet;
            existing.yellowCards += s.yellowCards ?? 0;
            existing.redCards += s.redCards ?? 0;
            existing.ownGoals += s.ownGoals ?? 0;
          } else {
            statsMap.set(pid, {
              playerId: pid,
              gameweekId: s.gameweekId,
              points: s.points ?? 0,
              goals: s.goals ?? 0,
              assists: s.assists ?? 0,
              cleanSheet: s.cleanSheet ?? false,
              yellowCards: s.yellowCards ?? 0,
              redCards: s.redCards ?? 0,
              ownGoals: s.ownGoals ?? 0,
              playerName: s.playerName ?? "",
            });
          }
        }

        // 3. Combine into SquadPlayer list
        const squadPlayers: SquadPlayer[] = players
          .filter((p) => squadIds.includes(p.id))
          .map((p) => {
            const stat = statsMap.get(p.id) ?? null;
            return {
              ...p,
              gwPoints: stat?.points ?? 0,
              stat,
            };
          });

        // 4. Compute total GW points (starting XI only, with multipliers)
        let total = 0;
        for (const id of sIds) {
          const p = squadPlayers.find((sp) => sp.id === id);
          if (!p) continue;
          const mult = Number(mults[id] ?? (id === capId ? 2 : 1));
          const m = Number.isFinite(mult) && mult > 0 ? mult : 1;
          total += p.gwPoints * m;
        }

        if (cancelled) return;

        setSquad(squadPlayers);
        setStartingIds(sIds);
        setCaptainId(capId);
        setViceId(vcId);
        setMultipliers(mults);
        setTotalGwPoints(total);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, selectedGwId, isHighestView]);

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

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-[#0D5C63]",
            "shadow-[0_8px_30px_rgba(180,155,80,0.35)]"
          )}
        >
          <div className="p-4 text-white">
            {/* Back button + title */}
            <div className="flex items-center gap-3 mb-4">
              <Link
                href="/dashboard/fantasy"
                className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20"
                aria-label="Back to Fantasy"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="text-sm font-semibold text-white/80">
                {isHighestView
                  ? `Highest Score${highestUserName ? ` - ${highestUserName}` : ""}`
                  : "Points"}
              </div>
            </div>

            {/* GW selector */}
            <div className="flex items-center justify-center gap-4 mb-2">
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

              <div className="text-center text-sm font-bold">
                Gameweek {selectedGwId ?? "--"}
              </div>

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

            {/* Total points */}
            <div className="text-center pb-3">
              <div className="text-4xl font-extrabold tabular-nums">
                {loading ? "--" : totalGwPoints}
              </div>
              <div className="mt-1 text-xs font-semibold text-white/70">
                GW Points
              </div>
            </div>
          </div>
        </div>
      </div>

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
          <PointsPitch
            squad={squad}
            startingIds={startingIds}
            captainId={captainId}
            viceId={viceId}
            multipliers={multipliers}
            onSelectPlayer={setSelectedPlayer}
          />
        )}
      </div>

      {/* Points Breakdown Bottom Sheet */}
      {selectedPlayer && (
        <PointsBreakdown
          player={selectedPlayer}
          isCaptain={captainId === selectedPlayer.id}
          multiplier={
            Number(multipliers[selectedPlayer.id] ?? (captainId === selectedPlayer.id ? 2 : 1))
          }
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
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthed(!!data.user);
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
