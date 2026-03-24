"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronDown, TrendingUp, X, ArrowRight, GitCompareArrows } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { normalizePosition, shortPos } from "@/lib/pitch-helpers";

/* ── Types ── */

type TeamResult = {
  team_uuid: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

type PlayerSearchResult = {
  id: string;
  name: string;
  web_name: string | null;
  position: string | null;
  avatar_url: string | null;
  teams?: { name: string; short_name: string | null; team_uuid: string } | null;
};

type MatchResult = {
  id: number;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean | null;
  is_final: boolean | null;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
};

type TopCard = {
  playerId: string;
  name: string;
  value: number;
  label: string;
  team: string;
  avatarUrl: string | null;
};

type BrowsePlayer = {
  id: string;
  name: string;
  position: string;
  posShort: string;
  price: number | null;
  points: number;
  totalGoals: number;
  totalAssists: number;
  ownership: number;
  form: string | null;
  isLady: boolean;
  avatarUrl: string | null;
  teamShort: string;
  teamName: string;
};

type PositionFilter = "All" | "GK" | "DEF" | "MID" | "FWD" | "Lady";
type SortKey = "points" | "goals" | "assists" | "price" | "form" | "ownership";

const POSITIONS: PositionFilter[] = ["All", "GK", "DEF", "MID", "FWD", "Lady"];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "points", label: "Points" },
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
  { value: "price", label: "Price" },
  { value: "form", label: "Form" },
  { value: "ownership", label: "Ownership %" },
];

const POS_SHORT_MAP: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

const PAGE_SIZE = 20;

/* ── Helpers ── */

function useDebouncedValue<T>(value: T, delay = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function posColor(pos: string) {
  if (pos === "GK") return "bg-amber-500/15 text-amber-600";
  if (pos === "DEF") return "bg-blue-500/15 text-blue-600";
  if (pos === "MID") return "bg-emerald-500/15 text-emerald-600";
  if (pos === "FWD") return "bg-red-500/15 text-red-600";
  return "bg-muted text-muted-foreground";
}

/* ── Stat grid row used in sheets ── */
function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums font-mono", highlight && "text-primary")}>
        {value}
      </span>
    </div>
  );
}

/* ── Skeletons ── */

function TopCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="rounded-2xl">
          <CardContent className="p-3 space-y-2">
            <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="h-5 w-12 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlayerRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
        <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-4 w-10 rounded bg-muted animate-pulse" />
    </div>
  );
}

/* ── Player Avatar ── */
function PlayerAvatar({ player, size = "md" }: { player: BrowsePlayer; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  return (
    <div className={cn(dim, "rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center")}>
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt={player.name} className="h-full w-full object-cover" />
      ) : (
        <span className={cn(textSize, "font-bold text-muted-foreground")}>
          {player.name.charAt(0)}
        </span>
      )}
    </div>
  );
}

/* ── Main Component ── */

