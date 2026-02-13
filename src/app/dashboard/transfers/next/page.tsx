"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { saveSquadIds, loadSquadIds } from "@/lib/fantasyStorage";
import { normalizePosition, BUDGET_TOTAL, Kit, getKitColor } from "@/lib/pitch-helpers";
import { type Player } from "../player-card";
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

type PendingTransfer = {
  outId: string;
  inId: string;
};

// =====================
// HELPERS
// =====================
function isLocked(deadlineIso?: string | null) {
  if (!deadlineIso) return false;
  return Date.now() >= new Date(deadlineIso).getTime();
}

function formatDeadlineUG(iso?: string | null) {
  if (!iso) return "--";
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

/* Transfer Icon (person with arrows) */
function TransferIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 3l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 17l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =====================
// PAGE
// =====================
export default function TransferNextPage() {
  const router = useRouter();

  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);

  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = React.useState(true);

  const [squadIds, setSquadIds] = React.useState<string[]>([]);
  const [pendingTransfers, setPendingTransfers] = React.useState<PendingTransfer[]>([]);
  const [confirmed, setConfirmed] = React.useState(false);

  // Check if wildcard or free hit is active
  const [wildcardActive, setWildcardActive] = React.useState(false);
  const [freeHitActive, setFreeHitActive] = React.useState(false);
  React.useEffect(() => {
    try {
      const chip = localStorage.getItem("tbl_active_chip");
      setWildcardActive(chip === "wildcard");
      setFreeHitActive(chip === "free_hit");
    } catch { /* ignore */ }
  }, []);
  const chipFree = wildcardActive || freeHitActive;

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

  // Load squad + pending transfers from localStorage
  React.useEffect(() => {
    const local = loadSquadIds();
    if (local.length > 0) setSquadIds(local);

    try {
      const raw = localStorage.getItem("tbl_pending_transfers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPendingTransfers(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const gwId = nextGW?.id ?? currentGW?.id ?? null;
  const { freeTransfers, recordTransfer, incrementUsedTransfers } = useTransfers(gwId);

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

  // New budget after applying pending transfers
  const newBudgetUsed = React.useMemo(() => {
    let total = budgetUsed;
    for (const t of pendingTransfers) {
      const outP = byId.get(t.outId);
      const inP = byId.get(t.inId);
      total -= Number(outP?.price ?? 0);
      total += Number(inP?.price ?? 0);
    }
    return total;
  }, [budgetUsed, pendingTransfers, byId]);
  const budgetRemaining = Math.max(0, BUDGET_TOTAL - newBudgetUsed);

  const pendingCount = pendingTransfers.length;
  const extraTransfers = chipFree ? 0 : Math.max(0, pendingCount - freeTransfers);
  const pendingCost = chipFree ? 0 : extraTransfers * 4;

  const deadlineLabel = formatDeadlineUG(nextGW?.deadline_time ?? currentGW?.deadline_time);

  function canConfirm() {
    if (locked) return false;
    if (pendingTransfers.length === 0) return false;
    return true;
  }

  async function confirmTransfers() {
    if (!canConfirm()) return;

    // Apply all transfers to squad
    let next = [...squadIds];
    for (const t of pendingTransfers) {
      next = next.map((id) => (id === t.outId ? t.inId : id));
    }
    setSquadIds(next);
    saveSquadIds(next);

    // Record each transfer and increment used count
    for (const t of pendingTransfers) {
      incrementUsedTransfers();

      if (gwId) {
        const outP = byId.get(t.outId);
        const inP = byId.get(t.inId);

        recordTransfer({
          gwId: gwId,
          ts: new Date().toISOString(),
          outId: t.outId,
          inId: t.inId,
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
    }

    // Clear pending transfers from localStorage
    localStorage.removeItem("tbl_pending_transfers");

    setConfirmed(true);
    setTimeout(() => router.push("/dashboard/transfers"), 1200);
  }

  const loading = gwLoading || playersLoading;

  return (
    <div className="mx-auto w-full max-w-app min-h-screen flex flex-col">
      {/* -- Header -- */}
      <div className="flex items-center px-4 pt-4 pb-3 bg-card">
        <Link
          href="/dashboard/transfers"
          className="h-9 w-9 rounded-full border bg-card grid place-items-center hover:bg-accent shrink-0"
          aria-label="Back to Transfers"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-lg font-extrabold mr-9">Confirm Transfers</h1>
      </div>

      {/* -- Gameweek + Deadline -- */}
      <div className="text-center px-4 py-4 bg-card">
        <span className="text-sm text-muted-foreground font-medium">
          {gwLoading ? "Loading..." : `Gameweek ${gwId ?? "--"}`}
        </span>
        <span className="mx-2 text-muted-foreground/40">•</span>
        <span className="text-sm font-bold">
          Deadline: {deadlineLabel}
        </span>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
      )}

      {/* -- Transfer Card -- */}
      <div className="px-5 pt-2">
        <div className="rounded-2xl border bg-card p-5 space-y-5 shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
          {/* Banner */}
          <div
            className="rounded-full py-2.5 px-5 text-center"
            style={{ background: wildcardActive ? "linear-gradient(90deg, #C8102E, #8B0000)" : freeHitActive ? "linear-gradient(90deg, #37003C, #5B0050)" : "linear-gradient(90deg, #00FF87, #04F5FF)" }}
          >
            <span className="text-sm font-bold" style={{ color: chipFree ? "#fff" : "#37003C" }}>
              {wildcardActive
                ? `Wildcard — ${pendingCount} free transfer${pendingCount > 1 ? "s" : ""}!`
                : freeHitActive
                ? `Free Hit — ${pendingCount} free transfer${pendingCount > 1 ? "s" : ""}!`
                : `You are about to make ${pendingCount} transfer${pendingCount > 1 ? "s" : ""}!`}
            </span>
          </div>

          {/* Transfer swaps */}
          <div className="space-y-3">
            {pendingTransfers.map((t, i) => {
              const outPlayer = byId.get(t.outId);
              const inPlayer = byId.get(t.inId);
              return (
                <div key={i} className="flex items-center justify-center gap-3 rounded-xl bg-muted/40 p-3">
                  {/* Out player */}
                  <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
                    {outPlayer ? (
                      <>
                        <Kit color={getKitColor(outPlayer.teamShort)} isGK={outPlayer.position === "Goalkeeper"} size={36} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{outPlayer.name}</div>
                          <div className="text-xs text-muted-foreground font-medium truncate">
                            {outPlayer.teamName ?? outPlayer.teamShort ?? "--"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">Unknown</div>
                    )}
                  </div>

                  {/* Arrow */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path d="M5 12h14m0 0l-4-4m4 4l-4 4" stroke="#E0187E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                  {/* In player */}
                  <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
                    {inPlayer ? (
                      <>
                        <Kit color={getKitColor(inPlayer.teamShort)} isGK={inPlayer.position === "Goalkeeper"} size={36} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{inPlayer.name}</div>
                          <div className="text-xs text-muted-foreground font-medium truncate">
                            {inPlayer.teamName ?? inPlayer.teamShort ?? "--"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">Unknown</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Labels */}
          {pendingTransfers.length > 0 && (
            <div className="flex items-center justify-center gap-5">
              <span className="text-xs font-bold text-red-500">OUT</span>
              <div className="text-muted-foreground">
                <TransferIcon />
              </div>
              <span className="text-xs font-bold text-emerald-600">IN</span>
            </div>
          )}

          {/* Info text */}
          {!locked && gwId && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-pink-600 font-semibold">
                Transfers will be active for Gameweek {gwId}
              </span>{" "}
              if made before the deadline ({deadlineLabel})
            </p>
          )}

          {locked && (
            <p className="text-xs text-red-600 font-semibold">
              Transfers are locked because the deadline has passed.
            </p>
          )}

          {pendingCost > 0 && !chipFree && (
            <p className="text-xs text-red-600 font-semibold text-center">
              This will cost you {pendingCost} points
            </p>
          )}
          {chipFree && (
            <p className="text-xs text-emerald-600 font-semibold text-center">
              {wildcardActive ? "Wildcard active — all transfers are free!" : "Free Hit active — all transfers are free!"}
            </p>
          )}
        </div>
      </div>

      {/* -- Points Overview -- */}
      <div className="px-5 pt-5">
        <div className="rounded-2xl border bg-card p-5 border-l-4 border-l-primary shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
          <h3 className="text-base font-extrabold mb-4">Points Overview</h3>

          {chipFree && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3" style={{ background: wildcardActive ? "linear-gradient(90deg, #fef2f2, #fff1f2)" : "linear-gradient(90deg, #f5f3ff, #ede9fe)", border: wildcardActive ? "1px solid #fecaca" : "1px solid #c4b5fd" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                {wildcardActive ? (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#C8102E" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3" stroke="#C8102E" strokeWidth="1.5" />
                  </>
                ) : (
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#7c3aed" strokeWidth="1.8" strokeLinejoin="round" />
                )}
              </svg>
              <span className="text-xs font-bold" style={{ color: wildcardActive ? "#C8102E" : "#7c3aed" }}>
                {wildcardActive ? "Wildcard" : "Free Hit"} — 0 point cost
              </span>
            </div>
          )}

          <div className="divide-y divide-muted/50">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground font-medium">Total transfers</span>
              <span className="text-lg font-extrabold">{pendingCount}</span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground font-medium">Free transfers used</span>
              <span className="text-lg font-extrabold">{chipFree ? "All free" : Math.min(pendingCount, freeTransfers)}</span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground font-medium">Additional transfers</span>
              <span className="text-lg font-extrabold">
                {chipFree ? (
                  <span className="text-emerald-600">0 <span className="text-sm font-semibold">(FREE)</span></span>
                ) : (
                  <>{extraTransfers} <span className="text-sm font-semibold text-muted-foreground">({pendingCost} pts)</span></>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground font-medium">Left in the bank</span>
              <span className="text-lg font-extrabold">UGX {budgetRemaining.toFixed(1)}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* -- Spacer -- */}
      <div className="flex-1" />

      {/* -- Bottom Buttons -- */}
      <div className="flex gap-3 px-5 py-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/transfers")}
          className="flex-1 py-3.5 rounded-full border-2 border-foreground text-sm font-bold hover:bg-accent transition"
        >
          Edit Transfers
        </button>
        <button
          type="button"
          onClick={confirmTransfers}
          disabled={!canConfirm() || confirmed}
          className={cn(
            "flex-1 py-3.5 rounded-full text-sm font-bold text-white transition",
            confirmed
              ? "bg-emerald-500"
              : "bg-foreground hover:bg-foreground/90",
            (!canConfirm() && !confirmed) && "opacity-40 cursor-not-allowed"
          )}
        >
          {confirmed ? "✓ Confirmed" : wildcardActive ? "Confirm (Wildcard)" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
