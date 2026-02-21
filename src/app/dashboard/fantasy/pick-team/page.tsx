"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import {
  TrendingUp,
  ArrowUpDown,
  ArrowLeft,
  ArrowLeftRight,
  Zap,
  X,
  TrendingDown,
  Info,
  Scale,
  MoreVertical,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// DB helpers (Step 3)
import { loadRosterFromDb, saveRosterToDb, upsertTeamName } from "@/lib/fantasyDb";

type Player = {
  id: string;
  name: string; // full name
  webName?: string | null; // short display name
  position?: string | null;

  teamName?: string | null;
  teamShort?: string | null;

  avatarUrl?: string | null;
  price?: number | null;
  points?: number | null;
  gwPoints?: number | null;
  formLast5?: string | null;
  isLady: boolean;

  // New FPL-inspired fields
  ownership?: number | null; // percentage of managers who own this player
  priceChange?: number | null; // positive = rising, negative = falling
  pointsHistory?: number[] | null; // last 5 GW points for sparkline
  nextOpponent?: string | null; // next fixture opponent short name
};

type ApiGameweek = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

const LS_PICKS = "tbl_picked_player_ids";
const LS_STARTING = "tbl_starting_player_ids";
const LS_SQUAD = "tbl_squad_player_ids"; // transfers key
const LS_CAPTAIN = "tbl_captain_id";
const LS_VICE = "tbl_vice_captain_id";

import {
  BUDGET_TOTAL,
  TEAM_SHORT_LOGOS,
  normalizePosition,
  shortPos,
  shortName,
  formatUGX,
  getTeamLogo,
  getKitColor,
  groupByPosition,
  splitStartingAndBench,
  Kit,
  EmptySlot,
} from "@/lib/pitch-helpers";

function loadIds(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

type TabKey = "pitch" | "list" | "squad";

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toString();
}

function formatForm(value?: string | null) {
  if (!value) return "--";
  return value;
}

