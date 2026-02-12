"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { loadSquadIds } from "@/lib/fantasyStorage";
import { type Player } from "./player-card";
import { useTransfers } from "./use-transfers";
import { ArrowLeft, MoreVertical, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [, setPlayersLoading] = React.useState(true);
  const [playersError, setPlayersError] = React.useState<string | null>(null);

  const [squadIds, setSquadIds] = React.useState<string[]>([]);

  const [outId, setOutId] = React.useState<string | null>(null);
  const [inId, setInId] = React.useState<string | null>(null);
  const [sheetPlayer, setSheetPlayer] = React.useState<Player | null>(null);

  // Use the transfers hook
  const gwId = nextGW?.id ?? currentGW?.id ?? null;
  const { freeTransfers, cost } = useTransfers(gwId);

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

  // Read back inId from localStorage (set by add-player page)
  React.useEffect(() => {
    const stored = localStorage.getItem("tbl_transfer_in_id");
    if (stored) {
      setInId(stored);
      localStorage.removeItem("tbl_transfer_in_id");
    }
  }, []);

  function resetSelection() {
    setOutId(null);
    setInId(null);
  }

  function pickOut(id: string) {
    if (locked) return;
    const player = byId.get(id);
    if (player) setSheetPlayer(player);
  }

  function handleRemove() {
    if (sheetPlayer) {
      setOutId(sheetPlayer.id);
      setInId(null);
    }
    setSheetPlayer(null);
  }

  // Normalize positions for pitch display
  const normalizedSquad = React.useMemo(
    () => squad.map((p) => ({ ...p, position: normalizePosition(p.position) })),
    [squad]
  );

  // Group ALL squad players by position for the full-squad pitch view
  const allGrouped = groupByPosition(normalizedSquad);
  const maleFwds = allGrouped.Forwards.filter((p) => !p.isLady);
  const ladyPlayers = normalizedSquad.filter((p) => p.isLady);

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
          <div className={cn("text-lg font-bold tabular-nums", cost > 0 && "text-red-600")}>{cost} pts</div>
          <div className="text-[10px] text-muted-foreground font-medium">Cost</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Wildcard</div>
            <div className="text-[10px] text-muted-foreground">Play to make unlimited free transfers</div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Available</span>
        </div>
        <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Free Hit</div>
            <div className="text-[10px] text-muted-foreground">Temporary squad for one gameweek</div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Available</span>
        </div>
      </div>

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
                  <SmallPitchCard key={p.id} player={p} isSelected={false} isGhost={outId === p.id} onTap={() => pickOut(p.id)} />
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
                  <SmallPitchCard key={p.id} player={p} isSelected={false} isGhost={outId === p.id} onTap={() => pickOut(p.id)} />
                ))
              ) : (
                Array.from({ length: 4 }).map((_, i) => <EmptySlot key={i} position="DEF" small />)
              )}
            </div>

            {/* MID Row — 6 midfielders */}
            <div style={{ display: "flex", justifyContent: "center", gap: 1, padding: "4px 0", position: "relative", zIndex: 1 }}>
              {allGrouped.Midfielders.length > 0 ? (
                allGrouped.Midfielders.map((p) => (
                  <SmallPitchCard key={p.id} player={p} isSelected={false} isGhost={outId === p.id} onTap={() => pickOut(p.id)} />
                ))
              ) : (
                Array.from({ length: 6 }).map((_, i) => <EmptySlot key={i} position="MID" small />)
              )}
            </div>

            {/* FWD Row — 3 male forwards */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "4px 0", position: "relative", zIndex: 1 }}>
              {maleFwds.length > 0 ? (
                maleFwds.map((p) => (
                  <SmallPitchCard key={p.id} player={p} isSelected={false} isGhost={outId === p.id} onTap={() => pickOut(p.id)} />
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
                    <SmallPitchCard key={p.id} player={p} isSelected={false} isGhost={outId === p.id} onTap={() => pickOut(p.id)} />
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
          {squad.length === 0 && (
            <div style={{ background: "linear-gradient(180deg, #e0f7f0, #c8ece0)", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#37003C" }}>
                Start building your 17-player squad below!
              </div>
            </div>
          )}
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

      {/* === RESET BUTTON (visible when a player is marked OUT) === */}
      {outId && (
        <button
          type="button"
          onClick={resetSelection}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 text-red-600 py-2.5 text-sm font-semibold hover:bg-red-50 transition"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Transfer
        </button>
      )}

      {/* === ADD PLAYER + NEXT BUTTONS === */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/dashboard/transfers/add-player${outId ? `?outId=${outId}&pos=${normalizePosition(byId.get(outId)?.position)}` : ""}`}
          className="flex items-center justify-center gap-2 rounded-xl border bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition"
        >
          + Add Player
        </Link>
        <Link
          href={`/dashboard/transfers/next${outId || inId ? `?${[outId ? `outId=${outId}` : "", inId ? `inId=${inId}` : ""].filter(Boolean).join("&")}` : ""}`}
          className="flex items-center justify-center rounded-xl border bg-card text-foreground py-2.5 text-sm font-semibold hover:bg-accent transition"
        >
          Next
        </Link>
      </div>

      {/* === ACTION SHEET === */}
      <Sheet open={!!sheetPlayer} onOpenChange={(open) => { if (!open) setSheetPlayer(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">
              {sheetPlayer && (
                <div className="flex items-center gap-3">
                  <Kit color={getKitColor(sheetPlayer.teamShort)} isGK={normalizePosition(sheetPlayer.position) === "Goalkeeper"} size={44} />
                  <div>
                    <div className="text-base font-bold">{sheetPlayer.name}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {sheetPlayer.teamName ?? sheetPlayer.teamShort ?? "--"} • {normalizePosition(sheetPlayer.position)}
                    </div>
                  </div>
                </div>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRemove}
              className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-red-50 transition text-red-600"
            >
              <span className="h-8 w-8 rounded-full bg-red-100 grid place-items-center text-red-600 text-xs font-bold">OUT</span>
              Remove Player
            </button>
            <Link
              href={`/dashboard/transfers/add-player${sheetPlayer ? `?outId=${sheetPlayer.id}&pos=${normalizePosition(sheetPlayer.position)}` : ""}`}
              onClick={() => { if (sheetPlayer) { setOutId(sheetPlayer.id); setInId(null); } setSheetPlayer(null); }}
              className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-accent transition"
            >
              <span className="h-8 w-8 rounded-full bg-emerald-100 grid place-items-center text-emerald-600 text-xs">↔</span>
              Select Replacement
            </Link>
            <Link
              href={sheetPlayer ? `/dashboard/players/${sheetPlayer.id}` : "#"}
              onClick={() => setSheetPlayer(null)}
              className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-accent transition"
            >
              <span className="h-8 w-8 rounded-full bg-blue-100 grid place-items-center text-blue-600 text-xs">i</span>
              Full Profile
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// =====================
// SUB-COMPONENTS
// =====================

function SmallPitchCard({ player, isSelected, isGhost, onTap }: {
  player: Player;
  isSelected: boolean;
  isGhost: boolean;
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
          {player.isLady && !isGhost && (
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
            background: isGhost ? "linear-gradient(180deg, #d1d5db, #c0c4c8)" : "linear-gradient(180deg, #f5e6c8, #e8d9b8)",
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
            background: isGhost ? "linear-gradient(180deg, #6b7280, #4b5563)" : "linear-gradient(180deg, #37003C, #2d0032)",
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
