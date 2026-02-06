"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import {
  Sparkles,
  TrendingUp,
  ArrowUpDown,
  ArrowLeft,
  ArrowLeftRight,
  Users,
  Zap,
  X,
  TrendingDown,
  Info,
  Scale,
  MoreVertical,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const BUDGET_TOTAL = 100; // UGX 100m

const TEAM_LOGOS: Record<string, string> = {
  accumulators: "/logos/t-accumulators.png",
  basunzi: "/logos/t-basunzi.png",
  bifa: "/logos/t-bifa.png",
  trotballo: "/logos/t-trotballo.png",
  dujay: "/logos/t-dujay.png",
  "night prep": "/logos/t-night-prep.png",
  "peaky blinders": "/logos/t-peaky-blinders.png",
  komunoballo: "/logos/t-komunoballo.png",
  masappe: "/logos/t-masappe.png",
  "midnight express": "/logos/t-midnight-express.png",
  centurions: "/logos/t-centurions.png",
  jubilewos: "/logos/t-jubilewos.png",
  endgame: "/logos/t-endgame.png",
  abachuba: "/logos/t-abachuba.png",
  abacuba: "/logos/t-abachuba.png",
  thazobalo: "/logos/t-thazobalo.png",
  thazoballo: "/logos/t-thazobalo.png",
  quadballo: "/logos/t-quadballo.png",
};

const TEAM_SHORT_LOGOS: Record<string, string> = {
  ACC: "/logos/t-accumulators.png",
  BAS: "/logos/t-basunzi.png",
  BIF: "/logos/t-bifa.png",
  TRO: "/logos/t-trotballo.png",
  DUJ: "/logos/t-dujay.png",
  NIG: "/logos/t-night-prep.png",
  PEA: "/logos/t-peaky-blinders.png",
  KOM: "/logos/t-komunoballo.png",
  MAS: "/logos/t-masappe.png",
  MID: "/logos/t-midnight-express.png",
  CEN: "/logos/t-centurions.png",
  JUB: "/logos/t-jubilewos.png",
  END: "/logos/t-endgame.png",
  ABA: "/logos/t-abachuba.png",
  THA: "/logos/t-thazobalo.png",
  QUA: "/logos/t-quadballo.png",
};

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

function normalizePosition(pos?: string | null) {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "defender" || p === "df") return "Defender";
  if (p === "mid" || p === "midfielder" || p === "mf") return "Midfielder";
  if (p === "fwd" || p === "forward" || p === "fw" || p === "striker") return "Forward";
  return (pos ?? "Midfielder") as any;
}

function shortPos(pos?: string | null) {
  const p = normalizePosition(pos);
  if (p === "Goalkeeper") return "GK";
  if (p === "Defender") return "DEF";
  if (p === "Midfielder") return "MID";
  if (p === "Forward") return "FWD";
  return "--";
}

function shortName(name?: string | null, webName?: string | null) {
  if (webName && webName.trim().length > 0) return webName.trim();
  const raw = (name ?? "").trim();
  if (!raw) return "--";
  const parts = raw.split(" ").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : raw;
}

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

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

  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Kampala",
  }).format(d);

  return formatted.replace(/\./g, "");
}

function getTeamLogo(teamName?: string | null, teamShort?: string | null) {
  const short = (teamShort ?? "").trim().toUpperCase();
  if (short && TEAM_SHORT_LOGOS[short]) return TEAM_SHORT_LOGOS[short];

  const nameKey = (teamName ?? "").trim().toLowerCase();
  if (nameKey && TEAM_LOGOS[nameKey]) return TEAM_LOGOS[nameKey];

  return null;
}

function groupByPosition(players: Player[]) {
  return {
    Goalkeepers: players.filter((p) => p.position === "Goalkeeper"),
    Defenders: players.filter((p) => p.position === "Defender"),
    Midfielders: players.filter((p) => p.position === "Midfielder"),
    Forwards: players.filter((p) => p.position === "Forward"),
  };
}

