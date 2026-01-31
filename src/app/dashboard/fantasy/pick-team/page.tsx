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
  return "—";
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
  const [saving, setSaving] = React.useState(false);
  const [showAuth, setShowAuth] = React.useState(false);
  const [pendingDbSave, setPendingDbSave] = React.useState(false);


  const [players, setPlayers] = React.useState<Player[]>([]);
  const [pickedIds, setPickedIds] = React.useState<string[]>([]);
  const [startingIds, setStartingIds] = React.useState<string[]>([]);
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
            name: String(p.name ?? p.webName ?? p.web_name ?? "—"),
            webName: p.webName ?? p.web_name ?? null,
            position: normalizePosition(p.position),

            teamShort: p.teamShort ?? p.team_short ?? null,
            teamName: p.teamName ?? p.team_name ?? null,

            avatarUrl: p.avatarUrl ?? p.avatar_url ?? null,
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

        if (data.teamName) localStorage.setItem("tbl_team_name", data.teamName);
        setDbLoaded(true);
      } catch {
        setDbLoaded(true);
      }
    })();
  }, [authed, gwId, dbLoaded]);

  React.useEffect(() => {
  if (!authed) return;
  if (!gwId) return;
  if (!pendingDbSave) return;

  (async () => {
    setSaving(true);
    try {
      const teamName = (localStorage.getItem("tbl_team_name") || "My Team").trim();
      await upsertTeamName(teamName);

      await saveRosterToDb({
        gameweekId: gwId,
        squadIds: pickedIds,
        startingIds,
        captainId: null,
        viceId: null,
      });

      setMsg("Signed in ✅ Saved to database.");
      setPendingDbSave(false);
      setShowAuth(false);
    } catch (e: any) {
      setMsg(`Signed in ✅ but DB save failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  })();
}, [authed, gwId, pendingDbSave]); // keep deps minimal


  // derived
  const picked = React.useMemo(
    () => players.filter((p) => pickedIds.includes(p.id)),
    [players, pickedIds]
  );

  const starting = React.useMemo(
    () => players.filter((p) => startingIds.includes(p.id)),
    [players, startingIds]
  );

  const pickedLadies = picked.filter((p) => p.isLady).length;
  const startingLadies = starting.filter((p) => p.isLady).length;

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
      return [...prev, id];
    });
  }

  function removeFromSquad(id: string) {
    setMsg(null);
    setPickedIds((prev) => prev.filter((x) => x !== id));
    setStartingIds((prev) => prev.filter((x) => x !== id)); // auto remove from starting
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
      return [...prev, id];
    });
  }

 async function save() {
  setMsg(null);

  // ✅ rules
  if (pickedIds.length !== 17) return setMsg("Squad must be exactly 17 players.");
  if (pickedLadies < 2) return setMsg("Squad must include at least 2 ladies.");
  if (startingIds.length !== 10) return setMsg("Starting lineup must be exactly 10 players.");

  // ✅ always save locally first (works without login)
  localStorage.setItem(LS_PICKS, JSON.stringify(pickedIds));
  localStorage.setItem(LS_SQUAD, JSON.stringify(pickedIds));
  localStorage.setItem(LS_STARTING, JSON.stringify(startingIds));

  // If not signed in, open AuthGate and mark that we want to DB-save after login
  if (!authed) {
    setPendingDbSave(true);
    setShowAuth(true);
    setMsg("Saved locally ✅ Sign in to save to database.");
    return;
  }

  // If no gwId, skip DB save
  if (!gwId) {
    setMsg("Saved locally ✅ (No gameweek yet, DB save skipped).");
    return;
  }

  // ✅ DB save now
  setSaving(true);
  try {
    const teamName = (localStorage.getItem("tbl_team_name") || "My Team").trim();
    await upsertTeamName(teamName);

    await saveRosterToDb({
      gameweekId: gwId,
      squadIds: pickedIds,
      startingIds,
      captainId: null,
      viceId: null,
    });

    setMsg("Saved ✅ (Database + Local).");
    setPendingDbSave(false);
  } catch (e: any) {
    setMsg(`Saved locally ✅ but DB failed: ${e?.message ?? "Unknown error"}`);
  } finally {
    setSaving(false);
  }
}

  // ----------------------------
  // UI components
  // ----------------------------
  function PitchPlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
    const displayName = (player.webName ?? player.name ?? "—").trim();
    const teamLabel = (player.teamShort ?? player.teamName ?? "—").trim();

    return (
      <button
        type="button"
        onClick={onClick}
        className="relative w-[86px] active:scale-[0.98] transition"
        aria-label={`Select ${displayName}`}
      >
        <div className="rounded-2xl overflow-hidden shadow-md">
          <div className="bg-white/15 backdrop-blur border border-white/10">
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
                ) : null}
              </div>
            </div>

            <div className="mt-2 bg-white text-black px-2 py-2">
              <div className="text-[12px] font-extrabold leading-tight truncate text-center">
                {displayName} {player.isLady ? "👩" : ""}
              </div>
              <div className="text-[11px] font-semibold text-black/70 text-center">
                {teamLabel} • {shortPos(player.position)}
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }

  function PickPitch({
    picked,
    startingIds,
    onToggleStarting,
  }: {
    picked: Player[];
    startingIds: string[];
    onToggleStarting: (id: string) => void;
  }) {
    const { starting, bench } = splitStartingAndBench(picked, startingIds);
    const g = groupByPosition(starting);

    return (
      <div className="space-y-3">
        {/* Pitch */}
        <div
          className={cn(
            "relative rounded-3xl overflow-hidden border",
            "bg-[radial-gradient(circle_at_top,#22c55e33,transparent_60%),linear-gradient(180deg,#0b3b1b,#0a2a16)]"
          )}
        >
          <div className="relative pt-6 pb-5 px-3">
            <div className="flex flex-col gap-6 py-3">
              <div className="flex justify-center">
                {g.Goalkeepers.slice(0, 1).map((p) => (
                  <PitchPlayerCard key={p.id} player={p} onClick={() => onToggleStarting(p.id)} />
                ))}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {g.Defenders.slice(0, 4).map((p) => (
                  <PitchPlayerCard key={p.id} player={p} onClick={() => onToggleStarting(p.id)} />
                ))}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {g.Midfielders.slice(0, 4).map((p) => (
                  <PitchPlayerCard key={p.id} player={p} onClick={() => onToggleStarting(p.id)} />
                ))}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {g.Forwards.slice(0, 3).map((p) => (
                  <PitchPlayerCard key={p.id} player={p} onClick={() => onToggleStarting(p.id)} />
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
                <PitchPlayerCard player={p} onClick={() => onToggleStarting(p.id)} />
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
 

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold">Pick Team</div>
        <div className="text-sm text-muted-foreground">
          Pick <b>17</b> players (min <b>2 ladies</b>). Starting lineup: <b>10</b> players (lady optional).
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          Saving for:{" "}
          <span className="font-semibold">
            {gwLoading ? "Loading GW..." : gwId ? `GW ${gwId}` : "No gameweek"}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="text-sm font-semibold">Squad</div>
            <div className="text-sm">
              {pickedIds.length}/17 • Ladies: {pickedLadies}
            </div>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="text-sm font-semibold">Starting</div>
            <div className="text-sm">
              {startingIds.length}/10 • Ladies: {startingLadies}
            </div>
          </div>
        </div>

        {msg ? <div className="mt-3 text-sm">{msg}</div> : null}

        <div className="mt-3 flex items-center gap-2">
          <Button className="rounded-2xl" onClick={save} disabled={loading || saving}>
  {saving ? "Saving..." : loading ? "Loading..." : "Save Team"}
</Button>

          <div className="ml-auto flex items-center justify-center">
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
          </div>
        </div>

        {/* Pitch/List view for starting lineup */}
        <div className="mt-4">
          {tab === "pitch" ? (
            <PickPitch picked={picked} startingIds={startingIds} onToggleStarting={toggleStarting} />
          ) : (
            <div className="divide-y rounded-2xl border">
              {picked.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Pick players from Player Pool below.</div>
              ) : (
                picked.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.teamName ?? p.teamShort ?? "—"} • {normalizePosition(p.position)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={startingIds.includes(p.id) ? "default" : "secondary"}
                        className="rounded-xl"
                        onClick={() => toggleStarting(p.id)}
                      >
                        {startingIds.includes(p.id) ? "Starting" : "Start"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => removeFromSquad(p.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Squad + Player Pool (FPL style) */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* SQUAD */}
        <div className="rounded-2xl border bg-card">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Your Squad</div>
              <div className="text-xs text-muted-foreground">{picked.length} picked</div>
            </div>

            {picked.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No players yet. Use the Player Pool to pick your 17.
              </div>
            ) : (
              <div className="space-y-2">
                {picked.map((p) => {
                  const isStarting = startingIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-3",
                        isStarting ? "border-emerald-400 bg-emerald-50/60" : "bg-card"
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
                              {p.teamName ?? p.teamShort ?? "—"} • {normalizePosition(p.position)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
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
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Player Pool</div>
              <div className="text-xs text-muted-foreground">
                {loading ? "Loading..." : `${pool.length} available`}
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

            {pickedIds.length >= 17 ? (
              <div className="text-sm text-muted-foreground">
                Squad full ✅ Remove someone to pick another player.
              </div>
            ) : null}

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {pool.map((p) => {
                const disabled = pickedIds.length >= 17;
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
                    {showAuth ? (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="rounded-2xl border bg-background shadow-xl overflow-hidden">
        <div className="p-3 flex items-center justify-between border-b">
          <div className="text-sm font-semibold">Sign in to save to database</div>
          <button
            type="button"
            className="text-sm px-3 py-1 rounded-xl border"
            onClick={() => setShowAuth(false)}
          >
            Close
          </button>
        </div>

        <div className="p-2">
          <AuthGate
            onAuthed={() => {
              setAuthed(true);
              // don't close here; the effect will save to DB then close
            }}
          />
        </div>
      </div>
    </div>
  </div>
) : null}

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
                            {p.teamName ?? p.teamShort ?? "—"} • {normalizePosition(p.position)}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold">
                          Pick
                        </span>
                      </div>
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
