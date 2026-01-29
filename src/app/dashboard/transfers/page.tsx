"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { saveSquadIds } from "@/lib/fantasyStorage";

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

type Player = {
  id: string;
  name: string;
  webName?: string | null;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | string;
  points: number;
  price: number;          // ✅ add this
  avatarUrl?: string | null;
  isLady?: boolean;
  teamName?: string | null;
  teamShort?: string | null;
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
function normalizePosition(pos?: string | null): Player["position"] {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "df" || p === "defender") return "Defender";
  if (p === "mid" || p === "mf" || p === "midfielder") return "Midfielder";
  if (p === "fwd" || p === "fw" || p === "forward" || p === "striker") return "Forward";
  return pos ?? "Midfielder";
}

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
// LOCAL STORAGE KEYS
// =====================
// You can keep your existing picks key, but transfers should work on the SQUAD
const LS_SQUAD = "tbl_squad_player_ids"; // squad IDs (ideally 15)
const LS_FT_BY_GW = (gwId: number) => `tbl_free_transfers_gw_${gwId}`; // number
const LS_USED_BY_GW = (gwId: number) => `tbl_transfers_used_gw_${gwId}`; // number

// simple: always 1 FT per GW, max carry 2
function getFreeTransfersForGW(gwId: number) {
  const raw = window.localStorage.getItem(LS_FT_BY_GW(gwId));
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n)) return Math.max(1, Math.min(2, n));
  return 1;
}

function setFreeTransfersForGW(gwId: number, value: number) {
  const v = Math.max(1, Math.min(2, value));
  window.localStorage.setItem(LS_FT_BY_GW(gwId), String(v));
}

