"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { myFantasyTeam, fantasyStandings } from "@/lib/data";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Shirt,
  ArrowLeftRight,
  Crown,
  ShieldCheck,
  X,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Player = {
  id: string;
  name: string;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | string;
  price: number;
  points: number;
  avatarUrl?: string | null;
  isLady?: boolean;
  teamShort?: string | null;
  teamName?: string | null;



  // ✅ needed for autosubs
  didPlay?: boolean; // or minutes?: number
};

type ApiGameweek = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

type ApiPlayer = {
  id: string;
  name: string;
  webName?: string | null;
  position?: string | null;
  price?: number | null;
  points?: number | null;
  avatarUrl?: string | null;
  isLady?: boolean | null;
  teamShort?: string | null;
  teamName?: string | null;
};

type TabKey = "pitch" | "list";

function groupByPosition(players: Player[]) {
  return {
    Goalkeepers: players.filter((p) => p.position === "Goalkeeper"),
    Defenders: players.filter((p) => p.position === "Defender"),
    Midfielders: players.filter((p) => p.position === "Midfielder"),
    Forwards: players.filter((p) => p.position === "Forward"),
  };
}

function normalizePosition(pos?: string | null): Player["position"] {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "df" || p === "defender") return "Defender";
  if (p === "mid" || p === "mf" || p === "midfielder") return "Midfielder";
  if (p === "fwd" || p === "fw" || p === "forward" || p === "striker") return "Forward";
  return pos ?? "Midfielder";
}



const LS_PICKS = "tbl_picked_player_ids";

function formatDeadlineUG(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);

  const s = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  }).format(d);

  return s
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM")
    .replace(/\ba\.m\.\b/i, "AM")
    .replace(/\bp\.m\.\b/i, "PM");
}

