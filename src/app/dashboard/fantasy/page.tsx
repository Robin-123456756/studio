"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { myFantasyTeam, fantasyStandings, type Player } from "@/lib/data";
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

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type TabKey = "pitch" | "list";

function groupByPosition(players: Player[]) {
  return {
    Goalkeepers: players.filter((p) => p.position === "Goalkeeper"),
    Defenders: players.filter((p) => p.position === "Defender"),
    Midfielders: players.filter((p) => p.position === "Midfielder"),
    Forwards: players.filter((p) => p.position === "Forward"),
  };
}

/**
 * Build a "starting XI" using a simple default formation:
 * GK 1, DEF 4, MID 4, FWD 3 (or fewer if you don't have enough players yet).
 * Bench = everyone else.
 */
function splitStartingAndBench(players: Player[]) {
  const g = groupByPosition(players);
  const starting = [
    ...g.Goalkeepers.slice(0, 1),
    ...g.Defenders.slice(0, 4),
    ...g.Midfielders.slice(0, 4),
    ...g.Forwards.slice(0, 3),
  ];

  const startingIds = new Set(starting.map((p) => p.id));
  const bench = players.filter((p) => !startingIds.has(p.id));

  return { starting, bench };
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
          <div className="text-sm text-muted-foreground">
            Your rank among rivals.
          </div>
        </div>

        <div className="px-2 pb-3">
          <div className="space-y-1">
            {fantasyStandings.map((t) => {
              const isMe = t.name === myFantasyTeam.name;
              const trend =
                t.rank < myFantasyTeam.rank
                  ? "up"
                  : t.rank > myFantasyTeam.rank
                  ? "down"
                  : "same";

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
                      <div className="text-xs text-muted-foreground truncate">
                        {t.owner}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-bold font-mono tabular-nums">
                    {t.points}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CaptainBadge({ type }: { type: "C" | "VC" }) {
  return (
    <div
      className={cn(
        "absolute -top-2 -right-2 h-6 w-6 rounded-full",
        "grid place-items-center text-[11px] font-extrabold",
        type === "C" ? "bg-amber-400 text-black" : "bg-emerald-400 text-black"
      )}
    >
      {type}
    </div>
  );
}

function PlayerPill({
  player,
  onClick,
  captainId,
  viceId,
}: {
  player: Player;
  onClick: (p: Player) => void;
  captainId?: string | null;
  viceId?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(player)}
      className="relative flex flex-col items-center gap-1 w-[76px] active:scale-[0.98] transition"
      aria-label={`Open ${player.name}`}
    >
      {captainId === player.id ? <CaptainBadge type="C" /> : null}
      {viceId === player.id ? <CaptainBadge type="VC" /> : null}

      <div className="rounded-xl bg-white/90 text-black w-full overflow-hidden shadow">
        <div className="flex items-center gap-2 px-2 pt-2">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-black/10 shrink-0">
            <Image
              src={player.avatarUrl}
              alt={player.name}
              width={32}
              height={32}
              className="h-8 w-8 object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold truncate leading-tight">
              {player.name}
            </div>
            <div className="text-[10px] text-black/60 truncate">{player.team}</div>
          </div>
        </div>
        <div className="px-2 pb-2 pt-1">
          <div className="text-[10px] text-black/60">{player.position}</div>
          <div className="text-[11px] font-bold">{player.points} pts</div>
        </div>
      </div>
    </button>
  );
}

function BenchRow({
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
  if (bench.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center justify-between pb-2">
        <div className="text-sm font-semibold">Bench</div>
        <div className="text-xs text-muted-foreground">Tap to swap</div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {bench.map((p) => (
          <div key={p.id} className="shrink-0">
            <PlayerPill
              player={p}
              onClick={onPick}
              captainId={captainId}
              viceId={viceId}
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
  const { starting, bench } = splitStartingAndBench(players);
  const grouped = groupByPosition(starting);

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          backgroundImage: "url('/pitch.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="backdrop-brightness-[0.92] p-3">
          <div className="flex flex-col gap-4 py-3">
            {/* GK */}
            <div className="flex justify-center">
              {grouped.Goalkeepers.slice(0, 1).map((p) => (
                <PlayerPill
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                />
              ))}
            </div>

            {/* DEF */}
            <div className="flex justify-center gap-3 flex-wrap">
              {grouped.Defenders.slice(0, 4).map((p) => (
                <PlayerPill
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                />
              ))}
            </div>

            {/* MID */}
            <div className="flex justify-center gap-3 flex-wrap">
              {grouped.Midfielders.slice(0, 4).map((p) => (
                <PlayerPill
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                />
              ))}
            </div>

            {/* FWD */}
            <div className="flex justify-center gap-3 flex-wrap">
              {grouped.Forwards.slice(0, 3).map((p) => (
                <PlayerPill
                  key={p.id}
                  player={p}
                  onClick={onPickPlayer}
                  captainId={captainId}
                  viceId={viceId}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Bench row (horizontal + scroll) */}
      <BenchRow
        bench={bench}
        onPick={onPickPlayer}
        captainId={captainId}
        viceId={viceId}
      />
    </div>
  );
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
                <Image
                  src={p.avatarUrl}
                  alt={p.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                />
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
                  {p.team} • {p.position}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-sm font-mono tabular-nums">${p.price}m</div>
              <div className="text-sm font-bold font-mono tabular-nums">
                {p.points}
              </div>
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
        className={cn(
          "rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
          "max-h-[85vh] overflow-y-auto"
        )}
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

        {/* Selected player header */}
        <div className="rounded-2xl border bg-card p-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-muted shrink-0">
              <Image
                src={selected.avatarUrl}
                alt={selected.name}
                width={48}
                height={48}
                className="h-12 w-12 object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold truncate">{selected.name}</div>
              <div className="text-sm text-muted-foreground truncate">
                {selected.team} • {selected.position}
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
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => setMode("swap")}
            >
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

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between pb-2">
              <div className="text-sm font-semibold">Swap with</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("actions")}
                className="rounded-xl"
              >
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
                        <Image
                          src={p.avatarUrl}
                          alt={p.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.team} • {p.position}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono tabular-nums">${p.price}m</div>
                      <div className="text-sm font-bold font-mono tabular-nums">
                        {p.points}
                      </div>
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

  // ✅ squad players must be local state (so swaps update UI)
  const [squadPlayers, setSquadPlayers] = React.useState<Player[]>(() => [
    ...myFantasyTeam.players,
  ]);

  // ✅ let user create / edit their team name
  const [teamName, setTeamName] = React.useState(myFantasyTeam.name);

  // ✅ captain + vice (persist)
  const [captainId, setCaptainId] = React.useState<string | null>(null);
  const [viceId, setViceId] = React.useState<string | null>(null);

  // ✅ player sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = React.useMemo(
    () => squadPlayers.find((p) => p.id === selectedId) ?? null,
    [squadPlayers, selectedId]
  );

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

    // If captain becomes same as vice, clear vice (clean UX)
    if (viceId === selectedId) {
      setViceId(null);
      window.localStorage.removeItem("tbl_vice_id");
    }
  }

  function setVice() {
    if (!selectedId) return;
    setViceId(selectedId);
    window.localStorage.setItem("tbl_vice_id", selectedId);

    // If vice becomes same as captain, clear captain
    if (captainId === selectedId) {
      setCaptainId(null);
      window.localStorage.removeItem("tbl_captain_id");
    }
  }

  // Fake numbers to match PL layout (replace later with real data)
  const average = 29;
  const pointsThisGW = 34;
  const highest = 104;

  return (
    <div className="space-y-5 animate-in fade-in-50">
      {/* PL-style top fantasy card */}
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

            <div className="text-white/80 text-sm">GW 18</div>
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
            <div className="text-base text-white/85">Gameweek 19</div>
            <div className="text-lg font-bold">Deadline: Tuesday 30 Dec at 21:00</div>
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

      {/* Pitch/List segmented control */}
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

      {/* Main content */}
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

      {/* Mini-league */}
      <MiniLeague />

      {/* ✅ Player actions bottom sheet */}
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