export default function ExplorePage() {
  /* Search state */
  const [q, setQ] = React.useState("");
  const dq = useDebouncedValue(q, 250);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchTeams, setSearchTeams] = React.useState<TeamResult[]>([]);
  const [searchPlayers, setSearchPlayers] = React.useState<PlayerSearchResult[]>([]);
  const [searchMatches, setSearchMatches] = React.useState<MatchResult[]>([]);

  /* Top performer cards */
  const [topScorer, setTopScorer] = React.useState<TopCard | null>(null);
  const [topAssister, setTopAssister] = React.useState<TopCard | null>(null);
  const [topCleanSheet, setTopCleanSheet] = React.useState<TopCard | null>(null);
  const [bestLady, setBestLady] = React.useState<TopCard | null>(null);
  const [cardsLoading, setCardsLoading] = React.useState(true);

  /* Browse state */
  const [allPlayers, setAllPlayers] = React.useState<BrowsePlayer[]>([]);
  const [browseLoading, setBrowseLoading] = React.useState(true);
  const [posFilter, setPosFilter] = React.useState<PositionFilter>("All");
  const [sortKey, setSortKey] = React.useState<SortKey>("points");
  const [showCount, setShowCount] = React.useState(PAGE_SIZE);
  const [sortOpen, setSortOpen] = React.useState(false);

  /* Player bottom sheet */
  const [sheetPlayer, setSheetPlayer] = React.useState<BrowsePlayer | null>(null);

  /* Compare state */
  const [compareIds, setCompareIds] = React.useState<[string?, string?]>([]);
  const [showCompare, setShowCompare] = React.useState(false);

  const isSearching = dq.trim().length >= 2;

  /* ── Compare helpers ── */
  function addToCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev; // already in
      if (!prev[0]) return [id, prev[1]];
      if (!prev[1]) return [prev[0], id];
      // Both slots full — replace second
      return [prev[0], id];
    });
  }

  function removeFromCompare(id: string) {
    setCompareIds((prev) => {
      if (prev[0] === id) return [prev[1], undefined];
      if (prev[1] === id) return [prev[0], undefined];
      return prev;
    });
  }

  function clearCompare() {
    setCompareIds([]);
    setShowCompare(false);
  }

  const compareCount = compareIds.filter(Boolean).length;
  const comparePlayerA = allPlayers.find((p) => p.id === compareIds[0]) ?? null;
  const comparePlayerB = allPlayers.find((p) => p.id === compareIds[1]) ?? null;

  /* ── Hot players (top 5 by form) ── */
  const hotPlayers = React.useMemo(() => {
    if (allPlayers.length === 0) return [];
    return [...allPlayers]
      .filter((p) => p.form !== null && parseFloat(p.form) > 0)
      .sort((a, b) => parseFloat(b.form ?? "0") - parseFloat(a.form ?? "0"))
      .slice(0, 5);
  }, [allPlayers]);

  /* ── Fetch top performer cards ── */
  React.useEffect(() => {
    (async () => {
      try {
        setCardsLoading(true);
        const res = await fetch("/api/player-stats", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error);

        const stats: any[] = json.stats ?? [];

        const goalMap = new Map<string, { name: string; goals: number; team: string; avatarUrl: string | null; id: string }>();
        const assistMap = new Map<string, { name: string; assists: number; team: string; avatarUrl: string | null; id: string }>();
        const csMap = new Map<string, { name: string; cs: number; team: string; avatarUrl: string | null; id: string }>();
        const ladyMap = new Map<string, { name: string; points: number; team: string; avatarUrl: string | null; id: string }>();

        for (const s of stats) {
          const id = s.playerId;
          const name = s.playerName ?? "\u2014";
          const team = s.player?.teamShort ?? s.player?.teamName ?? "\u2014";
          const avatarUrl = s.player?.avatarUrl ?? null;
          const pos = normalizePosition(s.player?.position);

          if (s.goals > 0) {
            const e = goalMap.get(id);
            goalMap.set(id, { name, goals: (e?.goals ?? 0) + s.goals, team, avatarUrl, id });
          }
          if (s.assists > 0) {
            const e = assistMap.get(id);
            assistMap.set(id, { name, assists: (e?.assists ?? 0) + s.assists, team, avatarUrl, id });
          }
          if (s.cleanSheet && pos === "Goalkeeper") {
            const e = csMap.get(id);
            csMap.set(id, { name, cs: (e?.cs ?? 0) + 1, team, avatarUrl, id });
          }
          if (s.player?.isLady) {
            const e = ladyMap.get(id);
            ladyMap.set(id, { name, points: (e?.points ?? 0) + (s.points ?? 0), team, avatarUrl, id });
          }
        }

        const topG = [...goalMap.values()].sort((a, b) => b.goals - a.goals)[0];
        const topA = [...assistMap.values()].sort((a, b) => b.assists - a.assists)[0];
        const topCS = [...csMap.values()].sort((a, b) => b.cs - a.cs)[0];
        const topL = [...ladyMap.values()].sort((a, b) => b.points - a.points)[0];

        if (topG) setTopScorer({ playerId: topG.id, name: topG.name, value: topG.goals, label: topG.goals === 1 ? "goal" : "goals", team: topG.team, avatarUrl: topG.avatarUrl });
        if (topA) setTopAssister({ playerId: topA.id, name: topA.name, value: topA.assists, label: topA.assists === 1 ? "assist" : "assists", team: topA.team, avatarUrl: topA.avatarUrl });
        if (topCS) setTopCleanSheet({ playerId: topCS.id, name: topCS.name, value: topCS.cs, label: topCS.cs === 1 ? "clean sheet" : "clean sheets", team: topCS.team, avatarUrl: topCS.avatarUrl });
        if (topL) setBestLady({ playerId: topL.id, name: topL.name, value: topL.points, label: "pts", team: topL.team, avatarUrl: topL.avatarUrl });
      } catch {
        // silent — cards just won't show
      } finally {
        setCardsLoading(false);
      }
    })();
  }, []);

  /* ── Fetch all players for browsing ── */
  React.useEffect(() => {
    (async () => {
      try {
        setBrowseLoading(true);
        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error);

        const list: BrowsePlayer[] = (json.players ?? []).map((p: any) => ({
          id: p.id,
          name: p.name ?? p.webName ?? "--",
          position: normalizePosition(p.position),
          posShort: shortPos(p.position),
          price: p.price ?? null,
          points: p.points ?? 0,
          totalGoals: p.totalGoals ?? 0,
          totalAssists: p.totalAssists ?? 0,
          ownership: p.ownership ?? 0,
          form: p.form_last5 ?? null,
          isLady: p.isLady ?? false,
          avatarUrl: p.avatarUrl ?? null,
          teamShort: p.teamShort ?? "--",
          teamName: p.teamName ?? "--",
        }));
        setAllPlayers(list);
      } catch {
        // silent
      } finally {
        setBrowseLoading(false);
      }
    })();
  }, []);

  /* ── Search effect ── */
  React.useEffect(() => {
    (async () => {
      const query = dq.trim();
      if (query.length < 2) {
        setSearchTeams([]);
        setSearchPlayers([]);
        setSearchMatches([]);
        setSearchError(null);
        return;
      }

      try {
        setSearchLoading(true);
        setSearchError(null);

        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Search failed");

        setSearchTeams(json.teams ?? []);
        setSearchPlayers(json.players ?? []);
        setSearchMatches(json.matches ?? []);
      } catch (e: any) {
        setSearchError(e?.message ?? "Search failed");
      } finally {
        setSearchLoading(false);
      }
    })();
  }, [dq]);

  /* ── Filter + sort players ── */
  const filteredPlayers = React.useMemo(() => {
    let list = allPlayers;

    if (posFilter === "Lady") {
      list = list.filter((p) => p.isLady);
    } else if (posFilter !== "All") {
      const full = POS_SHORT_MAP[posFilter];
      list = list.filter((p) => p.position === full);
    }

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "points": return b.points - a.points;
        case "goals": return b.totalGoals - a.totalGoals;
        case "assists": return b.totalAssists - a.totalAssists;
        case "price": return (b.price ?? 0) - (a.price ?? 0);
        case "form": return parseFloat(b.form ?? "0") - parseFloat(a.form ?? "0");
        case "ownership": return b.ownership - a.ownership;
        default: return 0;
      }
    });

    return list;
  }, [allPlayers, posFilter, sortKey]);

  const visiblePlayers = filteredPlayers.slice(0, showCount);
  const hasMore = showCount < filteredPlayers.length;

  // Reset visible count when filter/sort changes
  React.useEffect(() => {
    setShowCount(PAGE_SIZE);
  }, [posFilter, sortKey]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? "Points";

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="text-2xl font-extrabold tracking-tight">Explore</div>

      {/* ── Sticky search bar ── */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players, teams or matches..."
            className="w-full rounded-2xl border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {q.length > 0 && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Search results mode ── */}
      {isSearching ? (
        <>
          {searchError ? <div className="text-sm text-red-600">{searchError}</div> : null}
          {searchLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <PlayerRowSkeleton key={i} />)}
            </div>
          ) : (
            <>
              {/* Search: Teams */}
              {searchTeams.length > 0 && (
                <Card className="rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-semibold">Teams</div>
                    <div className="space-y-2">
                      {searchTeams.map((t) => (
                        <Link
                          key={t.team_uuid}
                          href={`/dashboard/teams/${t.team_uuid}`}
                          className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-muted/40"
                        >
                          <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                            {t.logo_url ? (
                              <Image src={t.logo_url} alt={t.name} width={40} height={40} />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t.short_name ?? "\u2014"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search: Players */}
              {searchPlayers.length > 0 && (
                <Card className="rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-semibold">Players</div>
                    <div className="space-y-1">
                      {searchPlayers.map((p) => (
                        <Link
                          key={p.id}
                          href={`/dashboard/players/${p.id}`}
                          className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                            {p.avatar_url ? (
                              <Image src={p.avatar_url} alt={p.name} width={40} height={40} />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate text-sm">
                              {p.name ?? p.web_name ?? "\u2014"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.position ?? "\u2014"}
                              {p.teams?.short_name ? ` \u00b7 ${p.teams.short_name}` : ""}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search: Matches */}
              {searchMatches.length > 0 && (
                <Card className="rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-semibold">Matches</div>
                    <div className="space-y-2">
                      {searchMatches.map((m) => (
                        <Link
                          key={m.id}
                          href={`/dashboard/matches?match=${m.id}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border p-3 hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {m.home_team?.name ?? "Home"} vs {m.away_team?.name ?? "Away"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              GW {m.gameweek_id} {"\u00b7"} {m.is_played ? "Played" : "Upcoming"}
                            </div>
                          </div>
                          <div className="font-mono font-extrabold tabular-nums">
                            {m.is_played ? `${m.home_goals ?? 0}-${m.away_goals ?? 0}` : "\u2014"}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search: Empty */}
              {searchTeams.length === 0 && searchPlayers.length === 0 && searchMatches.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No results for &ldquo;{dq.trim()}&rdquo;
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* ── Browse mode (default) ── */
        <>
          {/* Top Performer Cards */}
          {cardsLoading ? (
            <TopCardsSkeleton />
          ) : (topScorer || topAssister || topCleanSheet || bestLady) ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { data: topScorer, title: "Top Scorer", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { data: topAssister, title: "Top Assists", color: "text-blue-500", bg: "bg-blue-500/10" },
                { data: topCleanSheet, title: "Top Clean Sheets", color: "text-amber-500", bg: "bg-amber-500/10" },
                { data: bestLady, title: "Best Lady Player", color: "text-pink-500", bg: "bg-pink-500/10" },
              ].map(({ data: card, title, color, bg }) =>
                card ? (
                  <Link
                    key={title}
                    href={`/dashboard/players/${card.playerId}`}
                    className="block"
                  >
                    <Card className="rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all">
                      <CardContent className="p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                          {title}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className={cn("h-9 w-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center", bg)}>
                            {card.avatarUrl ? (
                              <img
                                src={card.avatarUrl}
                                alt={card.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className={cn("text-sm font-bold", color)}>
                                {card.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate leading-tight">
                              {card.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {card.team}
                            </div>
                          </div>
                        </div>
                        <div className={cn("text-lg font-extrabold tabular-nums font-mono", color)}>
                          {card.value} <span className="text-xs font-semibold">{card.label}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : null
              )}
            </div>
          ) : null}

          {/* ── Hot Players (form leaders) ── */}
          {!browseLoading && hotPlayers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-orange-500" aria-hidden="true" />
                <span className="text-sm font-semibold">Hot Players</span>
                <span className="text-xs text-muted-foreground ml-1">by form</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
                {hotPlayers.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSheetPlayer(p)}
                    className="shrink-0 w-[130px] text-left"
                  >
                    <Card className="rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all h-full">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-500">#{i + 1}</span>
                          <PlayerAvatar player={p} size="sm" />
                        </div>
                        <div className="truncate text-xs font-semibold leading-tight">{p.name}</div>
                        <div className="flex items-center gap-1">
                          <span className={cn("px-1 py-0.5 rounded text-[9px] font-bold", posColor(p.posShort))}>
                            {p.posShort}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">{p.teamShort}</span>
                        </div>
                        <div className="text-base font-extrabold tabular-nums font-mono text-orange-500">
                          {p.form} <span className="text-[10px] font-semibold">ppg</span>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Position Filter Tabs + Sort ── */}
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 pb-0.5">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPosFilter(pos)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors",
                      posFilter === pos
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent/30"
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:bg-accent/30 transition-colors"
              >
                {sortLabel}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sortOpen && "rotate-180")} aria-hidden="true" />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-30 bg-popover border rounded-xl shadow-lg py-1 min-w-[140px]">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setSortKey(opt.value); setSortOpen(false); }}
                        className={cn(
                          "w-full text-left px-3.5 py-2 text-xs font-medium transition-colors",
                          sortKey === opt.value
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Player count ── */}
          <div className="text-xs text-muted-foreground">
            {browseLoading
              ? "Loading players..."
              : `${filteredPlayers.length} player${filteredPlayers.length === 1 ? "" : "s"}`}
          </div>

          {/* ── Player list ── */}
          {browseLoading ? (
            <Card className="rounded-2xl">
              <CardContent className="p-2 divide-y divide-border/40">
                {Array.from({ length: 8 }).map((_, i) => (
                  <PlayerRowSkeleton key={i} />
                ))}
              </CardContent>
            </Card>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No players found.
            </div>
          ) : (
            <Card className="rounded-2xl">
              <CardContent className="p-0 divide-y divide-border/40">
                {visiblePlayers.map((p) => {
                  const isInCompare = compareIds.includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center">
                      {/* Main row — opens bottom sheet */}
                      <button
                        type="button"
                        onClick={() => setSheetPlayer(p)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors flex-1 min-w-0 text-left"
                      >
                        {/* Avatar */}
                        <PlayerAvatar player={p} />

                        {/* Name + meta */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate">{p.name}</span>
                            {p.isLady && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-pink-500/15 text-pink-600">
                                Lady
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", posColor(p.posShort))}>
                              {p.posShort}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">{p.teamShort}</span>
                            {p.price != null && (
                              <span className="text-xs text-muted-foreground">{"\u00b7"} {p.price.toFixed(1)}m</span>
                            )}
                          </div>
                        </div>

                        {/* Stat value */}
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-extrabold tabular-nums font-mono">
                            {sortKey === "points" && p.points}
                            {sortKey === "goals" && p.totalGoals}
                            {sortKey === "assists" && p.totalAssists}
                            {sortKey === "price" && (p.price != null ? `${p.price.toFixed(1)}` : "--")}
                            {sortKey === "form" && (p.form ?? "0.0")}
                            {sortKey === "ownership" && `${p.ownership}%`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {sortKey === "points" && "pts"}
                            {sortKey === "goals" && (p.totalGoals === 1 ? "goal" : "goals")}
                            {sortKey === "assists" && (p.totalAssists === 1 ? "assist" : "assists")}
                            {sortKey === "price" && "price"}
                            {sortKey === "form" && "form"}
                            {sortKey === "ownership" && "owned"}
                          </div>
                        </div>
                      </button>

                      {/* Compare toggle */}
                      <button
                        type="button"
                        onClick={() => isInCompare ? removeFromCompare(p.id) : addToCompare(p.id)}
                        className={cn(
                          "shrink-0 mr-3 h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                          isInCompare
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        )}
                        aria-label={isInCompare ? "Remove from compare" : "Add to compare"}
                      >
                        <GitCompareArrows className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Load more */}
          {hasMore && !browseLoading && (
            <button
              type="button"
              onClick={() => setShowCount((c) => c + PAGE_SIZE)}
              className="w-full py-3 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Show more ({filteredPlayers.length - showCount} remaining)
            </button>
          )}
        </>
      )}

      {/* ── Floating Compare Bar ── */}
      {compareCount > 0 && (
        <div className="fixed bottom-20 inset-x-4 z-40 mx-auto max-w-md">
          <Card className="rounded-2xl shadow-xl border-primary/20 overflow-hidden">
            <CardContent className="p-3 flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                {comparePlayerA && (
                  <span className="text-xs font-semibold truncate">{comparePlayerA.name}</span>
                )}
                {comparePlayerA && comparePlayerB && (
                  <span className="text-xs text-muted-foreground shrink-0">vs</span>
                )}
                {comparePlayerB && (
                  <span className="text-xs font-semibold truncate">{comparePlayerB.name}</span>
                )}
                {compareCount === 1 && (
                  <span className="text-xs text-muted-foreground shrink-0">Pick another</span>
                )}
              </div>
              {compareCount === 2 && (
                <button
                  type="button"
                  onClick={() => setShowCompare(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Compare
                </button>
              )}
              <button
                type="button"
                onClick={clearCompare}
                className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Clear compare"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Player Detail Bottom Sheet ── */}
      <Sheet open={!!sheetPlayer} onOpenChange={(open) => { if (!open) setSheetPlayer(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto px-5 pb-8">
          {sheetPlayer && (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle className="sr-only">{sheetPlayer.name}</SheetTitle>
              </SheetHeader>

              {/* Player header */}
              <div className="flex items-center gap-3 pt-2 pb-4">
                <div className="h-14 w-14 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {sheetPlayer.avatarUrl ? (
                    <img src={sheetPlayer.avatarUrl} alt={sheetPlayer.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-muted-foreground">{sheetPlayer.name.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold truncate">{sheetPlayer.name}</span>
                    {sheetPlayer.isLady && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-pink-500/15 text-pink-600">
                        Lady
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", posColor(sheetPlayer.posShort))}>
                      {sheetPlayer.posShort}
                    </span>
                    <span className="text-sm text-muted-foreground">{sheetPlayer.teamName}</span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <StatRow label="Total Points" value={sheetPlayer.points} highlight />
                  <StatRow label="Goals" value={sheetPlayer.totalGoals} />
                  <StatRow label="Assists" value={sheetPlayer.totalAssists} />
                  <StatRow label="Price" value={sheetPlayer.price != null ? `${sheetPlayer.price.toFixed(1)}m` : "--"} />
                  <StatRow label="Form (pts/GW)" value={sheetPlayer.form ?? "0.0"} />
                  <StatRow label="Ownership" value={`${sheetPlayer.ownership}%`} />
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                <Link
                  href={`/dashboard/players/${sheetPlayer.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Full Profile
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    addToCompare(sheetPlayer.id);
                    setSheetPlayer(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors",
                    compareIds.includes(sheetPlayer.id)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  )}
                >
                  <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                  Compare
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Comparison Bottom Sheet ── */}
      <Sheet open={showCompare} onOpenChange={(open) => { if (!open) setShowCompare(false); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto px-5 pb-8">
          {comparePlayerA && comparePlayerB && (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle className="text-center text-base font-extrabold pt-2">
                  Player Comparison
                </SheetTitle>
              </SheetHeader>

              {/* Player headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
                {/* Player A */}
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <PlayerAvatar player={comparePlayerA} />
                  <div className="text-center min-w-0">
                    <div className="text-sm font-semibold truncate">{comparePlayerA.name}</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className={cn("px-1 py-0.5 rounded text-[9px] font-bold", posColor(comparePlayerA.posShort))}>
                        {comparePlayerA.posShort}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{comparePlayerA.teamShort}</span>
                    </div>
                  </div>
                </div>

                {/* VS */}
                <div className="text-xs font-bold text-muted-foreground">VS</div>

                {/* Player B */}
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <PlayerAvatar player={comparePlayerB} />
                  <div className="text-center min-w-0">
                    <div className="text-sm font-semibold truncate">{comparePlayerB.name}</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className={cn("px-1 py-0.5 rounded text-[9px] font-bold", posColor(comparePlayerB.posShort))}>
                        {comparePlayerB.posShort}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{comparePlayerB.teamShort}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison stats table */}
              <Card className="rounded-2xl">
                <CardContent className="p-0">
                  {([
                    { label: "Points", a: comparePlayerA.points, b: comparePlayerB.points },
                    { label: "Goals", a: comparePlayerA.totalGoals, b: comparePlayerB.totalGoals },
                    { label: "Assists", a: comparePlayerA.totalAssists, b: comparePlayerB.totalAssists },
                    { label: "Price", a: comparePlayerA.price ?? 0, b: comparePlayerB.price ?? 0, fmt: (v: number) => `${v.toFixed(1)}m` },
                    { label: "Form", a: parseFloat(comparePlayerA.form ?? "0"), b: parseFloat(comparePlayerB.form ?? "0"), fmt: (v: number) => v.toFixed(1) },
                    { label: "Ownership", a: comparePlayerA.ownership, b: comparePlayerB.ownership, fmt: (v: number) => `${v}%` },
                  ] as { label: string; a: number; b: number; fmt?: (v: number) => string }[]).map(({ label, a, b, fmt }) => {
                    const aWins = a > b;
                    const bWins = b > a;
                    const format = fmt ?? ((v: number) => String(v));
                    return (
                      <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 border-b border-border/30 last:border-0">
                        <div className={cn("text-sm font-bold tabular-nums font-mono text-left", aWins && "text-primary")}>
                          {format(a)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium px-3">
                          {label}
                        </div>
                        <div className={cn("text-sm font-bold tabular-nums font-mono text-right", bWins && "text-primary")}>
                          {format(b)}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={clearCompare}
                  className="flex-1 px-4 py-3 rounded-2xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors text-center"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompare(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors text-center"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <div className="h-24 md:hidden" />
    </div>
  );
}
