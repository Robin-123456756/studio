"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { loadSquadIds } from "@/lib/fantasyStorage";
import { type Player } from "./player-card";
import { useTransfers } from "./use-transfers";
import { ArrowLeft, MoreVertical, RotateCcw, Search, X } from "lucide-react";
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

type PendingTransfer = {
  outId: string;
  inId: string;
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

// =====================
// PAGE
// =====================
export default function TransfersPage() {
  const router = useRouter();

  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [, setPlayersLoading] = React.useState(true);
  const [playersError, setPlayersError] = React.useState<string | null>(null);

  const [originalSquadIds, setOriginalSquadIds] = React.useState<string[]>([]);

  // Pending transfers (multiple swaps before confirming)
  const [pendingTransfers, setPendingTransfers] = React.useState<PendingTransfer[]>([]);
  // Currently selected player for removal (ghosted, awaiting replacement pick)
  const [selectedOutId, setSelectedOutId] = React.useState<string | null>(null);

  // Replacement list search/sort
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<"points" | "price" | "name">("points");

  // Use the transfers hook
  const gwId = nextGW?.id ?? currentGW?.id ?? null;
  const { freeTransfers, cost, recordTransfer, incrementUsedTransfers } = useTransfers(gwId);

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

  const savingGw = React.useMemo(() => {
    if (currentGW && currentGW.finalized === false) return currentGW;
    return nextGW ?? currentGW ?? null;
  }, [currentGW, nextGW]);

  const gwIdForRoster = savingGw?.id ?? null;

  React.useEffect(() => {
    if (!gwIdForRoster) {
      const local = loadSquadIds();
      if (local.length > 0) setOriginalSquadIds(local);
      return;
    }

    (async () => {
      const res = await fetch(`/api/rosters?gw_id=${gwIdForRoster}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !Array.isArray(json.squadIds) || json.squadIds.length === 0) {
        const local = loadSquadIds();
        if (local.length > 0) {
          setOriginalSquadIds(local);
          return;
        }
        setOriginalSquadIds([]);
        return;
      }

      setOriginalSquadIds(json.squadIds);
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
      if (local.length > 0) setOriginalSquadIds(local);
      return;
    }

    (async () => {
      const res = await fetch(`/api/rosters?gw_id=${gwId}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !Array.isArray(json.squadIds) || json.squadIds.length === 0) {
        const local = loadSquadIds();
        if (local.length > 0) {
          setOriginalSquadIds(local);
          return;
        }
        setOriginalSquadIds([]);
        return;
      }

      setOriginalSquadIds(json.squadIds);
    })();
  }, [gwId]);

  const locked = isLocked(nextGW?.deadline_time ?? currentGW?.deadline_time);

  const byId = React.useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  // The effective squad: apply pending transfers to original squad
  const effectiveSquadIds = React.useMemo(() => {
    return originalSquadIds.map((id) => {
      const swap = pendingTransfers.find((t) => t.outId === id);
      return swap ? swap.inId : id;
    });
  }, [originalSquadIds, pendingTransfers]);

  const effectiveSquad = React.useMemo(
    () => effectiveSquadIds.map((id) => byId.get(id)).filter(Boolean) as Player[],
    [effectiveSquadIds, byId]
  );

  // Budget based on effective squad
  const budgetUsed = React.useMemo(
    () => effectiveSquad.reduce((sum, p) => sum + (Number(p.price) || 0), 0),
    [effectiveSquad]
  );
  const budgetRemaining = Math.max(0, BUDGET_TOTAL - budgetUsed);

  // Transfer cost based on pending count
  const pendingCount = pendingTransfers.length;
  const extraTransfers = Math.max(0, pendingCount - freeTransfers);
  const pendingCost = extraTransfers * 4;

  // The selected out player
  const selectedOutPlayer = selectedOutId ? byId.get(selectedOutId) : null;
  const selectedOutPosition = selectedOutPlayer ? normalizePosition(selectedOutPlayer.position) : null;

  // Replacement pool: filtered by position, excluding effective squad
  const replacementPool = React.useMemo(() => {
    if (!selectedOutPosition) return [];
    const effectiveSet = new Set(effectiveSquadIds);
    const q = searchQuery.trim().toLowerCase();

    return allPlayers
      .filter((p) => normalizePosition(p.position) === selectedOutPosition)
      .filter((p) => !effectiveSet.has(p.id))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || (p.teamShort ?? "").toLowerCase().includes(q) || (p.teamName ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "price") return (b.price ?? 0) - (a.price ?? 0);
        return (b.points ?? 0) - (a.points ?? 0);
      });
  }, [allPlayers, effectiveSquadIds, selectedOutPosition, searchQuery, sortKey]);

  function selectForRemoval(playerId: string) {
    if (locked) return;
    // If tapping the same player, deselect
    if (selectedOutId === playerId) {
      setSelectedOutId(null);
      setSearchQuery("");
      return;
    }
    setSelectedOutId(playerId);
    setSearchQuery("");
  }

  function pickReplacement(inId: string) {
    if (!selectedOutId) return;

    // Check if this player was already swapped in a pending transfer — replace that transfer
    const existingIdx = pendingTransfers.findIndex((t) => t.outId === selectedOutId);
    if (existingIdx >= 0) {
      const updated = [...pendingTransfers];
      updated[existingIdx] = { outId: selectedOutId, inId };
      setPendingTransfers(updated);
    } else {
      setPendingTransfers((prev) => [...prev, { outId: selectedOutId, inId }]);
    }

    setSelectedOutId(null);
    setSearchQuery("");
  }

  function undoTransfer(outId: string) {
    setPendingTransfers((prev) => prev.filter((t) => t.outId !== outId));
    setSelectedOutId(null);
  }

  function resetAllTransfers() {
    setPendingTransfers([]);
    setSelectedOutId(null);
    setSearchQuery("");
  }

  function handleMakeTransfers() {
    if (pendingTransfers.length === 0) return;
    // Store pending transfers in localStorage for the confirmation page
    localStorage.setItem("tbl_pending_transfers", JSON.stringify(pendingTransfers));
    router.push("/dashboard/transfers/next");
  }

  // Normalize positions for pitch display
  const normalizedSquad = React.useMemo(
    () => effectiveSquad.map((p) => ({ ...p, position: normalizePosition(p.position) })),
    [effectiveSquad]
  );

  // Group ALL squad players by position for the full-squad pitch view
  const allGrouped = groupByPosition(normalizedSquad);
  const maleFwds = allGrouped.Forwards.filter((p) => !p.isLady);
  const ladyPlayers = normalizedSquad.filter((p) => p.isLady);

  // Check if a player on the pitch is a "new in" (from pending transfer)
  const pendingInIds = new Set(pendingTransfers.map((t) => t.inId));
  const pendingOutIds = new Set(pendingTransfers.map((t) => t.outId));

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
              onClick={resetAllTransfers}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All Transfers
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

      {/* === TRANSFER INFO CARDS === */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-lg font-bold tabular-nums">{budgetRemaining.toFixed(1)}m</div>
          <div className="text-[10px] text-muted-foreground font-medium">Budget</div>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-lg font-bold tabular-nums">{freeTransfers}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Free Transfers</div>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className={cn("text-lg font-bold tabular-nums", pendingCost > 0 && "text-red-600")}>{pendingCost} pts</div>
          <div className="text-[10px] text-muted-foreground font-medium">Cost</div>
        </div>
      </div>

      {/* Pending transfers count */}
      {pendingCount > 0 && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {pendingCount} transfer{pendingCount > 1 ? "s" : ""} pending
          </span>
        </div>
      )}

      {/* === PITCH VIEW (Full Width — all 17 players) === */}
      <div className="-mx-4">
        <div className="space-y-0 rounded-none overflow-hidden">
          <div
            style={{
              background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
              position: "relative",
              padding: "8px 0 20px",
              overflow: "hidden",
            }}
          >
            {/* Pitch boundary lines */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />

            {/* Center circle */}
            <div style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%, -50%)", width: 100, height: 100, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)" }} />
            <div style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%, -50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
            {/* Halfway line */}
            <div style={{ position: "absolute", top: "46%", left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.3)" }} />

            {/* Penalty area top */}
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 180, height: 56, borderBottom: "2.5px solid rgba(255,255,255,0.3)", borderLeft: "2.5px solid rgba(255,255,255,0.3)", borderRight: "2.5px solid rgba(255,255,255,0.3)" }} />
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 70, height: 24, borderBottom: "2.5px solid rgba(255,255,255,0.3)", borderLeft: "2.5px solid rgba(255,255,255,0.3)", borderRight: "2.5px solid rgba(255,255,255,0.3)" }} />

            {/* Penalty area bottom */}
            <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 180, height: 56, borderTop: "2.5px solid rgba(255,255,255,0.3)", borderLeft: "2.5px solid rgba(255,255,255,0.3)", borderRight: "2.5px solid rgba(255,255,255,0.3)" }} />
            <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 70, height: 24, borderTop: "2.5px solid rgba(255,255,255,0.3)", borderLeft: "2.5px solid rgba(255,255,255,0.3)", borderRight: "2.5px solid rgba(255,255,255,0.3)" }} />

            {/* Budo League Branding Bar */}
            <div style={{ display: "flex", height: 24, marginBottom: 2 }}>
              <div style={{ flex: 1, background: "linear-gradient(90deg, #C8102E, #8B0000)", display: "flex", alignItems: "center", paddingLeft: 12, fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Budo League
              </div>
              <div style={{ flex: 1, background: "linear-gradient(90deg, #8B0000, #C8102E)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12, fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Fantasy
              </div>
            </div>

            {/* GK Row — 2 keepers */}
            <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "2px 0 4px", position: "relative", zIndex: 1 }}>
              {allGrouped.Goalkeepers.length > 0 ? (
                allGrouped.Goalkeepers.map((p) => (
                  <SmallPitchCard
                    key={p.id}
                    player={p}
                    isSelected={selectedOutId === p.id}
                    isGhost={selectedOutId === p.id}
                    isNewIn={pendingInIds.has(p.id)}
                    onTap={() => selectForRemoval(p.id)}
                    onUndo={pendingInIds.has(p.id) ? () => {
                      const t = pendingTransfers.find((t) => t.inId === p.id);
                      if (t) undoTransfer(t.outId);
                    } : undefined}
                  />
                ))
              ) : (
                <>
                  <EmptySlot position="GK" small />
                  <EmptySlot position="GK" small />
                </>
              )}
            </div>

            {/* DEF Row — 4 defenders */}
            <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "4px 0", position: "relative", zIndex: 1 }}>
              {allGrouped.Defenders.length > 0 ? (
                allGrouped.Defenders.map((p) => (
                  <SmallPitchCard
                    key={p.id}
                    player={p}
                    isSelected={selectedOutId === p.id}
                    isGhost={selectedOutId === p.id}
                    isNewIn={pendingInIds.has(p.id)}
                    onTap={() => selectForRemoval(p.id)}
                    onUndo={pendingInIds.has(p.id) ? () => {
                      const t = pendingTransfers.find((t) => t.inId === p.id);
                      if (t) undoTransfer(t.outId);
                    } : undefined}
                  />
                ))
              ) : (
                Array.from({ length: 4 }).map((_, i) => <EmptySlot key={i} position="DEF" small />)
              )}
            </div>

            {/* MID Row — 6 midfielders */}
            <div style={{ display: "flex", justifyContent: "center", gap: 1, padding: "4px 0", position: "relative", zIndex: 1 }}>
              {allGrouped.Midfielders.length > 0 ? (
                allGrouped.Midfielders.map((p) => (
                  <SmallPitchCard
                    key={p.id}
                    player={p}
                    isSelected={selectedOutId === p.id}
                    isGhost={selectedOutId === p.id}
                    isNewIn={pendingInIds.has(p.id)}
                    onTap={() => selectForRemoval(p.id)}
                    onUndo={pendingInIds.has(p.id) ? () => {
                      const t = pendingTransfers.find((t) => t.inId === p.id);
                      if (t) undoTransfer(t.outId);
                    } : undefined}
                  />
                ))
              ) : (
                Array.from({ length: 6 }).map((_, i) => <EmptySlot key={i} position="MID" small />)
              )}
            </div>

            {/* FWD Row — 3 male forwards */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "4px 0", position: "relative", zIndex: 1 }}>
              {maleFwds.length > 0 ? (
                maleFwds.map((p) => (
                  <SmallPitchCard
                    key={p.id}
                    player={p}
                    isSelected={selectedOutId === p.id}
                    isGhost={selectedOutId === p.id}
                    isNewIn={pendingInIds.has(p.id)}
                    onTap={() => selectForRemoval(p.id)}
                    onUndo={pendingInIds.has(p.id) ? () => {
                      const t = pendingTransfers.find((t) => t.inId === p.id);
                      if (t) undoTransfer(t.outId);
                    } : undefined}
                  />
                ))
              ) : (
                Array.from({ length: 3 }).map((_, i) => <EmptySlot key={i} position="FWD" small />)
              )}
            </div>

            {/* LADIES Row — 2 lady forwards */}
            <div style={{ position: "relative", zIndex: 1, padding: "6px 0 4px" }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" as const, letterSpacing: 1.5 }}>Ladies</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                {ladyPlayers.length > 0 ? (
                  ladyPlayers.map((p) => (
                    <SmallPitchCard
                      key={p.id}
                      player={p}
                      isSelected={selectedOutId === p.id}
                      isGhost={selectedOutId === p.id}
                      isNewIn={pendingInIds.has(p.id)}
                      onTap={() => selectForRemoval(p.id)}
                      onUndo={pendingInIds.has(p.id) ? () => {
                        const t = pendingTransfers.find((t) => t.inId === p.id);
                        if (t) undoTransfer(t.outId);
                      } : undefined}
                    />
                  ))
                ) : (
                  <>
                    <EmptySlot position="FWD" small />
                    <EmptySlot position="FWD" small />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Empty state */}
          {effectiveSquad.length === 0 && (
            <div style={{ background: "linear-gradient(180deg, #e0f7f0, #c8ece0)", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#37003C" }}>
                Start building your 17-player squad below!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Squad count */}
      {effectiveSquad.length < 17 && (
        <div className="text-center text-xs text-amber-600 font-medium">
          {effectiveSquad.length}/17 players • Add {17 - effectiveSquad.length} more
        </div>
      )}

      {/* === SELECTED PLAYER BANNER === */}
      {selectedOutId && selectedOutPlayer && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-3 flex items-center gap-3">
          <Kit color={getKitColor(selectedOutPlayer.teamShort)} isGK={normalizePosition(selectedOutPlayer.position) === "Goalkeeper"} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{selectedOutPlayer.name}</div>
            <div className="text-xs text-muted-foreground">
              {selectedOutPlayer.teamName ?? selectedOutPlayer.teamShort ?? "--"} • {normalizePosition(selectedOutPlayer.position)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-red-600 font-bold">Selling</div>
            <div className="text-xs text-muted-foreground">{selectedOutPlayer.price ? `${Number(selectedOutPlayer.price).toFixed(1)}m` : "--"}</div>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedOutId(null); setSearchQuery(""); }}
            className="h-8 w-8 rounded-full border bg-white grid place-items-center hover:bg-red-100 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* === REPLACEMENT PLAYER LIST (visible when a player is selected for removal) === */}
      {selectedOutId && selectedOutPlayer && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-center">
            Select a replacement {selectedOutPosition}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or team..."
              className="w-full rounded-xl border bg-background pl-9 pr-3 py-2.5 text-sm"
            />
          </div>

          {/* Sort pills */}
          <div className="flex gap-2 justify-center">
            {(["points", "price", "name"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition",
                  sortKey === key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-muted hover:bg-accent"
                )}
              >
                {key === "points" ? "Points" : key === "price" ? "Price" : "Name"}
              </button>
            ))}
          </div>

          {/* Player list */}
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {replacementPool.map((p) => (
              <ReplacementRow
                key={p.id}
                player={p}
                onPick={() => pickReplacement(p.id)}
                budgetRemaining={budgetRemaining + (selectedOutPlayer?.price ?? 0)}
              />
            ))}
            {replacementPool.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No players match your filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* === RESET BUTTON (visible when pending transfers exist) === */}
      {pendingTransfers.length > 0 && !selectedOutId && (
        <button
          type="button"
          onClick={resetAllTransfers}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 text-red-600 py-2.5 text-sm font-semibold hover:bg-red-50 transition"
        >
          <RotateCcw className="h-4 w-4" />
          Reset All Transfers
        </button>
      )}

      {/* === MAKE TRANSFERS BUTTON === */}
      {!selectedOutId && (
        <div className="space-y-2">
          {pendingTransfers.length > 0 ? (
            <button
              type="button"
              onClick={handleMakeTransfers}
              disabled={locked}
              className={cn(
                "w-full py-3.5 rounded-full text-sm font-bold text-white transition",
                locked
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-foreground hover:bg-foreground/90"
              )}
              style={!locked ? { background: "linear-gradient(90deg, #00FF87, #04F5FF)" } : undefined}
            >
              <span style={!locked ? { color: "#37003C" } : undefined}>
                Make {pendingCount} Transfer{pendingCount > 1 ? "s" : ""}
              </span>
            </button>
          ) : (
            <div className="text-center text-xs text-muted-foreground py-2">
              Tap a player on the pitch to start a transfer
            </div>
          )}

          {effectiveSquad.length >= 17 && (
            <Link
              href="/dashboard/fantasy/pick-team"
              className="block text-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 py-1"
            >
              Go to Pick Team →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// =====================
// SUB-COMPONENTS
// =====================

function SmallPitchCard({ player, isSelected, isGhost, isNewIn, onTap, onUndo }: {
  player: Player;
  isSelected: boolean;
  isGhost: boolean;
  isNewIn: boolean;
  onTap: () => void;
  onUndo?: () => void;
}) {
  const displayName = shortName(player.name);
  const isGK = normalizePosition(player.position) === "Goalkeeper";
  const kitColor = getKitColor(player.teamShort);

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "active:scale-[0.96] transition-transform duration-150 rounded-md p-0.5",
        isSelected && "bg-red-500/30 ring-2 ring-red-500"
      )}
      style={isGhost ? { opacity: 0.4, filter: "grayscale(0.8)" } : undefined}
    >
      <div className="flex flex-col items-center" style={{ minWidth: 50 }}>
        <div className="relative">
          <Kit color={isGhost ? "#888" : kitColor} isGK={isGK} size={38} />
          {isGhost && (
            <div
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                zIndex: 2,
                background: "#ef4444",
                color: "#fff",
                fontSize: 7,
                fontWeight: 800,
                width: 18,
                height: 13,
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              OUT
            </div>
          )}
          {isNewIn && !isGhost && (
            <div
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                zIndex: 2,
                background: "#10b981",
                color: "#fff",
                fontSize: 7,
                fontWeight: 800,
                width: 18,
                height: 13,
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onUndo?.();
              }}
            >
              IN
            </div>
          )}
          {player.isLady && !isGhost && !isNewIn && (
            <span
              style={{
                position: "absolute", top: -3, left: -3, zIndex: 2,
                background: "linear-gradient(135deg, #FF69B4, #FF1493)", color: "#fff", fontSize: 8,
                width: 14, height: 14, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1.5px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              }}
            >★</span>
          )}
        </div>
        <div
          style={{
            background: isGhost
              ? "linear-gradient(180deg, #d1d5db, #c0c4c8)"
              : isNewIn
                ? "linear-gradient(180deg, #a7f3d0, #6ee7b7)"
                : "linear-gradient(180deg, #f5e6c8, #e8d9b8)",
            color: isGhost ? "#6b7280" : "#1a1a2e",
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "3px 3px 0 0",
            marginTop: -3,
            textAlign: "center",
            minWidth: 50,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 62,
            boxShadow: "0 -1px 2px rgba(0,0,0,0.12)",
            borderTop: "1px solid rgba(255,255,255,0.8)",
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            background: isGhost
              ? "linear-gradient(180deg, #6b7280, #4b5563)"
              : isNewIn
                ? "linear-gradient(180deg, #059669, #047857)"
                : "linear-gradient(180deg, #37003C, #2d0032)",
            color: "#fff",
            fontSize: 8,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: "0 0 3px 3px",
            textAlign: "center",
            minWidth: 50,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          {player.teamShort ?? "--"} • {player.price ? `${Number(player.price).toFixed(1)}m` : "--"}
        </div>
      </div>
    </button>
  );
}

function ReplacementRow({ player, onPick, budgetRemaining }: {
  player: Player;
  onPick: () => void;
  budgetRemaining: number;
}) {
  const canAfford = (player.price ?? 0) <= budgetRemaining;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
      canAfford ? "bg-card hover:bg-accent/50" : "bg-muted/40 opacity-60"
    )}>
      <Kit color={getKitColor(player.teamShort)} isGK={normalizePosition(player.position) === "Goalkeeper"} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          {player.name}
          {player.isLady && <span className="text-pink-600 ml-1">• Lady</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {player.teamName ?? player.teamShort ?? "--"}
        </div>
      </div>
      <div className="text-right shrink-0 mr-1">
        <div className="text-xs font-bold tabular-nums">{player.price ? `${Number(player.price).toFixed(1)}m` : "--"}</div>
        <div className="text-[10px] text-muted-foreground">{player.points ?? 0} pts</div>
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={!canAfford}
        className={cn(
          "h-8 w-8 rounded-full grid place-items-center shrink-0 transition font-bold text-sm",
          canAfford
            ? "text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        )}
        style={canAfford ? { background: "linear-gradient(135deg, #00FF87, #04F5FF)" } : undefined}
      >
        <span style={canAfford ? { color: "#37003C" } : undefined}>+</span>
      </button>
    </div>
  );
}