function sortBench(players: Player[]) {
  const posOrder: Record<string, number> = {
    Goalkeeper: 0,
    Defender: 1,
    Midfielder: 2,
    Forward: 3,
  };

  return [...players].sort((a, b) => {
    const pa = posOrder[a.position] ?? 99;
    const pb = posOrder[b.position] ?? 99;
    if (pa !== pb) return pa - pb;

    // same position -> points desc
    const ptsA = Number(a.points ?? 0);
    const ptsB = Number(b.points ?? 0);
    if (ptsB !== ptsA) return ptsB - ptsA;

    // tie-breaker -> price desc (optional)
    const prA = Number(a.price ?? 0);
    const prB = Number(b.price ?? 0);
    if (prB !== prA) return prB - prA;

    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

 function splitStartingAndBench(players: Player[]) {
  const { onField, bench } = pickMatchDay10(players);
  return { starting: onField, bench };
}

function swapPlayersInArray(players: Player[], aId: string, bId: string) {
  const aIndex = players.findIndex((p) => p.id === aId);
  const bIndex = players.findIndex((p) => p.id === bId);
  if (aIndex < 0 || bIndex < 0) return players;

  const next = [...players];
  const temp = next[aIndex];
  next[aIndex] = next[bIndex];
  next[bIndex] = temp;
  return next;
}

function MiniLeague() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="px-4 pt-4 pb-2">
          <div className="text-base font-semibold">Mini-League</div>
          <div className="text-sm text-muted-foreground">Your rank among rivals.</div>
        </div>

        <div className="px-2 pb-3">
          <div className="space-y-1">
            {fantasyStandings.map((t) => {
              const isMe = t.name === myFantasyTeam.name;
              const trend =
                t.rank < myFantasyTeam.rank ? "up" : t.rank > myFantasyTeam.rank ? "down" : "same";

              return (
                <div
                  key={t.rank}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2",
                    isMe ? "bg-primary/15" : "bg-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 text-sm font-medium flex items-center gap-1">
                      {trend === "up" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : trend === "down" ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      <span className="tabular-nums">{t.rank}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.owner}</div>
                    </div>
                  </div>

                  <div className="text-sm font-bold font-mono tabular-nums">{t.points}</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PitchPlayerCard({
  player,
  onClick,
  captainId,
  viceId,
  fixtureText,
}: {
  player: Player;
  onClick: (p: Player) => void;
  captainId?: string | null;
  viceId?: string | null;
  fixtureText?: string;
}) {
  const badge =
    captainId === player.id
      ? { label: "C", cls: "bg-amber-400 text-black" }
      : viceId === player.id
      ? { label: "VC", cls: "bg-emerald-400 text-black" }
      : null;

  return (
    <button
      type="button"
      onClick={() => onClick(player)}
      className="relative w-[86px] active:scale-[0.98] transition"
      aria-label={`Open ${player.name}`}
    >
      {badge ? (
        <div
          className={cn(
            "absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full grid place-items-center",
            "text-[11px] font-extrabold shadow",
            badge.cls
          )}
        >
          {badge.label}
        </div>
      ) : null}

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
              {player.name}
            </div>
            <div className="text-[11px] font-semibold text-black/70 text-center">
              {fixtureText ?? player.teamShort ?? player.teamName ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function BenchStrip({
  bench,
  onPick,
  captainId,
  viceId,
}: {
  bench: Player[];
  onPick: (p: Player) => void;
  captainId?: string | null;
  viceId?: string | null;
}) {
  if (!bench.length) return null;

  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur px-3 py-3">
      <div className="flex items-center justify-between pb-2">
        <div className="text-sm font-semibold">Bench</div>
        <div className="text-xs text-muted-foreground">Tap any player</div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {bench.map((p) => (
          <div key={p.id} className="shrink-0">
            <PitchPlayerCard
              player={p}
              onClick={onPick}
              captainId={captainId}
              viceId={viceId}
              fixtureText={p.position}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchView({
  players,
  onPickPlayer,
  captainId,
  viceId,
}: {
  players: Player[];
  onPickPlayer: (p: Player) => void;
  captainId?: string | null;
  viceId?: string | null;
}) {
  const { onField, bench, errors } = pickMatchDay10(players);
const benchSorted = React.useMemo(() => sortBench(bench), [bench]);
const g = groupByPosition(onField);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative rounded-3xl overflow-hidden border",
          "bg-[radial-gradient(circle_at_top,#22c55e33,transparent_60%),linear-gradient(180deg,#0b3b1b,#0a2a16)]"
        )}
      >
        <div className="absolute inset-x-0 top-0 h-10 bg-white/10 backdrop-blur border-b border-white/10 flex items-center justify-center">
          <div className="text-xs font-semibold text-white/80 tracking-wide">
            THE BUDO LEAGUE • FANTASY
          </div>
        </div>

        <div className="absolute inset-0 opacity-[0.18] pointer-events-none">
          <div className="absolute inset-6 rounded-3xl border border-white/60" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-36 w-36 rounded-full border border-white/60" />
          <div className="absolute left-1/2 top-[34%] -translate-x-1/2 h-28 w-44 rounded-2xl border border-white/60" />
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2 h-20 w-28 rounded-2xl border border-white/60" />
          <div className="absolute left-1/2 bottom-[34%] -translate-x-1/2 h-28 w-44 rounded-2xl border border-white/60" />
          <div className="absolute left-1/2 bottom-[18%] -translate-x-1/2 h-20 w-28 rounded-2xl border border-white/60" />
        </div>

        <div className="relative pt-12 pb-5 px-3">
          <div className="flex flex-col gap-6 py-3">
            <div className="flex justify-center">
              {g.Goalkeepers.slice(0, 1).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                  fixtureText="GK"
                />
              ))}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {g.Defenders.slice(0, 4).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                  fixtureText="DEF"
                />
              ))}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {g.Midfielders.slice(0, 4).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                  fixtureText="MID"
                />
              ))}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {g.Forwards.slice(0, 3).map((p) => (
                <PitchPlayerCard
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                  fixtureText="FWD"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <BenchStrip
  bench={benchSorted}
  onPick={onPickPlayer}
  captainId={captainId}
  viceId={viceId}
/>

    </div>
  );
}

function pickMatchDay10(players: Player[]) {
  const isGK = (p: Player) => p.position === "Goalkeeper";
  const isDEF = (p: Player) => p.position === "Defender";
  const isMID = (p: Player) => p.position === "Midfielder";
  const isFWD = (p: Player) => p.position === "Forward";

  const byBest = (list: Player[]) =>
    [...list].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  const selected = new Map<string, Player>();
  const add = (p?: Player | null) => {
    if (!p) return;
    if (selected.size >= 10) return;
    selected.set(p.id, p);
  };

  // 1) EXACTLY 1 GK
  const gk = byBest(players.filter(isGK))[0];
  add(gk);

  // 2) MUST have 1 lady attacker (lady forward)
  const ladyFwd = byBest(players.filter((p) => isFWD(p) && !!p.isLady))[0];
  add(ladyFwd);

  // 3) Fill attackers up to max 3 total
  const fwdNeed = 3 - [...selected.values()].filter(isFWD).length;
  byBest(players.filter((p) => isFWD(p) && !selected.has(p.id)))
    .slice(0, Math.max(0, fwdNeed))
    .forEach(add);

  // 4) Fill midfielders up to max 4 (aim 4)
  byBest(players.filter((p) => isMID(p) && !selected.has(p.id)))
    .slice(0, 4)
    .forEach(add);

  // 5) Ensure at least 2 defenders
  const defNeed = Math.max(
    0,
    2 - [...selected.values()].filter(isDEF).length
  );
  byBest(players.filter((p) => isDEF(p) && !selected.has(p.id)))
    .slice(0, defNeed)
    .forEach(add);

  // 6) Fill remaining slots to reach 10:
  // Prefer DEF, then MID (if <4), then FWD (if <3).
  // NEVER add another GK.
  while (selected.size < 10) {
    const current = [...selected.values()];
    const midCount = current.filter(isMID).length;
    const fwdCount = current.filter(isFWD).length;

    const nextDef = byBest(
      players.filter((p) => isDEF(p) && !selected.has(p.id))
    )[0];
    if (nextDef) {
      add(nextDef);
      continue;
    }

    if (midCount < 4) {
      const nextMid = byBest(
        players.filter((p) => isMID(p) && !selected.has(p.id))
      )[0];
      if (nextMid) {
        add(nextMid);
        continue;
      }
    }

    if (fwdCount < 3) {
      const nextFwd = byBest(
        players.filter((p) => isFWD(p) && !selected.has(p.id))
      )[0];
      if (nextFwd) {
        add(nextFwd);
        continue;
      }
    }

    // No legal player to add without breaking rules
    break;
  }

  const onField = [...selected.values()].slice(0, 10);

  // Bench = everyone else (including any extra goalkeepers)
  const bench = players.filter((p) => !selected.has(p.id));

  // Validate rules
  const errors: string[] = [];
  const gkCount = onField.filter(isGK).length;
  const defCount = onField.filter(isDEF).length;
  const midCount = onField.filter(isMID).length;
  const fwdCount = onField.filter(isFWD).length;
  const ladyFwdCount = onField.filter((p) => isFWD(p) && !!p.isLady).length;

  if (gkCount !== 1) errors.push("Pitch must have exactly 1 Goalkeeper.");
  if (defCount < 2) errors.push("Pitch must have at least 2 Defenders.");
  if (midCount > 4) errors.push("Pitch cannot have more than 4 Midfielders.");
  if (fwdCount > 3) errors.push("Pitch cannot have more than 3 Attackers.");
  if (ladyFwdCount < 1) errors.push("Pitch must include 1 Lady Attacker.");

  return { onField, bench, errors };
}


function ListView({
  players,
  onPickPlayer,
  captainId,
  viceId,
}: {
  players: Player[];
  onPickPlayer: (p: Player) => void;
  captainId?: string | null;
  viceId?: string | null;
}) {
  const grouped = groupByPosition(players);

  const Section = ({ title, list }: { title: string; list: Player[] }) => (
    <div className="rounded-2xl border bg-card">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">Price • Points</div>
      </div>

      <div className="divide-y">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPickPlayer(p)}
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-accent/10 active:bg-accent/20 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt={p.name}
                    className="h-10 w-10 object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}

                {captainId === p.id ? (
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-400 text-black grid place-items-center text-[10px] font-extrabold">
                    C
                  </div>
                ) : viceId === p.id ? (
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-400 text-black grid place-items-center text-[9px] font-extrabold">
                    VC
                  </div>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.teamName ?? p.teamShort ?? "—"} • {p.position}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-sm font-mono tabular-nums">${p.price}m</div>
              <div className="text-sm font-bold font-mono tabular-nums">{p.points}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Section title="Goalkeepers" list={grouped.Goalkeepers} />
      <Section title="Defenders" list={grouped.Defenders} />
      <Section title="Midfielders" list={grouped.Midfielders} />
      <Section title="Forwards" list={grouped.Forwards} />
    </div>
  );
}

function PlayerActionSheet({
  open,
  onOpenChange,
  selected,
  players,
  onSwapWith,
  onSetCaptain,
  onSetVice,
  captainId,
  viceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: Player | null;
  players: Player[];
  onSwapWith: (otherId: string) => void;
  onSetCaptain: () => void;
  onSetVice: () => void;
  captainId?: string | null;
  viceId?: string | null;
}) {
  const [mode, setMode] = React.useState<"actions" | "swap">("actions");

  React.useEffect(() => {
    if (!open) setMode("actions");
  }, [open]);

  if (!selected) return null;

  const others = players.filter((p) => p.id !== selected.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("rounded-t-3xl pb-[env(safe-area-inset-bottom)]", "max-h-[85vh] overflow-y-auto")}
      >
        <SheetHeader className="pb-3">
          <div className="flex items-center justify-between">
            <SheetTitle>{mode === "swap" ? "Swap Player" : "Player"}</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-2 hover:bg-accent/20 active:bg-accent/30"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="rounded-2xl border bg-card p-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-muted shrink-0">
              {selected.avatarUrl ? (
                <img
                  src={selected.avatarUrl}
                  alt={selected.name}
                  className="h-12 w-12 object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold truncate">{selected.name}</div>
              <div className="text-sm text-muted-foreground truncate">
                {selected.teamName ?? selected.teamShort ?? "—"} • {selected.position}
              </div>
              <div className="mt-1 text-sm font-mono tabular-nums">
                ${selected.price}m • <span className="font-bold">{selected.points}</span> pts
              </div>
            </div>

            <div className="flex items-center gap-2">
              {captainId === selected.id ? (
                <div className="flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-1 text-xs font-extrabold text-black">
                  <Crown className="h-4 w-4" /> C
                </div>
              ) : null}
              {viceId === selected.id ? (
                <div className="flex items-center gap-1 rounded-full bg-emerald-400/90 px-2 py-1 text-xs font-extrabold text-black">
                  <ShieldCheck className="h-4 w-4" /> VC
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {mode === "actions" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => setMode("swap")}>
              <span className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Swap
              </span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => {
                onSetCaptain();
                onOpenChange(false);
              }}
            >
              <span className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Captain
              </span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => {
                onSetVice();
                onOpenChange(false);
              }}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Vice
              </span>
            </Button>

            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between pb-2">
              <div className="text-sm font-semibold">Swap with</div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("actions")} className="rounded-xl">
                Back
              </Button>
            </div>

            <div className="space-y-2">
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSwapWith(p.id);
                    onOpenChange(false);
                  }}
                  className="w-full rounded-2xl border bg-card px-3 py-3 text-left hover:bg-accent/10 active:bg-accent/20 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.name}
                            className="h-10 w-10 object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.teamName ?? p.teamShort ?? "—"} • {p.position}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono tabular-nums">${p.price}m</div>
                      <div className="text-sm font-bold font-mono tabular-nums">{p.points}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function FantasyPage() {
  const [tab, setTab] = React.useState<TabKey>("pitch");
  const [squadPlayers, setSquadPlayers] = React.useState<Player[]>([]);
  const [squadError, setSquadError] = React.useState<string | null>(null);

  const [teamName, setTeamName] = React.useState(myFantasyTeam.name);
  const [captainId, setCaptainId] = React.useState<string | null>(null);
  const [viceId, setViceId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = React.useMemo(
    () => squadPlayers.find((p) => p.id === selectedId) ?? null,
    [squadPlayers, selectedId]
  );

  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  // Load squad from localStorage + api
  React.useEffect(() => {
    (async () => {
      try {
        setSquadError(null);

        const raw = window.localStorage.getItem(LS_PICKS);
        const pickedIds: string[] = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(pickedIds) || pickedIds.length === 0) {
          setSquadPlayers([]);
          return;
        }

        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        const all: Player[] = (json.players as ApiPlayer[]).map((p) => ({
  id: p.id,
  // ✅ Use webName on pitch, fallback to name
  name: (p.webName ?? p.name ?? "—").trim(),

  position: normalizePosition(p.position),
  price: Number(p.price ?? 0),
  points: Number(p.points ?? 0),
  avatarUrl: p.avatarUrl ?? null,
  isLady: Boolean(p.isLady),
  teamShort: p.teamShort ?? null,
  teamName: p.teamName ?? null,
}));


        const byId = new Map(all.map((p) => [p.id, p]));
        const picked = pickedIds.map((id) => byId.get(id)).filter(Boolean) as Player[];

        setSquadPlayers(picked);
      } catch (e: any) {
        setSquadError(e?.message || "Failed to load squad");
        setSquadPlayers([]);
      }
    })();
  }, []);

  // Load saved team name + captain/vice
  React.useEffect(() => {
    const savedName = window.localStorage.getItem("tbl_team_name");
    if (savedName && savedName.trim().length > 0) setTeamName(savedName);

    const savedC = window.localStorage.getItem("tbl_captain_id");
    const savedVC = window.localStorage.getItem("tbl_vice_id");
    if (savedC) setCaptainId(savedC);
    if (savedVC) setViceId(savedVC);
  }, []);

  function editTeamName() {
    const next = window.prompt("Enter your team name:", teamName);
    if (!next) return;
    const cleaned = next.trim().slice(0, 30);
    if (!cleaned) return;
    setTeamName(cleaned);
    window.localStorage.setItem("tbl_team_name", cleaned);
  }

  function openPlayer(p: Player) {
    setSelectedId(p.id);
    setSheetOpen(true);
  }

  function swapWith(otherId: string) {
    if (!selectedId) return;
    setSquadPlayers((prev) => swapPlayersInArray(prev, selectedId, otherId));
  }

  function setCaptain() {
    if (!selectedId) return;
    setCaptainId(selectedId);
    window.localStorage.setItem("tbl_captain_id", selectedId);
    if (viceId === selectedId) {
      setViceId(null);
      window.localStorage.removeItem("tbl_vice_id");
    }
  }

  function setVice() {
    if (!selectedId) return;
    setViceId(selectedId);
    window.localStorage.setItem("tbl_vice_id", selectedId);
    if (captainId === selectedId) {
      setCaptainId(null);
      window.localStorage.removeItem("tbl_captain_id");
    }
  }

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

  // Autosubs helper (after match finalized)
  function applyAutosubsAfterMatch(players: Player[]) {
    const { starting, bench } = splitStartingAndBench(players);
    if (!starting.length || !bench.length) return players;

    const benchPool = sortBench(bench); // better than [...bench]
    const replacedPairs: Array<{ outId: string; inId: string }> = [];

    for (const starter of starting) {
      if (starter.didPlay !== false) continue; // only replace if explicitly false

      const idx = benchPool.findIndex(
        (b) => normalizePosition(b.position) === normalizePosition(starter.position)
      );
      if (idx === -1) continue;

      const sub = benchPool.splice(idx, 1)[0];
      replacedPairs.push({ outId: starter.id, inId: sub.id });
    }

    if (!replacedPairs.length) return players;

    let next = [...players];
    for (const { outId, inId } of replacedPairs) {
      next = swapPlayersInArray(next, outId, inId);
    }
    return next;
  }

  // Autosub effect (runs once per finalized GW)
  React.useEffect(() => {
    if (!currentGW?.id) return;
    if (!currentGW.finalized) return;

    const key = `tbl_autosubs_applied_gw_${currentGW.id}`;
    if (window.localStorage.getItem(key) === "1") return;

    setSquadPlayers((prev) => applyAutosubsAfterMatch(prev));
    window.localStorage.setItem(key, "1");
  }, [currentGW?.id, currentGW?.finalized]);

  const average = 29;
  const pointsThisGW = 34;
  const highest = 104;

  return (
    <div className="space-y-5 animate-in fade-in-50">
      {/* Top card */}
      <div
        className={cn(
          "rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-sky-500 via-indigo-500 to-fuchsia-500"
        )}
      >
        <div className="p-4 text-white">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={editTeamName}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 hover:bg-white/15 active:bg-white/20"
              aria-label="Edit team name"
            >
              <div className="h-12 w-12 rounded-2xl bg-white/20 grid place-items-center">
                <Shirt className="h-6 w-6" />
              </div>
              <div className="text-left">
                <div className="text-xl font-bold leading-tight">{teamName}</div>
                <div className="text-sm text-white/80">{myFantasyTeam.owner}</div>
              </div>
            </button>

            <div className="text-white/80 text-sm">
              {gwLoading ? "GW ..." : `GW ${currentGW?.id ?? "—"}`}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-3xl font-extrabold tabular-nums">{average}</div>
              <div className="text-sm text-white/80">Average</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold tabular-nums leading-none">
                {pointsThisGW}
              </div>
              <div className="text-sm text-white/80">Points</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tabular-nums">{highest}</div>
              <div className="text-sm text-white/80">Highest</div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="text-base text-white/85">
              {gwLoading ? "Gameweek ..." : `Gameweek ${nextGW?.id ?? "—"}`}
            </div>

            <div className="text-lg font-bold">
  {gwLoading ? "Deadline: ..." : `Deadline: ${formatDeadlineUG(nextGW?.deadline_time)}`}
</div>


            {gwError ? <div className="mt-2 text-xs text-white/80">⚠ {gwError}</div> : null}
          </div>

          <div className="mt-4 space-y-3">
            <Button
              asChild
              className="w-full rounded-2xl bg-white/15 text-white hover:bg-white/20"
              variant="secondary"
            >
              <Link href="/dashboard/fantasy/pick-team">
                <span className="flex items-center justify-center gap-2">
                  <Shirt className="h-5 w-5" /> Pick Team
                </span>
              </Link>
            </Button>

            <Button
              asChild
              className="w-full rounded-2xl bg-white/15 text-white hover:bg-white/20"
              variant="secondary"
            >
              <Link href="/dashboard/transfers">
                <span className="flex items-center justify-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" /> Transfers
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {squadError ? (
        <div className="text-sm text-muted-foreground">⚠ Squad load: {squadError}</div>
      ) : null}

      {/* Segmented control */}
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
        </div>
      </div>

      {/* Main */}
      {tab === "pitch" ? (
        <PitchView
          players={squadPlayers}
          onPickPlayer={openPlayer}
          captainId={captainId}
          viceId={viceId}
        />
      ) : (
        <ListView
          players={squadPlayers}
          onPickPlayer={openPlayer}
          captainId={captainId}
          viceId={viceId}
        />
      )}

      <MiniLeague />

      <PlayerActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selected={selected}
        players={squadPlayers}
        onSwapWith={swapWith}
        onSetCaptain={setCaptain}
        onSetVice={setVice}
        captainId={captainId}
        viceId={viceId}
      />
    </div>
  );
}
