"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { loadSquadIds } from "@/lib/fantasyStorage";
import { normalizePosition } from "@/lib/pitch-helpers";
import { PlayerCard, type Player } from "../player-card";

const LS_TRANSFER_IN = "tbl_transfer_in_id";

type ApiPlayer = {
  id: string;
  name: string;
  position?: string | null;
  price?: number | null;
  points?: number | null;
  avatarUrl?: string | null;
  isLady?: boolean | null;
  teamShort?: string | null;
  teamName?: string | null;
};

function AddPlayerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const outId = searchParams.get("outId");
  const initialPos = searchParams.get("pos") ?? "ALL";

  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [squadIds, setSquadIds] = React.useState<string[]>([]);

  const [query, setQuery] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<string>(initialPos);
  const [teamFilter, setTeamFilter] = React.useState("ALL");
  const [sortKey, setSortKey] = React.useState<"price" | "points" | "name">("points");
  const [sortAsc, setSortAsc] = React.useState(false);

  // Load squad IDs
  React.useEffect(() => {
    setSquadIds(loadSquadIds());
  }, []);

  // Load all players
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        const mapped: Player[] = (json.players as ApiPlayer[]).map((p) => ({
          id: p.id,
          name: p.name,
          position: normalizePosition(p.position),
          price: Number(p.price ?? 0),
          points: Number(p.points ?? 0),
          avatarUrl: p.avatarUrl ?? null,
          isLady: Boolean(p.isLady),
          teamShort: p.teamShort ?? null,
          teamName: p.teamName ?? null,
        }));

        setAllPlayers(mapped);
      } catch (e: any) {
        setError(e?.message || "Failed to load players");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byId = React.useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);
  const outPlayer = outId ? byId.get(outId) : null;

  const allTeams = React.useMemo(() => {
    const teams = new Set<string>();
    allPlayers.forEach((p) => {
      if (p.teamShort) teams.add(p.teamShort);
    });
    return Array.from(teams).sort();
  }, [allPlayers]);

  const pool = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const squadSet = new Set(squadIds);

    return allPlayers
      .filter((p) => !squadSet.has(p.id))
      .filter((p) => (posFilter === "ALL" ? true : p.position === posFilter))
      .filter((p) => (teamFilter === "ALL" ? true : p.teamShort === teamFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") {
          cmp = a.name.localeCompare(b.name);
        } else if (sortKey === "price") {
          cmp = (b.price ?? 0) - (a.price ?? 0);
        } else if (sortKey === "points") {
          cmp = (b.points ?? 0) - (a.points ?? 0);
        }
        return sortAsc ? -cmp : cmp;
      });
  }, [allPlayers, squadIds, query, posFilter, teamFilter, sortKey, sortAsc]);

  function selectPlayer(id: string) {
    localStorage.setItem(LS_TRANSFER_IN, id);
    router.push("/dashboard/transfers");
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/transfers"
          className="h-9 w-9 rounded-full border bg-card/80 grid place-items-center hover:bg-accent"
          aria-label="Back to Transfers"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-base font-semibold">Add Player</div>
      </div>

      {/* OUT player context */}
      {outPlayer && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <div className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">OUT</div>
          <span className="text-sm font-semibold">{outPlayer.name}</span>
          <span className="text-xs text-muted-foreground">({outPlayer.position})</span>
        </div>
      )}

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
          onChange={(e) => setPosFilter(e.target.value)}
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
          onChange={(e) => setSortKey(e.target.value as any)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="points">Sort: Points</option>
          <option value="price">Sort: Price</option>
          <option value="name">Sort: Name</option>
        </select>

        <button
          type="button"
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center justify-center gap-1 rounded-xl border bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          {sortAsc ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {/* Status */}
      {loading && <div className="text-sm text-muted-foreground text-center">Loading players...</div>}
      {error && <div className="text-xs text-red-600 text-center">{error}</div>}

      {!outId && squadIds.length >= 17 && (
        <div className="text-sm text-muted-foreground">
          Tap a squad player on the pitch first, then choose a replacement.
        </div>
      )}

      {/* Player pool */}
      <div className="space-y-2">
        {pool.map((p) => {
          const disabled = squadIds.length >= 17 && !outId;
          return (
            <PlayerCard
              key={p.id}
              player={p}
              variant="in"
              disabled={disabled}
              onClick={() => selectPlayer(p.id)}
            />
          );
        })}
        {!loading && pool.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            No players match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auth wrapper ──
export default function AddPlayerRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user?.email_confirmed_at);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user?.email_confirmed_at);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (checking) {
    return <div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">Checking session...</div>;
  }
  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }
  return <AddPlayerPageInner />;
}
