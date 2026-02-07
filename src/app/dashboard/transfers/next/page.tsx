"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveSquadIds, loadSquadIds } from "@/lib/fantasyStorage";
import { normalizePosition, BUDGET_TOTAL } from "@/lib/pitch-helpers";
import { type Player } from "../player-card";
import { TransferBadge } from "../transfer-badge";
import { TransferLogItemComponent } from "../transfer-log-item";
import { useTransfers } from "../use-transfers";

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
export default function TransferNextPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const outId = searchParams.get("outId");
  const inId = searchParams.get("inId");

  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);

  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = React.useState(true);

  const [squadIds, setSquadIds] = React.useState<string[]>([]);

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        setGwLoading(true);
        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");
        setCurrentGW(json.current ?? null);
        setNextGW(json.next ?? null);
      } catch {
        // silently handle
      } finally {
        setGwLoading(false);
      }
    })();
  }, []);

  // Load all players
  React.useEffect(() => {
    (async () => {
      try {
        setPlayersLoading(true);
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
      } catch {
        // silently handle
      } finally {
        setPlayersLoading(false);
      }
    })();
  }, []);

  // Load squad
  React.useEffect(() => {
    const local = loadSquadIds();
    if (local.length > 0) setSquadIds(local);
  }, []);

  const gwId = nextGW?.id ?? currentGW?.id ?? null;
  const { transfersThisGW, freeTransfers, usedTransfers, cost, recordTransfer, incrementUsedTransfers } = useTransfers(gwId);

  const locked = isLocked(nextGW?.deadline_time ?? currentGW?.deadline_time);

  const byId = React.useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  const squad = React.useMemo(
    () => squadIds.map((id) => byId.get(id)).filter(Boolean) as Player[],
    [squadIds, byId]
  );

  const budgetUsed = React.useMemo(
    () => squad.reduce((sum, p) => sum + (Number(p.price) || 0), 0),
    [squad]
  );
  const budgetRemaining = Math.max(0, BUDGET_TOTAL - budgetUsed);

  const outPlayer = outId ? byId.get(outId) : null;
  const inPlayer = inId ? byId.get(inId) : null;

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
    setSquadIds(next);
    saveSquadIds(next);

    incrementUsedTransfers();

    if (gwId) {
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
    }

    router.push("/dashboard/transfers");
  }

  const loading = gwLoading || playersLoading;

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/transfers"
          className="h-9 w-9 rounded-full border bg-card/80 grid place-items-center hover:bg-accent"
          aria-label="Back to Transfers"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-base font-semibold">Transfer Summary</div>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground text-center">Loading...</div>
      )}

      {/* Transfer notice */}
      <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-center">
        <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          You are about to make {usedTransfers > 0 ? usedTransfers + 1 : 1} transfer{usedTransfers > 0 ? "s" : ""}
        </div>
        {cost > 0 && (
          <div className="text-xs text-red-600 font-medium mt-1">
            This will cost you {cost} points
          </div>
        )}
      </div>

      {/* Transfer Summary */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold text-center">Transfer Summary</div>

        {/* OUT row */}
        <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
          <TransferBadge kind="out" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">
              {outPlayer ? outPlayer.name : "Pick player from pitch"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {outPlayer ? `${outPlayer.teamShort ?? "--"} - ${outPlayer.position ?? "--"}` : "--"}
            </div>
          </div>
          {outPlayer && (
            <div className="text-xs font-mono text-muted-foreground">
              {outPlayer.price ? `${Number(outPlayer.price).toFixed(1)}m` : "--"}
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
              {inPlayer ? inPlayer.name : "Pick replacement from Add Player"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {inPlayer ? `${inPlayer.teamShort ?? "--"} - ${inPlayer.position ?? "--"}` : "--"}
            </div>
          </div>
          {inPlayer && (
            <div className="text-xs font-mono text-muted-foreground">
              {inPlayer.price ? `${Number(inPlayer.price).toFixed(1)}m` : "--"}
            </div>
          )}
        </div>

        {locked && (
          <div className="text-xs text-red-600 mt-2">
            Transfers are locked because the deadline has passed.
          </div>
        )}
      </div>

      {/* Points Overview (FPL-style) */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-muted/50 px-4 py-2">
          <div className="text-xs font-semibold text-center">Points Overview</div>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Free transfers</span>
            <span className="text-sm font-semibold">{freeTransfers}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Transfers made</span>
            <span className="text-sm font-semibold">{usedTransfers}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Extra transfers</span>
            <span className="text-sm font-semibold">{Math.max(0, usedTransfers - freeTransfers)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Transfer cost</span>
            <span className={cn("text-sm font-semibold", cost > 0 && "text-red-600")}>{cost} pts</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Budget remaining</span>
            <span className="text-sm font-semibold">{budgetRemaining.toFixed(1)}m</span>
          </div>
        </div>
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

      {/* Action buttons (FPL-style) */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl py-3 text-sm font-semibold"
          onClick={() => router.push("/dashboard/transfers")}
        >
          Edit Transfer
        </Button>
        <Button
          type="button"
          className="rounded-xl py-3 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={!canConfirm()}
          onClick={confirmTransfer}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