function getTransfersUsedForGW(gwId: number) {
  const raw = window.localStorage.getItem(LS_USED_BY_GW(gwId));
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function setTransfersUsedForGW(gwId: number, value: number) {
  const v = Math.max(0, value);
  window.localStorage.setItem(LS_USED_BY_GW(gwId), String(v));
}

function calcTransferCost(used: number, free: number) {
  const paid = Math.max(0, used - free);
  return paid * 4;
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
  const [query, setQuery] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<"ALL" | "Goalkeeper" | "Defender" | "Midfielder" | "Forward">("ALL");

  const [outId, setOutId] = React.useState<string | null>(null);
  const [inId, setInId] = React.useState<string | null>(null);

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

  // Load squad from localStorage
  React.useEffect(() => {
    const raw = window.localStorage.getItem(LS_SQUAD);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    setSquadIds(Array.isArray(ids) ? ids : []);
  }, []);

  const gwId = nextGW?.id ?? currentGW?.id ?? null;
const locked = isLocked(nextGW?.deadline_time ?? currentGW?.deadline_time);

  const freeTransfers = React.useMemo(() => (gwId ? getFreeTransfersForGW(gwId) : 1), [gwId]);
  const usedTransfers = React.useMemo(() => (gwId ? getTransfersUsedForGW(gwId) : 0), [gwId]);
  const cost = React.useMemo(() => calcTransferCost(usedTransfers, freeTransfers), [usedTransfers, freeTransfers]);

  const byId = React.useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  const squad = React.useMemo(
    () => squadIds.map((id) => byId.get(id)).filter(Boolean) as Player[],
    [squadIds, byId]
  );

  const pool = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const squadSet = new Set(squadIds);

    return allPlayers
      .filter((p) => !squadSet.has(p.id)) // pool excludes current squad
      .filter((p) => (posFilter === "ALL" ? true : p.position === posFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  }, [allPlayers, squadIds, query, posFilter]);

  function persistSquad(ids: string[]) {
  setSquadIds(ids);     // keep UI state in sync
  saveSquadIds(ids);    // ✅ shared storage helper (uses tbl_squad_player_ids internally)
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

  function pickIn(id: string) {
    if (locked) return;
    setInId(id);
  }

  function canConfirm() {
    if (locked) return false;
    if (!gwId) return false;
    if (!outId || !inId) return false;
    if (!squadIds.includes(outId)) return false;
    if (squadIds.includes(inId)) return false;
    return true;
  }

  function confirmTransfer() {
  if (!canConfirm() || !gwId || !outId || !inId) return;

  const next = squadIds.map((id) => (id === outId ? inId : id));
  persistSquad(next);

  const used = getTransfersUsedForGW(gwId);
  setTransfersUsedForGW(gwId, used + 1);

  resetSelection();
}


  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Transfers</div>
          <div className="text-sm text-muted-foreground">
            {gwLoading ? "Loading gameweek..." : `GW ${currentGW?.id ?? "—"} • ${currentGW?.name ?? "—"}`}
          </div>
        </div>

        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard/fantasy">Back</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="text-sm">
              <span className="font-semibold">Free transfers:</span>{" "}
              <span className="font-mono tabular-nums">{freeTransfers}</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">Transfers made:</span>{" "}
              <span className="font-mono tabular-nums">{usedTransfers}</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">Cost:</span>{" "}
              <span className={cn("font-mono tabular-nums", cost > 0 ? "text-red-600" : "")}>
                {cost}
              </span>
            </div>
          </div>

         <div className="text-sm text-muted-foreground">
  {gwLoading ? (
    "Deadline: ..."
  ) : nextGW?.deadline_time ? (
    <>
      Deadline (UG):{" "}
      <span className="font-semibold">{formatDeadlineUG(nextGW.deadline_time)}</span>
    </>
  ) : (
    "Deadline: —"
  )}
  {locked ? <span className="ml-2 text-red-600 font-semibold">• Locked</span> : null}
</div>

{gwError ? <div className="text-xs text-red-600">⚠ {gwError}</div> : null}

        </CardContent>
      </Card>

      {playersError ? <div className="text-sm text-red-600">⚠ {playersError}</div> : null}

      {/* Squad + Pool */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* SQUAD */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Your Squad</div>
              <div className="text-xs text-muted-foreground">{squad.length} players</div>
            </div>

            {squad.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No squad saved yet. Save your squad IDs in localStorage key: <span className="font-mono">{LS_SQUAD}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {squad.map((p) => {
                  const active = outId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickOut(p.id)}
                      disabled={locked}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                        active ? "border-red-500 bg-red-50" : "bg-card hover:bg-accent/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.teamName ?? p.teamShort ?? "—"} • {p.position}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
  <div className="text-xs text-muted-foreground">Price</div>
  <div className="font-mono font-bold tabular-nums">${Number(p.price ?? 0)}m</div>

  <div className="mt-1 text-[11px] text-muted-foreground">Pts</div>
  <div className="font-mono font-bold tabular-nums">{Number(p.points ?? 0)}</div>
</div>

                        </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* POOL */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Player Pool</div>
              <div className="text-xs text-muted-foreground">
                {playersLoading ? "Loading..." : `${pool.length} available`}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players..."
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value as any)}
                className="rounded-xl border bg-background px-3 py-2 text-sm"
              >
                <option value="ALL">All</option>
                <option value="Goalkeeper">GK</option>
                <option value="Defender">DEF</option>
                <option value="Midfielder">MID</option>
                <option value="Forward">FWD</option>
              </select>
            </div>

            {!outId ? (
              <div className="text-sm text-muted-foreground">
                Pick a squad player first (OUT), then choose a replacement (IN).
              </div>
            ) : null}

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {pool.map((p) => {
                const active = inId === p.id;
                const disabled = locked || !outId;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickIn(p.id)}
                    disabled={disabled}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left transition",
                      active ? "border-emerald-600 bg-emerald-50" : "bg-card hover:bg-accent/10",
                      disabled ? "opacity-60" : ""
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.teamName ?? p.teamShort ?? "—"} • {p.position}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
  <div className="text-xs text-muted-foreground">Price</div>
  <div className="font-mono font-bold tabular-nums">${Number(p.price ?? 0)}m</div>

  <div className="mt-1 text-[11px] text-muted-foreground">Pts</div>
  <div className="font-mono font-bold tabular-nums">{Number(p.points ?? 0)}</div>
</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold">OUT:</span>{" "}
              <span className="font-mono">{outId ? (byId.get(outId)?.name ?? outId) : "—"}</span>
              <span className="mx-2">→</span>
              <span className="font-semibold">IN:</span>{" "}
              <span className="font-mono">{inId ? (byId.get(inId)?.name ?? inId) : "—"}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetSelection}>
                Reset
              </Button>

              <Button
                type="button"
                className="rounded-2xl"
                disabled={!canConfirm()}
                onClick={confirmTransfer}
              >
                Confirm Transfer
              </Button>
            </div>
          </div>

          {locked ? (
            <div className="mt-2 text-xs text-red-600">
              Transfers are locked because the deadline has passed.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
