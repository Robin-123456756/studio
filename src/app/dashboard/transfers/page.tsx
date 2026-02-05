"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { saveSquadIds } from "@/lib/fantasyStorage";
import { PlayerCard, type Player } from "./player-card";
import { TransferBadge } from "./transfer-badge";
import { TransferLogItemComponent } from "./transfer-log-item";
import { useTransfers } from "./use-transfers";

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
  const [query, setQuery] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<
    "ALL" | "Goalkeeper" | "Defender" | "Midfielder" | "Forward"
  >("ALL");
  const [teamFilter, setTeamFilter] = React.useState<string>("ALL");
  const [sortKey, setSortKey] = React.useState<"price" | "points" | "name">("points");
  const [sortAsc, setSortAsc] = React.useState(false);

  const [outId, setOutId] = React.useState<string | null>(null);
  const [inId, setInId] = React.useState<string | null>(null);

  const [rightTab, setRightTab] = React.useState<"IN" | "TRANSFERS">("IN");

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

  const savingGw = React.useMemo(() => {
  // If current isn't finalized, transfers apply to current. Else apply to next.
  if (currentGW && currentGW.finalized === false) return currentGW;
  return nextGW ?? currentGW ?? null;
}, [currentGW, nextGW]);

const gwIdForRoster = savingGw?.id ?? null;

