"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { myFantasyTeam, fantasyStandings, type Player } from "@/lib/data";
import { ArrowDown, ArrowUp, Minus, Shirt, ArrowLeftRight } from "lucide-react";

type TabKey = "pitch" | "list";

function groupByPosition(players: Player[]) {
  return {
    Goalkeepers: players.filter((p) => p.position === "Goalkeeper"),
    Defenders: players.filter((p) => p.position === "Defender"),
    Midfielders: players.filter((p) => p.position === "Midfielder"),
    Forwards: players.filter((p) => p.position === "Forward"),
  };
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

function PlayerPill({ player }: { player: Player }) {
  return (
    <div className="flex flex-col items-center gap-1 w-[76px]">
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
            <div className="text-[11px] font-semibold truncate leading-tight">{player.name}</div>
            <div className="text-[10px] text-black/60 truncate">{player.team}</div>
          </div>
        </div>
        <div className="px-2 pb-2 pt-1">
          <div className="text-[10px] text-black/60">{player.position}</div>
          <div className="text-[11px] font-bold">{player.points} pts</div>
        </div>
      </div>
    </div>
  );
}

function PitchView({ players }: { players: Player[] }) {
  const grouped = groupByPosition(players);

  return (
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
              <PlayerPill key={p.id} player={p} />
            ))}
          </div>

          {/* DEF */}
          <div className="flex justify-center gap-3 flex-wrap">
            {grouped.Defenders.slice(0, 4).map((p) => (
              <PlayerPill key={p.id} player={p} />
            ))}
          </div>

          {/* MID */}
          <div className="flex justify-center gap-3 flex-wrap">
            {grouped.Midfielders.slice(0, 4).map((p) => (
              <PlayerPill key={p.id} player={p} />
            ))}
          </div>

          {/* FWD */}
          <div className="flex justify-center gap-3 flex-wrap">
            {grouped.Forwards.slice(0, 3).map((p) => (
              <PlayerPill key={p.id} player={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListView({ players }: { players: Player[] }) {
  const grouped = groupByPosition(players);

  const Section = ({ title, list }: { title: string; list: Player[] }) => (
    <div className="rounded-2xl border bg-card">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">Price • Points</div>
      </div>

      <div className="divide-y">
        {list.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
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
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.team} • {p.position}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-sm font-mono tabular-nums">${p.price}m</div>
              <div className="text-sm font-bold font-mono tabular-nums">{p.points}</div>
            </div>
          </div>
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

export default function FantasyPage() {
  const [tab, setTab] = React.useState<TabKey>("pitch");

  // ✅ let user create / edit their team name
  const [teamName, setTeamName] = React.useState(myFantasyTeam.name);

  React.useEffect(() => {
    const saved = window.localStorage.getItem("tbl_team_name");
    if (saved && saved.trim().length > 0) setTeamName(saved);
  }, []);

  function editTeamName() {
    const next = window.prompt("Enter your team name:", teamName);
    if (!next) return;
    const cleaned = next.trim().slice(0, 30);
    if (!cleaned) return;
    setTeamName(cleaned);
    window.localStorage.setItem("tbl_team_name", cleaned);
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
        <PitchView players={myFantasyTeam.players} />
      ) : (
        <ListView players={myFantasyTeam.players} />
      )}

      {/* Mini-league (PL-ish section) */}
      <MiniLeague />
    </div>
  );
}