function formatOwnership(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value}%`;
}

function formatDeadlineUG(iso?: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";

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
    .replace(/\./g, "")
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}


// ============================================
// FPL-INSPIRED COMPONENTS
// ============================================

// Mini sparkline chart for last 5 GW points
function FormSparkline({ history, size = "sm" }: { history?: number[] | null; size?: "sm" | "md" }) {
  const data = history ?? [0, 0, 0, 0, 0];
  const max = Math.max(...data, 1);
  const h = size === "sm" ? 16 : 24;
  const w = size === "sm" ? 40 : 60;
  const barW = (w - (data.length - 1) * 2) / data.length;

  return (
    <div className="flex items-end gap-0.5" style={{ height: h, width: w }}>
      {data.map((val, i) => {
        const barH = Math.max(2, (val / max) * h);
        const isLast = i === data.length - 1;
        return (
          <div
            key={i}
            className={cn(
              "rounded-sm transition-all",
              isLast ? "bg-primary" : "bg-primary/40"
            )}
            style={{ height: barH, width: barW }}
            title={`GW${i + 1}: ${val} pts`}
          />
        );
      })}
    </div>
  );
}

// Price change indicator (arrow up/down/neutral)
function PriceChangeIndicator({ change }: { change?: number | null }) {
  if (!change || change === 0) return null;

  const isRising = change > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold",
        isRising ? "text-emerald-500" : "text-rose-500"
      )}
    >
      {isRising ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isRising ? "+" : ""}{change.toFixed(1)}
    </span>
  );
}


// Player Detail Modal
function PlayerDetailModal({
  player,
  onClose,
  isPicked,
  isStarting,
  isCaptain,
  isVice,
  onPick,
  onRemove,
  onToggleStarting,
  onSetCaptain,
  onSetVice,
  onCompare,
  activeChip,
}: {
  player: Player;
  onClose: () => void;
  isPicked: boolean;
  isStarting: boolean;
  isCaptain: boolean;
  isVice: boolean;
  onPick: () => void;
  onRemove: () => void;
  onToggleStarting: () => void;
  onSetCaptain: () => void;
  onSetVice: () => void;
  onCompare: () => void;
  activeChip?: string | null;
}) {
  const displayName = shortName(player.name, player.webName);
  const logo = getTeamLogo(player.teamName, player.teamShort);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white p-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 grid place-items-center hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-2xl bg-white/20 border-2 border-white/40 overflow-hidden shrink-0">
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-2xl font-bold text-white/80">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold truncate">{player.name}</h2>
                {player.isLady && (
                  <span className="shrink-0 bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    • Lady
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                {logo && (
                  <img src={logo} alt="" className="h-5 w-5 rounded-full object-contain" />
                )}
                <span className="text-white/90">{player.teamName ?? player.teamShort}</span>
                <span className="text-white/60">•</span>
                <span className="text-white/90">{shortPos(player.position)}</span>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <span className="text-lg font-bold">{formatUGX(player.price)}</span>
                <PriceChangeIndicator change={player.priceChange} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="text-2xl font-bold text-primary">{formatNumber(player.points)}</div>
              <div className="text-xs text-muted-foreground">Total Pts</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="text-2xl font-bold">{formatNumber(player.gwPoints)}</div>
              <div className="text-xs text-muted-foreground">GW Pts</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="text-2xl font-bold">{formatOwnership(player.ownership)}</div>
              <div className="text-xs text-muted-foreground">Owned By</div>
            </div>
          </div>

          {/* Form section */}
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Form (Last 5 GWs)</span>
              <span className="text-sm font-bold text-primary">{formatForm(player.formLast5)}</span>
            </div>
            <FormSparkline history={player.pointsHistory} size="md" />
          </div>

          {/* Next fixture */}
          {player.nextOpponent && (
            <div className="rounded-xl border p-3 flex items-center justify-between">
              <span className="text-sm font-medium">Next Fixture</span>
              <div className="flex items-center gap-2">
                {TEAM_SHORT_LOGOS[player.nextOpponent] && (
                  <img
                    src={TEAM_SHORT_LOGOS[player.nextOpponent]}
                    alt=""
                    className="h-6 w-6 rounded-full object-contain"
                  />
                )}
                <span className="font-semibold">{player.nextOpponent}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {!isPicked ? (
              <Button onClick={onPick} className="w-full rounded-xl bg-primary">
                Add to Squad
              </Button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={onToggleStarting}
                    variant={isStarting ? "default" : "outline"}
                    className="rounded-xl"
                  >
                    {isStarting ? "In Starting XI" : "Add to Starting"}
                  </Button>
                  <Button onClick={onRemove} variant="outline" className="rounded-xl text-destructive">
                    Remove
                  </Button>
                </div>

                {isStarting && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={onSetCaptain}
                      variant={isCaptain ? "default" : "outline"}
                      className={cn("rounded-xl", isCaptain && activeChip === "triple_captain" ? "bg-red-600 hover:bg-red-700" : isCaptain && "bg-amber-500 hover:bg-amber-600")}
                    >
                      {isCaptain ? (activeChip === "triple_captain" ? "Triple Captain" : "Captain") : "Make Captain"}
                    </Button>
                    <Button
                      onClick={onSetVice}
                      variant={isVice ? "default" : "outline"}
                      className={cn("rounded-xl", isVice && "bg-sky-500 hover:bg-sky-600")}
                    >
                      {isVice ? "Vice-Captain" : "Make Vice"}
                    </Button>
                  </div>
                )}
              </>
            )}

            <Button onClick={onCompare} variant="outline" className="w-full rounded-xl gap-2">
              <Scale className="h-4 w-4" />
              Compare with another player
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compare Players Modal
function ComparePlayersModal({
  players,
  onClose,
}: {
  players: Player[];
  onClose: () => void;
}) {
  if (players.length < 2) return null;

  const [p1, p2] = players;

  const stats = [
    { label: "Total Points", key: "points" },
    { label: "GW Points", key: "gwPoints" },
    { label: "Price", key: "price", format: (v: number) => formatUGX(v) },
    { label: "Ownership", key: "ownership", format: (v: number) => `${v}%` },
    { label: "Form", key: "formLast5" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Compare Players</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted grid place-items-center hover:bg-muted/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Player headers */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="col-span-1" />
            {[p1, p2].map((p) => (
              <div key={p.id} className="text-center">
                <div className="h-14 w-14 mx-auto rounded-xl bg-muted overflow-hidden mb-2">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center font-bold">
                      {shortName(p.name, p.webName).charAt(0)}
                    </div>
                  )}
                </div>
                <div className="text-sm font-semibold truncate">{shortName(p.name, p.webName)}</div>
                <div className="text-xs text-muted-foreground">{p.teamShort}</div>
              </div>
            ))}
          </div>

          {/* Stats comparison */}
          <div className="space-y-2">
            {stats.map(({ label, key, format }) => {
              const v1 = (p1 as any)[key];
              const v2 = (p2 as any)[key];
              const n1 = typeof v1 === "number" ? v1 : parseFloat(v1) || 0;
              const n2 = typeof v2 === "number" ? v2 : parseFloat(v2) || 0;
              const winner = n1 > n2 ? 1 : n2 > n1 ? 2 : 0;

              return (
                <div key={key} className="grid grid-cols-3 gap-2 items-center py-2 border-b border-border/50">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div
                    className={cn(
                      "text-center font-semibold",
                      winner === 1 && "text-emerald-600"
                    )}
                  >
                    {format ? format(v1) : formatNumber(v1)}
                  </div>
                  <div
                    className={cn(
                      "text-center font-semibold",
                      winner === 2 && "text-emerald-600"
                    )}
                  >
                    {format ? format(v2) : formatNumber(v2)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form sparklines */}
          <div className="grid grid-cols-3 gap-2 items-center py-3 mt-2">
            <div className="text-xs text-muted-foreground">Form Chart</div>
            <div className="flex justify-center">
              <FormSparkline history={p1.pointsHistory} size="md" />
            </div>
            <div className="flex justify-center">
              <FormSparkline history={p2.pointsHistory} size="md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================
// FPL-style Player Info Bottom Sheet
// =====================
function PlayerInfoSheet({
  player,
  open,
  onOpenChange,
  isCaptain,
  isVice,
  isStarting,
  onSetCaptain,
  onSetVice,
  onSubstitute,
  activeChip,
}: {
  player: Player;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCaptain: boolean;
  isVice: boolean;
  isStarting: boolean;
  onSetCaptain: () => void;
  onSetVice: () => void;
  onSubstitute: () => void;
  activeChip?: string | null;
}) {
  const displayName = shortName(player.name, player.webName);
  const logo = getTeamLogo(player.teamName, player.teamShort);
  const kitColor = getKitColor(player.teamShort);
  const isGK = normalizePosition(player.position) === "Goalkeeper";
  const history = player.pointsHistory ?? [];
  const maxPts = Math.max(...history, 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[85vh] overflow-y-auto">
        <SheetTitle className="sr-only">{player.name}</SheetTitle>

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Player Header */}
        <div className="flex items-center gap-4 px-5 pb-4 border-b">
          <div className="relative shrink-0">
            <Kit color={kitColor} isGK={isGK} size={56} />
            {player.isLady && (
              <span
                className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[8px] text-white"
                style={{ background: "linear-gradient(135deg, #FF69B4, #FF1493)" }}
              >★</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground mb-1">
              {shortPos(player.position)}
            </span>
            <div className="text-lg font-bold truncate">{player.name}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {logo && <img src={logo} alt="" className="h-4 w-4 rounded-full object-contain" />}
              <span>{player.teamName ?? player.teamShort ?? "--"}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3">
          <div className="rounded-xl bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">Price</div>
            <div className="text-base font-bold text-primary">{formatUGX(player.price)}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">Total Pts</div>
            <div className="text-base font-bold">{formatNumber(player.points)}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">Form</div>
            <div className="text-base font-bold">{formatForm(player.formLast5)}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">Owned</div>
            <div className="text-base font-bold">{formatOwnership(player.ownership)}</div>
          </div>
        </div>

        {/* GW History Bar Chart */}
        {history.length > 0 && (
          <div className="px-5 py-2 border-t">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Gameweek History
            </div>
            <div className="flex items-end gap-1" style={{ height: 72 }}>
              {history.map((pts, i) => {
                const h = Math.max(4, (pts / maxPts) * 56);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold">{pts}</span>
                    <div
                      className={cn(
                        "w-full rounded-t-sm",
                        pts >= 8 ? "bg-emerald-500" : pts >= 5 ? "bg-sky-400" : pts >= 3 ? "bg-amber-400" : "bg-muted"
                      )}
                      style={{ height: h }}
                    />
                    <span className="text-[7px] text-muted-foreground">GW{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Captain / Vice Captain */}
        {isStarting && (
          <div className="grid grid-cols-2 gap-2 px-5 py-3 border-t">
            <button
              type="button"
              onClick={onSetCaptain}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
                isCaptain && activeChip === "triple_captain" ? "border-red-500 bg-red-50" : isCaptain ? "border-amber-500 bg-amber-50" : "border-border"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded-full grid place-items-center font-black",
                isCaptain && activeChip === "triple_captain" ? "text-white text-[9px]" : isCaptain ? "bg-amber-500 text-white text-xs" : "bg-muted text-muted-foreground text-xs"
              )} style={isCaptain && activeChip === "triple_captain" ? { background: "linear-gradient(135deg, #C8102E, #8B0000)" } : undefined}>
                {activeChip === "triple_captain" ? "TC" : "C"}
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">{activeChip === "triple_captain" ? "Triple Captain" : "Captain"}</div>
                <div className="text-[10px] text-muted-foreground">{activeChip === "triple_captain" ? "Triple points" : "Double points"}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={onSetVice}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
                isVice ? "border-sky-500 bg-sky-50" : "border-border"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded-full grid place-items-center text-xs font-black",
                isVice ? "bg-sky-500 text-white" : "bg-muted text-muted-foreground"
              )}>V</div>
              <div className="text-left">
                <div className="text-sm font-bold">Vice Captain</div>
                <div className="text-[10px] text-muted-foreground">Backup captain</div>
              </div>
            </button>
          </div>
        )}

        {/* Lady 2x info */}
        {player.isLady && (
          <div className="mx-5 mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
            style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.1), rgba(219,39,119,0.1))", border: "1px solid rgba(236,72,153,0.25)" }}>
            <span style={{ background: "linear-gradient(135deg, #FF69B4, #FF1493)", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>★</span>
            <div>
              <div className="font-bold text-pink-500 text-xs">Lady Player — 2x Points</div>
              <div className="text-[10px] text-muted-foreground">All points doubled automatically. Captain stacks to 4x!</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-5 pb-6 pt-2 space-y-2">
          <Button
            type="button"
            onClick={onSubstitute}
            className="w-full rounded-xl gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            Substitute
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl gap-2"
            asChild
          >
            <Link href={`/dashboard/players/${player.id}`}>
              <Info className="h-4 w-4" />
              Full Profile
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function PickTeamPage() {
  const [authed, setAuthed] = React.useState(false);

  const [players, setPlayers] = React.useState<Player[]>([]);
  const [pickedIds, setPickedIds] = React.useState<string[]>([]);
  const [startingIds, setStartingIds] = React.useState<string[]>([]);
  const [captainId, setCaptainId] = React.useState<string | null>(null);
  const [viceId, setViceId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Saved state tracking (for FPL-style confirm/cancel UI)
  const [savedPickedIds, setSavedPickedIds] = React.useState<string[]>([]);
  const [savedStartingIds, setSavedStartingIds] = React.useState<string[]>([]);
  const [savedCaptainId, setSavedCaptainId] = React.useState<string | null>(null);
  const [savedViceId, setSavedViceId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabKey>("pitch");

  // Player detail modal
  const [selectedPlayer, setSelectedPlayer] = React.useState<Player | null>(null);

  // Compare players
  const [compareMode, setCompareMode] = React.useState(false);
  const [comparePlayerIds, setComparePlayerIds] = React.useState<string[]>([]);

  // gameweeks (so we save roster per GW)
  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);

  // Substitution mode - track player selected for swap
  const [selectedForSwap, setSelectedForSwap] = React.useState<string | null>(null);
  const [sheetPlayer, setSheetPlayer] = React.useState<Player | null>(null);
  // List view: expanded player detail (inline instead of bottom sheet)
  const [expandedListId, setExpandedListId] = React.useState<string | null>(null);
  // Bench reorder: custom bench ordering (array of player IDs in desired order)
  const [benchOrder, setBenchOrder] = React.useState<string[]>([]);
  const [selectedBenchSwap, setSelectedBenchSwap] = React.useState<string | null>(null);
  const { toast } = useToast();

  // Chips state
  type ChipKey = "bench_boost" | "triple_captain" | "wildcard" | "free_hit";
  const LS_ACTIVE_CHIP = "tbl_active_chip";
  const LS_USED_CHIPS = "tbl_used_chips";
  const LS_FREE_HIT_BACKUP = "tbl_free_hit_backup";
  const LS_FREE_HIT_GW = "tbl_free_hit_gw";
  const [activeChip, setActiveChip] = React.useState<ChipKey | null>(null);
  const [usedChips, setUsedChips] = React.useState<ChipKey[]>([]);
  const [showFreeHitModal, setShowFreeHitModal] = React.useState(false);
  const [showBenchBoostModal, setShowBenchBoostModal] = React.useState(false);
  const [showTripleCaptainModal, setShowTripleCaptainModal] = React.useState(false);

  // Load chip state from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_ACTIVE_CHIP);
      if (saved) setActiveChip(saved as ChipKey);
      const used = localStorage.getItem(LS_USED_CHIPS);
      if (used) setUsedChips(JSON.parse(used));
    } catch { /* ignore */ }
  }, []);

  function toggleChip(chip: ChipKey) {
    if (usedChips.includes(chip)) {
      toast({ description: `${chip.replace("_", " ")} has already been used this season.`, variant: "destructive" });
      return;
    }
    // Free Hit gets a confirmation modal
    if (chip === "free_hit" && activeChip !== chip) {
      setShowFreeHitModal(true);
      return;
    }
    // Bench Boost gets a confirmation modal
    if (chip === "bench_boost" && activeChip !== chip) {
      setShowBenchBoostModal(true);
      return;
    }
    // Triple Captain gets a confirmation modal
    if (chip === "triple_captain" && activeChip !== chip) {
      setShowTripleCaptainModal(true);
      return;
    }
    if (activeChip === chip) {
      // Deactivate
      if (chip === "free_hit") {
        // Restore backup squad
        try {
          const backup = localStorage.getItem(LS_FREE_HIT_BACKUP);
          if (backup) {
            const backupIds: string[] = JSON.parse(backup);
            localStorage.setItem(LS_SQUAD, JSON.stringify(backupIds));
            localStorage.setItem(LS_PICKS, JSON.stringify(backupIds));
            localStorage.removeItem(LS_FREE_HIT_BACKUP);
            localStorage.removeItem(LS_FREE_HIT_GW);
            window.dispatchEvent(new Event("tbl_squad_updated"));
          }
        } catch { /* ignore */ }
      }
      setActiveChip(null);
      localStorage.removeItem(LS_ACTIVE_CHIP);
      toast({ description: `${chipLabel(chip)} deactivated` });
    } else {
      // Activate (only one chip at a time)
      setActiveChip(chip);
      localStorage.setItem(LS_ACTIVE_CHIP, chip);
      toast({ description: `${chipLabel(chip)} activated!` });
    }
  }

  function activateFreeHit() {
    // Backup current squad before activating
    try {
      const currentSquad = localStorage.getItem(LS_SQUAD);
      if (currentSquad) {
        localStorage.setItem(LS_FREE_HIT_BACKUP, currentSquad);
      }
      const gw = nextGW?.id ?? currentGW?.id ?? null;
      if (gw) localStorage.setItem(LS_FREE_HIT_GW, String(gw));
    } catch { /* ignore */ }
    setActiveChip("free_hit");
    localStorage.setItem(LS_ACTIVE_CHIP, "free_hit");
    setShowFreeHitModal(false);
    toast({ description: "Free Hit activated! Head to Transfers to rebuild your squad for this gameweek." });
  }

  function activateBenchBoost() {
    setActiveChip("bench_boost");
    localStorage.setItem(LS_ACTIVE_CHIP, "bench_boost");
    setShowBenchBoostModal(false);
    toast({ description: "Bench Boost activated! All 17 players will score this gameweek. Save your team to confirm." });
  }

  function activateTripleCaptain() {
    setActiveChip("triple_captain");
    localStorage.setItem(LS_ACTIVE_CHIP, "triple_captain");
    setShowTripleCaptainModal(false);
    const capName = captainId && playerById.get(captainId)
      ? shortName(playerById.get(captainId)?.name, playerById.get(captainId)?.webName)
      : "Your captain";
    toast({ description: `Triple Captain activated! ${capName}'s points will be tripled. Save your team to confirm.` });
  }

  function chipLabel(chip: ChipKey): string {
    const labels: Record<ChipKey, string> = {
      bench_boost: "Bench Boost",
      triple_captain: "Triple Captain",
      wildcard: "Wildcard",
      free_hit: "Free Hit",
    };
    return labels[chip];
  }

  function chipStatus(chip: ChipKey): string {
    if (usedChips.includes(chip)) return "Used";
    if (activeChip === chip) return "Active";
    return "Available";
  }

  const gwId = React.useMemo(() => nextGW?.id ?? currentGW?.id ?? null, [nextGW?.id, currentGW?.id]);

  // Upcoming fixtures for this gameweek
  type FixtureMatch = {
    id: string;
    kickoff_time: string | null;
    home_team: { name: string; logo_url: string | null } | null;
    away_team: { name: string; logo_url: string | null } | null;
    home_goals: number | null;
    away_goals: number | null;
    is_played: boolean | null;
  };
  const [gwFixtures, setGwFixtures] = React.useState<FixtureMatch[]>([]);

  // ----------------------------
  // auth state
  // ----------------------------
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session?.user?.email_confirmed_at));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user?.email_confirmed_at);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // ----------------------------
  // load gameweeks
  // ----------------------------
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
        // page can still work without GW (local save)
      } finally {
        setGwLoading(false);
      }
    })();
  }, []);

  // Fetch fixtures for the current gameweek
  React.useEffect(() => {
    if (!gwId) return;
    (async () => {
      try {
        const res = await fetch(`/api/matches?gw_id=${gwId}`, { cache: "no-store" });
        const json = await res.json();
        if (res.ok) setGwFixtures(json.matches ?? []);
      } catch {
        // non-critical
      }
    })();
  }, [gwId]);

  // ----------------------------
  // load local cache + all players
  // Squad comes from Transfers (LS_SQUAD), starting lineup is managed here
  // ----------------------------
  React.useEffect(() => {
    // Primary source: LS_SQUAD from Transfers page
    const squad = loadIds(LS_SQUAD);
    // Fallback to legacy picks if squad is empty
    const picks = squad.length > 0 ? squad : loadIds(LS_PICKS);
    const starting = loadIds(LS_STARTING);

    setPickedIds(picks);
    setStartingIds(starting);

    // Also update saved state for change tracking
    setSavedPickedIds(picks);
    setSavedStartingIds(starting);

    const savedCaptain = localStorage.getItem(LS_CAPTAIN);
    const savedVice = localStorage.getItem(LS_VICE);
    if (savedCaptain) {
      setCaptainId(savedCaptain);
      setSavedCaptainId(savedCaptain);
    }
    if (savedVice) {
      setViceId(savedVice);
      setSavedViceId(savedVice);
    }

    // Sync legacy key if needed
    if (squad.length > 0 && picks !== squad) {
      localStorage.setItem(LS_PICKS, JSON.stringify(squad));
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        setPlayers(
          (json.players ?? []).map((p: any) => {
            const ownershipRaw = Number(p.ownership);
            const ownership = Number.isFinite(ownershipRaw)
              ? Math.round(ownershipRaw * 10) / 10
              : 0;
            const priceChangeRaw = Number(p.priceChange ?? p.price_change);
            const priceChange = Number.isFinite(priceChangeRaw)
              ? Math.round(priceChangeRaw * 10) / 10
              : null;
            const pointsHistoryRaw = p.pointsHistory ?? p.points_history;
            const pointsHistory =
              Array.isArray(pointsHistoryRaw)
                ? pointsHistoryRaw
                    .map((v: any) => Number(v))
                    .filter((v: number) => Number.isFinite(v))
                : null;
            const nextOpponentRaw = p.nextOpponent ?? p.next_opponent ?? null;
            const nextOpponent =
              typeof nextOpponentRaw === "string" && nextOpponentRaw.trim().length > 0
                ? nextOpponentRaw.trim().toUpperCase()
                : null;

            return {
              id: String(p.id),
              name: String(p.name ?? p.webName ?? p.web_name ?? "--"),
              webName: p.webName ?? p.web_name ?? null,
              position: normalizePosition(p.position),

              teamShort: p.teamShort ?? p.team_short ?? null,
              teamName: p.teamName ?? p.team_name ?? null,

              avatarUrl: p.avatarUrl ?? p.avatar_url ?? null,
              price: Number(p.price ?? p.now_cost ?? NaN),
              points: Number(p.points ?? p.total_points ?? NaN),
              gwPoints: p.gw_points ?? p.points_this_gw ?? null,
              formLast5: p.form_last5 ?? p.form_last_5 ?? null,
              isLady: Boolean(p.isLady ?? p.is_lady),

              // Data-driven fields
              ownership,
              priceChange,
              pointsHistory: pointsHistory && pointsHistory.length > 0 ? pointsHistory : null,
              nextOpponent,
            };
          })
        );
      } catch (e: any) {
        setMsg(e?.message || "Failed to load players");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ----------------------------
  // load roster from DB (once signed in + gwId exists)
  // ----------------------------
  const [dbLoaded, setDbLoaded] = React.useState(false);

  function buildStartingFromSquad(squad: Player[]) {
    const points = (p: Player) => Number(p.points ?? 0);
    const isGK = (p: Player) => normalizePosition(p.position) === "Goalkeeper";
    const isDef = (p: Player) => normalizePosition(p.position) === "Defender";
    const isMid = (p: Player) => normalizePosition(p.position) === "Midfielder";
    const isFwd = (p: Player) => normalizePosition(p.position) === "Forward";

    const gks = squad.filter(isGK).sort((a, b) => points(b) - points(a));
    const defs = squad.filter(isDef).sort((a, b) => points(b) - points(a));
    const mids = squad.filter(isMid).sort((a, b) => points(b) - points(a));
    const fwds = squad.filter(isFwd).sort((a, b) => points(b) - points(a));

    // 10 starters: 1 GK + 9 outfield (DEF + MID + FWD = 9)
    // Lady forward is always included; maleFwd = totalFwd - 1
    const maleFwds = fwds.filter((p) => !p.isLady);
    const ladyFwd = fwds.find((p) => p.isLady);

    // Lady is mandatory — if no lady forward, can't build valid starting
    if (!ladyFwd) return [];

    // total FWD is 2–3 including the lady (lady always 1)
    // so maleFwd is 1–2
    const formations = [
      { gk: 1, def: 2, mid: 5, maleFwd: 1, totalFwd: 2 }, // 2-5-2
      { gk: 1, def: 2, mid: 4, maleFwd: 2, totalFwd: 3 }, // 2-4-3
      { gk: 1, def: 3, mid: 4, maleFwd: 1, totalFwd: 2 }, // 3-4-2
      { gk: 1, def: 3, mid: 3, maleFwd: 2, totalFwd: 3 }, // 3-3-3
    ];

    let best: Player[] = [];
    let bestScore = -1;

    for (const f of formations) {
      if (gks.length < 1 || defs.length < f.def || mids.length < f.mid || maleFwds.length < f.maleFwd) continue;

      const starting: Player[] = [];
      starting.push(gks[0]);
      starting.push(...defs.slice(0, f.def));
      starting.push(...mids.slice(0, f.mid));
      starting.push(...maleFwds.slice(0, f.maleFwd));
      starting.push(ladyFwd); // ensures lady is part of the 2 or 3 forwards

      if (starting.length !== 10) continue;

      const score = starting.reduce((sum, p) => sum + Number(p.points ?? 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = starting;
      }
    }

    return best.map((p) => p.id);
  }

  function buildAutoRoster(pool: Player[]) {
    const byPoints = [...pool].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const squad: Player[] = [];

    const isGK = (p: Player) => normalizePosition(p.position) === "Goalkeeper";
    const isDef = (p: Player) => normalizePosition(p.position) === "Defender";
    const isMid = (p: Player) => normalizePosition(p.position) === "Midfielder";
    const isMaleFwd = (p: Player) =>
      !p.isLady && normalizePosition(p.position) === "Forward";
    const isLadyFwd = (p: Player) =>
      p.isLady && normalizePosition(p.position) === "Forward";
    const addUnique = (p?: Player) => {
      if (!p) return;
      if (!squad.some((s) => s.id === p.id)) squad.push(p);
    };

    // Ensure required positions for valid formations:
    // Need 2 GK, at least 3 DEF, at least 5 MID, 2 lady FWD, at least 2 male FWD
    for (const p of byPoints) {
      if (isGK(p) && squad.filter(isGK).length < 2) addUnique(p);
    }
    for (const p of byPoints) {
      if (isLadyFwd(p) && squad.filter(isLadyFwd).length < 2) addUnique(p);
    }
    for (const p of byPoints) {
      if (isDef(p) && squad.filter(isDef).length < 3) addUnique(p);
    }
    for (const p of byPoints) {
      if (isMid(p) && squad.filter(isMid).length < 5) addUnique(p);
    }
    for (const p of byPoints) {
      if (isMaleFwd(p) && squad.filter(isMaleFwd).length < 2) addUnique(p);
    }

    // Fill remaining slots
    for (const p of byPoints) {
      if (squad.length >= 17) break;
      addUnique(p);
    }

    const squadIds = squad.slice(0, 17).map((p) => p.id);

    // Build starting 10 based on formation rules
    const startingIds = buildStartingFromSquad(squad);
    const startingPlayers = startingIds
      .map((id) => squad.find((p) => p.id === id))
      .filter(Boolean) as Player[];
    const startingByPoints = [...startingPlayers].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const captainId = startingByPoints[0]?.id ?? null;
    const viceId = startingByPoints[1]?.id ?? null;

    return { squadIds, startingIds, captainId, viceId };
  }

  React.useEffect(() => {
    if (!authed) return;
    if (!gwId) return;
    if (dbLoaded) return;
    if (loading) return;
    if (players.length === 0) return;

    (async () => {
      try {
        setMsg(null);
        const data = await loadRosterFromDb(gwId);

        // Only use DB data if localStorage doesn't already have a full 17-player squad.
        // Transfers writes to localStorage before redirecting here, and the DB save
        // may have failed (e.g. trigger issues), so localStorage is the fresher source.
        const localSquad = loadIds(LS_SQUAD);
        const localHasFullSquad = localSquad.length === 17;

        if (Array.isArray(data.squadIds) && data.squadIds.length > 0) {
          if (!localHasFullSquad) {
            setPickedIds(data.squadIds);
            setStartingIds(data.startingIds ?? []);
            setSavedPickedIds(data.squadIds);
            setSavedStartingIds(data.startingIds ?? []);

            localStorage.setItem(LS_PICKS, JSON.stringify(data.squadIds));
            localStorage.setItem(LS_SQUAD, JSON.stringify(data.squadIds));
            localStorage.setItem(LS_STARTING, JSON.stringify(data.startingIds ?? []));
          } else {
            // localStorage has a full squad (likely from Transfers) — keep it,
            // but still record the DB saved state for change tracking
            setSavedPickedIds(data.squadIds);
            setSavedStartingIds(data.startingIds ?? []);
          }
        }

        if (data.captainId) {
          if (!localHasFullSquad) {
            setCaptainId(data.captainId);
            localStorage.setItem(LS_CAPTAIN, data.captainId);
          }
          setSavedCaptainId(data.captainId);
        }
        if (data.viceId) {
          if (!localHasFullSquad) {
            setViceId(data.viceId);
            localStorage.setItem(LS_VICE, data.viceId);
          }
          setSavedViceId(data.viceId);
        }

        if (data.teamName) localStorage.setItem("tbl_team_name", data.teamName);

        // If we have a valid squad from either source, we're done
        if ((Array.isArray(data.squadIds) && data.squadIds.length > 0) || localHasFullSquad) {
          setDbLoaded(true);
          return;
        }

        // No roster in DB - auto-build a full squad so pitch has no ghost slots
      const auto = buildAutoRoster(players);
      if (auto.squadIds.length > 0) {
        setPickedIds(auto.squadIds);
        setStartingIds(auto.startingIds);
        setCaptainId(auto.captainId);
        setViceId(auto.viceId);

        setSavedPickedIds(auto.squadIds);
        setSavedStartingIds(auto.startingIds);
        setSavedCaptainId(auto.captainId);
        setSavedViceId(auto.viceId);

        localStorage.setItem(LS_PICKS, JSON.stringify(auto.squadIds));
        localStorage.setItem(LS_SQUAD, JSON.stringify(auto.squadIds));
        localStorage.setItem(LS_STARTING, JSON.stringify(auto.startingIds));
        if (auto.captainId) localStorage.setItem(LS_CAPTAIN, auto.captainId);
        if (auto.viceId) localStorage.setItem(LS_VICE, auto.viceId);
      }

      if (
        auto.squadIds.length === 17 &&
        auto.startingIds.length === 10 &&
        auto.captainId &&
        auto.viceId
      ) {
        const teamName = (localStorage.getItem("tbl_team_name") || "My Team").trim();
        await upsertTeamName(teamName);
        await saveRosterToDb({
          gameweekId: gwId,
          squadIds: auto.squadIds,
          startingIds: auto.startingIds,
          captainId: auto.captainId,
          viceId: auto.viceId,
        });
        setMsg("Auto-picked your squad for this gameweek.");
      } else {
        setMsg("Auto-picked a starter squad. Please review and save.");
      }

      setDbLoaded(true);
    } catch {
      setDbLoaded(true);
    }
    })();
  }, [authed, gwId, dbLoaded, loading, players]);

  const playerById = React.useMemo(() => {
    return new Map(players.map((p) => [p.id, p]));
  }, [players]);

  // --- Formation validator (reused by toggle, swap, save) ---
  function getStartingCounts(ids: string[]) {
    const ps = ids.map((id) => playerById.get(id)).filter(Boolean) as Player[];
    const count = (pos: string) => ps.filter((p) => normalizePosition(p.position) === pos).length;

    const GK = count("Goalkeeper");
    const DEF = count("Defender");
    const MID = count("Midfielder");
    const FWD = count("Forward");
    const ladyFwd = ps.filter((p) => p.isLady && normalizePosition(p.position) === "Forward").length;
    const ladyNonFwd = ps.filter((p) => p.isLady && normalizePosition(p.position) !== "Forward").length;

    return { GK, DEF, MID, FWD, ladyFwd, ladyNonFwd };
  }

  function validateStarting10(ids: string[]): string | null {
    if (ids.length !== 10) return null; // only enforce when lineup is complete

    const { GK, DEF, MID, FWD, ladyFwd, ladyNonFwd } = getStartingCounts(ids);

    if (GK !== 1) return "Starting lineup must include exactly 1 goalkeeper.";
    if (DEF < 2 || DEF > 3) return "Defenders must be between 2 and 3.";
    if (MID < 3 || MID > 5) return "Midfielders must be between 3 and 5.";
    if (FWD < 2 || FWD > 3) return "Forwards must be between 2 and 3 (including the lady).";
    if (ladyFwd !== 1) return "Starting lineup must include exactly 1 lady forward.";
    if (ladyNonFwd > 0) return "Lady players can only start as forwards.";

    return null;
  }

  // derived
  const picked = React.useMemo(
    () => players.filter((p) => pickedIds.includes(p.id)),
    [players, pickedIds]
  );

  const starting = React.useMemo(
    () => players.filter((p) => startingIds.includes(p.id)),
    [players, startingIds]
  );

  const bench = React.useMemo(() => {
    const benchPlayers = picked.filter((p) => !startingIds.includes(p.id));
    // Apply custom bench ordering if available
    if (benchOrder.length > 0) {
      const ordered: Player[] = [];
      for (const id of benchOrder) {
        const p = benchPlayers.find((bp) => bp.id === id);
        if (p) ordered.push(p);
      }
      // Add any bench players not yet in the order
      for (const p of benchPlayers) {
        if (!ordered.some((o) => o.id === p.id)) ordered.push(p);
      }
      return ordered;
    }
    return benchPlayers;
  }, [picked, startingIds, benchOrder]);

  const startingByPos = React.useMemo(() => groupByPosition(starting), [starting]);

  const pickedLadyForwards = picked.filter(
    (p) => p.isLady && normalizePosition(p.position) === "Forward"
  );
  const pickedGoalkeepers = picked.filter(
    (p) => normalizePosition(p.position) === "Goalkeeper"
  );
  const startingGoalkeepers = startingByPos.Goalkeepers.length;
  const startingDefenders = startingByPos.Defenders.length;
  const startingMidfielders = startingByPos.Midfielders.length;
  const startingForwards = startingByPos.Forwards.length;
  const startingLadyForwards = starting.filter(
    (p) => p.isLady && normalizePosition(p.position) === "Forward"
  ).length;
  const startingLadyNonForwards = starting.filter(
    (p) => p.isLady && normalizePosition(p.position) !== "Forward"
  ).length;

  const budgetUsed = picked.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const budgetRemaining = Math.max(0, BUDGET_TOTAL - budgetUsed);
  const budgetPercent = Math.min(100, Math.max(0, (budgetUsed / BUDGET_TOTAL) * 100));

  const captainName =
    captainId && playerById.get(captainId)
      ? shortName(playerById.get(captainId)?.name, playerById.get(captainId)?.webName)
      : "--";
  const viceName =
    viceId && playerById.get(viceId)
      ? shortName(playerById.get(viceId)?.name, playerById.get(viceId)?.webName)
      : "--";

  const deadlineLabel = formatDeadlineUG(nextGW?.deadline_time ?? currentGW?.deadline_time);
  const currentGwLabel = gwId ? `Gameweek ${gwId}` : "Gameweek --";
  const chipsList: { key: ChipKey; name: string; icon: React.ReactNode }[] = [
    { key: "bench_boost", name: "Bench Boost", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M4 14h16M6 10V4h12v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v4h16v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )},
    { key: "triple_captain", name: "Triple Captain", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6l3-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )},
    { key: "wildcard", name: "Wildcard", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )},
    { key: "free_hit", name: "Free Hit", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )},
  ];

  const listSections = [
    { title: "Goalkeepers", players: startingByPos.Goalkeepers },
    { title: "Defenders", players: startingByPos.Defenders },
    { title: "Midfielders", players: startingByPos.Midfielders },
    { title: "Forwards", players: startingByPos.Forwards },
  ];

  // Check if there are unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    const pickedChanged = JSON.stringify([...pickedIds].sort()) !== JSON.stringify([...savedPickedIds].sort());
    const startingChanged = JSON.stringify([...startingIds].sort()) !== JSON.stringify([...savedStartingIds].sort());
    const captainChanged = captainId !== savedCaptainId;
    const viceChanged = viceId !== savedViceId;
    return pickedChanged || startingChanged || captainChanged || viceChanged;
  }, [pickedIds, startingIds, captainId, viceId, savedPickedIds, savedStartingIds, savedCaptainId, savedViceId]);

  React.useEffect(() => {
    if (captainId && !startingIds.includes(captainId)) setCaptainId(null);
    if (viceId && !startingIds.includes(viceId)) setViceId(null);
  }, [startingIds, captainId, viceId]);

  // ----------------------------
  // actions
  // ----------------------------
  function addToSquad(id: string) {
    setMsg(null);

    setPickedIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 17) {
        setMsg("You can only pick 17 players.");
        return prev;
      }
      const player = playerById.get(id);
      if (player?.isLady && normalizePosition(player.position) === "Forward") {
        const currentLadyForwards = pickedLadyForwards.length;
        if (currentLadyForwards >= 2) {
          setMsg("Only 2 lady forwards are allowed in the squad.");
          return prev;
        }
      }
      if (player && normalizePosition(player.position) === "Goalkeeper") {
        const currentGoalkeepers = pickedGoalkeepers.length;
        if (currentGoalkeepers >= 2) {
          setMsg("Only 2 goalkeepers are allowed in the squad.");
          return prev;
        }
      }
      return [...prev, id];
    });
  }

  function removeFromSquad(id: string) {
    setMsg(null);
    setPickedIds((prev) => prev.filter((x) => x !== id));
    setStartingIds((prev) => prev.filter((x) => x !== id)); // auto remove from starting
    if (captainId === id) setCaptainId(null);
    if (viceId === id) setViceId(null);
  }

  function toggleStarting(id: string) {
  setMsg(null);

  if (!pickedIds.includes(id)) {
    setMsg("Pick the player first, then add to starting 10.");
    return;
  }

  const player = playerById.get(id);
  if (!player) return;

  setStartingIds((prev) => {
    const has = prev.includes(id);
    const pos = normalizePosition(player.position);

    // --- LADY RULE (fix) ---
    if (player.isLady) {
      if (pos !== "Forward") {
        setMsg("Lady players can only start as forwards.");
        return prev;
      }

      // don’t allow removing lady from starting
      if (has) {
        setMsg("Lady forward must stay in Starting 10. Use swap to change the lady.");
        return prev;
      }

      // only 1 lady forward in starting
      const c0 = getStartingCounts(prev);
      if (c0.ladyFwd >= 1) {
        setMsg("Starting lineup must include exactly 1 lady forward.");
        return prev;
      }

      if (prev.length >= 10) {
        setMsg("Starting lineup is only 10 players.");
        return prev;
      }

      const next = [...prev, id];
      const err = validateStarting10(next);
      if (err) {
        setMsg(err);
        return prev;
      }
      return next;
    }

    // remove (male or GK) — allow while editing
    if (has) {
      return prev.filter((x) => x !== id);
    }

    // add
    if (prev.length >= 10) {
      setMsg("Starting lineup is only 10 players.");
      return prev;
    }

    // use fresh counts from prev
    const c = getStartingCounts(prev);

    if (pos === "Goalkeeper" && c.GK >= 1) {
      setMsg("Only one goalkeeper can start.");
      return prev;
    }
    if (pos === "Defender" && c.DEF >= 3) {
      setMsg("Defenders are limited to 3.");
      return prev;
    }
    if (pos === "Midfielder" && c.MID >= 5) {
      setMsg("Midfielders are limited to 5.");
      return prev;
    }
    if (pos === "Forward" && c.FWD >= 3) {
      setMsg("Forwards are limited to 3 (including the lady).");
      return prev;
    }

    const next = [...prev, id];

    // only enforce full rules when lineup hits 10
    const err = validateStarting10(next);
    if (err) {
      setMsg(err);
      return prev;
    }

    return next;
  });
}

  // Swap two players (one starting, one bench). Returns true on success.
  function swapPlayers(id1: string, id2: string): boolean {
    setMsg(null);

    const player1 = playerById.get(id1);
    const player2 = playerById.get(id2);
    if (!player1 || !player2) return false;

    const isId1Starting = startingIds.includes(id1);
    const isId2Starting = startingIds.includes(id2);

    if (isId1Starting === isId2Starting) {
      setMsg("Select one starting player and one bench player to swap.");
      return false;
    }

    const startingPlayer = isId1Starting ? player1 : player2;
    const benchPlayer = isId1Starting ? player2 : player1;
    const startingId = isId1Starting ? id1 : id2;
    const benchId = isId1Starting ? id2 : id1;

    // Goalkeeper can only swap with goalkeeper
    const startingPos = normalizePosition(startingPlayer.position);
    const benchPos = normalizePosition(benchPlayer.position);
    if (startingPos === "Goalkeeper" && benchPos !== "Goalkeeper") {
      setMsg("A goalkeeper can only be swapped with another goalkeeper.");
      return false;
    }
    if (benchPos === "Goalkeeper" && startingPos !== "Goalkeeper") {
      setMsg("A goalkeeper can only be swapped with another goalkeeper.");
      return false;
    }

    // Lady can only swap with lady
    if (startingPlayer.isLady && !benchPlayer.isLady) {
      setMsg("A lady player can only be swapped with another lady.");
      return false;
    }
    if (benchPlayer.isLady && !startingPlayer.isLady) {
      setMsg("A lady player can only be swapped with another lady.");
      return false;
    }

    // If swapping two GKs, just do it directly
    if (startingPos === "Goalkeeper" && benchPos === "Goalkeeper") {
      setStartingIds((prev) => {
        const updated = prev.filter((id) => id !== startingId);
        return [...updated, benchId];
      });
      if (captainId === startingId) {
        setCaptainId(benchId);
        localStorage.setItem(LS_CAPTAIN, benchId);
      }
      if (viceId === startingId) {
        setViceId(benchId);
        localStorage.setItem(LS_VICE, benchId);
      }
      return true;
    }

    // If swapping two ladies, just do it (lady always stays in starting)
    if (startingPlayer.isLady && benchPlayer.isLady) {
      setStartingIds((prev) => {
        const updated = prev.filter((id) => id !== startingId);
        return [...updated, benchId];
      });
      if (captainId === startingId) {
        setCaptainId(benchId);
        localStorage.setItem(LS_CAPTAIN, benchId);
      }
      if (viceId === startingId) {
        setViceId(benchId);
        localStorage.setItem(LS_VICE, benchId);
      }
      return true;
    }

    // Simulate the swap and validate the resulting formation
    const nextStarting = startingIds
      .filter((id) => id !== startingId)
      .concat(benchId);

    const formationErr = validateStarting10(nextStarting);
    if (formationErr) {
      setMsg(formationErr);
      return false;
    }

    // Perform the swap
    setStartingIds((prev) => {
      const updated = prev.filter((id) => id !== startingId);
      return [...updated, benchId];
    });

    // Update captain/vice if needed
    if (captainId === startingId) {
      setCaptainId(benchId);
      localStorage.setItem(LS_CAPTAIN, benchId);
    }
    if (viceId === startingId) {
      setViceId(benchId);
      localStorage.setItem(LS_VICE, benchId);
    }
    return true;
  }

  // Pure predicate: can sourceId swap with targetId?
  function canSwapWith(sourceId: string, targetId: string): boolean {
    const source = playerById.get(sourceId);
    const target = playerById.get(targetId);
    if (!source || !target || sourceId === targetId) return false;

    const isSourceStarting = startingIds.includes(sourceId);
    const isTargetStarting = startingIds.includes(targetId);
    if (isSourceStarting === isTargetStarting) return false;

    const startingP = isSourceStarting ? source : target;
    const benchP = isSourceStarting ? target : source;
    const sPos = normalizePosition(startingP.position);
    const bPos = normalizePosition(benchP.position);

    if (sPos === "Goalkeeper" && bPos !== "Goalkeeper") return false;
    if (bPos === "Goalkeeper" && sPos !== "Goalkeeper") return false;
    if (startingP.isLady && !benchP.isLady) return false;
    if (benchP.isLady && !startingP.isLady) return false;
    if (sPos === "Goalkeeper" && bPos === "Goalkeeper") return true;
    if (startingP.isLady && benchP.isLady) return true;

    // Simulate the swap and validate
    const startingId = isSourceStarting ? sourceId : targetId;
    const benchId = isSourceStarting ? targetId : sourceId;
    const nextStarting = startingIds
      .filter((id) => id !== startingId)
      .concat(benchId);

    return validateStarting10(nextStarting) === null;
  }

  function setCaptain(id: string) {
    if (!startingIds.includes(id)) {
      setMsg("Captain must be in the starting 10.");
      return;
    }
    setCaptainId(id);
    localStorage.setItem(LS_CAPTAIN, id);
    if (viceId === id) {
      setViceId(null);
      localStorage.removeItem(LS_VICE);
    }
  }

  function setVice(id: string) {
    if (!startingIds.includes(id)) {
      setMsg("Vice-captain must be in the starting 10.");
      return;
    }
    setViceId(id);
    localStorage.setItem(LS_VICE, id);
    if (captainId === id) {
      setCaptainId(null);
      localStorage.removeItem(LS_CAPTAIN);
    }
  }

  // Auto-pick function
  function autoPick() {
    setMsg(null);

    const currentPicked = [...pickedIds];
    const currentBudget = picked.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
    let remainingBudget = BUDGET_TOTAL - currentBudget;

    const pickedSet = new Set(currentPicked);
    const available = players.filter((p) => !pickedSet.has(p.id));

    // Count current positions
    const currentGKs = picked.filter((p) => normalizePosition(p.position) === "Goalkeeper").length;
    const currentLadyFwds = picked.filter((p) => p.isLady && normalizePosition(p.position) === "Forward").length;

    // Sort by points (best value)
    const sortedByValue = [...available].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

    const newPicks: string[] = [];

    // First, fill required positions
    // Need 2 GKs
    if (currentGKs < 2) {
      const gks = sortedByValue.filter(
        (p) => normalizePosition(p.position) === "Goalkeeper" && (p.price ?? 0) <= remainingBudget
      );
      for (const gk of gks) {
        if (currentGKs + newPicks.filter((id) => normalizePosition(playerById.get(id)?.position) === "Goalkeeper").length >= 2) break;
        if (currentPicked.length + newPicks.length >= 17) break;
        newPicks.push(gk.id);
        remainingBudget -= gk.price ?? 0;
      }
    }

    // Need 2 lady forwards
    if (currentLadyFwds < 2) {
      const ladyFwds = sortedByValue.filter(
        (p) => p.isLady && normalizePosition(p.position) === "Forward" && (p.price ?? 0) <= remainingBudget && !newPicks.includes(p.id)
      );
      for (const lf of ladyFwds) {
        if (currentLadyFwds + newPicks.filter((id) => {
          const pl = playerById.get(id);
          return pl?.isLady && normalizePosition(pl.position) === "Forward";
        }).length >= 2) break;
        if (currentPicked.length + newPicks.length >= 17) break;
        newPicks.push(lf.id);
        remainingBudget -= lf.price ?? 0;
      }
    }

    // Fill remaining slots with best available
    const remaining = sortedByValue.filter(
      (p) => !newPicks.includes(p.id) && (p.price ?? 0) <= remainingBudget
    );

    for (const p of remaining) {
      if (currentPicked.length + newPicks.length >= 17) break;
      if ((p.price ?? 0) > remainingBudget) continue;

      // Check position limits
      const pos = normalizePosition(p.position);
      const isLadyFwd = p.isLady && pos === "Forward";

      if (pos === "Goalkeeper") {
        const totalGKs = currentGKs + newPicks.filter((id) => normalizePosition(playerById.get(id)?.position) === "Goalkeeper").length;
        if (totalGKs >= 2) continue;
      }

      if (isLadyFwd) {
        const totalLadyFwds = currentLadyFwds + newPicks.filter((id) => {
          const pl = playerById.get(id);
          return pl?.isLady && normalizePosition(pl.position) === "Forward";
        }).length;
        if (totalLadyFwds >= 2) continue;
      }

      newPicks.push(p.id);
      remainingBudget -= p.price ?? 0;
    }

    if (newPicks.length === 0) {
      setMsg("No more players can be added within budget.");
      return;
    }

    setPickedIds([...currentPicked, ...newPicks]);
    setMsg(`Auto-picked ${newPicks.length} player${newPicks.length > 1 ? "s" : ""}.`);
  }

  // Auto-select starting 10
  function autoSelectStarting() {
    setMsg(null);

    if (pickedIds.length < 10) {
      setMsg("Pick at least 10 players first.");
      return;
    }

    const newStarting = buildStartingFromSquad(picked);

    if (newStarting.length < 10) {
      setMsg("Not enough players to form a valid starting 10.");
      return;
    }

    setStartingIds(newStarting);
    setMsg("Auto-selected starting 10 based on points.");
  }

  function resetStartingLineup() {
    // Only reset starting lineup, captain, and vice - keep the squad intact
    setStartingIds([]);
    setCaptainId(null);
    setViceId(null);
    setMsg("Starting lineup has been reset. Tap players to select your starting 10.");
  }

  function cancelChanges() {
    setPickedIds(savedPickedIds);
    setStartingIds(savedStartingIds);
    setCaptainId(savedCaptainId);
    setViceId(savedViceId);
    setMsg(null);
  }

  function swapBenchOrder(id1: string, id2: string) {
    setBenchOrder((prev) => {
      // Initialize from current bench if no custom order yet
      const currentBench = picked.filter((p) => !startingIds.includes(p.id));
      const order = prev.length > 0 ? [...prev] : currentBench.map((p) => p.id);
      const i1 = order.indexOf(id1);
      const i2 = order.indexOf(id2);
      if (i1 === -1 || i2 === -1) return prev;
      [order[i1], order[i2]] = [order[i2], order[i1]];
      return order;
    });
    toast({ description: "Bench order updated" });
  }

  async function save() {
    setMsg(null);

    // rules
    if (pickedIds.length !== 17) return setMsg("Squad must be exactly 17 players.");
    if (pickedGoalkeepers.length !== 2) {
      return setMsg("Squad must include exactly 2 goalkeepers.");
    }
    if (pickedLadyForwards.length < 2) {
      return setMsg("Squad must include 2 lady forwards.");
    }
    if (pickedLadyForwards.length > 2) {
      return setMsg("Only 2 lady forwards are allowed in the squad.");
    }
    if (startingIds.length !== 10) {
      return setMsg("Starting lineup must be exactly 10 players.");
    }
    if (startingGoalkeepers !== 1) {
      return setMsg("Starting lineup must include exactly 1 goalkeeper.");
    }
    if (startingForwards < 2 || startingForwards > 3) {
      return setMsg("Starting forwards must be between 2 and 3 (including the lady).");
    }
    if (startingLadyForwards !== 1) {
      return setMsg("Starting lineup must include exactly 1 lady forward.");
    }
    if (startingLadyNonForwards > 0) {
      return setMsg("Lady players can only start as forwards.");
    }
    if (startingDefenders < 2 || startingDefenders > 3) {
      return setMsg("Starting defenders must be between 2 and 3.");
    }
    if (startingMidfielders < 3 || startingMidfielders > 5) {
      return setMsg("Starting midfielders must be between 3 and 5.");
    }
    if (!captainId || !viceId) {
      return setMsg("Please choose a Captain and Vice-captain.");
    }

    // local cache
    localStorage.setItem(LS_PICKS, JSON.stringify(pickedIds));
    localStorage.setItem(LS_SQUAD, JSON.stringify(pickedIds));
    localStorage.setItem(LS_STARTING, JSON.stringify(startingIds));
    if (captainId) localStorage.setItem(LS_CAPTAIN, captainId);
    if (viceId) localStorage.setItem(LS_VICE, viceId);

    // DB save
    if (!authed) return setMsg("Saved locally. Sign in to save to database.");
    if (!gwId) return setMsg("Saved locally. (No gameweek yet, DB save skipped).");

    try {
      const teamName = (localStorage.getItem("tbl_team_name") || "My Team").trim();
      await upsertTeamName(teamName);

      await saveRosterToDb({
        gameweekId: gwId,
        squadIds: pickedIds,
        startingIds,
        captainId,
        viceId,
      });

      // Update saved state after successful save
      setSavedPickedIds(pickedIds);
      setSavedStartingIds(startingIds);
      setSavedCaptainId(captainId);
      setSavedViceId(viceId);

      // Mark active chip as used after successful save
      if (activeChip) {
        const newUsed = [...usedChips, activeChip];
        setUsedChips(newUsed);
        localStorage.setItem(LS_USED_CHIPS, JSON.stringify(newUsed));
        const chipName = chipLabel(activeChip);
        setActiveChip(null);
        localStorage.removeItem(LS_ACTIVE_CHIP);
        toast({ description: `Team saved! ${chipName} has been applied.`, duration: 3000 });
      } else {
        toast({ description: "Your team has been saved!", duration: 3000 });
      }
      setMsg(null);
    } catch (e: any) {
      toast({ description: `Saved locally. DB error: ${e?.message ?? "Unknown"}`, variant: "destructive", duration: 4000 });
    }
  }

  // ----------------------------
  // UI components
  // ----------------------------
  function TeamBadge({
    teamName,
    teamShort,
    size = "md",
  }: {
    teamName?: string | null;
    teamShort?: string | null;
    size?: "sm" | "md";
  }) {
  const logo = getTeamLogo(teamName, teamShort);
  const label =
      (teamShort ?? teamName ?? "--").toString().trim().slice(0, 3).toUpperCase() || "--";

    const sizeClass = size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";

    if (logo) {
      return (
        <img
          src={logo}
          alt={teamName ?? teamShort ?? "Team badge"}
          className={cn(sizeClass, "rounded-full object-contain")}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div
        className={cn(
          sizeClass,
          "rounded-full bg-white/10 grid place-items-center text-white/90 font-semibold"
        )}
      >
        {label}
      </div>
    );
  }

  /* ── FPL Style Player Card ── */
  function PlayerCard({ player, isGK = false, small = false }: {
    player: { name: string; team: string; fixture: string; color: string; price?: number | null; captain?: boolean; viceCaptain?: boolean; star?: boolean; warning?: boolean };
    isGK?: boolean;
    small?: boolean;
  }) {
    const sz = small ? 48 : 56;
    const cardW = small ? 64 : 72;
    return (
      <div className="relative" style={{ width: cardW }}>
        {/* Badges — floating above the card */}
        {player.captain && (
          <span
            style={{
              position: "absolute", top: -6, left: -6, zIndex: 4,
              background: activeChip === "triple_captain"
                ? "linear-gradient(135deg, #C8102E, #8B0000)"
                : "linear-gradient(135deg, #FFD700, #FFA500)",
              color: activeChip === "triple_captain" ? "#fff" : "#000",
              fontSize: activeChip === "triple_captain" ? 8 : 10,
              fontWeight: 900,
              width: 18, height: 18, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: activeChip === "triple_captain" ? "2px solid #FFD700" : "2px solid #fff",
              boxShadow: activeChip === "triple_captain"
                ? "0 2px 6px rgba(200,16,46,0.6)"
                : "0 2px 4px rgba(0,0,0,0.4)",
            }}
          >{activeChip === "triple_captain" ? "TC" : "C"}</span>
        )}
        {player.viceCaptain && (
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
        {player.star && (
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
        {player.warning && (
          <span
            style={{
              position: "absolute", top: -6, right: -6, zIndex: 4,
              background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000", fontSize: 11, fontWeight: 900,
              width: 18, height: 18, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
            }}
          >!</span>
        )}

        {/* Card body */}
        <div
          className="flex flex-col items-center"
          style={{
            width: cardW,
            borderRadius: small ? 6 : 8,
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
        {/* Kit section — transparent top */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(100,100,100,0.22) 100%)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: small ? "3px 4px 0" : "3px 6px 0",
            backdropFilter: "blur(2px)",
          }}
        >
          {/* Price badge */}
          <div style={{
            fontSize: small ? 7 : 8,
            fontWeight: 700,
            color: "#fff",
            background: "rgba(0,0,0,0.45)",
            padding: "1px 6px",
            borderRadius: 6,
            marginBottom: small ? 1 : 2,
            textAlign: "center",
          }}>
            {player.price ? `${Number(player.price).toFixed(1)}m` : "--"}
          </div>
          <Kit color={player.color} isGK={isGK} size={sz} />
        </div>

        {/* Name plate */}
        <div
          style={{
            background: player.captain && activeChip === "triple_captain"
              ? "linear-gradient(135deg, #C8102E, #8B0000)"
              : player.captain
              ? "linear-gradient(135deg, #FFD700, #FFA500)"
              : "#f5e6c8",
            color: player.captain && activeChip === "triple_captain" ? "#fff" : "#1a1a2e",
            fontSize: small ? 10 : 11,
            fontWeight: 700,
            padding: "2px 4px",
            textAlign: "center",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>

        {/* Fixture plate */}
        <div
          style={{
            background: player.captain && activeChip === "triple_captain"
              ? "linear-gradient(180deg, #8B0000, #5c0000)"
              : player.captain
              ? "linear-gradient(180deg, #e6c200, #d4a800)"
              : "linear-gradient(180deg, #37003C, #2d0032)",
            color: player.captain && activeChip === "triple_captain" ? "#FFD700" : player.captain ? "#1a1a2e" : "#fff",
            fontSize: small ? 9 : 10,
            fontWeight: 600,
            padding: "2px 4px",
            textAlign: "center",
            width: "100%",
          }}
        >
          {player.fixture}
        </div>
        </div>
      </div>
    );
  }

  function PitchPlayerCard({
    player,
    onToggle,
    isCaptain,
    isVice,
    isStarting = false,
    small = false,
  }: {
    player: Player;
    onToggle: () => void;
    isCaptain: boolean;
    isVice: boolean;
    isStarting?: boolean;
    small?: boolean;
  }) {
    const displayName = shortName(player.name, player.webName);
    const fixture = player.nextOpponent ?? "--";
    const teamShort = player.teamShort ?? "--";
    const isGK = normalizePosition(player.position) === "Goalkeeper";
    const kitColor = getKitColor(player.teamShort);

    // Transform to PlayerCard format
    const cardPlayer = {
      name: displayName,
      team: teamShort,
      fixture: fixture,
      color: kitColor,
      price: player.price,
      captain: isCaptain,
      viceCaptain: isVice,
      star: player.isLady, // Show star for lady players
    };

    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "active:scale-[0.96] transition-transform duration-150",
          isStarting && "ring-2 ring-emerald-400 rounded-lg"
        )}
        aria-label={`Select ${displayName}`}
      >
        <PlayerCard player={cardPlayer} isGK={isGK} small={small} />
      </button>
    );
  }

  function PickPitch({
    picked,
    startingIds,
    onSwapPlayers,
    captainId,
    viceId,
    selectedForSwap,
    onSelectForSwap,
    onOpenSheet,
    canSwapWithFn,
    selectedBenchSwap,
    onSelectBenchSwap,
    onSwapBench,
  }: {
    picked: Player[];
    startingIds: string[];
    onSwapPlayers: (id1: string, id2: string) => void;
    captainId: string | null;
    viceId: string | null;
    selectedForSwap: string | null;
    onSelectForSwap: (id: string | null) => void;
    onOpenSheet: (player: Player) => void;
    canSwapWithFn: (sourceId: string, targetId: string) => boolean;
    selectedBenchSwap: string | null;
    onSelectBenchSwap: (id: string | null) => void;
    onSwapBench: (id1: string, id2: string) => void;
  }) {
    const { starting, bench } = splitStartingAndBench(picked, startingIds);
    const g = groupByPosition(starting);

    // Handle player tap — opens sheet normally, or completes swap in swap mode
    const handlePlayerTap = (playerId: string) => {
      if (!selectedForSwap) {
        // Not in swap mode — open bottom sheet
        const player = picked.find((p) => p.id === playerId);
        if (player) onOpenSheet(player);
      } else if (selectedForSwap === playerId) {
        // Tapped same player — cancel swap
        onSelectForSwap(null);
      } else {
        // In swap mode — attempt swap
        onSwapPlayers(selectedForSwap, playerId);
        onSelectForSwap(null);
      }
    };

    const isSelected = (id: string) => selectedForSwap === id;
    const isValidTarget = (id: string) => selectedForSwap ? canSwapWithFn(selectedForSwap, id) : false;
    const isDimmed = (id: string) => {
      if (!selectedForSwap) return false;
      if (id === selectedForSwap) return false;
      return !canSwapWithFn(selectedForSwap, id);
    };

    const swapPlayer = selectedForSwap ? picked.find((p) => p.id === selectedForSwap) : null;

    return (
      <div className="-mx-4 space-y-0 overflow-visible">
        {/* Swap Mode Banner — FPL purple style */}
        {swapPlayer && (
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(90deg, #37003C, #5B0050)" }}>
            <div className="flex items-center gap-2 text-white">
              <ArrowUpDown className="h-4 w-4" />
              <div>
                <div className="text-sm font-bold">Swapping {shortName(swapPlayer.name, swapPlayer.webName)}</div>
                <div className="text-[10px] text-white/70">Tap a valid player to complete the swap</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectForSwap(null)}
              className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30"
            >
              Cancel
            </button>
          </div>
        )}
        {/* Pitch View */}
        <div
          style={{
            background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
            position: "relative",
            padding: "8px 12px 16px",
            overflow: "visible",
          }}
        >
          {/* Goal line - top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
          {/* Goal line - bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 2.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
          {/* Sideline - left */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 2.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
          {/* Sideline - right */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 2.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
          {/* Pitch markings - center circle */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: "2.5px solid rgba(255,255,255,0.35)",
            }}
          />
          {/* Center spot */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.35)",
            }}
          />
          {/* Halfway line */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 2.5,
              background: "rgba(255,255,255,0.35)",
            }}
          />
          {/* Penalty area top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 200,
              height: 70,
              borderBottom: "2.5px solid rgba(255,255,255,0.35)",
              borderLeft: "2.5px solid rgba(255,255,255,0.35)",
              borderRight: "2.5px solid rgba(255,255,255,0.35)",
            }}
          />
          {/* Goal area top (six-yard box) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 80,
              height: 30,
              borderBottom: "2.5px solid rgba(255,255,255,0.35)",
              borderLeft: "2.5px solid rgba(255,255,255,0.35)",
              borderRight: "2.5px solid rgba(255,255,255,0.35)",
            }}
          />
          {/* Penalty area bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 200,
              height: 70,
              borderTop: "2.5px solid rgba(255,255,255,0.35)",
              borderLeft: "2.5px solid rgba(255,255,255,0.35)",
              borderRight: "2.5px solid rgba(255,255,255,0.35)",
            }}
          />
          {/* Goal area bottom (six-yard box) */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 80,
              height: 30,
              borderTop: "2.5px solid rgba(255,255,255,0.35)",
              borderLeft: "2.5px solid rgba(255,255,255,0.35)",
              borderRight: "2.5px solid rgba(255,255,255,0.35)",
            }}
          />

          {/* Budo League Fantasy Branding Bar */}
          <div style={{ display: "flex", height: 28, marginBottom: 4, marginLeft: -12, marginRight: -12 }}>
            <div
              style={{
                flex: 1,
                background: "linear-gradient(90deg, #C8102E, #8B0000)",
                display: "flex",
                alignItems: "center",
                paddingLeft: 16,
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Budo League
            </div>
            <div
              style={{
                flex: 1,
                background: "linear-gradient(90deg, #8B0000, #C8102E)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 16,
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Fantasy
            </div>
          </div>

          {/* GK Row — 1 slot */}
          <div style={{ position: "relative", padding: "4px 0 8px" }}>
            <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
              {g.Goalkeepers.length > 0 ? (
                g.Goalkeepers.map((p) => (
                  <div key={p.id} className={cn(
                    "rounded-lg p-1 transition-all duration-200",
                    isSelected(p.id) && "bg-amber-400/50 ring-2 ring-amber-500",
                    isValidTarget(p.id) && "ring-2 ring-emerald-400 bg-emerald-400/20",
                    isDimmed(p.id) && "opacity-30",
                  )}>
                    <PitchPlayerCard
                      player={p}
                      onToggle={() => handlePlayerTap(p.id)}
                      isCaptain={captainId === p.id}
                      isVice={viceId === p.id}
                    />
                  </div>
                ))
              ) : (
                <Link href="/dashboard/transfers" className="active:scale-95 transition-transform">
                  <EmptySlot position="GK" />
                </Link>
              )}
            </div>
          </div>

          {/* DEF Row — 3 slots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "6px 8px 8px", position: "relative", zIndex: 1 }}>
            {g.Defenders.map((p) => (
              <div key={p.id} className={cn(
                "rounded-lg p-1 transition-all duration-200",
                isSelected(p.id) && "bg-amber-400/50 ring-2 ring-amber-500",
                isValidTarget(p.id) && "ring-2 ring-emerald-400 bg-emerald-400/20",
                isDimmed(p.id) && "opacity-30",
              )}>
                <PitchPlayerCard
                  player={p}
                  onToggle={() => handlePlayerTap(p.id)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                />
              </div>
            ))}
            {g.Defenders.length === 0 && (
              <>
                {[0, 1, 2].map((i) => (
                  <Link key={`def-empty-${i}`} href="/dashboard/transfers" className="active:scale-95 transition-transform">
                    <EmptySlot position="DEF" />
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* MID Row — 4 slots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "6px 8px 8px", position: "relative", zIndex: 1, flexWrap: "wrap" }}>
            {g.Midfielders.map((p) => (
              <div key={p.id} className={cn(
                "rounded-lg p-1 transition-all duration-200",
                isSelected(p.id) && "bg-amber-400/50 ring-2 ring-amber-500",
                isValidTarget(p.id) && "ring-2 ring-emerald-400 bg-emerald-400/20",
                isDimmed(p.id) && "opacity-30",
              )}>
                <PitchPlayerCard
                  player={p}
                  onToggle={() => handlePlayerTap(p.id)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                />
              </div>
            ))}
            {g.Midfielders.length === 0 && (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <Link key={`mid-empty-${i}`} href="/dashboard/transfers" className="active:scale-95 transition-transform">
                    <EmptySlot position="MID" />
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* FWD Row — 2 slots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "6px 8px 4px", position: "relative", zIndex: 1 }}>
            {g.Forwards.map((p) => (
              <div key={p.id} className={cn(
                "rounded-lg p-1 transition-all duration-200",
                isSelected(p.id) && "bg-amber-400/50 ring-2 ring-amber-500",
                isValidTarget(p.id) && "ring-2 ring-emerald-400 bg-emerald-400/20",
                isDimmed(p.id) && "opacity-30",
              )}>
                <PitchPlayerCard
                  player={p}
                  onToggle={() => handlePlayerTap(p.id)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                />
              </div>
            ))}
            {g.Forwards.length === 0 && (
              <>
                {[0, 1].map((i) => (
                  <Link key={`fwd-empty-${i}`} href="/dashboard/transfers" className="active:scale-95 transition-transform">
                    <EmptySlot position="FWD" />
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Bench - Always show */}
        {bench.length > 0 ? (
          <div
            style={{
              background: activeChip === "bench_boost"
                ? "linear-gradient(180deg, #a7f3d0, #6ee7b7)"
                : "linear-gradient(180deg, #e0f7f0, #c8ece0)",
              padding: "12px 8px 16px",
              transition: "background 0.3s",
              ...(activeChip === "bench_boost" ? { boxShadow: "inset 0 0 20px rgba(16,185,129,0.2)" } : {}),
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: activeChip === "bench_boost" ? "#047857" : "#37003C" }}>
                {activeChip === "bench_boost" ? "BENCH BOOST ACTIVE" : "SUBSTITUTES"}
              </span>
              {selectedForSwap && (
                <span style={{ fontSize: 10, color: "#666", marginLeft: 8 }}>
                  Tap a player to swap with starter
                </span>
              )}
              {!selectedForSwap && selectedBenchSwap && (
                <span style={{ fontSize: 10, color: "#7c3aed", marginLeft: 8 }}>
                  Tap another sub to reorder
                </span>
              )}
              {!selectedForSwap && !selectedBenchSwap && (
                <span style={{ fontSize: 10, color: "#666", marginLeft: 8 }}>
                  Long-press to reorder
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 8px" }}>
              {bench.map((p, index) => {
                  const pos = normalizePosition(p.position);
                  const posShort = pos === "Goalkeeper" ? "GK" : pos === "Defender" ? "DEF" : pos === "Midfielder" ? "MID" : "FWD";
                  const selected = isSelected(p.id);
                  const isBenchSelected = selectedBenchSwap === p.id;
                  const isBenchTarget = selectedBenchSwap && selectedBenchSwap !== p.id && !startingIds.includes(p.id);

                  const handleBenchTap = () => {
                    // If in starter swap mode, use starter swap
                    if (selectedForSwap) {
                      handlePlayerTap(p.id);
                      return;
                    }
                    // If a bench player is selected for reorder
                    if (selectedBenchSwap) {
                      if (selectedBenchSwap === p.id) {
                        onSelectBenchSwap(null); // cancel
                      } else {
                        onSwapBench(selectedBenchSwap, p.id);
                        onSelectBenchSwap(null);
                      }
                      return;
                    }
                    // Normal tap — open sheet
                    const player = picked.find((pl) => pl.id === p.id);
                    if (player) onOpenSheet(player);
                  };

                  return (
                    <button
                      key={p.id}
                      onClick={handleBenchTap}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!selectedForSwap) onSelectBenchSwap(p.id);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: isBenchSelected ? "#ede9fe" : selected ? "#fef3c7" : isValidTarget(p.id) ? "rgba(52,211,153,0.15)" : isBenchTarget ? "rgba(139,92,246,0.08)" : "#f8eed8",
                        borderRadius: 8,
                        padding: "10px 14px",
                        border: isBenchSelected ? "2px solid #7c3aed" : selected ? "2px solid #f59e0b" : isValidTarget(p.id) ? "2px solid #34d399" : isBenchTarget ? "2px solid #a78bfa" : "1px solid #ddd0b0",
                        cursor: isDimmed(p.id) ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        opacity: isDimmed(p.id) ? 0.3 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: isBenchSelected ? "#7c3aed" : "#37003C",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ width: 36, height: 36 }}>
                        <Kit color={getKitColor(p.teamShort)} isGK={pos === "Goalkeeper"} size={36} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>
                          {shortName(p.name, p.webName)}
                        </div>
                        <div style={{ fontSize: 10, color: "#666" }}>
                          {p.teamShort} • {p.nextOpponent ?? "--"}
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
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "linear-gradient(180deg, #e0f7f0, #c8ece0)",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#37003C" }}>
                Build your 17-player squad in Transfers first
              </div>
              <Link
                href="/dashboard/transfers"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #C8102E, #8B0000)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "10px 20px",
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                <ArrowLeftRight size={16} />
                Go to Transfers
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------
  // auth gate
  // ----------------------------
  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div className="mx-auto w-full max-w-appWide px-4 pt-4 pb-6 space-y-4">
      {/* Page header - directly on surface */}
      <div className="flex items-center justify-between">
        {hasUnsavedChanges ? (
          <button
            onClick={cancelChanges}
            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
          >
            Cancel
          </button>
        ) : (
          <Link
            href="/dashboard/fantasy"
            className="h-9 w-9 rounded-full border bg-card/80 grid place-items-center hover:bg-accent"
            aria-label="Back to Fantasy"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="text-base font-semibold">Pick Team</div>
        {hasUnsavedChanges ? (
          <button
            onClick={save}
            disabled={loading}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-9 w-9 rounded-full border bg-card/80 grid place-items-center hover:bg-accent"
                aria-label="Team options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/dashboard/transfers">
                  <ArrowLeftRight className="h-4 w-4" />
                  Transfers
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={autoSelectStarting}
                disabled={loading || pickedIds.length < 11}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                Auto-Start
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={resetStartingLineup}
                disabled={loading || startingIds.length === 0}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Lineup
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="text-sm text-muted-foreground text-center">
        {gwLoading ? "Loading..." : `${currentGwLabel} - Deadline: ${deadlineLabel}`}
      </div>

      {/* Chips - interactive */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {chipsList.map((chip) => {
          const status = chipStatus(chip.key);
          const isActive = activeChip === chip.key;
          const isUsed = usedChips.includes(chip.key);

          return (
            <button
              key={chip.key}
              onClick={() => toggleChip(chip.key)}
              style={{
                flex: 1,
                background: isActive
                  ? "linear-gradient(135deg, #C8102E, #8B0000)"
                  : isUsed
                  ? "hsl(var(--muted))"
                  : "hsl(var(--card))",
                border: isActive
                  ? "2px solid #C8102E"
                  : "1.5px solid hsl(var(--border))",
                borderRadius: 10,
                padding: "8px 4px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                cursor: isUsed ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isUsed ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: isActive
                    ? "rgba(255,255,255,0.25)"
                    : "linear-gradient(135deg, #C8102E, #8B0000)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                {chip.icon}
              </div>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: isActive ? "#fff" : "hsl(var(--foreground))",
              }}>
                {chip.name}
              </span>
              <span
                style={{
                  fontSize: 8,
                  color: isActive ? "#fff" : status === "Used" ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
                  border: isActive ? "1px solid rgba(255,255,255,0.5)" : "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  padding: "1px 6px",
                  fontWeight: 600,
                }}
              >
                {status}
              </span>
            </button>
          );
        })}
      </div>

      {msg ? <div className="text-sm text-center">{msg}</div> : null}

      {/* Triple Captain Active Banner */}
      {activeChip === "triple_captain" && (
        <div className="rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(90deg, #C8102E, #8B0000)" }}>
            <div className="flex items-center gap-2 text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6l3-6z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.2)" />
              </svg>
              <div>
                <div className="text-sm font-bold">Triple Captain Active</div>
                <div className="text-[10px] text-white/70">
                  {captainName}&apos;s points will be tripled this gameweek
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleChip("triple_captain")}
              className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs - centered on surface */}
      <div className="flex items-center justify-center">
        <div className="rounded-2xl bg-muted p-1 inline-flex">
          <button
            type="button"
            onClick={() => setTab("pitch")}
            className={cn(
              "px-6 py-2 rounded-2xl text-sm font-semibold transition",
              tab === "pitch" ? "bg-background shadow" : "text-muted-foreground"
            )}
          >
            Pitch
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className={cn(
              "px-6 py-2 rounded-2xl text-sm font-semibold transition",
              tab === "list" ? "bg-background shadow" : "text-muted-foreground"
            )}
          >
            List
          </button>
          {/* Squad tab hidden for now - kept for future use */}
          {false && (
            <button
              type="button"
              onClick={() => setTab("squad")}
              className={cn(
                "px-6 py-2 rounded-2xl text-sm font-semibold transition",
                tab === "squad" ? "bg-background shadow" : "text-muted-foreground"
              )}
            >
              Squad
            </button>
          )}
        </div>
      </div>

      {/* Pitch view - full width edge to edge like FPL */}
      {tab === "pitch" && (
        <div className="-mx-4 space-y-3">
          {picked.length === 0 ? (
            <div className="mx-4 rounded-2xl border bg-card overflow-hidden">
              <div
                className="relative flex flex-col items-center justify-center text-center"
                style={{
                  minHeight: 320,
                  background: "linear-gradient(180deg, #1a6b37 0%, #228B3B 40%, #1a6b37 100%)",
                }}
              >
                {/* Pitch lines decoration */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-24 h-24 rounded-full border-2 border-white/20" />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/15" />

                <div className="relative z-10 space-y-4 px-6">
                  <div className="text-5xl animate-bounce" style={{ animationDuration: "2s" }}>&#9917;</div>
                  <div>
                    <div className="text-lg font-extrabold text-white">Build your dream team!</div>
                    <div className="text-sm text-white/70 mt-1.5 leading-relaxed">
                      Pick 17 players to compete in the<br />Budo League Fantasy
                    </div>
                  </div>
                  <Link
                    href="/dashboard/transfers"
                    className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-800 px-6 py-2.5 text-sm font-bold hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <ArrowLeftRight size={14} />
                    Go to Transfers
                  </Link>
                  <div className="grid grid-cols-4 gap-3 pt-4 text-[11px] text-white/60">
                    <div><span className="block text-white font-bold">1</span>GK</div>
                    <div><span className="block text-white font-bold">2-3</span>DEF</div>
                    <div><span className="block text-white font-bold">3-5</span>MID</div>
                    <div><span className="block text-white font-bold">2-3</span>FWD</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-4 rounded-2xl border bg-card p-3">
                <div className="text-sm font-semibold">Formation Rules</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>GK: <span className="font-semibold text-foreground">1</span></div>
                  <div>DEF: <span className="font-semibold text-foreground">2-3</span></div>
                  <div>MID: <span className="font-semibold text-foreground">3-5</span></div>
                  <div>FWD: <span className="font-semibold text-foreground">2-3</span></div>
                  <div className="col-span-2">Lady: <span className="font-semibold text-foreground">must be Forward</span></div>
                </div>
              </div>
            </>
          )}

          <PickPitch
            picked={picked}
            startingIds={startingIds}
            onSwapPlayers={(id1, id2) => {
              const ok = swapPlayers(id1, id2);
              if (ok) {
                toast({ description: "Swap completed" });
              }
            }}
            captainId={captainId}
            viceId={viceId}
            selectedForSwap={selectedForSwap}
            onSelectForSwap={setSelectedForSwap}
            onOpenSheet={(player) => setSheetPlayer(player)}
            canSwapWithFn={canSwapWith}
            selectedBenchSwap={selectedBenchSwap}
            onSelectBenchSwap={setSelectedBenchSwap}
            onSwapBench={swapBenchOrder}
          />
        </div>
      )}

      {/* List view — FPL style */}
      {tab === "list" && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          {/* Column Headers */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              padding: "20px 12px 8px 12px",
              borderBottom: "1px solid hsl(var(--border))",
            }}
          >
            <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-foreground))", textAlign: "left" }}>Player</div>
            <div style={{ width: 36, textAlign: "center", fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>Form</div>
            <div style={{ width: 48, textAlign: "center", fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-foreground))", lineHeight: 1.2 }}>
              Current Price
            </div>
            <div style={{ width: 42, textAlign: "right", fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>Selected</div>
          </div>

          {picked.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>
                <span role="img" aria-label="football">&#9917;</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 6 }}>
                Build your dream team!
              </div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 20, lineHeight: 1.5 }}>
                Pick 17 players to compete in the<br />Budo League Fantasy
              </div>
              <Link
                href="/dashboard/transfers"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 24px",
                  borderRadius: 9999,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <ArrowLeftRight size={14} />
                Go to Transfers
              </Link>
            </div>
          ) : (
            <>
              {/* Starters by position */}
              {listSections.map((section) => (
                <div key={section.title}>
                  {section.players.length > 0 && (
                    <>
                      {/* Section header — serif style like FPL */}
                      <div style={{ padding: "16px 16px 8px" }}>
                        <h2 style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "hsl(var(--foreground))",
                        }}>
                          {section.title}
                        </h2>
                      </div>
                      {/* Player rows */}
                      {section.players.map((p) => {
                        const displayName = shortName(p.name, p.webName);
                        const isCap = captainId === p.id;
                        const isVc = viceId === p.id;
                        const isGK = normalizePosition(p.position) === "Goalkeeper";
                        const kitColor = getKitColor(p.teamShort);
                        const formVal = p.formLast5 ? parseFloat(p.formLast5) : 0;
                        const isExpanded = expandedListId === p.id;
                        const history = p.pointsHistory ?? [];
                        const maxPts = Math.max(...history, 1);
                        const isStarter = startingIds.includes(p.id);

                        return (
                          <div key={p.id} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                            {/* Clickable row header */}
                            <button
                              type="button"
                              onClick={() => setExpandedListId(isExpanded ? null : p.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "12px 12px 12px 8px",
                                background: isExpanded ? "hsl(var(--accent))" : "transparent",
                                width: "100%",
                                cursor: "pointer",
                                border: "none",
                                textAlign: "left",
                              }}
                            >
                              {/* Status icon (info "i") */}
                              <div style={{
                                width: 18, height: 18, flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <span style={{
                                  fontFamily: "Georgia, 'Times New Roman', serif",
                                  fontStyle: "italic",
                                  fontSize: 14,
                                  fontWeight: 400,
                                  color: isExpanded ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                                  opacity: isExpanded ? 1 : 0.7,
                                  lineHeight: 1,
                                }}>i</span>
                              </div>

                              {/* Kit */}
                              <div style={{ marginLeft: 4, marginRight: 8, flexShrink: 0 }}>
                                <Kit color={kitColor} isGK={isGK} size={36} />
                              </div>

                              {/* Player name + team + pos */}
                              <div style={{
                                flex: 1, minWidth: 0,
                                paddingRight: 6,
                                borderRight: "1px solid hsl(var(--border))",
                                marginRight: 6,
                              }}>
                                <div style={{
                                  fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))",
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                  lineHeight: 1.3,
                                  display: "flex", alignItems: "center", gap: 4,
                                }}>
                                  {displayName}
                                  {p.isLady && (
                                    <span style={{
                                      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                      background: "#FF69B4", border: "1px solid #FF1493",
                                      marginLeft: 3, verticalAlign: "middle",
                                    }} />
                                  )}
                                  {isCap && (
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 16, height: 16, borderRadius: "50%",
                                      background: activeChip === "triple_captain"
                                        ? "linear-gradient(135deg, #C8102E, #8B0000)"
                                        : "linear-gradient(135deg, #FFD700, #FFA500)",
                                      color: activeChip === "triple_captain" ? "#fff" : "#000",
                                      fontSize: activeChip === "triple_captain" ? 7 : 9,
                                      fontWeight: 900,
                                    }}>{activeChip === "triple_captain" ? "TC" : "C"}</span>
                                  )}
                                  {isVc && (
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 16, height: 16, borderRadius: "50%",
                                      background: "linear-gradient(135deg, #f5e6c8, #ddd0b0)",
                                      border: "1px solid hsl(var(--border))",
                                      color: "#000", fontSize: 9, fontWeight: 900,
                                    }}>V</span>
                                  )}
                                </div>
                                <div style={{
                                  fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 400,
                                  marginTop: 1, display: "flex", gap: 6,
                                }}>
                                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {p.teamShort ?? p.teamName ?? "--"}
                                  </span>
                                  <span>{shortPos(p.position)}</span>
                                </div>
                              </div>

                              {/* Form */}
                              <div style={{ width: 36, textAlign: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                  {formVal > 0 ? formVal.toFixed(1) : "--"}
                                </span>
                              </div>

                              {/* Price */}
                              <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                  {formatUGX(p.price)}
                                </span>
                              </div>

                              {/* Selected */}
                              <div style={{ width: 42, textAlign: "right", flexShrink: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                  {formatOwnership(p.ownership)}
                                </span>
                              </div>
                            </button>
                         
                            {/* Expanded inline detail panel */}
                            {isExpanded && (
                              <div style={{ padding: "0 16px 12px", background: "hsl(var(--accent))" }}>
                                {/* Stats Grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                                  <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Price</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--primary))" }}>{formatUGX(p.price)}</div>
                                  </div>
                                  <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Total Pts</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{formatNumber(p.points)}</div>
                                  </div>
                                  <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Form</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{formatForm(p.formLast5)}</div>
                                  </div>
                                  <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Owned</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{formatOwnership(p.ownership)}</div>
                                  </div>
                                </div>

                                {/* GW History Bar Chart */}
                                {history.length > 0 && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border))" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
                                      Gameweek History
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 72 }}>
                                      {history.map((pts, i) => {
                                        const h = Math.max(4, (pts / maxPts) * 56);
                                        return (
                                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700 }}>{pts}</span>
                                            <div
                                              style={{
                                                width: "100%",
                                                borderRadius: "3px 3px 0 0",
                                                height: h,
                                                background: pts >= 8 ? "#10b981" : pts >= 5 ? "#38bdf8" : pts >= 3 ? "#fbbf24" : "hsl(var(--muted))",
                                              }}
                                            />
                                            <span style={{ fontSize: 7, color: "hsl(var(--muted-foreground))" }}>GW{i + 1}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Captain / Vice Captain buttons */}
                                {isStarter && (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border))" }}>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setCaptain(p.id); }}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 8,
                                        borderRadius: 12, border: `2px solid ${isCap ? (activeChip === "triple_captain" ? "#ef4444" : "#f59e0b") : "hsl(var(--border))"}`,
                                        background: isCap ? (activeChip === "triple_captain" ? "#fef2f2" : "#fffbeb") : "transparent",
                                        padding: "10px 12px", cursor: "pointer", textAlign: "left",
                                      }}
                                    >
                                      <div style={{
                                        width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
                                        fontWeight: 900, fontSize: activeChip === "triple_captain" ? 9 : 12,
                                        background: isCap ? (activeChip === "triple_captain" ? "linear-gradient(135deg, #C8102E, #8B0000)" : "#f59e0b") : "hsl(var(--muted))",
                                        color: isCap ? "#fff" : "hsl(var(--muted-foreground))",
                                      }}>{activeChip === "triple_captain" ? "TC" : "C"}</div>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{activeChip === "triple_captain" ? "Triple Captain" : "Captain"}</div>
                                        <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{activeChip === "triple_captain" ? "Triple points" : "Double points"}</div>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setVice(p.id); }}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 8,
                                        borderRadius: 12, border: `2px solid ${isVc ? "#3b82f6" : "hsl(var(--border))"}`,
                                        background: isVc ? "#eff6ff" : "transparent",
                                        padding: "10px 12px", cursor: "pointer", textAlign: "left",
                                      }}
                                    >
                                      <div style={{
                                        width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
                                        fontWeight: 900, fontSize: 12,
                                        background: isVc ? "#3b82f6" : "hsl(var(--muted))",
                                        color: isVc ? "#fff" : "hsl(var(--muted-foreground))",
                                      }}>V</div>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>Vice Captain</div>
                                        <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>Backup captain</div>
                                      </div>
                                    </button>
                                  </div>
                                )}

                                {/* Lady 2x info */}
                                {p.isLady && (
                                  <div style={{
                                    marginTop: 10, display: "flex", alignItems: "center", gap: 8,
                                    borderRadius: 12, padding: "10px 12px",
                                    background: "linear-gradient(135deg, rgba(236,72,153,0.1), rgba(219,39,119,0.1))",
                                    border: "1px solid rgba(236,72,153,0.25)",
                                  }}>
                                    <span style={{ background: "linear-gradient(135deg, #FF69B4, #FF1493)", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>★</span>
                                    <div>
                                      <div style={{ fontWeight: 700, color: "#ec4899", fontSize: 12 }}>Lady Player — 2x Points</div>
                                      <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>All points doubled automatically. Captain stacks to 4x!</div>
                                    </div>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <Button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedForSwap(p.id); setExpandedListId(null); }}
                                    className="flex-1 rounded-xl gap-2"
                                    size="sm"
                                  >
                                    <ArrowUpDown className="h-4 w-4" />
                                    Substitute
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 rounded-xl gap-2"
                                    size="sm"
                                    asChild
                                  >
                                    <Link href={`/dashboard/players/${p.id}`}>
                                      <Info className="h-4 w-4" />
                                      Full Profile
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              ))}

              {/* Substitutes */}
              {bench.length > 0 && (
                <>
                  <div style={{ padding: "16px 16px 8px" }}>
                    <h2 style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "hsl(var(--foreground))",
                    }}>
                      Substitutes
                    </h2>
                  </div>
                  {bench.map((p) => {
                    const displayName = shortName(p.name, p.webName);
                    const isCap = captainId === p.id;
                    const isVc = viceId === p.id;
                    const isGK = normalizePosition(p.position) === "Goalkeeper";
                    const kitColor = getKitColor(p.teamShort);
                    const formVal = p.formLast5 ? parseFloat(p.formLast5) : 0;
                    const isExpanded = expandedListId === p.id;
                    const history = p.pointsHistory ?? [];
                    const maxPts = Math.max(...history, 1);

                    return (
                      <div key={p.id} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                        {/* Clickable row header */}
                        <button
                          type="button"
                          onClick={() => setExpandedListId(isExpanded ? null : p.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "12px 12px 12px 8px",
                            background: isExpanded ? "hsl(var(--accent))" : "transparent",
                            width: "100%",
                            cursor: "pointer",
                            border: "none",
                            textAlign: "left",
                          }}
                        >
                          {/* Status icon */}
                          <div style={{
                            width: 18, height: 18, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{
                              fontFamily: "Georgia, 'Times New Roman', serif",
                              fontStyle: "italic",
                              fontSize: 14,
                              fontWeight: 400,
                              color: isExpanded ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                              opacity: isExpanded ? 1 : 0.5,
                              lineHeight: 1,
                            }}>i</span>
                          </div>

                          {/* Kit */}
                          <div style={{ marginLeft: 4, marginRight: 8, flexShrink: 0 }}>
                            <Kit color={kitColor} isGK={isGK} size={36} />
                          </div>

                          {/* Player name + team + pos */}
                          <div style={{
                            flex: 1, minWidth: 0,
                            paddingRight: 6,
                            borderRight: "1px solid hsl(var(--border))",
                            marginRight: 6,
                          }}>
                            <div style={{
                              fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              lineHeight: 1.3,
                              display: "flex", alignItems: "center", gap: 4,
                            }}>
                              {displayName}
                              {p.isLady && (
                                <span style={{
                                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                  background: "#FF69B4", border: "1px solid #FF1493",
                                  marginLeft: 3, verticalAlign: "middle",
                                }} />
                              )}
                              {isCap && (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 16, height: 16, borderRadius: "50%",
                                  background: activeChip === "triple_captain"
                                    ? "linear-gradient(135deg, #C8102E, #8B0000)"
                                    : "linear-gradient(135deg, #FFD700, #FFA500)",
                                  color: activeChip === "triple_captain" ? "#fff" : "#000",
                                  fontSize: activeChip === "triple_captain" ? 7 : 9,
                                  fontWeight: 900,
                                }}>{activeChip === "triple_captain" ? "TC" : "C"}</span>
                              )}
                              {isVc && (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 16, height: 16, borderRadius: "50%",
                                  background: "linear-gradient(135deg, #f5e6c8, #ddd0b0)",
                                  border: "1px solid hsl(var(--border))",
                                  color: "#000", fontSize: 9, fontWeight: 900,
                                }}>V</span>
                              )}
                            </div>
                            <div style={{
                              fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 400,
                              marginTop: 1, display: "flex", gap: 6,
                            }}>
                              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {p.teamShort ?? p.teamName ?? "--"}
                              </span>
                              <span>{shortPos(p.position)}</span>
                            </div>
                          </div>

                          {/* Form */}
                          <div style={{ width: 36, textAlign: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                              {formVal > 0 ? formVal.toFixed(1) : "--"}
                            </span>
                          </div>

                          {/* Price */}
                          <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                              {formatUGX(p.price)}
                            </span>
                          </div>

                          {/* Selected */}
                          <div style={{ width: 42, textAlign: "right", flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                              {formatOwnership(p.ownership)}
                            </span>
                          </div>
                        </button>

                        {/* Expanded inline detail panel */}
                        {isExpanded && (
                          <div style={{ padding: "0 16px 12px", background: "hsl(var(--accent))" }}>
                            {/* Stats Grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                              <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Price</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--primary))" }}>{formatUGX(p.price)}</div>
                              </div>
                              <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Total Pts</div>
                                <div style={{ fontSize: 15, fontWeight: 700 }}>{formatNumber(p.points)}</div>
                              </div>
                              <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Form</div>
                                <div style={{ fontSize: 15, fontWeight: 700 }}>{formatForm(p.formLast5)}</div>
                              </div>
                              <div style={{ borderRadius: 12, background: "hsl(var(--muted)/0.5)", padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>Owned</div>
                                <div style={{ fontSize: 15, fontWeight: 700 }}>{formatOwnership(p.ownership)}</div>
                              </div>
                            </div>

                            {/* GW History Bar Chart */}
                            {history.length > 0 && (
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border))" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
                                  Gameweek History
                                </div>
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 72 }}>
                                  {history.map((pts, i) => {
                                    const h = Math.max(4, (pts / maxPts) * 56);
                                    return (
                                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <span style={{ fontSize: 9, fontWeight: 700 }}>{pts}</span>
                                        <div
                                          style={{
                                            width: "100%",
                                            borderRadius: "3px 3px 0 0",
                                            height: h,
                                            background: pts >= 8 ? "#10b981" : pts >= 5 ? "#38bdf8" : pts >= 3 ? "#fbbf24" : "hsl(var(--muted))",
                                          }}
                                        />
                                        <span style={{ fontSize: 7, color: "hsl(var(--muted-foreground))" }}>GW{i + 1}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Lady 2x info */}
                            {p.isLady && (
                              <div style={{
                                marginTop: 10, display: "flex", alignItems: "center", gap: 8,
                                borderRadius: 12, padding: "10px 12px",
                                background: "linear-gradient(135deg, rgba(236,72,153,0.1), rgba(219,39,119,0.1))",
                                border: "1px solid rgba(236,72,153,0.25)",
                              }}>
                                <span style={{ background: "linear-gradient(135deg, #FF69B4, #FF1493)", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>★</span>
                                <div>
                                  <div style={{ fontWeight: 700, color: "#ec4899", fontSize: 12 }}>Lady Player — 2x Points</div>
                                  <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>All points doubled automatically. Captain stacks to 4x!</div>
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <Button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedForSwap(p.id); setExpandedListId(null); }}
                                className="flex-1 rounded-xl gap-2"
                                size="sm"
                              >
                                <ArrowUpDown className="h-4 w-4" />
                                Substitute
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 rounded-xl gap-2"
                                size="sm"
                                asChild
                              >
                                <Link href={`/dashboard/players/${p.id}`}>
                                  <Info className="h-4 w-4" />
                                  Full Profile
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Bottom spacer */}
              <div style={{ height: 12 }} />
            </>
          )}
        </div>
      )}

          {tab === "squad" && (
            <div className="rounded-2xl border bg-card">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">Your Squad</div>
                  <div className="text-xs text-muted-foreground">{picked.length} picked</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  GKs {pickedGoalkeepers.length}/2 - Lady forwards {pickedLadyForwards.length}/2 - Starting{" "}
                  {startingIds.length}/10
                </div>

                {picked.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-6 space-y-3">
                    <div className="text-4xl">&#9917;</div>
                    <div>
                      <div className="text-sm font-bold">Build your dream team!</div>
                      <div className="text-xs text-muted-foreground mt-1">Pick 17 players to compete in the Budo League Fantasy</div>
                    </div>
                    <Link href="/dashboard/transfers" className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold hover:opacity-90 transition-opacity">
                      <ArrowLeftRight size={12} />
                      Go to Transfers
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {picked.map((p) => {
                      const isStarting = startingIds.includes(p.id);
                      const isCaptain = captainId === p.id;
                      const isVice = viceId === p.id;
                      const displayName = shortName(p.name, p.webName);
                      const pointsLabel = p.gwPoints !== null && p.gwPoints !== undefined ? "GW" : "Total";
                      const pointsValue =
                        p.gwPoints !== null && p.gwPoints !== undefined ? p.gwPoints : p.points ?? null;

                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "w-full rounded-2xl border px-3 py-3",
                            isStarting ? "border-emerald-400 bg-emerald-50/60" : "bg-card"
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-12 w-12 rounded-2xl overflow-hidden bg-muted shrink-0">
                                {p.avatarUrl ? (
                                  <img src={p.avatarUrl} alt={displayName} className="h-12 w-12 object-cover" />
                                ) : null}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold truncate">{displayName}</div>
                                  {p.isLady ? (
                                    <span className="text-[10px] font-semibold text-pink-600">• Lady</span>
                                  ) : null}
                                  {isCaptain ? (
                                    <span className="text-[10px] font-semibold" style={{ color: activeChip === "triple_captain" ? "#C8102E" : "#d97706" }}>
                                      {activeChip === "triple_captain" ? "TC" : "C"}
                                    </span>
                                  ) : null}
                                  {isVice ? (
                                    <span className="text-[10px] font-semibold text-sky-600">VC</span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <TeamBadge teamName={p.teamName} teamShort={p.teamShort} size="sm" />
                                  <span className="truncate">
                                    {p.teamShort ?? p.teamName ?? "--"} - {shortPos(p.position)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Price {formatUGX(p.price)} - {pointsLabel} {formatNumber(pointsValue)} - Form{" "}
                                  {formatForm(p.formLast5)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant={isStarting ? "default" : "secondary"}
                                className="rounded-xl"
                                onClick={() => toggleStarting(p.id)}
                              >
                                {isStarting ? "Starting" : "Start"}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => removeFromSquad(p.id)}
                              >
                                Remove
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-8 w-8 rounded-xl p-0",
                                  activeChip === "triple_captain" && isCaptain ? "bg-red-600 text-white border-red-600 text-[9px]" : isCaptain ? "bg-amber-400 text-black border-amber-400 text-xs" : "text-xs"
                                )}
                                onClick={() => setCaptain(p.id)}
                                disabled={!isStarting}
                              >
                                {activeChip === "triple_captain" ? "TC" : "C"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-8 w-8 rounded-xl p-0 text-xs",
                                  isVice ? "bg-sky-300 text-black border-sky-300" : ""
                                )}
                                onClick={() => setVice(p.id)}
                                disabled={!isStarting}
                              >
                                VC
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

      {/* Gameweek Fixtures */}
      {gwFixtures.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Gameweek {gwId} Fixtures
          </h3>
          {gwFixtures.map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {m.home_team?.logo_url && (
                    <img src={m.home_team.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" />
                  )}
                  <span className="text-xs font-semibold truncate">{m.home_team?.name ?? "TBD"}</span>
                </div>
                <div className="shrink-0 mx-3 text-center min-w-[48px]">
                  {m.is_played && m.home_goals != null && m.away_goals != null ? (
                    <span className="text-sm font-bold tabular-nums">{m.home_goals} - {m.away_goals}</span>
                  ) : m.kickoff_time ? (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Kampala" }).format(new Date(m.kickoff_time)).replace(/\bam\b/i, "AM").replace(/\bpm\b/i, "PM")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">vs</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-xs font-semibold truncate text-right">{m.away_team?.name ?? "TBD"}</span>
                  {m.away_team?.logo_url && (
                    <img src={m.away_team.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          isPicked={pickedIds.includes(selectedPlayer.id)}
          isStarting={startingIds.includes(selectedPlayer.id)}
          isCaptain={captainId === selectedPlayer.id}
          isVice={viceId === selectedPlayer.id}
          onPick={() => {
            addToSquad(selectedPlayer.id);
            setSelectedPlayer(null);
          }}
          onRemove={() => {
            removeFromSquad(selectedPlayer.id);
            setSelectedPlayer(null);
          }}
          onToggleStarting={() => toggleStarting(selectedPlayer.id)}
          onSetCaptain={() => setCaptain(selectedPlayer.id)}
          onSetVice={() => setVice(selectedPlayer.id)}
          onCompare={() => {
            setComparePlayerIds([selectedPlayer.id]);
            setCompareMode(true);
            setSelectedPlayer(null);
          }}
          activeChip={activeChip}
        />
      )}

      {/* Player Info Bottom Sheet (pitch tap) */}
      {sheetPlayer && (
        <PlayerInfoSheet
          player={sheetPlayer}
          open={!!sheetPlayer}
          onOpenChange={(open) => { if (!open) setSheetPlayer(null); }}
          isCaptain={captainId === sheetPlayer.id}
          isVice={viceId === sheetPlayer.id}
          isStarting={startingIds.includes(sheetPlayer.id)}
          onSetCaptain={() => {
            setCaptain(sheetPlayer.id);
          }}
          onSetVice={() => {
            setVice(sheetPlayer.id);
          }}
          onSubstitute={() => {
            setSelectedForSwap(sheetPlayer.id);
            setSheetPlayer(null);
          }}
          activeChip={activeChip}
        />
      )}

      {/* Action Bar — inline after substitutes */}
      <div className="flex gap-3 pt-2 pb-4">
        {hasUnsavedChanges ? (
          <>
            <button
              type="button"
              onClick={cancelChanges}
              className="flex-1 py-3 rounded-full border-2 border-foreground text-sm font-bold hover:bg-accent transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="flex-1 py-3 rounded-full text-sm font-bold text-white transition disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #00FF87, #04F5FF)" }}
            >
              <span style={{ color: "#37003C" }}>
                {activeChip === "bench_boost" ? "Save Team (Bench Boost)" : activeChip ? `Save Team (${chipLabel(activeChip)})` : "Save Your Team"}
              </span>
            </button>
          </>
        ) : (
          <div className="flex-1 py-3 rounded-full text-sm font-bold text-center text-muted-foreground border-2 border-muted">
            Team Saved
          </div>
        )}
      </div>

      {/* Free Hit Confirmation Modal */}
      {showFreeHitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center" style={{ background: "linear-gradient(135deg, #37003C, #5B0050)" }}>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Activate Free Hit</h3>
              <p className="text-xs text-white/70 mt-1">
                {nextGW ? `Gameweek ${nextGW.id}` : currentGW ? `Gameweek ${currentGW.id}` : "This Gameweek"}
                {nextGW?.deadline_time && ` • Deadline: ${new Date(nextGW.deadline_time).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}`}
              </p>
            </div>

            {/* Rules */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#10b981" }}>1</div>
                <div className="text-sm"><span className="font-semibold">Unlimited transfers</span> — make as many changes as you want with zero point cost</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#f59e0b" }}>2</div>
                <div className="text-sm"><span className="font-semibold">One gameweek only</span> — your new squad is temporary for this gameweek</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#3b82f6" }}>3</div>
                <div className="text-sm"><span className="font-semibold">Squad restored</span> — your original squad returns after the gameweek</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#ef4444" }}>4</div>
                <div className="text-sm"><span className="font-semibold">Once per season</span> — you can only use Free Hit once</div>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-2">
                <p className="text-xs text-amber-800 font-medium">
                  After the deadline passes, this cannot be cancelled and your original squad will be automatically restored next gameweek.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowFreeHitModal(false)}
                className="flex-1 py-3 rounded-full border-2 text-sm font-bold transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={activateFreeHit}
                className="flex-1 py-3 rounded-full text-sm font-bold text-white transition"
                style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}
              >
                Activate Free Hit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bench Boost Confirmation Modal */}
      {showBenchBoostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center" style={{ background: "linear-gradient(135deg, #047857, #10b981)" }}>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Activate Bench Boost</h3>
              <p className="text-xs text-white/70 mt-1">
                {nextGW ? `Gameweek ${nextGW.id}` : currentGW ? `Gameweek ${currentGW.id}` : "This Gameweek"}
              </p>
            </div>

            {/* Rules */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#10b981" }}>1</div>
                <div className="text-sm"><span className="font-semibold">All 17 players score</span> — bench players&apos; points count towards your total</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#f59e0b" }}>2</div>
                <div className="text-sm"><span className="font-semibold">One gameweek only</span> — Bench Boost applies for this gameweek only</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#3b82f6" }}>3</div>
                <div className="text-sm"><span className="font-semibold">Captain unaffected</span> — your captain still earns double points as normal</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#8b5cf6" }}>4</div>
                <div className="text-sm"><span className="font-semibold">No auto-subs</span> — all players are active so auto-substitution is skipped</div>
              </div>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 mt-2">
                <p className="text-xs text-emerald-800 font-medium">
                  You can cancel before the deadline. Once the deadline passes, Bench Boost is locked in and used.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowBenchBoostModal(false)}
                className="flex-1 py-3 rounded-full border-2 text-sm font-bold transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={activateBenchBoost}
                className="flex-1 py-3 rounded-full text-sm font-bold text-white transition"
                style={{ background: "linear-gradient(135deg, #047857, #10b981)" }}
              >
                Activate Bench Boost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Triple Captain Confirmation Modal */}
      {showTripleCaptainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center" style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6l3-6z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.25)" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Activate Triple Captain</h3>
              <p className="text-xs text-white/70 mt-1">
                {nextGW ? `Gameweek ${nextGW.id}` : currentGW ? `Gameweek ${currentGW.id}` : "This Gameweek"}
              </p>
            </div>

            {/* Current Captain */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "linear-gradient(135deg, #fef2f2, #fff1f2)", border: "1px solid #fecaca" }}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}>
                  <span className="text-white text-xs font-black">TC</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground font-medium">Current captain</div>
                  <div className="text-sm font-bold truncate">
                    {captainId && playerById.get(captainId)
                      ? playerById.get(captainId)!.name
                      : "No captain selected"}
                  </div>
                  {captainId && playerById.get(captainId)?.teamName && (
                    <div className="text-xs text-muted-foreground">{playerById.get(captainId)!.teamName}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black" style={{ color: "#C8102E" }}>3x</div>
                  <div className="text-[10px] text-muted-foreground">points</div>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="px-5 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#C8102E" }}>1</div>
                <div className="text-sm"><span className="font-semibold">Captain earns 3x points</span> — instead of the usual double, your captain&apos;s score is tripled</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#f59e0b" }}>2</div>
                <div className="text-sm"><span className="font-semibold">One gameweek only</span> — Triple Captain applies for this gameweek only</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white" style={{ background: "#3b82f6" }}>3</div>
                <div className="text-sm"><span className="font-semibold">Vice captain fallback</span> — if your captain doesn&apos;t play, vice gets 2x (not 3x)</div>
              </div>

              <div className="rounded-lg border p-3 mt-2" style={{ background: "linear-gradient(135deg, #fef7f0, #fff7ed)", borderColor: "#fed7aa" }}>
                <p className="text-xs font-medium" style={{ color: "#9a3412" }}>
                  You can cancel before the deadline. Choose your captain wisely — pick a nailed-on starter!
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowTripleCaptainModal(false)}
                className="flex-1 py-3 rounded-full border-2 text-sm font-bold transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={activateTripleCaptain}
                disabled={!captainId}
                className="flex-1 py-3 rounded-full text-sm font-bold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #C8102E, #8B0000)" }}
              >
                Activate Triple Captain
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster />

      {/* Compare Players Modal */}
      {compareMode && comparePlayerIds.length >= 1 && (
        comparePlayerIds.length === 2 ? (
          <ComparePlayersModal
            players={comparePlayerIds.map((id) => playerById.get(id)!).filter(Boolean)}
            onClose={() => {
              setCompareMode(false);
              setComparePlayerIds([]);
            }}
          />
        ) : (
          // Player selection for comparison
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
              setCompareMode(false);
              setComparePlayerIds([]);
            }} />
            <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[80vh]">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold">Select player to compare</h2>
                <button
                  onClick={() => {
                    setCompareMode(false);
                    setComparePlayerIds([]);
                  }}
                  className="h-8 w-8 rounded-full bg-muted grid place-items-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
                {players
                  .filter((p) => !comparePlayerIds.includes(p.id))
                  .slice(0, 50)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setComparePlayerIds([...comparePlayerIds, p.id]);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-accent/10"
                    >
                      <div className="h-10 w-10 rounded-xl bg-muted overflow-hidden">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center font-bold">
                            {shortName(p.name, p.webName).charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{shortName(p.name, p.webName)}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.teamShort} • {shortPos(p.position)} • {formatNumber(p.points)} pts
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
