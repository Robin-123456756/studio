"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Player = {
  id: string;
  name: string;
  position?: string | null;
  team?: string | null;
  avatarUrl?: string | null;
  isLady: boolean;
};

const LS_PICKS = "tbl_picked_player_ids";
const LS_STARTING = "tbl_starting_player_ids";

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
  if (p === "gk" || p === "goalkeeper") return "Goalkeeper";
  if (p === "def" || p === "defender") return "Defender";
  if (p === "mid" || p === "midfielder") return "Midfielder";
  if (p === "fwd" || p === "forward") return "Forward";
  return pos ?? "Midfielder";
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
  const starting = players.filter((p) => startingIds.includes(p.id));
  const startingSet = new Set(startingIds);
  const bench = players.filter((p) => !startingSet.has(p.id));
  return { starting, bench };
}

export default function PickTeamPage() {
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [pickedIds, setPickedIds] = React.useState<string[]>([]);
  const [startingIds, setStartingIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);
  


  React.useEffect(() => {
    setPickedIds(loadIds(LS_PICKS));
    setStartingIds(loadIds(LS_STARTING));

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load players");
        setPlayers((json.players ?? []).map((p: Player) => ({
  ...p,
  position: normalizePosition(p.position),
})));

      } catch (e: any) {
        setMsg(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const [tab, setTab] = React.useState<TabKey>("pitch");
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
      {tab === "pitch" ? (
  <PickPitch
    picked={picked}
    startingIds={startingIds}
    onToggleStarting={(id) => toggleStarting(id)}
  />
) : null}

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


  function togglePick(id: string) {
    setMsg(null);
    setPickedIds((prev) => {
      const has = prev.includes(id);
      if (has) {
        // remove from picks and starting
        setStartingIds((sPrev) => sPrev.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 17) {
        setMsg("You can only pick 17 players.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function toggleStarting(id: string) {
    setMsg(null);

    // must already be picked
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
      return [...prev, id];
    });
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
      <div
        className={cn(
          "relative rounded-3xl overflow-hidden border",
          "bg-[radial-gradient(circle_at_top,#22c55e33,transparent_60%),linear-gradient(180deg,#0b3b1b,#0a2a16)]"
        )}
      >
        {/* Pitch lines overlay */}
        <div className="absolute inset-0 opacity-[0.18] pointer-events-none">
          <div className="absolute inset-6 rounded-3xl border border-white/60" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-36 w-36 rounded-full border border-white/60" />
        </div>

        {/* Players */}
        <div className="relative pt-6 pb-5 px-3">
          <div className="flex flex-col gap-6 py-3">
            <div className="flex justify-center">
              {g.Goalkeepers.slice(0, 1).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={() => onToggleStarting(p.id)}
                  label={p.team ?? "—"}
                />
              ))}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {g.Defenders.slice(0, 4).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={() => onToggleStarting(p.id)}
                  label={p.team ?? "—"}
                />
              ))}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {g.Midfielders.slice(0, 4).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={() => onToggleStarting(p.id)}
                  label={p.team ?? "—"}
                />
              ))}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {g.Forwards.slice(0, 3).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={() => onToggleStarting(p.id)}
                  label={p.team ?? "—"}
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
                onClick={() => onToggleStarting(p.id)}
                label={p.team ?? "—"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


  function PitchPlayerCard({
  player,
  onClick,
  label,
}: {
  player: Player;
  onClick: (p: Player) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(player)}
      className="relative w-[86px] active:scale-[0.98] transition"
      aria-label={`Select ${player.name}`}
    >
      <div className="rounded-2xl overflow-hidden shadow-md">
        <div className="bg-white/15 backdrop-blur border border-white/10">
          <div className="px-2 pt-2 flex items-center justify-center">
            <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 grid place-items-center overflow-hidden">
              {player.avatarUrl ? (
                <img
                  src={player.avatarUrl}
                  alt={player.name}
                  className="h-12 w-12 object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>
          </div>

          <div className="mt-2 bg-white text-black px-2 py-2">
            <div className="text-[12px] font-extrabold leading-tight truncate text-center">
              {player.name} {player.isLady ? "👩" : ""}
            </div>
            <div className="text-[11px] font-semibold text-black/70 text-center">
              {label ?? player.team ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

  function save() {
    // rules:
    // - exactly 17 picked
    // - at least 2 ladies in squad
    // - exactly 9 starting
    // - at least 1 lady in starting
    if (pickedIds.length !== 17) {
      setMsg("Squad must be exactly 17 players.");
      return;
    }
    if (pickedLadies < 2) {
      setMsg("Squad must include at least 2 ladies.");
      return;
    }
    if (startingIds.length !== 9) {
      setMsg("Starting lineup must be exactly 9 players.");
      return;
    }
    if (startingLadies < 1) {
      setMsg("Starting lineup must include at least 1 lady.");
      return;
    }

    localStorage.setItem(LS_PICKS, JSON.stringify(pickedIds));
    localStorage.setItem(LS_STARTING, JSON.stringify(startingIds));
    setMsg("Saved ✅ Go back to Fantasy to see your team.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold">Pick Team</div>
        <div className="text-sm text-muted-foreground">
          Pick <b>17</b> players (min <b>2 ladies</b>). Starting lineup: <b>9</b> players (min <b>1 lady</b>).
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
              {startingIds.length}/9 • Ladies: {startingLadies}
            </div>
          </div>
        </div>

        {msg ? <div className="mt-3 text-sm">{msg}</div> : null}

        <div className="mt-3">
          <Button className="rounded-2xl" onClick={save}>
            Save Team
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border">
        <div className="p-4 border-b">
          <div className="text-sm font-semibold">All Players</div>
          <div className="text-xs text-muted-foreground">
            Click to pick/unpick. Use “Start” button to add/remove from starting 9.
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="divide-y">
            {players.map((p) => {
              const picked = pickedIds.includes(p.id);
              const starting = startingIds.includes(p.id);

              return (
                <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => togglePick(p.id)}
                    className={cn(
                      "flex items-center gap-3 min-w-0 text-left rounded-xl px-2 py-2 flex-1",
                      picked ? "bg-primary/10" : "hover:bg-accent/10"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {p.name} {p.isLady ? "👩" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.team ?? "—"} • {p.position ?? "—"}
                      </div>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant={starting ? "default" : "secondary"}
                    className="rounded-xl"
                    onClick={() => toggleStarting(p.id)}
                  >
                    {starting ? "Starting" : "Start"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
