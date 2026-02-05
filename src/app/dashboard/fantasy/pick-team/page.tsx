"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

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

  const [gw, setGw] = React.useState<{ current: any; next: any } | null>(null);

React.useEffect(() => {
  (async () => {
    const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
    const json = await res.json();
    setGw(json);
  })();
}, []);

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

  const savingFor = React.useMemo(() => {
  if (!gw) return null;

  // if current is not finalized, save to current
  if (gw.current && gw.current.finalized === false) return gw.current;

  // otherwise save to next
  return gw.next ?? null;
}, [gw]);

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

        setPlayers(
          (json.players ?? []).map((p: any) => ({
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
          }))
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

  const pool = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pickedSet = new Set(pickedIds);

    return players
      .filter((p) => !pickedSet.has(p.id))
      .filter((p) => (posFilter === "ALL" ? true : normalizePosition(p.position) === posFilter))
      .filter((p) => (q ? (p.name ?? "").toLowerCase().includes(q) || (p.webName ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => (a.webName ?? a.name).localeCompare(b.webName ?? b.name));
  }, [players, pickedIds, query, posFilter]);

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
    isCaptain,
    isVice,
    showLeadership = true,
  }: {
    player: Player;
    onToggle: () => void;
    onCaptain: () => void;
    onVice: () => void;
    isCaptain: boolean;
    isVice: boolean;
    showLeadership?: boolean;
  }) {
    const displayName = shortName(player.name, player.webName);
    const pointsLabel = player.gwPoints !== null && player.gwPoints !== undefined ? "GW" : "Total";
    const pointsValue =
      player.gwPoints !== null && player.gwPoints !== undefined
        ? player.gwPoints
        : player.points ?? null;

    return (
      <div className="relative w-[92px]">
        <button
          type="button"
          onClick={onToggle}
          className="w-full active:scale-[0.98] transition"
          aria-label={`Select ${displayName}`}
        >
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-white/10 backdrop-blur border border-white/15">
              <div className="flex items-center justify-between px-2 pt-2">
                <TeamBadge teamName={player.teamName} teamShort={player.teamShort} size="sm" />
                <div className="text-[10px] font-semibold text-white/90">
                  {formatUGX(player.price)}
                </div>
              </div>

              <div className="px-2 pt-2 flex items-center justify-center">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 grid place-items-center overflow-hidden">
                  {player.avatarUrl ? (
                    <img
                      src={player.avatarUrl}
                      alt={displayName}
                      className="h-12 w-12 object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-[10px] text-white/60">No photo</div>
                  )}
                </div>
              </div>

              <div className="mt-2 bg-white text-black px-2 py-2">
                <div className="text-[12px] font-extrabold leading-tight truncate text-center">
                  {displayName} {player.isLady ? "Lady" : ""}
                </div>
                <div className="text-[11px] font-semibold text-black/70 text-center">
                  {player.teamShort ?? player.teamName ?? "--"} - {shortPos(player.position)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-black/70">
                  <span>
                    {pointsLabel}: {formatNumber(pointsValue)}
                  </span>
                  <span>Form: {formatForm(player.formLast5)}</span>
                </div>
              </div>
            </div>
          </div>
        </button>

        {showLeadership ? (
          <div className="absolute -top-2 right-1 flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCaptain();
              }}
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow",
                isCaptain ? "bg-amber-400 text-black" : "bg-white/80 text-black/70"
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
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow",
                isVice ? "bg-sky-300 text-black" : "bg-white/70 text-black/60"
              )}
            >
              VC
            </button>
          </div>
        ) : null}

        {showLeadership && isCaptain ? (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-black shadow">
            Captain
          </div>
        ) : null}
        {showLeadership && isVice ? (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-sky-300 px-2 py-0.5 text-[10px] font-semibold text-black shadow">
            Vice
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
  }: {
    picked: Player[];
    startingIds: string[];
    onToggleStarting: (id: string) => void;
    captainId: string | null;
    viceId: string | null;
    onCaptain: (id: string) => void;
    onVice: (id: string) => void;
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
        {/* Pitch */}
        <div
          className={cn(
            "relative rounded-3xl overflow-hidden border border-emerald-300/30",
            "bg-[radial-gradient(circle_at_top,#16a34a55,transparent_55%),linear-gradient(180deg,#0a3b1b,#082815)]"
          )}
        >
          <div className="absolute inset-4 rounded-2xl border border-white/20" />
          <div className="absolute left-1/2 top-4 bottom-4 w-px bg-white/10" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" />
          <div className="absolute left-1/2 top-6 h-20 w-44 -translate-x-1/2 rounded-b-3xl border border-white/20" />
          <div className="absolute left-1/2 bottom-6 h-20 w-44 -translate-x-1/2 rounded-t-3xl border border-white/20" />

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
            {bench.map((p) => (
              <div key={p.id} className="shrink-0">
                <PitchPlayerCard
                  player={p}
                  onToggle={() => onToggleStarting(p.id)}
                  onCaptain={() => onCaptain(p.id)}
                  onVice={() => onVice(p.id)}
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
            <div className="text-lg font-semibold">Pick Team</div>
            <div className="text-sm text-muted-foreground">
              Build a 17-player squad. Must include 2 GKs and 2 lady forwards. Start 10: 1 GK, 9
              male + 1 lady forward.
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Saving for:{" "}
              <span className="font-semibold">
                {gwLoading ? "Loading GW..." : gwId ? `GW ${gwId}` : "No gameweek"}
              </span>
            </div>
          </div>

          <Button className="rounded-2xl" onClick={save} disabled={loading}>
            {loading ? "Loading..." : "Save Team"}
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-xl bg-muted/40 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Budget</div>
            <div className="text-sm font-semibold">{formatUGX(budgetRemaining)} left</div>
            <div className="text-xs text-muted-foreground">
              {formatUGX(budgetUsed)} / {formatUGX(BUDGET_TOTAL)}
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Squad</div>
            <div className="text-sm font-semibold">{pickedIds.length}/17</div>
            <div className="text-xs text-muted-foreground">
              GKs: {pickedGoalkeepers.length}/2 - Lady forwards: {pickedLadyForwards.length}/2
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Starting 10</div>
            <div className="text-sm font-semibold">{startingIds.length}/10</div>
            <div className="text-xs text-muted-foreground">
              GK: {startingGoalkeepers}/1 - Male: {startingMales}/9 - Lady FWD:{" "}
              {startingLadyForwards}/1
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border px-2 py-1">Squad 17</span>
          <span className="rounded-full border px-2 py-1">2 GKs</span>
          <span className="rounded-full border px-2 py-1">2 Lady Forwards</span>
          <span className="rounded-full border px-2 py-1">Starting 10</span>
          <span className="rounded-full border px-2 py-1">Start 1 GK</span>
          <span className="rounded-full border px-2 py-1">9 Male + 1 Lady FWD</span>
          <span className="rounded-full border px-2 py-1">Captain + Vice</span>
        </div>

        <div className="text-xs text-muted-foreground">
          Captain: <span className="font-semibold text-foreground">{captainName}</span> | Vice:{" "}
          <span className="font-semibold text-foreground">{viceName}</span>
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

            <div className="grid gap-2 sm:grid-cols-[1fr,120px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players..."
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />

              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value as any)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              >
                <option value="ALL">All</option>
                <option value="Goalkeeper">GK</option>
                <option value="Defender">DEF</option>
                <option value="Midfielder">MID</option>
                <option value="Forward">FWD</option>
              </select>
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
                const pointsLabel = p.gwPoints !== null && p.gwPoints !== undefined ? "GW" : "Total";
                const pointsValue =
                  p.gwPoints !== null && p.gwPoints !== undefined ? p.gwPoints : p.points ?? null;

                return (
                  <button
                    key={p.id}
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
                      <div className="h-10 w-10 rounded-2xl overflow-hidden bg-muted shrink-0">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={displayName} className="h-10 w-10 object-cover" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold truncate">{displayName}</div>
                          {p.isLady ? (
                            <span className="text-[10px] font-semibold text-pink-600">Lady</span>
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

                      <span className="shrink-0 inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold">
                        Pick
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>

  );
}
