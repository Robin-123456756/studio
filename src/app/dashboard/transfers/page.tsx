"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { saveSquadIds } from "@/lib/fantasyStorage";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  ArrowRight,
  Clock3,
} from "lucide-react";

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
  price: number;
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
const LS_TRANSFERS_LOG = "tbl_transfers_log";

type TransferLogItem = {
  gwId: number;
  ts: string; // ISO timestamp
  outId: string;
  inId: string;

  outName?: string;
  inName?: string;
  outTeamShort?: string | null;
  inTeamShort?: string | null;
  outPos?: string | null;
  inPos?: string | null;
  outPrice?: number | null;
  inPrice?: number | null;
};

function loadTransfersLog(): TransferLogItem[] {
  try {
    const raw = window.localStorage.getItem(LS_TRANSFERS_LOG);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as TransferLogItem[]) : [];
  } catch {
    return [];
  }
}

function saveTransfersLog(items: TransferLogItem[]) {
  window.localStorage.setItem(LS_TRANSFERS_LOG, JSON.stringify(items));
}

function appendTransferLog(item: TransferLogItem) {
  const prev = loadTransfersLog();
  saveTransfersLog([item, ...prev]); // newest first
}

function getTransfersForGW(gwId: number) {
  return loadTransfersLog().filter((t) => t.gwId === gwId);
}

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

