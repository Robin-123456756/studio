"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import {
  Sparkles,
  TrendingUp,
  ArrowUpDown,
  Users,
  Zap,
  X,
  TrendingDown,
  Info,
  Scale,
} from "lucide-react";

// DB helpers (Step 3)
import { loadRosterFromDb, saveRosterToDb, upsertTeamName } from "@/lib/fantasyDb";

type SortKey = "name" | "price" | "points" | "form";

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

type TabKey = "pitch" | "list";

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

// Ownership badge
function OwnershipBadge({ ownership }: { ownership?: number | null }) {
  if (!ownership) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
        ownership > 50 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
      )}
      title={`${ownership}% of managers own this player`}
    >
      <Users className="h-2.5 w-2.5" />
      {ownership}%
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
  const [msg, setMsg] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabKey>("pitch");

  // Pool filters
  const [query, setQuery] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<
    "ALL" | "Goalkeeper" | "Defender" | "Midfielder" | "Forward"
  >("ALL");
  const [sortKey, setSortKey] = React.useState<SortKey>("price");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [teamFilter, setTeamFilter] = React.useState<string>("ALL");

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
  // ----------------------------
  React.useEffect(() => {
    const picks = loadIds(LS_PICKS);
    const starting = loadIds(LS_STARTING);
    setPickedIds(picks);
    setStartingIds(starting);
    const savedCaptain = localStorage.getItem(LS_CAPTAIN);
    const savedVice = localStorage.getItem(LS_VICE);
    if (savedCaptain) setCaptainId(savedCaptain);
    if (savedVice) setViceId(savedVice);

    // sync transfers key
    const squad = loadIds(LS_SQUAD);
    if (squad.length === 0 && picks.length > 0) {
      localStorage.setItem(LS_SQUAD, JSON.stringify(picks));
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

  React.useEffect(() => {
    if (!authed) return;
    if (!gwId) return;
    if (dbLoaded) return;

    (async () => {
      try {
        setMsg(null);
        const data = await loadRosterFromDb(gwId);

        if (Array.isArray(data.squadIds) && data.squadIds.length > 0) {
          setPickedIds(data.squadIds);
          setStartingIds(data.startingIds ?? []);

          localStorage.setItem(LS_PICKS, JSON.stringify(data.squadIds));
          localStorage.setItem(LS_SQUAD, JSON.stringify(data.squadIds));
          localStorage.setItem(LS_STARTING, JSON.stringify(data.startingIds ?? []));
        }

        if (data.captainId) {
          setCaptainId(data.captainId);
          localStorage.setItem(LS_CAPTAIN, data.captainId);
        }
        if (data.viceId) {
          setViceId(data.viceId);
          localStorage.setItem(LS_VICE, data.viceId);
        }

        if (data.teamName) localStorage.setItem("tbl_team_name", data.teamName);
        setDbLoaded(true);
      } catch {
        setDbLoaded(true);
      }
    })();
  }, [authed, gwId, dbLoaded]);

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

  const pickedLadyForwards = picked.filter(
    (p) => p.isLady && normalizePosition(p.position) === "Forward"
  );
  const pickedGoalkeepers = picked.filter(
    (p) => normalizePosition(p.position) === "Goalkeeper"
  );
  const startingLadyForwards = starting.filter(
    (p) => p.isLady && normalizePosition(p.position) === "Forward"
  ).length;
  const startingGoalkeepers = starting.filter(
    (p) => normalizePosition(p.position) === "Goalkeeper"
  ).length;
  const startingMales = starting.filter((p) => !p.isLady).length;

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

  React.useEffect(() => {
    if (captainId && !startingIds.includes(captainId)) setCaptainId(null);
    if (viceId && !startingIds.includes(viceId)) setViceId(null);
  }, [startingIds, captainId, viceId]);

  // Get unique teams for filter
  const allTeams = React.useMemo(() => {
    const teams = new Set<string>();
    players.forEach((p) => {
      if (p.teamShort) teams.add(p.teamShort);
    });
    return Array.from(teams).sort();
  }, [players]);

  const pool = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pickedSet = new Set(pickedIds);

    return players
      .filter((p) => !pickedSet.has(p.id))
      .filter((p) => (posFilter === "ALL" ? true : normalizePosition(p.position) === posFilter))
      .filter((p) => (teamFilter === "ALL" ? true : p.teamShort === teamFilter))
      .filter((p) => (q ? (p.name ?? "").toLowerCase().includes(q) || (p.webName ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") {
          cmp = (a.webName ?? a.name).localeCompare(b.webName ?? b.name);
        } else if (sortKey === "price") {
          cmp = (b.price ?? 0) - (a.price ?? 0);
        } else if (sortKey === "points") {
          cmp = (b.points ?? 0) - (a.points ?? 0);
        } else if (sortKey === "form") {
          const af = parseFloat(a.formLast5 ?? "0") || 0;
          const bf = parseFloat(b.formLast5 ?? "0") || 0;
          cmp = bf - af;
        }
        return sortAsc ? -cmp : cmp;
      });
  }, [players, pickedIds, query, posFilter, teamFilter, sortKey, sortAsc]);

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

    setStartingIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= 10) {
        setMsg("Starting lineup is only 10 players.");
        return prev;
      }
      const player = playerById.get(id);
      if (player && normalizePosition(player.position) === "Goalkeeper") {
        if (startingGoalkeepers >= 1) {
          setMsg("Only one goalkeeper can start.");
          return prev;
        }
      }
      if (player?.isLady) {
        if (normalizePosition(player.position) !== "Forward") {
          setMsg("Only lady forwards can start.");
          return prev;
        }
        if (startingLadyForwards >= 1) {
          setMsg("Only one lady forward can start.");
          return prev;
        }
      } else if (startingMales >= 9) {
        setMsg("Starting lineup must have only 9 male players.");
        return prev;
      }
      return [...prev, id];
    });
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

    // Sort picked by points
    const sortedPicked = [...picked].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

    const newStarting: string[] = [];

    // Must have 1 GK
    const gk = sortedPicked.find((p) => normalizePosition(p.position) === "Goalkeeper");
    if (gk) newStarting.push(gk.id);

    // Must have 1 lady forward
    const ladyFwd = sortedPicked.find((p) => p.isLady && normalizePosition(p.position) === "Forward");
    if (ladyFwd) newStarting.push(ladyFwd.id);

    // Fill remaining 8 with best males (non-GK)
    const males = sortedPicked.filter(
      (p) => !p.isLady && normalizePosition(p.position) !== "Goalkeeper" && !newStarting.includes(p.id)
    );

    for (const m of males) {
      if (newStarting.length >= 10) break;
      newStarting.push(m.id);
    }

    // If still not 10, add more non-starting males
    if (newStarting.length < 10) {
      const remaining = sortedPicked.filter((p) => !newStarting.includes(p.id) && !p.isLady);
      for (const r of remaining) {
        if (newStarting.length >= 10) break;
        newStarting.push(r.id);
      }
    }

    setStartingIds(newStarting);
    setMsg("Auto-selected starting 10 based on points.");
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
    if (startingLadyForwards !== 1) {
      return setMsg("Starting lineup must include exactly 1 lady forward.");
    }
    if (startingMales !== 9) {
      return setMsg("Starting lineup must include exactly 9 male players.");
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

  function PitchPlayerCard({
    player,
    onToggle,
    onCaptain,
    onVice,
    onInfo,
    isCaptain,
    isVice,
    showLeadership = true,
  }: {
    player: Player;
    onToggle: () => void;
    onCaptain: () => void;
    onVice: () => void;
    onInfo: () => void;
    isCaptain: boolean;
    isVice: boolean;
    showLeadership?: boolean;
  }) {
    const displayName = shortName(player.name, player.webName);
    const pointsValue =
      player.gwPoints !== null && player.gwPoints !== undefined
        ? player.gwPoints
        : player.points ?? null;

    // Get position color for jersey
    const posColorMap: Record<string, string> = {
      Goalkeeper: "from-amber-500 to-amber-600",
      Defender: "from-blue-500 to-blue-600",
      Midfielder: "from-emerald-500 to-emerald-600",
      Forward: "from-rose-600 to-red-700",
    };
    const normalizedPos = normalizePosition(player.position);
    const posColor = posColorMap[normalizedPos] ?? "from-gray-500 to-gray-600";

    return (
      <div className="relative w-[88px]">
        {/* Info button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          className="absolute -top-1 -left-1 z-10 h-5 w-5 rounded-full bg-white shadow-md grid place-items-center hover:bg-gray-100"
          aria-label={`View ${displayName} details`}
        >
          <Info className="h-3 w-3 text-gray-600" />
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="w-full active:scale-[0.96] transition-transform duration-150"
          aria-label={`Select ${displayName}`}
        >
          <div className="rounded-2xl overflow-hidden shadow-xl">
            {/* Jersey/Avatar section */}
            <div className={cn("relative bg-gradient-to-b", posColor, "pt-1 pb-2")}>
              {/* Team badge */}
              <div className="absolute top-1 left-1">
                <TeamBadge teamName={player.teamName} teamShort={player.teamShort} size="sm" />
              </div>

              {/* Lady badge + Price change */}
              <div className="absolute top-1 right-1 flex items-center gap-0.5">
                {player.priceChange !== 0 && player.priceChange && (
                  <div className={cn(
                    "text-[8px] font-bold px-1 rounded",
                    player.priceChange > 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                  )}>
                    {player.priceChange > 0 ? "↑" : "↓"}
                  </div>
                )}
                {player.isLady && (
                  <div className="bg-pink-500 text-white text-[8px] font-bold px-1 rounded">
                    F
                  </div>
                )}
              </div>

              {/* Avatar */}
              <div className="flex items-center justify-center pt-3">
                <div className="h-11 w-11 rounded-full bg-white/20 border-2 border-white/40 grid place-items-center overflow-hidden shadow-inner">
                  {player.avatarUrl ? (
                    <img
                      src={player.avatarUrl}
                      alt={displayName}
                      className="h-11 w-11 object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-white/80 text-lg font-bold">
                      {displayName.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info section - Budo League themed */}
            <div className="bg-gradient-to-b from-zinc-900 to-black text-white px-1.5 py-1.5">
              <div className="text-[11px] font-bold leading-tight truncate text-center">
                {displayName}
              </div>
              <div className="text-[9px] text-white/70 text-center truncate">
                {player.teamShort ?? "--"}
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px]">
                <span className="text-emerald-400 font-semibold">{formatNumber(pointsValue)} pts</span>
                <span className="text-white/60">{formatUGX(player.price).replace("UGX ", "")}</span>
              </div>
            </div>
          </div>
        </button>

        {/* Captain/Vice buttons */}
        {showLeadership ? (
          <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCaptain();
              }}
              className={cn(
                "h-5 w-5 rounded-full text-[9px] font-bold shadow-lg transition-all",
                isCaptain
                  ? "bg-gradient-to-br from-amber-400 to-amber-500 text-black ring-2 ring-amber-300"
                  : "bg-white/90 text-black/60 hover:bg-white"
              )}
            >
              C
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVice();
              }}
              className={cn(
                "h-5 w-5 rounded-full text-[9px] font-bold shadow-lg transition-all",
                isVice
                  ? "bg-gradient-to-br from-sky-400 to-sky-500 text-black ring-2 ring-sky-300"
                  : "bg-white/80 text-black/50 hover:bg-white"
              )}
            >
              V
            </button>
          </div>
        ) : null}

        {/* Captain/Vice label */}
        {showLeadership && isCaptain ? (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[8px] font-bold text-black shadow-lg">
            CAPTAIN
          </div>
        ) : null}
        {showLeadership && isVice ? (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-400 to-sky-500 px-2 py-0.5 text-[8px] font-bold text-black shadow-lg">
            VICE
          </div>
        ) : null}
      </div>
    );
  }

  function PickPitch({
    picked,
    startingIds,
    onToggleStarting,
    captainId,
    viceId,
    onCaptain,
    onVice,
    onInfo,
  }: {
    picked: Player[];
    startingIds: string[];
    onToggleStarting: (id: string) => void;
    captainId: string | null;
    viceId: string | null;
    onCaptain: (id: string) => void;
    onVice: (id: string) => void;
    onInfo: (player: Player) => void;
  }) {
    const { starting, bench } = splitStartingAndBench(picked, startingIds);
    const g = groupByPosition(starting);
    const startingMales = starting.filter((p) => !p.isLady).length;
    const startingLadyForwards = starting.filter(
      (p) => p.isLady && normalizePosition(p.position) === "Forward"
    ).length;
    const formationReady =
      starting.length === 10 &&
      startingMales === 9 &&
      startingLadyForwards === 1 &&
      startingGoalkeepers === 1;
    const formation = formationReady
      ? `${g.Defenders.length}-${g.Midfielders.length}-${g.Forwards.length}`
      : "--";

    return (
      <div className="space-y-3">
        {/* Pitch - Budo League themed */}
        <div
          className={cn(
            "relative rounded-3xl overflow-hidden border-2 border-primary/30",
            "bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-800",
            "shadow-[inset_0_0_100px_rgba(0,0,0,0.3)]"
          )}
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 80px),
              linear-gradient(180deg, #166534 0%, #15803d 50%, #166534 100%)
            `
          }}
        >
          {/* Field markings */}
          <div className="absolute inset-4 rounded-2xl border-2 border-white/30" />
          <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-white/20" />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />
          <div className="absolute left-1/2 top-6 h-24 w-48 -translate-x-1/2 rounded-b-3xl border-2 border-white/30" />
          <div className="absolute left-1/2 bottom-6 h-24 w-48 -translate-x-1/2 rounded-t-3xl border-2 border-white/30" />
          {/* Goal areas */}
          <div className="absolute left-1/2 top-6 h-10 w-20 -translate-x-1/2 rounded-b-xl border-2 border-white/25" />
          <div className="absolute left-1/2 bottom-6 h-10 w-20 -translate-x-1/2 rounded-t-xl border-2 border-white/25" />

          <div className="relative px-3 pt-4 pb-6">
            <div className="mb-2 flex items-center justify-between text-xs text-white/70">
              <span>Formation {formation}</span>
              <span className="uppercase tracking-widest">Starting 10</span>
            </div>

            <div className="flex flex-col gap-6 py-3">
              <div className="flex justify-center">
                {g.Goalkeepers.slice(0, 1).map((p) => (
                  <PitchPlayerCard
                    key={p.id}
                    player={p}
                    onToggle={() => onToggleStarting(p.id)}
                    onCaptain={() => onCaptain(p.id)}
                    onVice={() => onVice(p.id)}
                    onInfo={() => onInfo(p)}
                    isCaptain={captainId === p.id}
                    isVice={viceId === p.id}
                  />
                ))}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {g.Defenders.map((p) => (
                  <PitchPlayerCard
                    key={p.id}
                    player={p}
                    onToggle={() => onToggleStarting(p.id)}
                    onCaptain={() => onCaptain(p.id)}
                    onVice={() => onVice(p.id)}
                    onInfo={() => onInfo(p)}
                    isCaptain={captainId === p.id}
                    isVice={viceId === p.id}
                  />
                ))}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {g.Midfielders.map((p) => (
                  <PitchPlayerCard
                    key={p.id}
                    player={p}
                    onToggle={() => onToggleStarting(p.id)}
                    onCaptain={() => onCaptain(p.id)}
                    onVice={() => onVice(p.id)}
                    onInfo={() => onInfo(p)}
                    isCaptain={captainId === p.id}
                    isVice={viceId === p.id}
                  />
                ))}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {g.Forwards.map((p) => (
                  <PitchPlayerCard
                    key={p.id}
                    player={p}
                    onToggle={() => onToggleStarting(p.id)}
                    onCaptain={() => onCaptain(p.id)}
                    onVice={() => onVice(p.id)}
                    onInfo={() => onInfo(p)}
                    isCaptain={captainId === p.id}
                    isVice={viceId === p.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bench */}
        <div className="rounded-2xl border bg-card/60 backdrop-blur px-3 py-3">
          <div className="flex items-center justify-between pb-2">
            <div className="text-sm font-semibold">Bench</div>
            <div className="text-xs text-muted-foreground">Tap to add/remove starting</div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {bench.map((p, index) => (
              <div key={p.id} className="shrink-0 relative">
                {/* Bench order number */}
                <div className="absolute -top-2 -left-1 z-10 h-5 w-5 rounded-full bg-zinc-800 text-white text-[10px] font-bold grid place-items-center shadow">
                  {index + 1}
                </div>
                <PitchPlayerCard
                  player={p}
                  onToggle={() => onToggleStarting(p.id)}
                  onCaptain={() => onCaptain(p.id)}
                  onVice={() => onVice(p.id)}
                  onInfo={() => onInfo(p)}
                  isCaptain={captainId === p.id}
                  isVice={viceId === p.id}
                  showLeadership={false}
                />
              </div>
            ))}
          </div>
        </div>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xl font-bold text-foreground">Pick Your Squad</div>
            <div className="text-sm text-muted-foreground mt-1">
              Build a 17-player squad with 2 GKs and 2 lady forwards. Start 10: 1 GK, 9 males + 1 lady forward.
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                {gwLoading ? "Loading..." : gwId ? `GW ${gwId}` : "No gameweek"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-2xl gap-2"
              onClick={autoPick}
              disabled={loading || pickedIds.length >= 17}
            >
              <Sparkles className="h-4 w-4" />
              Auto-Pick
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl gap-2"
              onClick={autoSelectStarting}
              disabled={loading || pickedIds.length < 10}
            >
              <Zap className="h-4 w-4" />
              Auto-Start
            </Button>
            <Button
              className="rounded-2xl bg-primary hover:bg-primary/90 gap-2"
              onClick={save}
              disabled={loading}
            >
              {loading ? "Loading..." : "Save Team"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Budget Card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider">
              <TrendingUp className="h-3.5 w-3.5" />
              Budget
            </div>
            <div className="mt-2 text-2xl font-bold">{formatUGX(budgetRemaining)}</div>
            <div className="text-xs text-muted-foreground">
              {formatUGX(budgetUsed)} spent of {formatUGX(BUDGET_TOTAL)}
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-primary/20 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  budgetPercent > 90 ? "bg-rose-500" : budgetPercent > 75 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>

          {/* Squad Card */}
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-black text-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-white/70 uppercase tracking-wider">
              <Users className="h-3.5 w-3.5" />
              Squad
            </div>
            <div className="mt-2 text-2xl font-bold">{pickedIds.length}<span className="text-white/50">/17</span></div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className={cn("text-xs px-2 py-0.5 rounded-full", pickedGoalkeepers.length === 2 ? "bg-emerald-500/30 text-emerald-300" : "bg-white/10 text-white/70")}>
                GK {pickedGoalkeepers.length}/2
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", pickedLadyForwards.length === 2 ? "bg-pink-500/30 text-pink-300" : "bg-white/10 text-white/70")}>
                Lady FWD {pickedLadyForwards.length}/2
              </span>
            </div>
          </div>

          {/* Starting 10 Card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-white/80 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" />
              Starting 10
            </div>
            <div className="mt-2 text-2xl font-bold">{startingIds.length}<span className="text-white/50">/10</span></div>
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              <span className={cn("px-2 py-0.5 rounded-full", startingGoalkeepers === 1 ? "bg-white/30" : "bg-white/10 text-white/60")}>
                GK {startingGoalkeepers}/1
              </span>
              <span className={cn("px-2 py-0.5 rounded-full", startingMales === 9 ? "bg-white/30" : "bg-white/10 text-white/60")}>
                Male {startingMales}/9
              </span>
              <span className={cn("px-2 py-0.5 rounded-full", startingLadyForwards === 1 ? "bg-white/30" : "bg-white/10 text-white/60")}>
                Lady {startingLadyForwards}/1
              </span>
            </div>
          </div>
        </div>

        {/* Leadership */}
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 grid place-items-center text-black font-bold text-sm shadow">
              C
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Captain</div>
              <div className="text-sm font-semibold">{captainName}</div>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-500 grid place-items-center text-black font-bold text-sm shadow">
              V
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Vice-Captain</div>
              <div className="text-sm font-semibold">{viceName}</div>
            </div>
          </div>
        </div>

        {msg ? <div className="text-sm">{msg}</div> : null}

        <div className="flex items-center gap-2">
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
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Tap a player to toggle starting. Captain and vice are from the starting 10.
          </div>
        </div>

        {/* Pitch/List view for starting lineup */}
        <div className="mt-4">
          {tab === "pitch" ? (
            <PickPitch
              picked={picked}
              startingIds={startingIds}
              onToggleStarting={toggleStarting}
              captainId={captainId}
              viceId={viceId}
              onCaptain={setCaptain}
              onVice={setVice}
              onInfo={setSelectedPlayer}
            />
          ) : (
            <div className="divide-y rounded-2xl border">
              {picked.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Pick players from Player Pool below.</div>
              ) : (
                picked.map((p) => {
                  const isStarting = startingIds.includes(p.id);
                  const isCaptain = captainId === p.id;
                  const isVice = viceId === p.id;
                  const displayName = shortName(p.name, p.webName);
                  const pointsLabel = p.gwPoints !== null && p.gwPoints !== undefined ? "GW" : "Total";
                  const pointsValue =
                    p.gwPoints !== null && p.gwPoints !== undefined ? p.gwPoints : p.points ?? null;

                  return (
                    <div key={p.id} className="p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-muted shrink-0">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={displayName} className="h-12 w-12 object-cover" />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">{displayName}</div>
                            {p.isLady ? (
                              <span className="text-[10px] font-semibold text-pink-600">Lady</span>
                            ) : null}
                            {isCaptain ? (
                              <span className="text-[10px] font-semibold text-amber-600">C</span>
                            ) : null}
                            {isVice ? <span className="text-[10px] font-semibold text-sky-600">VC</span> : null}
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

                      <div className="flex flex-wrap items-center gap-2">
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

                        <div className="flex items-center gap-1">
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
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Squad + Player Pool (FPL style) */}
      <div className="mx-auto w-full max-w-md grid gap-4 md:max-w-5xl md:grid-cols-2">
        {/* SQUAD */}
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
              <div className="text-sm text-muted-foreground">
                No players yet. Use the Player Pool to pick your 17.
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

        {/* PLAYER POOL */}
        <div className="rounded-2xl border bg-card">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-semibold">Player Pool</div>

              <div className="text-xs text-muted-foreground whitespace-nowrap rounded-full border px-2 py-0.5">
                {loading ? "Loading..." : `${pool.length} available`}
              </div>
            </div>

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
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-xl border bg-background px-3 py-2 text-sm"
              >
                <option value="price">Sort: Price</option>
                <option value="points">Sort: Points</option>
                <option value="form">Sort: Form</option>
                <option value="name">Sort: Name</option>
              </select>

              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                className="flex items-center justify-center gap-1 rounded-xl border bg-background px-3 py-2 text-sm hover:bg-accent"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortAsc ? "Asc" : "Desc"}
              </button>
            </div>

            {pickedIds.length >= 17 ? (
              <div className="text-sm text-muted-foreground">
                Squad full. Remove someone to pick another player.
              </div>
            ) : null}

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {pool.map((p) => {
                const disabled = pickedIds.length >= 17;
                const displayName = shortName(p.name, p.webName);
                const pointsValue = p.points ?? 0;

                return (
                  <div key={p.id} className="relative">
                    {/* Info button */}
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer(p)}
                      className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-muted grid place-items-center hover:bg-muted/80"
                      aria-label="View details"
                    >
                      <Info className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => addToSquad(p.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                        "bg-card hover:bg-accent/10 active:bg-accent/20",
                        disabled ? "opacity-60" : ""
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar with position color */}
                        <div className="relative">
                          <div className="h-12 w-12 rounded-2xl overflow-hidden bg-muted shrink-0">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={displayName} className="h-12 w-12 object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center text-lg font-bold text-muted-foreground">
                                {displayName.charAt(0)}
                              </div>
                            )}
                          </div>
                          {/* Position indicator */}
                          <div className={cn(
                            "absolute -bottom-1 -right-1 h-5 w-5 rounded-full grid place-items-center text-[9px] font-bold text-white",
                            normalizePosition(p.position) === "Goalkeeper" && "bg-amber-500",
                            normalizePosition(p.position) === "Defender" && "bg-blue-500",
                            normalizePosition(p.position) === "Midfielder" && "bg-emerald-500",
                            normalizePosition(p.position) === "Forward" && "bg-rose-500"
                          )}>
                            {shortPos(p.position)}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold truncate">{displayName}</div>
                            {p.isLady && (
                              <span className="text-[10px] font-semibold text-pink-600">Lady</span>
                            )}
                            <PriceChangeIndicator change={p.priceChange} />
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <TeamBadge teamName={p.teamName} teamShort={p.teamShort} size="sm" />
                            <span className="truncate">{p.teamShort ?? "--"}</span>
                            {p.nextOpponent && (
                              <>
                                <span className="text-muted-foreground/50">vs</span>
                                <span className="font-medium">{p.nextOpponent}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] font-semibold text-primary">
                              {formatUGX(p.price)}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-medium">
                              {formatNumber(pointsValue)} pts
                            </span>
                            <OwnershipBadge ownership={p.ownership} />
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <FormSparkline history={p.pointsHistory} size="sm" />
                          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-semibold">
                            Pick
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
