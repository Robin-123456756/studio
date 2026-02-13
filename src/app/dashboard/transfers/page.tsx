"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { loadSquadIds } from "@/lib/fantasyStorage";
import { type Player } from "./player-card";
import { useTransfers } from "./use-transfers";
import { ArrowLeft, MoreVertical, RotateCcw, Search, X, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveSquadIds } from "@/lib/fantasyStorage";
import {
  BUDGET_TOTAL,
  normalizePosition,
  shortName,
  getKitColor,
  groupByPosition,
  Kit,
  EmptySlot,
  darkenColor,
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

  // "Add mode" — for building squad from scratch (no outId, just pick by position)
  const [addPosition, setAddPosition] = React.useState<string | null>(null);

  // Free Hit chip state
  const [freeHitActive, setFreeHitActive] = React.useState(false);
  const [showCancelFreeHitModal, setShowCancelFreeHitModal] = React.useState(false);

  // Wildcard chip state
  const [wildcardActive, setWildcardActive] = React.useState(false);
  const [showWildcardModal, setShowWildcardModal] = React.useState(false);
  const [showWildcardOfferModal, setShowWildcardOfferModal] = React.useState(false);

  React.useEffect(() => {
    try {
      const chip = localStorage.getItem("tbl_active_chip");
      setFreeHitActive(chip === "free_hit");
      setWildcardActive(chip === "wildcard");
    } catch { /* ignore */ }
  }, []);

  function cancelFreeHit() {
    try {
      // Restore backup squad
      const backup = localStorage.getItem("tbl_free_hit_backup");
      if (backup) {
        const backupIds: string[] = JSON.parse(backup);
        localStorage.setItem("tbl_squad_player_ids", JSON.stringify(backupIds));
        localStorage.setItem("tbl_picked_player_ids", JSON.stringify(backupIds));
        setOriginalSquadIds(backupIds);
        localStorage.removeItem("tbl_free_hit_backup");
        localStorage.removeItem("tbl_free_hit_gw");
      }
      // Deactivate chip
      localStorage.removeItem("tbl_active_chip");
      setFreeHitActive(false);
      setPendingTransfers([]);
      setSelectedOutId(null);
      setSearchQuery("");
      window.dispatchEvent(new Event("tbl_squad_updated"));
    } catch { /* ignore */ }
    setShowCancelFreeHitModal(false);
  }

  function activateWildcard() {
    try {
      localStorage.setItem("tbl_active_chip", "wildcard");
      // Mark wildcard as used (cannot be cancelled)
      const raw = localStorage.getItem("tbl_used_chips");
      const used: string[] = raw ? JSON.parse(raw) : [];
      if (!used.includes("wildcard")) {
        used.push("wildcard");
        localStorage.setItem("tbl_used_chips", JSON.stringify(used));
      }
    } catch { /* ignore */ }
    setWildcardActive(true);
    setShowWildcardModal(false);
    setShowWildcardOfferModal(false);
  }

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

  // Team count map for 3-per-team rule
  const MAX_PER_TEAM = 3;
  const teamCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of effectiveSquad) {
      const team = (p.teamShort ?? "").toUpperCase();
      if (team) counts.set(team, (counts.get(team) ?? 0) + 1);
    }
    return counts;
  }, [effectiveSquad]);

  function wouldExceedTeamLimit(playerId: string, excludePlayerId?: string): boolean {
    const player = byId.get(playerId);
    if (!player) return false;
    const team = (player.teamShort ?? "").toUpperCase();
    if (!team) return false;
    let count = teamCounts.get(team) ?? 0;
    // If we're replacing someone from the same team, subtract 1
    if (excludePlayerId) {
      const outPlayer = byId.get(excludePlayerId);
      if (outPlayer && (outPlayer.teamShort ?? "").toUpperCase() === team) {
        count -= 1;
      }
    }
    return count >= MAX_PER_TEAM;
  }

  // Error toast for team limit
  const [teamLimitError, setTeamLimitError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!teamLimitError) return;
    const timer = setTimeout(() => setTeamLimitError(null), 3500);
    return () => clearTimeout(timer);
  }, [teamLimitError]);

  // Budget based on effective squad
  const budgetUsed = React.useMemo(
    () => effectiveSquad.reduce((sum, p) => sum + (Number(p.price) || 0), 0),
    [effectiveSquad]
  );
  const budgetRemaining = Math.max(0, BUDGET_TOTAL - budgetUsed);

  // Transfer cost based on pending count (Free Hit / Wildcard = 0 cost)
  const pendingCount = pendingTransfers.length;
  const chipFree = freeHitActive || wildcardActive;
  const extraTransfers = chipFree ? 0 : Math.max(0, pendingCount - freeTransfers);
  const pendingCost = chipFree ? 0 : extraTransfers * 4;

  // Check if wildcard is available (not already used)
  const wildcardAvailable = React.useMemo(() => {
    try {
      const raw = localStorage.getItem("tbl_used_chips");
      const used: string[] = raw ? JSON.parse(raw) : [];
      return !used.includes("wildcard");
    } catch { return true; }
  }, [wildcardActive]);

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

  // Pool for "add mode" — players filtered by addPosition, excluding current squad
  const addPool = React.useMemo(() => {
    if (!addPosition) return [];
    const fullPos = addPosition === "GK" ? "Goalkeeper" : addPosition === "DEF" ? "Defender" : addPosition === "MID" ? "Midfielder" : "Forward";
    const effectiveSet = new Set(effectiveSquadIds);
    const q = searchQuery.trim().toLowerCase();

    return allPlayers
      .filter((p) => normalizePosition(p.position) === fullPos)
      .filter((p) => !effectiveSet.has(p.id))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || (p.teamShort ?? "").toLowerCase().includes(q) || (p.teamName ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "price") return (b.price ?? 0) - (a.price ?? 0);
        return (b.points ?? 0) - (a.points ?? 0);
      });
  }, [allPlayers, effectiveSquadIds, addPosition, searchQuery, sortKey]);

  function addPlayerToSquad(playerId: string) {
    if (wouldExceedTeamLimit(playerId)) {
      const player = byId.get(playerId);
      const team = player?.teamName ?? player?.teamShort ?? "this team";
      setTeamLimitError(`You already have ${MAX_PER_TEAM} players from ${team}`);
      return;
    }
    const newIds = [...originalSquadIds, playerId];
    setOriginalSquadIds(newIds);
    saveSquadIds(newIds);
    setAddPosition(null);
    setSearchQuery("");
  }

  function openAddMode(posLabel: string) {
    if (locked) return;
    setSelectedOutId(null);
    setAddPosition(posLabel);
    setSearchQuery("");
  }

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

    // 3-per-team check (exclude the player being swapped out)
    if (wouldExceedTeamLimit(inId, selectedOutId)) {
      const player = byId.get(inId);
      const team = player?.teamName ?? player?.teamShort ?? "this team";
      setTeamLimitError(`You already have ${MAX_PER_TEAM} players from ${team}`);
      return;
    }

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

  function clearEntireSquad() {
    // Clear all squad data from localStorage
    localStorage.removeItem("tbl_squad_player_ids");
    localStorage.removeItem("tbl_picked_player_ids");
    localStorage.removeItem("tbl_starting_player_ids");
    localStorage.removeItem("tbl_captain_id");
    localStorage.removeItem("tbl_vice_captain_id");
    localStorage.removeItem("tbl_pending_transfers");
    // Reset state
    setOriginalSquadIds([]);
    setPendingTransfers([]);
    setSelectedOutId(null);
    setSearchQuery("");
    window.dispatchEvent(new Event("tbl_squad_updated"));
  }

  function handleMakeTransfers() {
    if (pendingTransfers.length === 0) return;

    // Auto-prompt Wildcard when transfers cost points and wildcard is available
    if (pendingCost > 0 && wildcardAvailable && !wildcardActive && !freeHitActive) {
      setShowWildcardOfferModal(true);
      return;
    }

    // Store pending transfers in localStorage for the confirmation page
    localStorage.setItem("tbl_pending_transfers", JSON.stringify(pendingTransfers));
    router.push("/dashboard/transfers/next");
  }

  function proceedWithoutWildcard() {
    setShowWildcardOfferModal(false);
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
            <DropdownMenuItem
              onClick={clearEntireSquad}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <X className="h-4 w-4" />
              Clear Entire Squad
            </DropdownMenuItem>
            {!wildcardActive && wildcardAvailable && !freeHitActive && (
              <DropdownMenuItem
                onClick={() => setShowWildcardModal(true)}
                className="gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Play Wildcard
              </DropdownMenuItem>
            )}
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

      {/* === FREE HIT BANNER === */}
      {freeHitActive && (
        <div className="rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(90deg, #37003C, #5B0050)" }}>
            <div className="flex items-center gap-2 text-white">
              <Zap className="h-4 w-4" />
              <div>
                <div className="text-sm font-bold">Free Hit Active</div>
                <div className="text-[10px] text-white/70">Unlimited transfers — 0 point cost — squad reverts after gameweek</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCancelFreeHitModal(true)}
              className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* === WILDCARD BANNER === */}
      {wildcardActive && (
        <div className="rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(90deg, #C8102E, #8B0000)" }}>
            <div className="flex items-center gap-2 text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
                <path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <div>
                <div className="text-sm font-bold">Wildcard Active</div>
                <div className="text-[10px] text-white/70">Unlimited free transfers — permanent squad changes</div>
              </div>
            </div>
            <div className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white shrink-0">
              Locked In
            </div>
          </div>
        </div>
      )}

      {/* === TRANSFER INFO CARDS === */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-lg font-bold tabular-nums">{budgetRemaining.toFixed(1)}m</div>
          <div className="text-[10px] text-muted-foreground font-medium">Budget</div>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-lg font-bold tabular-nums">{chipFree ? "∞" : freeTransfers}</div>
          <div className="text-[10px] text-muted-foreground font-medium">{chipFree ? "Unlimited" : "Free Transfers"}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className={cn("text-lg font-bold tabular-nums", !chipFree && pendingCost > 0 && "text-red-600")}>
            {chipFree ? <span className="text-emerald-600">FREE</span> : `${pendingCost} pts`}
          </div>
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
        <div className="space-y-0 rounded-none overflow-visible">
          <div
            style={{
              background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
              position: "relative",
              padding: "8px 12px 20px",
              overflow: "visible",
            }}
          >

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
            <div style={{ display: "flex", height: 24, marginBottom: 2, marginLeft: -12, marginRight: -12 }}>
              <div style={{ flex: 1, background: "linear-gradient(90deg, #C8102E, #8B0000)", display: "flex", alignItems: "center", paddingLeft: 16, fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Budo League
              </div>
              <div style={{ flex: 1, background: "linear-gradient(90deg, #8B0000, #C8102E)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 16, fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Fantasy
              </div>
            </div>

            {/* GK Row — 2 keepers */}
            <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "2px 8px 4px", position: "relative", zIndex: 1 }}>
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
              ) : null}
              {/* Fill remaining GK slots */}
              {Array.from({ length: Math.max(0, 2 - allGrouped.Goalkeepers.length) }).map((_, i) => (
                <button key={`gk-empty-${i}`} type="button" onClick={() => openAddMode("GK")} className="active:scale-95 transition-transform">
                  <EmptySlot position="GK" small />
                </button>
              ))}
            </div>

            {/* DEF Row — 4 defenders */}
            <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "4px 8px", position: "relative", zIndex: 1 }}>
              {allGrouped.Defenders.map((p) => (
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
              ))}
              {Array.from({ length: Math.max(0, 4 - allGrouped.Defenders.length) }).map((_, i) => (
                <button key={`def-empty-${i}`} type="button" onClick={() => openAddMode("DEF")} className="active:scale-95 transition-transform">
                  <EmptySlot position="DEF" small />
                </button>
              ))}
            </div>

            {/* MID Row — 6 midfielders */}
            <div style={{ display: "flex", justifyContent: "center", gap: 1, padding: "4px 8px", position: "relative", zIndex: 1, flexWrap: "wrap" }}>
              {allGrouped.Midfielders.map((p) => (
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
              ))}
              {Array.from({ length: Math.max(0, 6 - allGrouped.Midfielders.length) }).map((_, i) => (
                <button key={`mid-empty-${i}`} type="button" onClick={() => openAddMode("MID")} className="active:scale-95 transition-transform">
                  <EmptySlot position="MID" small />
                </button>
              ))}
            </div>

            {/* FWD Row — 3 male forwards */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "4px 8px", position: "relative", zIndex: 1 }}>
              {maleFwds.map((p) => (
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
              ))}
              {Array.from({ length: Math.max(0, 3 - maleFwds.length) }).map((_, i) => (
                <button key={`fwd-empty-${i}`} type="button" onClick={() => openAddMode("FWD")} className="active:scale-95 transition-transform">
                  <EmptySlot position="FWD" small />
                </button>
              ))}
            </div>

            {/* LADIES Row — 2 lady forwards */}
            <div style={{ position: "relative", zIndex: 1, padding: "6px 0 4px" }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" as const, letterSpacing: 1.5 }}>Ladies</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                {ladyPlayers.map((p) => (
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
                ))}
                {Array.from({ length: Math.max(0, 2 - ladyPlayers.length) }).map((_, i) => (
                  <button key={`lady-empty-${i}`} type="button" onClick={() => openAddMode("FWD")} className="active:scale-95 transition-transform">
                    <EmptySlot position="FWD" small />
                  </button>
                ))}
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

      {/* === ADD PLAYER PANEL (building squad from scratch) === */}
      {addPosition && !selectedOutId && (
        <div className="space-y-3">
          <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold" style={{ color: "#37003C" }}>
                Add a {addPosition === "GK" ? "Goalkeeper" : addPosition === "DEF" ? "Defender" : addPosition === "MID" ? "Midfielder" : "Forward"}
              </div>
              <div className="text-xs text-muted-foreground">
                {effectiveSquad.length}/17 players selected
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setAddPosition(null); setSearchQuery(""); }}
              className="h-8 w-8 rounded-full border bg-white grid place-items-center hover:bg-red-100 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
            {addPool.map((p) => (
              <ReplacementRow
                key={p.id}
                player={p}
                onPick={() => addPlayerToSquad(p.id)}
                budgetRemaining={budgetRemaining}
                teamBlocked={wouldExceedTeamLimit(p.id)}
              />
            ))}
            {addPool.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No players match your filters.
              </div>
            )}
          </div>
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
                teamBlocked={wouldExceedTeamLimit(p.id, selectedOutId ?? undefined)}
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
                {wildcardActive ? `Confirm ${pendingCount} Transfer${pendingCount > 1 ? "s" : ""} (Wildcard)` : `Make ${pendingCount} Transfer${pendingCount > 1 ? "s" : ""}`}
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

      {/* === TEAM LIMIT ERROR TOAST === */}
      {teamLimitError && (
        <div className="fixed bottom-20 inset-x-0 z-50 flex justify-center px-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-white px-5 py-3.5 shadow-xl max-w-sm w-full">
            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
              <X className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">Team limit reached</div>
              <div className="text-xs text-gray-500">{teamLimitError}</div>
            </div>
            <button
              type="button"
              onClick={() => setTeamLimitError(null)}
              className="h-7 w-7 rounded-full grid place-items-center hover:bg-gray-100 shrink-0"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* === CANCEL FREE HIT MODAL === */}
      {showCancelFreeHitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 text-center" style={{ background: "linear-gradient(135deg, #37003C, #5B0050)" }}>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Cancel Free Hit?</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-center">
                All transfers made during Free Hit will be <span className="font-bold text-red-600">undone</span> and your original squad will be restored.
              </p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800 font-medium text-center">
                  Your Free Hit chip will become available again for future use.
                </p>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelFreeHitModal(false)}
                className="flex-1 py-3 rounded-full border-2 text-sm font-bold transition hover:bg-accent"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={cancelFreeHit}
                className="flex-1 py-3 rounded-full text-sm font-bold text-white transition"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
              >
                Cancel Free Hit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === WILDCARD PROACTIVE MODAL (manual activation) === */}
      {showWildcardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center" style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
                  <path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Activate Wildcard</h3>
              <p className="text-xs text-white/70 mt-1">
                {nextGW ? `Gameweek ${nextGW.id}` : currentGW ? `Gameweek ${currentGW.id}` : "This Gameweek"}
              </p>
            </div>

            {/* Rules */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#C8102E" }}>1</div>
                <div className="text-sm"><span className="font-semibold">Unlimited free transfers</span> — make as many changes as you want with zero point cost</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#f59e0b" }}>2</div>
                <div className="text-sm"><span className="font-semibold">Permanent changes</span> — your new squad is your squad going forward (unlike Free Hit)</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#3b82f6" }}>3</div>
                <div className="text-sm"><span className="font-semibold">Budget & rules apply</span> — team limits and budget constraints still apply</div>
              </div>

              <div className="rounded-lg border p-3 mt-2" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                <p className="text-xs font-medium" style={{ color: "#991b1b" }}>
                  Once activated, Wildcard cannot be cancelled. This action is irreversible.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowWildcardModal(false)}
                className="flex-1 py-3 rounded-full border-2 text-sm font-bold transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={activateWildcard}
                className="flex-1 py-3 rounded-full text-sm font-bold text-white transition"
                style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}
              >
                Activate Wildcard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === WILDCARD OFFER MODAL (auto-prompted when transfers cost points) === */}
      {showWildcardOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center" style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
                  <path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Play Your Wildcard?</h3>
            </div>

            {/* Cost warning */}
            <div className="px-5 py-4 space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <span className="text-2xl font-extrabold text-red-600">-{pendingCost}</span>
                  <span className="text-sm font-semibold text-red-600">points</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Your {pendingCount} transfer{pendingCount > 1 ? "s" : ""} will cost <span className="font-bold text-red-600">{pendingCost} points</span>
                </p>
              </div>

              <div className="rounded-lg p-3 space-y-2" style={{ background: "linear-gradient(135deg, #fef7f0, #fff7ed)", border: "1px solid #fed7aa" }}>
                <p className="text-sm font-semibold" style={{ color: "#9a3412" }}>
                  Play your Wildcard to avoid the point hit!
                </p>
                <ul className="text-xs space-y-1" style={{ color: "#9a3412" }}>
                  <li>All transfers become free — {pendingCost} points saved</li>
                  <li>Make more changes until the deadline</li>
                  <li>Squad changes are permanent</li>
                </ul>
              </div>

              <div className="rounded-lg border p-3" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                <p className="text-xs font-medium" style={{ color: "#991b1b" }}>
                  Once played, Wildcard cannot be cancelled.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  activateWildcard();
                  // After activating, proceed to confirmation
                  setTimeout(() => {
                    localStorage.setItem("tbl_pending_transfers", JSON.stringify(pendingTransfers));
                    router.push("/dashboard/transfers/next");
                  }, 100);
                }}
                className="w-full py-3 rounded-full text-sm font-bold text-white transition"
                style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}
              >
                Play Wildcard (Save {pendingCost} pts)
              </button>
              <button
                type="button"
                onClick={proceedWithoutWildcard}
                className="w-full py-3 rounded-full border-2 text-sm font-bold transition hover:bg-accent"
              >
                Accept -{pendingCost} Point Hit
              </button>
              <button
                type="button"
                onClick={() => setShowWildcardOfferModal(false)}
                className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                Go back to editing
              </button>
            </div>
          </div>
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
      <div className="flex flex-col items-center" style={{ width: 62 }}>
        {/* Price above kit */}
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: isGhost ? "#9ca3af" : "#fff",
            background: isGhost ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.45)",
            padding: "1px 6px",
            borderRadius: 8,
            marginBottom: 2,
            textAlign: "center",
          }}
        >
          {player.price ? `${Number(player.price).toFixed(1)}m` : "--"}
        </div>
        <div
          className="relative"
          style={{
            background: isGhost
              ? "linear-gradient(150deg, #888 15%, #555 85%)"
              : `linear-gradient(150deg, ${kitColor} 15%, ${darkenColor(kitColor, 0.35)} 85%)`,
            borderRadius: 6,
            padding: "5px 4px 1px",
            width: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "visible",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          {/* Decorative circle */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }} />
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
            padding: "2px 4px",
            borderRadius: "3px 3px 0 0",
            marginTop: -3,
            textAlign: "center",
            width: 62,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
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
            padding: "1px 4px",
            borderRadius: "0 0 3px 3px",
            textAlign: "center",
            width: 62,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          {player.teamShort ?? "--"}
        </div>
      </div>
    </button>
  );
}

