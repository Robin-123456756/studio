"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveSquadIds, loadSquadIds, loadIds, LS_STARTING } from "@/lib/fantasyStorage";
import { type Player } from "./player-card";
import { TransferBadge } from "./transfer-badge";
import { TransferLogItemComponent } from "./transfer-log-item";
import { useTransfers } from "./use-transfers";
import { ArrowLeft, MoreVertical, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BUDGET_TOTAL,
  normalizePosition,
  shortName,
  getKitColor,
  groupByPosition,
  splitStartingAndBench,
  Kit,
  EmptySlot,
} from "@/lib/pitch-helpers";

// =====================
// TYPES
// =====================
type ApiGameweek = {
  id: number;
  name: string | null;
  deadline_time: string | null;
  finalized?: boolean | null;
  is_current?: boolean | null;
};

type ApiPlayer = {
  id: string;
  name: string;
  position?: string | null;
  price?: number | null;
  points?: number | null;
  avatarUrl?: string | null;
  isLady?: boolean | null;
  teamShort?: string | null;
  teamName?: string | null;
};

// =====================
// HELPERS
// =====================
function formatDeadlineUG(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

function isLocked(deadlineIso?: string | null) {
  if (!deadlineIso) return false;
  return Date.now() >= new Date(deadlineIso).getTime();
}

function formatTimeUG(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

// =====================
// PAGE
// =====================
export default function TransfersPage() {
  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = React.useState(true);
  const [playersError, setPlayersError] = React.useState<string | null>(null);

  const [squadIds, setSquadIds] = React.useState<string[]>([]);
  const [startingIds, setStartingIds] = React.useState<string[]>([]);

  const [outId, setOutId] = React.useState<string | null>(null);
  const [inId, setInId] = React.useState<string | null>(null);

  // Use the transfers hook
  const gwId = nextGW?.id ?? currentGW?.id ?? null;
  const { transfersThisGW, freeTransfers, usedTransfers, cost, recordTransfer, incrementUsedTransfers } = useTransfers(gwId);

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        setGwLoading(true);
        setGwError(null);
        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");
        setCurrentGW(json.current ?? null);
        setNextGW(json.next ?? null);
      } catch (e: any) {
        setGwError(e?.message || "Unknown error");
      } finally {
        setGwLoading(false);
      }
    })();
  }, []);

  // Load starting IDs from local storage
  React.useEffect(() => {
    const ids = loadIds(LS_STARTING);
    if (ids.length > 0) setStartingIds(ids);
  }, []);

  const savingGw = React.useMemo(() => {
    if (currentGW && currentGW.finalized === false) return currentGW;
    return nextGW ?? currentGW ?? null;
  }, [currentGW, nextGW]);

  const gwIdForRoster = savingGw?.id ?? null;

  React.useEffect(() => {
    if (!gwIdForRoster) {
      const local = loadSquadIds();
      if (local.length > 0) setSquadIds(local);
      return;
    }

    (async () => {
      const res = await fetch(`/api/rosters?gw_id=${gwIdForRoster}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !Array.isArray(json.squadIds) || json.squadIds.length === 0) {
        const local = loadSquadIds();
        if (local.length > 0) {
          setSquadIds(local);
          return;
        }
        setSquadIds([]);
        return;
      }

      setSquadIds(json.squadIds);
    })();
  }, [gwIdForRoster]);

  // Load all players (pool)
  React.useEffect(() => {
    (async () => {
      try {
        setPlayersLoading(true);
        setPlayersError(null);
        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        const mapped: Player[] = (json.players as ApiPlayer[]).map((p) => ({
          id: p.id,
          name: p.name,
          position: normalizePosition(p.position),
          price: Number(p.price ?? 0),
          points: Number(p.points ?? 0),
          avatarUrl: p.avatarUrl ?? null,
          isLady: Boolean(p.isLady),
          teamShort: p.teamShort ?? null,
          teamName: p.teamName ?? null,
        }));

        setAllPlayers(mapped);
      } catch (e: any) {
        setPlayersError(e?.message || "Failed to load players");
      } finally {
        setPlayersLoading(false);
      }
    })();
  }, []);

  // Also load squad by gwId
  React.useEffect(() => {
    if (!gwId) {
      const local = loadSquadIds();
      if (local.length > 0) setSquadIds(local);
      return;
    }

    (async () => {
      const res = await fetch(`/api/rosters?gw_id=${gwId}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !Array.isArray(json.squadIds) || json.squadIds.length === 0) {
        const local = loadSquadIds();
        if (local.length > 0) {
          setSquadIds(local);
          return;
        }
        setSquadIds([]);
        return;
      }

      setSquadIds(json.squadIds);
    })();
  }, [gwId]);

  const locked = isLocked(nextGW?.deadline_time ?? currentGW?.deadline_time);

  const byId = React.useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  const squad = React.useMemo(
    () => squadIds.map((id) => byId.get(id)).filter(Boolean) as Player[],
    [squadIds, byId]
  );

  // Budget
  const budgetUsed = React.useMemo(
    () => squad.reduce((sum, p) => sum + (Number(p.price) || 0), 0),
    [squad]
  );
  const budgetRemaining = Math.max(0, BUDGET_TOTAL - budgetUsed);

  // Auto-infer starting IDs if none saved
  const effectiveStartingIds = React.useMemo(() => {
    if (startingIds.length > 0) {
      // Filter to only include IDs actually in the squad
      const inSquad = startingIds.filter((id) => squadIds.includes(id));
      if (inSquad.length > 0) return inSquad;
    }
    // Auto-infer: first 1 GK + 3 DEF + 3 MID + 3 FWD
    const normalized = squad.map((p) => ({ ...p, position: normalizePosition(p.position) }));
    const g = groupByPosition(normalized);
    const auto: string[] = [];
    auto.push(...g.Goalkeepers.slice(0, 1).map((p) => p.id));
    auto.push(...g.Defenders.slice(0, 3).map((p) => p.id));
    auto.push(...g.Midfielders.slice(0, 3).map((p) => p.id));
    auto.push(...g.Forwards.slice(0, 3).map((p) => p.id));
    return auto;
  }, [startingIds, squadIds, squad]);

  // Read back inId from localStorage (set by add-player page)
  React.useEffect(() => {
    const stored = localStorage.getItem("tbl_transfer_in_id");
    if (stored) {
      setInId(stored);
      localStorage.removeItem("tbl_transfer_in_id");
    }
  }, []);

  function persistSquad(ids: string[]) {
    setSquadIds(ids);
    saveSquadIds(ids);
  }

  function resetSelection() {
    setOutId(null);
    setInId(null);
  }

  function pickOut(id: string) {
    if (locked) return;
    setOutId(id);
    setInId(null);
  }

  function canConfirm() {
    if (locked) return false;
    if (!outId || !inId) return false;
    if (!squadIds.includes(outId)) return false;
    if (squadIds.includes(inId)) return false;
    return true;
  }

  async function confirmTransfer() {
    if (!canConfirm() || !outId || !inId) return;

    const next = squadIds.map((id) => (id === outId ? inId : id));
    persistSquad(next);

    incrementUsedTransfers();

    if (!gwId) {
      resetSelection();
      return;
    }

    const outP = byId.get(outId);
    const inP = byId.get(inId);

    recordTransfer({
      gwId: gwId,
      ts: new Date().toISOString(),
      outId,
      inId,
      outName: outP?.name,
      inName: inP?.name,
      outTeamShort: outP?.teamShort ?? null,
      inTeamShort: inP?.teamShort ?? null,
      outPos: outP?.position ?? null,
      inPos: inP?.position ?? null,
      outPrice: typeof outP?.price === "number" ? outP.price : null,
      inPrice: typeof inP?.price === "number" ? inP.price : null,
    });

    resetSelection();
  }

  // Normalize positions for pitch display
  const normalizedSquad = React.useMemo(
    () => squad.map((p) => ({ ...p, position: normalizePosition(p.position) })),
    [squad]
  );

  const { starting, bench } = splitStartingAndBench(normalizedSquad, effectiveStartingIds);
  const g = groupByPosition(starting);

  // =====================
  // RENDER
  // =====================
  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      {/* === HEADER === */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/fantasy"
          className="h-9 w-9 rounded-full border bg-card/80 grid place-items-center hover:bg-accent"
          aria-label="Back to Fantasy"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-base font-semibold">Transfers</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-9 w-9 rounded-full border bg-card/80 grid place-items-center hover:bg-accent"
              aria-label="Transfer options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={resetSelection}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Selection
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/dashboard/fantasy/pick-team">
                Pick Team
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* === GAMEWEEK + DEADLINE === */}
      <div className="text-sm text-muted-foreground text-center">
        {gwLoading
          ? "Loading..."
          : `GW ${currentGW?.id ?? "--"} - Deadline: ${nextGW?.deadline_time ? formatDeadlineUG(nextGW.deadline_time) : "--"}`}
        {locked && <span className="ml-2 text-red-600 font-semibold">Locked</span>}
      </div>

      {gwError && <div className="text-xs text-red-600 text-center">Warning: {gwError}</div>}
      {playersError && <div className="text-xs text-red-600 text-center">Warning: {playersError}</div>}

      {/* === FPL-STYLE INFO BAR === */}
      <div className="flex items-center justify-between gap-1 rounded-xl border bg-muted/40 px-2 py-2">
        <InfoPill label="Budget" value={`${budgetRemaining.toFixed(1)}m`} />
        <div className="w-px h-8 bg-border" />
        <InfoPill label="Wildcard" value="Available" variant="chip" />
        <div className="w-px h-8 bg-border" />
        <InfoPill label="Free Hit" value="Available" variant="chip" />
        <div className="w-px h-8 bg-border" />
        <InfoPill label="Free Transfers" value={String(freeTransfers)} />
        <div className="w-px h-8 bg-border" />
        <InfoPill label="Cost" value={`${cost} pts`} highlight={cost > 0} />
      </div>

      {/* === PITCH VIEW (Full Width) === */}
      <div className="-mx-4">
        <div className="space-y-0 rounded-none overflow-hidden">
          {/* Pitch */}
          <div
            style={{
              background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
              position: "relative",
              padding: "8px 0 16px",
              overflow: "hidden",
            }}
          >
            {/* Pitch boundary lines */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />

            {/* Center circle */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 120, height: 120, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
            {/* Halfway line */}
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.35)" }} />

            {/* Penalty area top */}
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 70, borderBottom: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 30, borderBottom: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />

            {/* Penalty area bottom */}
            <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 70, borderTop: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 30, borderTop: "2.5px solid rgba(255,255,255,0.35)", borderLeft: "2.5px solid rgba(255,255,255,0.35)", borderRight: "2.5px solid rgba(255,255,255,0.35)" }} />

            {/* Budo League Branding Bar */}
            <div style={{ display: "flex", height: 28, marginBottom: 4 }}>
              <div style={{ flex: 1, background: "linear-gradient(90deg, #C8102E, #8B0000)", display: "flex", alignItems: "center", paddingLeft: 12, fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Budo League
              </div>
              <div style={{ flex: 1, background: "linear-gradient(90deg, #8B0000, #C8102E)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12, fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Fantasy
              </div>
            </div>

            {/* GK Row */}
            <div style={{ position: "relative", padding: "4px 0 8px" }}>
              <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
                {g.Goalkeepers.length > 0 ? (
                  g.Goalkeepers.map((p) => (
                    <TransferPitchCard key={p.id} player={p} isSelected={outId === p.id} onTap={() => pickOut(p.id)} />
                  ))
                ) : (
                  <EmptySlot position="GK" />
                )}
              </div>
            </div>

            {/* DEF Row */}
            <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "6px 0 8px", position: "relative", zIndex: 1 }}>
              {g.Defenders.map((p) => (
                <TransferPitchCard key={p.id} player={p} isSelected={outId === p.id} onTap={() => pickOut(p.id)} />
              ))}
              {g.Defenders.length === 0 && (
                <>
                  <EmptySlot position="DEF" />
                  <EmptySlot position="DEF" />
                </>
              )}
            </div>

            {/* MID Row */}
            <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "6px 0 8px", position: "relative", zIndex: 1 }}>
              {g.Midfielders.map((p) => (
                <TransferPitchCard key={p.id} player={p} isSelected={outId === p.id} onTap={() => pickOut(p.id)} />
              ))}
              {g.Midfielders.length === 0 && (
                <>
                  <EmptySlot position="MID" />
                  <EmptySlot position="MID" />
                  <EmptySlot position="MID" />
                </>
              )}
            </div>

            {/* FWD Row */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "6px 0 4px", position: "relative", zIndex: 1 }}>
              {g.Forwards.map((p) => (
                <TransferPitchCard key={p.id} player={p} isSelected={outId === p.id} onTap={() => pickOut(p.id)} />
              ))}
              {g.Forwards.length === 0 && (
                <>
                  <EmptySlot position="FWD" />
                  <EmptySlot position="FWD" />
                </>
              )}
            </div>
          </div>

          {/* Bench / Substitutes */}
          {bench.length > 0 ? (
            <div style={{ background: "linear-gradient(180deg, #e0f7f0, #c8ece0)", padding: "12px 8px 16px" }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#37003C" }}>SUBSTITUTES</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 8px" }}>
                {bench
                  .sort((a, b) => {
                    const posOrder: Record<string, number> = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4 };
                    return (posOrder[normalizePosition(a.position)] || 5) - (posOrder[normalizePosition(b.position)] || 5);
                  })
                  .map((p, index) => {
                    const pos = normalizePosition(p.position);
                    const posShort = pos === "Goalkeeper" ? "GK" : pos === "Defender" ? "DEF" : pos === "Midfielder" ? "MID" : "FWD";
                    const selected = outId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => pickOut(p.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: selected ? "#fee2e2" : "#fff",
                          borderRadius: 8,
                          padding: "10px 14px",
                          border: selected ? "2px solid #ef4444" : "1px solid #e0e0e0",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#37003C", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {index + 1}
                        </div>
                        <div style={{ width: 36, height: 36 }}>
                          <Kit color="#1e3a5f" isGK={pos === "Goalkeeper"} size={36} />
                        </div>
                        <div style={{ flex: 1, textAlign: "left" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>
                            {shortName(p.name)}
                          </div>
                          <div style={{ fontSize: 10, color: "#666" }}>
                            {p.teamShort ?? "--"} • {p.price ? `${p.price.toFixed(1)}m` : "--"}
                          </div>
                        </div>
                        <div
                          style={{
                            background: posShort === "GK" ? "#f59e0b" : posShort === "DEF" ? "#3b82f6" : posShort === "MID" ? "#22c55e" : "#ef4444",
                            color: "#fff",
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 4,
                          }}
                        >
                          {posShort}
                        </div>
                        {selected && (
                          <div style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                            OUT
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : squad.length === 0 ? (
            <div style={{ background: "linear-gradient(180deg, #e0f7f0, #c8ece0)", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#37003C" }}>
                Start building your 17-player squad below!
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Squad count */}
      {squad.length < 17 && (
        <div className="text-center text-xs text-amber-600 font-medium">
          {squad.length}/17 players • Add {17 - squad.length} more
        </div>
      )}

      {squad.length >= 17 && (
        <div className="text-center">
          <Link
            href="/dashboard/fantasy/pick-team"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg"
          >
            Go to Pick Team →
          </Link>
        </div>
      )}

      {/* === ADD PLAYER BUTTON === */}
      <Link
        href={`/dashboard/transfers/add-player${outId ? `?outId=${outId}&pos=${normalizePosition(byId.get(outId)?.position)}` : ""}`}
        className="flex items-center justify-center gap-2 w-full rounded-2xl border bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/90 transition"
      >
        + Add Player
      </Link>

      {/* === TRANSFER SUMMARY === */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-center">Transfer Summary</div>

          {/* OUT row */}
          <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
            <TransferBadge kind="out" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">
                {outId ? (byId.get(outId)?.name ?? "Selected") : "Pick player from pitch"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {outId ? `${byId.get(outId)?.teamShort ?? "--"} - ${byId.get(outId)?.position ?? "--"}` : "--"}
              </div>
            </div>
            {outId && (
              <div className="text-xs font-mono text-muted-foreground">
                {byId.get(outId)?.price ? `${Number(byId.get(outId)!.price).toFixed(1)}m` : "--"}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
              <span className="text-muted-foreground text-lg">↓</span>
            </div>
          </div>

          {/* IN row */}
          <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
            <TransferBadge kind="in" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">
                {inId ? (byId.get(inId)?.name ?? "Selected") : "Pick replacement from Add Player"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {inId ? `${byId.get(inId)?.teamShort ?? "--"} - ${byId.get(inId)?.position ?? "--"}` : "--"}
              </div>
            </div>
            {inId && (
              <div className="text-xs font-mono text-muted-foreground">
                {byId.get(inId)?.price ? `${Number(byId.get(inId)!.price).toFixed(1)}m` : "--"}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={resetSelection}>
              Reset
            </Button>
            <Button type="button" className="rounded-2xl" disabled={!canConfirm()} onClick={confirmTransfer}>
              Confirm Transfer
            </Button>
          </div>

          {locked && (
            <div className="text-xs text-red-600">
              Transfers are locked because the deadline has passed.
            </div>
          )}
        </div>

        {/* Transfer History */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Transfer History</div>
          {transfersThisGW.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No transfers logged for this gameweek yet.
            </div>
          ) : (
            <div className="space-y-2">
              {transfersThisGW.map((t) => (
                <TransferLogItemComponent
                  key={t.ts}
                  transfer={t}
                  outPlayer={byId.get(t.outId)}
                  inPlayer={byId.get(t.inId)}
                  formatTime={formatTimeUG}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================
// SUB-COMPONENTS
// =====================

function InfoPill({ label, value, variant = "default", highlight = false }: {
  label: string;
  value: string;
  variant?: "default" | "chip";
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center min-w-0 flex-1">
      <div className={cn(
        "text-xs font-mono font-bold tabular-nums",
        highlight ? "text-red-600" : "",
        variant === "chip" ? "text-emerald-600" : ""
      )}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground font-medium truncate">{label}</div>
    </div>
  );
}

function TransferPitchCard({ player, isSelected, onTap }: {
  player: Player;
  isSelected: boolean;
  onTap: () => void;
}) {
  const displayName = shortName(player.name);
  const isGK = normalizePosition(player.position) === "Goalkeeper";
  const kitColor = getKitColor(player.teamShort);

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "active:scale-[0.96] transition-transform duration-150 rounded-lg p-1",
        isSelected && "bg-red-500/30 ring-2 ring-red-500"
      )}
    >
      <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
        <div className="relative">
          <Kit color={kitColor} isGK={isGK} size={56} />
          {isSelected && (
            <div
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                zIndex: 2,
                background: "#ef4444",
                color: "#fff",
                fontSize: 8,
                fontWeight: 800,
                width: 22,
                height: 16,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              OUT
            </div>
          )}
          {player.isLady && (
            <span
              style={{
                position: "absolute", top: -4, left: -4, zIndex: 2,
                background: "linear-gradient(135deg, #FF69B4, #FF1493)", color: "#fff", fontSize: 11,
                width: 18, height: 18, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              }}
            >★</span>
          )}
        </div>
        <div
          style={{
            background: isSelected ? "linear-gradient(180deg, #fee2e2, #fecaca)" : "linear-gradient(180deg, #fff, #f0f0f0)",
            color: "#1a1a2e",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: "4px 4px 0 0",
            marginTop: -4,
            textAlign: "center",
            minWidth: 72,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 88,
            boxShadow: "0 -1px 3px rgba(0,0,0,0.15)",
            borderTop: "1px solid rgba(255,255,255,0.8)",
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            background: isSelected ? "linear-gradient(180deg, #dc2626, #b91c1c)" : "linear-gradient(180deg, #37003C, #2d0032)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: "0 0 4px 4px",
            textAlign: "center",
            minWidth: 72,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          {player.teamShort ?? "--"} • {player.price ? `${Number(player.price).toFixed(1)}m` : "--"}
        </div>
      </div>
    </button>
  );
}