function TransferBadge({ kind }: { kind: "out" | "in" }) {
  return kind === "out" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-1 text-xs font-semibold">
      <ArrowLeftCircle className="h-4 w-4" />
      OUT
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 text-xs font-semibold">
      <ArrowRightCircle className="h-4 w-4" />
      IN
    </span>
  );
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
// LOCAL STORAGE KEYS
// =====================
const LS_SQUAD = "tbl_squad_player_ids";
const LS_FT_BY_GW = (gwId: number) => `tbl_free_transfers_gw_${gwId}`;
const LS_USED_BY_GW = (gwId: number) => `tbl_transfers_used_gw_${gwId}`;

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
  const [posFilter, setPosFilter] = React.useState<
    "ALL" | "Goalkeeper" | "Defender" | "Midfielder" | "Forward"
  >("ALL");

  const [outId, setOutId] = React.useState<string | null>(null);
  const [inId, setInId] = React.useState<string | null>(null);

  // ✅ tabs above pool: IN (pool) vs Transfers (history)
  const [rightTab, setRightTab] = React.useState<"IN" | "TRANSFERS">("IN");

  // ✅ force refresh transfers list after confirm
  const [transfersLogVersion, setTransfersLogVersion] = React.useState(0);

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
      .filter((p) => !squadSet.has(p.id))
      .filter((p) => (posFilter === "ALL" ? true : p.position === posFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  }, [allPlayers, squadIds, query, posFilter]);

  const transfersThisGW = React.useMemo(() => {
    if (!gwId) return [];
    return getTransfersForGW(gwId);
  }, [gwId, transfersLogVersion]);

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
    setRightTab("IN"); // when you pick OUT, jump to IN pool
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

    // 1) swap in squad ids
    const next = squadIds.map((id) => (id === outId ? inId : id));
    persistSquad(next);

    // 2) count transfer usage
    const used = getTransfersUsedForGW(gwId);
    setTransfersUsedForGW(gwId, used + 1);

    // 3) log the transfer
    const outP = byId.get(outId);
    const inP = byId.get(inId);

    appendTransferLog({
      gwId,
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

    setTransfersLogVersion((v) => v + 1); // ✅ refresh history list
    resetSelection();
    setRightTab("TRANSFERS"); // ✅ show the transfer you just made
  }

  const outP = outId ? byId.get(outId) : null;
  const inP = inId ? byId.get(inId) : null;

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
              <span className={cn("font-mono tabular-nums", cost > 0 ? "text-red-600" : "")}>{cost}</span>
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
                No squad saved yet. Save your squad IDs in localStorage key:{" "}
                <span className="font-mono">{LS_SQUAD}</span>
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
                            {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 object-cover" /> : null}
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

        {/* RIGHT COLUMN: Tabs + Pool/Transfers */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">
                {rightTab === "IN" ? "Player Pool" : "Transfers"}
              </div>
              <div className="text-xs text-muted-foreground">
                {rightTab === "IN"
                  ? playersLoading
                    ? "Loading..."
                    : `${pool.length} available`
                  : `${transfersThisGW.length} in GW`}
              </div>
            </div>

            {/* ✅ Tabs above pool */}
            <div className="flex items-center justify-center">
              <div className="rounded-2xl bg-muted p-1 inline-flex">
                <button
                  type="button"
                  onClick={() => setRightTab("IN")}
                  className={cn(
                    "px-5 py-2 rounded-2xl text-sm font-semibold transition",
                    rightTab === "IN" ? "bg-background shadow" : "text-muted-foreground"
                  )}
                >
                  IN
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("TRANSFERS")}
                  className={cn(
                    "px-5 py-2 rounded-2xl text-sm font-semibold transition",
                    rightTab === "TRANSFERS" ? "bg-background shadow" : "text-muted-foreground"
                  )}
                >
                  Transfers
                </button>
              </div>
            </div>

            {rightTab === "IN" ? (
              <>
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
                              {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 object-cover" /> : null}
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
              </>
            ) : (
              // ✅ Transfers list form: OUT row + IN row (fancy)
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {transfersThisGW.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No transfers logged for this gameweek yet.
                  </div>
                ) : (
                  transfersThisGW.map((t) => {
                    const outNow = byId.get(t.outId);
                    const inNow = byId.get(t.inId);

                    return (
                      <div key={t.ts} className="rounded-2xl border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-4 w-4" /> {formatTimeUG(t.ts)}
                          </span>
                          <span className="font-mono">GW {t.gwId}</span>
                        </div>

                        {/* OUT */}
                        <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <TransferBadge kind="out" />
                              <div className="text-sm font-semibold truncate">
                                {outNow?.name ?? t.outName ?? t.outId}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {(outNow?.teamShort ?? t.outTeamShort ?? "—")} • {(outNow?.position ?? t.outPos ?? "—")}
                            </div>
                          </div>
                          <div className="text-sm font-mono font-bold tabular-nums">
                            ${Number(outNow?.price ?? 0)}m
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        {/* IN */}
                        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <TransferBadge kind="in" />
                              <div className="text-sm font-semibold truncate">
                                {inNow?.name ?? t.inName ?? t.inId}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {(inNow?.teamShort ?? t.inTeamShort ?? "—")} • {(inNow?.position ?? t.inPos ?? "—")}
                            </div>
                          </div>
                          <div className="text-sm font-mono font-bold tabular-nums">
                            ${Number(inNow?.price ?? 0)}m
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ Confirm bar (fancy arrows) */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2">
            {/* OUT row */}
            <div className={cn("rounded-2xl border px-3 py-3", outId ? "bg-red-50 border-red-200" : "bg-card")}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TransferBadge kind="out" />
                    <div className="text-sm font-semibold truncate">
                      {outId ? (outP?.name ?? outId) : "Pick OUT player from squad"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {outId ? `${outP?.teamShort ?? outP?.teamName ?? "—"} • ${outP?.position ?? "—"}` : "—"}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-mono font-bold tabular-nums">
                    {outId ? `$${Number(outP?.price ?? 0)}m` : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* arrow bubble */}
            <div className="flex items-center justify-center">
              <div className="h-9 w-9 rounded-full bg-muted grid place-items-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* IN row */}
            <div className={cn("rounded-2xl border px-3 py-3", inId ? "bg-emerald-50 border-emerald-200" : "bg-card")}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TransferBadge kind="in" />
                    <div className="text-sm font-semibold truncate">
                      {inId ? (inP?.name ?? inId) : "Pick IN player from pool"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {inId ? `${inP?.teamShort ?? inP?.teamName ?? "—"} • ${inP?.position ?? "—"}` : "—"}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-mono font-bold tabular-nums">
                    {inId ? `$${Number(inP?.price ?? 0)}m` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Tip: Pick an OUT player first, then go to <span className="font-semibold">IN</span> tab to select replacement.
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetSelection}>
                Reset
              </Button>
              <Button type="button" className="rounded-2xl" disabled={!canConfirm()} onClick={confirmTransfer}>
                Confirm Transfer
              </Button>
            </div>
          </div>

          {locked ? (
            <div className="text-xs text-red-600">Transfers are locked because the deadline has passed.</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