function ReplacementRow({ player, onPick, budgetRemaining, teamBlocked = false }: {
  player: Player;
  onPick: () => void;
  budgetRemaining: number;
  teamBlocked?: boolean;
}) {
  const canAfford = (player.price ?? 0) <= budgetRemaining;
  const blocked = teamBlocked || !canAfford;
  const reason = teamBlocked ? "Max 3 per team" : !canAfford ? "Over budget" : null;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
      blocked ? "bg-muted/40 opacity-60" : "bg-card hover:bg-accent/50"
    )}>
      <Kit color={getKitColor(player.teamShort)} isGK={normalizePosition(player.position) === "Goalkeeper"} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          {player.name}
          {player.isLady && <span className="text-pink-600 ml-1">• Lady</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {player.teamName ?? player.teamShort ?? "--"}
          {reason && <span className="ml-1 text-red-500 font-semibold">• {reason}</span>}
        </div>
      </div>
      <div className="text-right shrink-0 mr-1">
        <div className="text-xs font-bold tabular-nums">{player.price ? `${Number(player.price).toFixed(1)}m` : "--"}</div>
        <div className="text-[10px] text-muted-foreground">{player.points ?? 0} pts</div>
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={blocked}
        className={cn(
          "h-8 w-8 rounded-full grid place-items-center shrink-0 transition font-bold text-sm",
          blocked
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "text-white"
        )}
        style={!blocked ? { background: "linear-gradient(135deg, #00FF87, #04F5FF)" } : undefined}
      >
        <span style={!blocked ? { color: "#37003C" } : undefined}>+</span>
      </button>
    </div>
  );
}