React.useEffect(() => {
  if (!gwIdForRoster) return;

  (async () => {
    const res = await fetch(`/api/rosters?gw_id=${gwIdForRoster}`, { cache: "no-store" });
    const json = await res.json();

    if (!res.ok) {
      // If not signed in or no roster yet, keep empty.
      setSquadIds([]);
      return;
    }

    setSquadIds(Array.isArray(json.squadIds) ? json.squadIds : []);
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

  React.useEffect(() => {
    if (!gwId) return;

    (async () => {
      const res = await fetch(`/api/rosters?gw_id=${gwId}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        setSquadIds([]);
        return;
      }

      setSquadIds(Array.isArray(json.squadIds) ? json.squadIds : []);
    })();
  }, [gwId]);

  const locked = isLocked(nextGW?.deadline_time ?? currentGW?.deadline_time);

  const byId = React.useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  const squad = React.useMemo(
    () => squadIds.map((id) => byId.get(id)).filter(Boolean) as Player[],
    [squadIds, byId]
  );

  // Get unique teams for filter
  const allTeams = React.useMemo(() => {
    const teams = new Set<string>();
    allPlayers.forEach((p) => {
      if (p.teamShort) teams.add(p.teamShort);
    });
    return Array.from(teams).sort();
  }, [allPlayers]);

  const pool = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const squadSet = new Set(squadIds);

    return allPlayers
      .filter((p) => !squadSet.has(p.id))
      .filter((p) => (posFilter === "ALL" ? true : p.position === posFilter))
      .filter((p) => (teamFilter === "ALL" ? true : p.teamShort === teamFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") {
          cmp = a.name.localeCompare(b.name);
        } else if (sortKey === "price") {
          cmp = (b.price ?? 0) - (a.price ?? 0);
        } else if (sortKey === "points") {
          cmp = (b.points ?? 0) - (a.points ?? 0);
        }
        return sortAsc ? -cmp : cmp;
      });
  }, [allPlayers, squadIds, query, posFilter, teamFilter, sortKey, sortAsc]);

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

  async function confirmTransfer() {
    if (!canConfirm() || !gwId || !outId || !inId) return;

    // 1) swap in squad ids
    const next = squadIds.map((id) => (id === outId ? inId : id));
    await persistSquad(next);

    // 2) count transfer usage
    incrementUsedTransfers();

    // 3) log the transfer
    const outP = byId.get(outId);
    const inP = byId.get(inId);

    recordTransfer({
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

    resetSelection();
    setRightTab("TRANSFERS"); // show the transfer you just made
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Transfers</div>
          <div className="text-sm text-muted-foreground">
            {gwLoading ? "Loading gameweek..." : `GW ${currentGW?.id ?? "--"} - ${currentGW?.name ?? "--"}`}
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
              "Deadline: --"
            )}
            {locked ? <span className="ml-2 text-red-600 font-semibold">- Locked</span> : null}
          </div>

          {gwError ? <div className="text-xs text-red-600">Warning: {gwError}</div> : null}
        </CardContent>
      </Card>

      {playersError ? <div className="text-sm text-red-600">Warning: {playersError}</div> : null}

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
    No squad saved for this gameweek yet. Go to <b>Pick Team</b> and press <b>Save Team</b>.
  </div>
) : (
              <div className="space-y-2">
                {squad.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    variant="out"
                    active={outId === p.id}
                    disabled={locked}
                    onClick={() => pickOut(p.id)}
                  />
                ))}
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

            {/* Tabs above pool */}
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
                {/* Search */}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search players..."
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />

                {/* Filters */}
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  <select
                    value={posFilter}
                    onChange={(e) => setPosFilter(e.target.value as any)}
                    className="rounded-xl border bg-background px-3 py-2 text-sm"
                  >
                    <option value="ALL">All Positions</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                    <option value="Defender">Defender</option>
                    <option value="Midfielder">Midfielder</option>
                    <option value="Forward">Forward</option>
                  </select>

                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="rounded-xl border bg-background px-3 py-2 text-sm"
                  >
                    <option value="ALL">All Teams</option>
                    {allTeams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as any)}
                    className="rounded-xl border bg-background px-3 py-2 text-sm"
                  >
                    <option value="points">Sort: Points</option>
                    <option value="price">Sort: Price</option>
                    <option value="name">Sort: Name</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSortAsc(!sortAsc)}
                    className="flex items-center justify-center gap-1 rounded-xl border bg-background px-3 py-2 text-sm hover:bg-accent"
                  >
                    {sortAsc ? "↑ Asc" : "↓ Desc"}
                  </button>
                </div>

                {!outId ? (
                  <div className="text-sm text-muted-foreground">
                    Pick a squad player first (OUT), then choose a replacement (IN).
                  </div>
                ) : null}

                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {pool.map((p) => {
                    const disabled = locked || !outId;

                    return (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        variant="in"
                        active={inId === p.id}
                        disabled={disabled}
                        onClick={() => pickIn(p.id)}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              // Transfers list form: OUT row + IN row
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {transfersThisGW.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No transfers logged for this gameweek yet.
                  </div>
                ) : (
                  transfersThisGW.map((t) => (
                    <TransferLogItemComponent
                      key={t.ts}
                      transfer={t}
                      outPlayer={byId.get(t.outId)}
                      inPlayer={byId.get(t.inId)}
                      formatTime={formatTimeUG}
                    />
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm bar */}
<Card>
  <CardContent className="p-4 space-y-3">
    {/* OUT / IN summary */}
    <div className="space-y-2">
      {/* OUT row */}
      <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <TransferBadge kind="out" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {outId ? (byId.get(outId)?.name ?? "Selected OUT player") : "Pick OUT player from squad"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {outId ? `${byId.get(outId)?.teamShort ?? byId.get(outId)?.teamName ?? "--"} - ${byId.get(outId)?.position ?? "--"}` : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* arrow divider */}
      <div className="flex justify-center">
        <div className="h-9 w-9 rounded-full bg-muted grid place-items-center">
          <span className="text-muted-foreground">-&gt;</span>
        </div>
      </div>

      {/* IN row */}
      <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <TransferBadge kind="in" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {inId ? (byId.get(inId)?.name ?? "Selected IN player") : "Pick IN player from pool"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {inId ? `${byId.get(inId)?.teamShort ?? byId.get(inId)?.teamName ?? "--"} - ${byId.get(inId)?.position ?? "--"}` : "--"}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* actions */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">
        Tip: Pick an <span className="font-semibold">OUT</span> player first, then go to{" "}
        <span className="font-semibold">IN</span> tab to select replacement.
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
      <div className="text-xs text-red-600">
        Transfers are locked because the deadline has passed.
      </div>
    ) : null}
  </CardContent>
</Card>
     </div>
  );
}