function splitStartingAndBench(players: Player[], startingIds: string[]) {
  const startingSet = new Set(startingIds);
  const starting = players.filter((p) => startingSet.has(p.id));
  const bench = players.filter((p) => !startingSet.has(p.id));
  return { starting, bench };
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
                    Lady
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                {logo && (
                  <img src={logo} alt="" className="h-5 w-5 rounded-full bg-white/90 object-contain" />
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
              <div className="text-2xl font-bold">{player.ownership ?? "--"}%</div>
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
                    className="h-6 w-6 rounded-full bg-white object-contain border"
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
                      className={cn("rounded-xl", isCaptain && "bg-amber-500 hover:bg-amber-600")}
                    >
                      {isCaptain ? "Captain" : "Make Captain"}
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

  const gwId = React.useMemo(() => nextGW?.id ?? currentGW?.id ?? null, [nextGW?.id, currentGW?.id]);

  // ----------------------------
  // auth state
  // ----------------------------
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
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

        // Generate mock data for FPL-inspired features if not from API
        const allTeamShorts = ["ACC", "BAS", "BIF", "TRO", "DUJ", "NIG", "PEA", "KOM", "MAS", "MID", "CEN", "JUB", "END", "ABA", "THA", "QUA"];

        setPlayers(
          (json.players ?? []).map((p: any) => {
            const pts = Number(p.points ?? p.total_points ?? 0);
            // Generate mock ownership based on points (higher points = higher ownership)
            const mockOwnership = p.ownership ?? Math.min(95, Math.max(1, Math.round(pts * 0.8 + Math.random() * 20)));
            // Generate mock price change (-0.2 to +0.2)
            const mockPriceChange = p.priceChange ?? p.price_change ?? (Math.random() > 0.7 ? (Math.random() - 0.5) * 0.4 : 0);
            // Generate mock points history (last 5 GWs)
            const mockHistory = p.pointsHistory ?? p.points_history ?? Array.from({ length: 5 }, () => Math.floor(Math.random() * 15));
            // Generate mock next opponent
            const playerTeam = (p.teamShort ?? p.team_short ?? "").toUpperCase();
            const opponents = allTeamShorts.filter(t => t !== playerTeam);
            const mockNextOpp = p.nextOpponent ?? p.next_opponent ?? opponents[Math.floor(Math.random() * opponents.length)];

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

              // FPL-inspired fields
              ownership: mockOwnership,
              priceChange: Math.round(mockPriceChange * 10) / 10,
              pointsHistory: mockHistory,
              nextOpponent: mockNextOpp,
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

    const formations = [
      { def: 2, mid: 3, fwd: 3 },
      { def: 2, mid: 4, fwd: 2 },
      { def: 3, mid: 3, fwd: 2 },
    ];

    let best: Player[] = [];
    let bestScore = -1;

    for (const f of formations) {
      if (gks.length < 1 || defs.length < f.def || mids.length < f.mid || fwds.length < f.fwd) {
        continue;
      }

      const starting: Player[] = [];
      starting.push(gks[0]);

      starting.push(...defs.slice(0, f.def));
      starting.push(...mids.slice(0, f.mid));

      const chosenFwds: Player[] = [];
      let ladyCount = 0;
      for (const p of fwds) {
        if (chosenFwds.length >= f.fwd) break;
        if (p.isLady) {
          if (ladyCount >= 1) continue;
          ladyCount += 1;
        }
        chosenFwds.push(p);
      }

      if (chosenFwds.length < f.fwd) continue;
      starting.push(...chosenFwds);

      const score = starting.reduce((sum, p) => sum + points(p), 0);
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
    const isLadyFwd = (p: Player) =>
      p.isLady && normalizePosition(p.position) === "Forward";
    const addUnique = (p?: Player) => {
      if (!p) return;
      if (!squad.some((s) => s.id === p.id)) squad.push(p);
    };

    // Ensure required positions
    for (const p of byPoints) {
      if (isGK(p) && squad.filter(isGK).length < 2) addUnique(p);
    }
    for (const p of byPoints) {
      if (isLadyFwd(p) && squad.filter(isLadyFwd).length < 2) addUnique(p);
    }

    // Fill remaining slots
    for (const p of byPoints) {
      if (squad.length >= 17) break;
      addUnique(p);
    }

    const squadIds = squad.slice(0, 17).map((p) => p.id);

    // Build starting 9 based on formation rules
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

        if (Array.isArray(data.squadIds) && data.squadIds.length > 0) {
          setPickedIds(data.squadIds);
          setStartingIds(data.startingIds ?? []);
          // Also set saved state for change tracking
          setSavedPickedIds(data.squadIds);
          setSavedStartingIds(data.startingIds ?? []);

          localStorage.setItem(LS_PICKS, JSON.stringify(data.squadIds));
          localStorage.setItem(LS_SQUAD, JSON.stringify(data.squadIds));
          localStorage.setItem(LS_STARTING, JSON.stringify(data.startingIds ?? []));
        }

        if (data.captainId) {
          setCaptainId(data.captainId);
          setSavedCaptainId(data.captainId);
          localStorage.setItem(LS_CAPTAIN, data.captainId);
        }
        if (data.viceId) {
          setViceId(data.viceId);
          setSavedViceId(data.viceId);
          localStorage.setItem(LS_VICE, data.viceId);
        }

        if (data.teamName) localStorage.setItem("tbl_team_name", data.teamName);

        // If we have a valid squad from DB, we're done
        if (Array.isArray(data.squadIds) && data.squadIds.length > 0) {
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
        auto.startingIds.length === 9 &&
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

  // derived
  const picked = React.useMemo(
    () => players.filter((p) => pickedIds.includes(p.id)),
    [players, pickedIds]
  );

  const starting = React.useMemo(
    () => players.filter((p) => startingIds.includes(p.id)),
    [players, startingIds]
  );

  const bench = React.useMemo(
    () => picked.filter((p) => !startingIds.includes(p.id)),
    [picked, startingIds]
  );

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
  const chips = [
    { name: "Bench Boost", icon: "🔄", status: "Available" },
    { name: "Triple Captain", icon: "👑", status: "Available" },
    { name: "Wildcard", icon: "🃏", status: "Available" },
    { name: "Free Hit", icon: "⚡", status: "Available" },
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
      setMsg("Pick the player first, then add to starting 9.");
      return;
    }

    setStartingIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= 9) {
        setMsg("Starting lineup is only 9 players.");
        return prev;
      }
      const player = playerById.get(id);
      if (!player) return prev;

      const pos = normalizePosition(player.position);
      if (pos === "Goalkeeper" && startingGoalkeepers >= 1) {
        setMsg("Only one goalkeeper can start.");
        return prev;
      }
      if (pos === "Defender" && startingDefenders >= 3) {
        setMsg("Defenders are limited to 3.");
        return prev;
      }
      if (pos === "Midfielder" && startingMidfielders >= 4) {
        setMsg("Midfielders are limited to 4.");
        return prev;
      }
      if (pos === "Forward" && startingForwards >= 3) {
        setMsg("Forwards are limited to 3.");
        return prev;
      }
      if (player.isLady && pos !== "Forward") {
        setMsg("Lady players can only start as forwards.");
        return prev;
      }
      if (player.isLady && startingLadyForwards >= 1) {
        setMsg("Only one lady forward can start.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function setCaptain(id: string) {
    if (!startingIds.includes(id)) {
      setMsg("Captain must be in the starting 9.");
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
      setMsg("Vice-captain must be in the starting 9.");
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

  // Auto-select starting 9
  function autoSelectStarting() {
    setMsg(null);

    if (pickedIds.length < 9) {
      setMsg("Pick at least 9 players first.");
      return;
    }

    const newStarting = buildStartingFromSquad(picked);

    if (newStarting.length < 9) {
      setMsg("Not enough players to form a valid starting 9.");
      return;
    }

    setStartingIds(newStarting);
    setMsg("Auto-selected starting 9 based on points.");
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
    if (startingIds.length !== 9) {
      return setMsg("Starting lineup must be exactly 9 players.");
    }
    if (startingGoalkeepers !== 1) {
      return setMsg("Starting lineup must include exactly 1 goalkeeper.");
    }
    if (startingDefenders < 2 || startingDefenders > 3) {
      return setMsg("Starting defenders must be between 2 and 3.");
    }
    if (startingMidfielders < 3 || startingMidfielders > 4) {
      return setMsg("Starting midfielders must be between 3 and 4.");
    }
    if (startingForwards < 2 || startingForwards > 3) {
      return setMsg("Starting forwards must be between 2 and 3.");
    }
    if (startingLadyNonForwards > 0) {
      return setMsg("Lady players can only start as forwards.");
    }
    if (startingLadyForwards > 1) {
      return setMsg("Only one lady forward can start.");
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

      setMsg("Saved (Database + Local).");
    } catch (e: any) {
      setMsg(`Saved locally but DB failed: ${e?.message ?? "Unknown error"}`);
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
          className={cn(sizeClass, "rounded-full border border-white/40 object-contain bg-white/90")}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div
        className={cn(
          sizeClass,
          "rounded-full border border-white/40 bg-white/10 grid place-items-center text-white/90 font-semibold"
        )}
      >
        {label}
      </div>
    );
  }

  /* ── SVG Kit component ── */
  function Kit({ color = "#EF0107", isGK = false, size = 56 }: { color?: string; isGK?: boolean; size?: number }) {
    const id = `kit-${Math.random().toString(36).substr(2, 9)}`;
    if (isGK) {
      return (
        <svg width={size} height={size} viewBox="0 0 60 60" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
          <defs>
            <linearGradient id={`${id}-gk`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="50%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          {/* Body */}
          <rect x="10" y="8" width="40" height="36" rx="4" fill={`url(#${id}-gk)`} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
          {/* Sleeves */}
          <rect x="4" y="8" width="12" height="20" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
          <rect x="44" y="8" width="12" height="20" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
          {/* Shorts */}
          <rect x="18" y="40" width="24" height="16" rx="2" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
          {/* Collar detail */}
          <path d="M25 8 Q30 12 35 8" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
          {/* Chest stripe */}
          <line x1="10" y1="20" x2="50" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          {/* Number box */}
          <rect x="22" y="22" width="16" height="10" rx="1" fill="rgba(255,255,255,0.25)" />
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
        <defs>
          <linearGradient id={`${id}-out`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="30%" stopColor={color} />
            <stop offset="50%" stopColor="rgba(255,255,255,0.15)" stopOpacity="0.3" />
            <stop offset="70%" stopColor={color} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        {/* Body */}
        <rect x="12" y="10" width="36" height="30" rx="4" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        {/* Gradient overlay for sheen */}
        <rect x="12" y="10" width="36" height="30" rx="4" fill={`url(#${id}-out)`} />
        {/* Sleeves */}
        <rect x="4" y="10" width="14" height="18" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <rect x="42" y="10" width="14" height="18" rx="3" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        {/* Shorts */}
        <rect x="18" y="38" width="24" height="16" rx="2" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
        {/* Collar */}
        <path d="M25 10 Q30 14 35 10" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" />
        {/* Chest stripe */}
        <line x1="12" y1="22" x2="48" y2="22" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </svg>
    );
  }

  /* ── FPL Style Player Card ── */
  function PlayerCard({ player, isGK = false, small = false }: {
    player: { name: string; team: string; fixture: string; color: string; captain?: boolean; viceCaptain?: boolean; star?: boolean; warning?: boolean };
    isGK?: boolean;
    small?: boolean;
  }) {
    const sz = small ? 48 : 56;
    return (
      <div className="flex flex-col items-center" style={{ minWidth: small ? 64 : 72 }}>
        <div className="relative">
          {player.captain && (
            <span
              style={{
                position: "absolute", top: -4, left: -4, zIndex: 2,
                background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000", fontSize: 10, fontWeight: 900,
                width: 18, height: 18, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              }}
            >C</span>
          )}
          {player.viceCaptain && (
            <span
              style={{
                position: "absolute", top: -4, left: -4, zIndex: 2,
                background: "linear-gradient(135deg, #fff, #e0e0e0)", color: "#000", fontSize: 9, fontWeight: 900,
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
                position: "absolute", top: -4, right: -4, zIndex: 2,
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
                position: "absolute", top: -4, right: -4, zIndex: 2,
                background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000", fontSize: 11, fontWeight: 900,
                width: 18, height: 18, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              }}
            >!</span>
          )}
          <Kit color={player.color} isGK={isGK} size={sz} />
        </div>
        <div
          style={{
            background: player.captain ? "linear-gradient(135deg, #FFD700, #FFA500)" : "linear-gradient(180deg, #fff, #f0f0f0)",
            color: "#1a1a2e",
            fontSize: small ? 10 : 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: "4px 4px 0 0",
            marginTop: -4,
            textAlign: "center",
            minWidth: small ? 62 : 72,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: small ? 72 : 88,
            boxShadow: "0 -1px 3px rgba(0,0,0,0.15)",
            borderTop: "1px solid rgba(255,255,255,0.8)",
          }}
        >
          {player.name}
        </div>
        <div
          style={{
            background: player.captain ? "linear-gradient(180deg, #e6c200, #d4a800)" : "linear-gradient(180deg, #37003C, #2d0032)",
            color: player.captain ? "#1a1a2e" : "#fff",
            fontSize: small ? 9 : 10,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: "0 0 4px 4px",
            textAlign: "center",
            minWidth: small ? 62 : 72,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          {player.team} ({player.fixture})
        </div>
      </div>
    );
  }

  // Team kit colors mapping - vibrant FPL-style colors
  const TEAM_KIT_COLORS: Record<string, string> = {
    ACC: "#DB0007", // Accumulators - Arsenal Red
    BAS: "#034694", // Basunzi - Chelsea Blue
    BIF: "#FF7B00", // Bifa - Vibrant Orange
    TRO: "#00B140", // Trotballo - Vibrant Green
    DUJ: "#7B2D8E", // Dujay - Purple
    NIG: "#2D2D2D", // Night Prep - Dark Gray (not pure black for visibility)
    PEA: "#132257", // Peaky Blinders - Navy
    KOM: "#FDBE11", // Komunoballo - Wolves Gold
    MAS: "#EF0107", // Masappe - Bright Red
    MID: "#003399", // Midnight Express - Royal Blue
    CEN: "#00A650", // Centurions - Celtic Green
    JUB: "#FF5722", // Jubilewos - Deep Orange
    END: "#C8102E", // Endgame - Liverpool Red
    ABA: "#1EB980", // Abachuba - Teal Green
    THA: "#A855F7", // Thazobalo - Bright Purple
    QUA: "#06B6D4", // Quadballo - Cyan
  };

  function getKitColor(teamShort?: string | null): string {
    if (!teamShort) return "#666666";
    return TEAM_KIT_COLORS[teamShort.toUpperCase()] || "#666666";
  }

  /* ── Empty Player Slot (FPL Style) ── */
  function EmptySlot({ position, small = false }: { position: string; small?: boolean }) {
    const isGK = position === "GK";
    const sz = small ? 48 : 56;
    const ghostColor = isGK ? "#8B7355" : "#4a4a5a";

    return (
      <div className="flex flex-col items-center" style={{ minWidth: small ? 64 : 72 }}>
        <div className="relative" style={{ opacity: 0.85 }}>
          <Kit color={ghostColor} isGK={isGK} size={sz} />
          {/* Plus icon */}
          <div
            style={{
              position: "absolute",
              bottom: 4,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #00ff87, #04f5ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,255,135,0.6)",
              border: "2px solid #fff",
            }}
          >
            <span style={{ color: "#000", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>+</span>
          </div>
        </div>
        <div
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,240,0.9))",
            color: "#666",
            fontSize: small ? 10 : 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: "4px 4px 0 0",
            marginTop: -4,
            textAlign: "center",
            minWidth: small ? 62 : 72,
            boxShadow: "0 -1px 3px rgba(0,0,0,0.1)",
          }}
        >
          {position}
        </div>
        <div
          style={{
            background: "linear-gradient(180deg, #555, #444)",
            color: "#ccc",
            fontSize: small ? 9 : 10,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: "0 0 4px 4px",
            textAlign: "center",
            minWidth: small ? 62 : 72,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          ---
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
    onToggleStarting,
    captainId,
    viceId,
  }: {
    picked: Player[];
    startingIds: string[];
    onToggleStarting: (id: string) => void;
    captainId: string | null;
    viceId: string | null;
  }) {
    const { starting, bench } = splitStartingAndBench(picked, startingIds);
    const startingByPos = groupByPosition(starting);
    const startingGKs = startingByPos.Goalkeepers.length;
    const startingDefs = startingByPos.Defenders.length;
    const startingMids = startingByPos.Midfielders.length;
    const startingFwds = startingByPos.Forwards.length;
    const startingLadyForwards = starting.filter(
      (p) => p.isLady && normalizePosition(p.position) === "Forward"
    ).length;
    const startingLadyNonForwards = starting.filter(
      (p) => p.isLady && normalizePosition(p.position) !== "Forward"
    ).length;

    // Check if starting 9 is complete and valid
    const isStartingComplete =
      starting.length === 9 &&
      startingGKs === 1 &&
      startingDefs >= 2 &&
      startingDefs <= 3 &&
      startingMids >= 3 &&
      startingMids <= 4 &&
      startingFwds >= 2 &&
      startingFwds <= 3 &&
      startingLadyForwards <= 1 &&
      startingLadyNonForwards === 0;

    // When starting is complete, show starting 9 on pitch; otherwise show all picked
    const playersOnPitch = isStartingComplete ? starting : picked;
    const g = groupByPosition(playersOnPitch);

    const formation = isStartingComplete
      ? `${g.Defenders.length}-${g.Midfielders.length}-${g.Forwards.length}`
      : `${picked.length}/17`;

    return (
      <div className="space-y-0 rounded-2xl overflow-hidden">
        {/* Pitch View */}
        <div
          style={{
            background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
            position: "relative",
            padding: "8px 0 16px",
            overflow: "hidden",
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
          <div style={{ display: "flex", height: 28, marginBottom: 4 }}>
            <div
              style={{
                flex: 1,
                background: "linear-gradient(90deg, #C8102E, #8B0000)",
                display: "flex",
                alignItems: "center",
                paddingLeft: 12,
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
                paddingRight: 12,
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

          {/* GK Row */}
          <div style={{ position: "relative", padding: "8px 0 16px" }}>
            {/* GK */}
            <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
              {g.Goalkeepers.length > 0 ? (
                g.Goalkeepers.map((p) => (
                  <PitchPlayerCard
                    key={p.id}
                    player={p}
                    onToggle={() => onToggleStarting(p.id)}
                    isCaptain={captainId === p.id}
                    isVice={viceId === p.id}
                    isStarting={!isStartingComplete && startingIds.includes(p.id)}
                  />
                ))
              ) : (
                <EmptySlot position="GK" />
              )}
            </div>
          </div>

          {/* DEF Row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "12px 0 16px", position: "relative", zIndex: 1 }}>
            {g.Defenders.length > 0 ? (
              g.Defenders.map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onToggle={() => onToggleStarting(p.id)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                  isStarting={!isStartingComplete && startingIds.includes(p.id)}
                />
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <EmptySlot key={`def-${i}`} position="DEF" />
              ))
            )}
          </div>

          {/* MID Row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "12px 0 16px", position: "relative", zIndex: 1 }}>
            {g.Midfielders.length > 0 ? (
              g.Midfielders.map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onToggle={() => onToggleStarting(p.id)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                  isStarting={!isStartingComplete && startingIds.includes(p.id)}
                />
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <EmptySlot key={`mid-${i}`} position="MID" />
              ))
            )}
          </div>

          {/* FWD Row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 24, padding: "12px 0 8px", position: "relative", zIndex: 1 }}>
            {g.Forwards.length > 0 ? (
              g.Forwards.map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onToggle={() => onToggleStarting(p.id)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                  isStarting={!isStartingComplete && startingIds.includes(p.id)}
                />
              ))
            ) : (
              Array.from({ length: 2 }).map((_, i) => (
                <EmptySlot key={`fwd-${i}`} position="FWD" />
              ))
            )}
          </div>
        </div>

        {/* Bench - Only show when starting 9 is complete */}
        {isStartingComplete ? (
          <div
            style={{
              background: "linear-gradient(180deg, #e0f7f0, #c8ece0)",
              padding: "12px 8px 20px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#37003C" }}>SUBSTITUTES</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 12px" }}>
              {bench
                .sort((a, b) => {
                  const posOrder: Record<string, number> = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4 };
                  const posA = posOrder[normalizePosition(a.position)] || 5;
                  const posB = posOrder[normalizePosition(b.position)] || 5;
                  return posA - posB;
                })
                .map((p, index) => {
                  const pos = normalizePosition(p.position);
                  const posShort = pos === "Goalkeeper" ? "GK" : pos === "Defender" ? "DEF" : pos === "Midfielder" ? "MID" : "FWD";
                  const kitColor = getKitColor(p.teamShort);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onToggleStarting(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#fff",
                        borderRadius: 8,
                        padding: "8px 12px",
                        border: "1px solid #e0e0e0",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "#37003C",
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
                      <div style={{ width: 32, height: 32 }}>
                        <Kit color={kitColor} isGK={pos === "Goalkeeper"} size={32} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>
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
            {picked.length === 0 ? (
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
            ) : picked.length < 17 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#37003C" }}>
                  {picked.length}/17 players in squad
                </div>
                <Link
                  href="/dashboard/transfers"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#C8102E",
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  Complete your squad in Transfers
                </Link>
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#37003C" }}>
                Tap players to select your starting 10 (9 males + 1 lady forward + 1 GK)
              </div>
            )}
            {picked.length === 17 && starting.length > 0 && starting.length < 10 && (
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                {starting.length}/10 starting • Need {10 - starting.length} more
              </div>
            )}
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
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="rounded-2xl border bg-card/70 p-4 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {hasUnsavedChanges ? (
              <button
                onClick={cancelChanges}
                className="h-9 w-9 rounded-full border border-red-200 bg-red-50 grid place-items-center hover:bg-red-100 transition-colors"
                aria-label="Cancel changes"
              >
                <X className="h-4 w-4 text-red-600" />
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
                className="h-9 w-9 rounded-full border border-emerald-200 bg-emerald-50 grid place-items-center hover:bg-emerald-100 transition-colors disabled:opacity-50"
                aria-label="Confirm changes"
              >
                <Check className="h-4 w-4 text-emerald-600" />
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
                    disabled={loading || pickedIds.length < 10}
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
        </div>
      </div>

      {/* Chips - separate small cards */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {chips.map((chip) => (
          <button
            key={chip.name}
            style={{
              flex: 1,
              background: "#f8f8f8",
              border: "1.5px solid #e0e0e0",
              borderRadius: 10,
              padding: "8px 4px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #04F5FF, #00FF87)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
            >
              {chip.icon}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#37003C" }}>{chip.name}</span>
            <span
              style={{
                fontSize: 8,
                color: "#37003C",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "1px 6px",
                fontWeight: 600,
              }}
            >
              {chip.status}
            </span>
          </button>
        ))}
      </div>

      {msg ? <div className="text-sm text-center">{msg}</div> : null}

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
        <div className="-mx-4">
          <PickPitch
            picked={picked}
            startingIds={startingIds}
            onToggleStarting={toggleStarting}
            captainId={captainId}
            viceId={viceId}
          />
        </div>
      )}

      {/* List view - in a card */}
      {tab === "list" && (
        <div className="rounded-2xl border bg-card">
              <div className="px-4 py-3 border-b text-[11px] font-semibold text-muted-foreground grid grid-cols-[1fr_56px_84px_70px] sm:grid-cols-[1fr_70px_100px_80px] gap-2">
                <div>Player</div>
                <div className="text-right">Form</div>
                <div className="text-right">Current Price</div>
                <div className="text-right">Selected</div>
              </div>

              {picked.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Pick players from Player Pool below.</div>
              ) : (
                <div className="divide-y">
                  {listSections.map((section) => (
                    <div key={section.title}>
                      <div className="px-4 py-2 text-sm font-semibold">{section.title}</div>
                      {section.players.length === 0 ? (
                        <div className="px-4 pb-3 text-xs text-muted-foreground">No players selected.</div>
                      ) : (
                        <div className="divide-y">
                          {section.players.map((p) => {
                            const isStarting = startingIds.includes(p.id);
                            const isCaptain = captainId === p.id;
                            const isVice = viceId === p.id;
                            const displayName = shortName(p.name, p.webName);

                            return (
                              <div
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleStarting(p.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleStarting(p.id);
                                  }
                                }}
                                className={cn(
                                  "px-4 py-2 grid grid-cols-[1fr_56px_84px_70px] sm:grid-cols-[1fr_70px_100px_80px] gap-2 items-center",
                                  isStarting ? "bg-emerald-50/60" : "hover:bg-muted/40"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPlayer(p);
                                    }}
                                    className="h-6 w-6 rounded-full border bg-background grid place-items-center"
                                    aria-label={`View ${displayName} details`}
                                  >
                                    <Info className="h-3 w-3" />
                                  </button>
                                  <div className="h-9 w-9 rounded-full overflow-hidden bg-muted shrink-0">
                                    {p.avatarUrl ? (
                                      <img src={p.avatarUrl} alt={displayName} className="h-9 w-9 object-cover" />
                                    ) : (
                                      <div className="h-full w-full grid place-items-center text-sm font-semibold text-muted-foreground">
                                        {displayName.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <div className="text-sm font-semibold truncate">{displayName}</div>
                                      {p.isLady ? (
                                        <span className="text-[10px] font-semibold text-pink-600">Lady</span>
                                      ) : null}
                                      {isCaptain ? (
                                        <span className="text-[10px] font-semibold text-amber-600">C</span>
                                      ) : null}
                                      {isVice ? (
                                        <span className="text-[10px] font-semibold text-sky-600">VC</span>
                                      ) : null}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate">
                                      {p.teamShort ?? p.teamName ?? "--"} - {shortPos(p.position)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right text-xs tabular-nums">{formatForm(p.formLast5)}</div>
                                <div className="text-right text-xs tabular-nums">{formatUGX(p.price)}</div>
                                <div className="text-right text-xs tabular-nums">{formatOwnership(p.ownership)}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  <div>
                    <div className="px-4 py-2 text-sm font-semibold">Substitutes</div>
                    {bench.length === 0 ? (
                      <div className="px-4 pb-3 text-xs text-muted-foreground">No substitutes selected.</div>
                    ) : (
                      <div className="divide-y">
                        {bench.map((p) => {
                          const isCaptain = captainId === p.id;
                          const isVice = viceId === p.id;
                          const displayName = shortName(p.name, p.webName);

                          return (
                            <div
                              key={p.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleStarting(p.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleStarting(p.id);
                                }
                              }}
                              className="px-4 py-2 grid grid-cols-[1fr_56px_84px_70px] sm:grid-cols-[1fr_70px_100px_80px] gap-2 items-center hover:bg-muted/40"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPlayer(p);
                                  }}
                                  className="h-6 w-6 rounded-full border bg-background grid place-items-center"
                                  aria-label={`View ${displayName} details`}
                                >
                                  <Info className="h-3 w-3" />
                                </button>
                                <div className="h-9 w-9 rounded-full overflow-hidden bg-muted shrink-0">
                                  {p.avatarUrl ? (
                                    <img src={p.avatarUrl} alt={displayName} className="h-9 w-9 object-cover" />
                                  ) : (
                                    <div className="h-full w-full grid place-items-center text-sm font-semibold text-muted-foreground">
                                      {displayName.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <div className="text-sm font-semibold truncate">{displayName}</div>
                                    {p.isLady ? (
                                      <span className="text-[10px] font-semibold text-pink-600">Lady</span>
                                    ) : null}
                                    {isCaptain ? (
                                      <span className="text-[10px] font-semibold text-amber-600">C</span>
                                    ) : null}
                                    {isVice ? (
                                      <span className="text-[10px] font-semibold text-sky-600">VC</span>
                                    ) : null}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {p.teamShort ?? p.teamName ?? "--"} - {shortPos(p.position)}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-xs tabular-nums">{formatForm(p.formLast5)}</div>
                              <div className="text-right text-xs tabular-nums">{formatUGX(p.price)}</div>
                              <div className="text-right text-xs tabular-nums">{formatOwnership(p.ownership)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
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
                  {startingIds.length}/9
                </div>

                {picked.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No players yet. Go to <Link href="/dashboard/transfers" className="text-primary font-semibold hover:underline">Transfers</Link> to pick your squad.
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
                                    <span className="text-[10px] font-semibold text-pink-600">Lady</span>
                                  ) : null}
                                  {isCaptain ? (
                                    <span className="text-[10px] font-semibold text-amber-600">C</span>
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
                                  "h-8 w-8 rounded-xl p-0 text-xs",
                                  isCaptain ? "bg-amber-400 text-black border-amber-400" : ""
                                )}
                                onClick={() => setCaptain(p.id)}
                                disabled={!isStarting}
                              >
                                C
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
        />
      )}

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
