"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { ArrowLeft, ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  normalizePosition,
  shortName,
  getKitColor,
  groupByPosition,
  Kit,
} from "@/lib/pitch-helpers";

type ApiGameweek = {
  id: number;
  name?: string | null;
  hasPlayedMatches?: boolean;
};

type DreamPlayer = {
  id: string;
  name: string;
  webName: string | null;
  position: string;
  isLady: boolean;
  avatarUrl: string | null;
  price: number | null;
  teamName: string;
  teamShort: string;
  teamUuid: string | null;
  gwPoints: number;
};

// ── Player Card ──

function DreamPlayerCard({
  player,
  isStar,
}: {
  player: DreamPlayer;
  isStar: boolean;
}) {
  const display = shortName(player.name, player.webName);
  const kitColor = getKitColor(player.teamShort);
  const plateColor =
    player.gwPoints >= 9
      ? "linear-gradient(180deg, #FFD700, #e6c200)"
      : player.gwPoints >= 5
        ? "linear-gradient(180deg, #059669, #047857)"
        : player.gwPoints >= 2
          ? "linear-gradient(180deg, #37003C, #2d0032)"
          : "linear-gradient(180deg, #6b7280, #555)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 68,
        position: "relative",
      }}
    >
      {/* Star badge */}
      {isStar && (
        <div
          style={{
            position: "absolute",
            top: -4,
            right: 4,
            zIndex: 10,
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            borderRadius: "50%",
            width: 18,
            height: 18,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          <Star style={{ width: 10, height: 10, fill: "#fff", color: "#fff" }} />
        </div>
      )}

      {/* Lady badge */}
      {player.isLady && (
        <div
          style={{
            position: "absolute",
            top: -4,
            left: 4,
            zIndex: 10,
            background: "#ec4899",
            borderRadius: "50%",
            width: 14,
            height: 14,
            border: "2px solid #fff",
          }}
        />
      )}

      {/* Kit */}
      <div style={{ width: 38, height: 32, overflow: "hidden" }}>
        <Kit color={kitColor} />
      </div>

      {/* Name */}
      <div
        style={{
          background: "#fff",
          borderRadius: "4px 4px 0 0",
          padding: "1px 4px",
          fontSize: 9,
          fontWeight: 700,
          color: "#1a1a2e",
          textAlign: "center",
          width: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
          marginTop: -2,
          position: "relative",
          zIndex: 2,
        }}
      >
        {display}
      </div>

      {/* Points plate */}
      <div
        style={{
          background: plateColor,
          borderRadius: "0 0 4px 4px",
          padding: "1px 4px",
          fontSize: 10,
          fontWeight: 800,
          color: "#fff",
          textAlign: "center",
          width: "100%",
          lineHeight: 1.3,
        }}
      >
        {player.gwPoints}
      </div>

      {/* Team */}
      <div
        style={{
          fontSize: 8,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          marginTop: 1,
        }}
      >
        {player.teamShort}
      </div>
    </div>
  );
}

// ── Main Content ──

function DreamTeamContent() {
  const [allGWs, setAllGWs] = React.useState<ApiGameweek[]>([]);
  const [selectedGwId, setSelectedGwId] = React.useState<number | null>(null);
  const [players, setPlayers] = React.useState<DreamPlayer[]>([]);
  const [totalPoints, setTotalPoints] = React.useState(0);
  const [starPlayerId, setStarPlayerId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gameweeks/current", { credentials: "same-origin" });
        const json = await res.json();
        if (!res.ok) { setLoading(false); return; }
        const allGws: ApiGameweek[] = (json.all ?? []).sort(
          (a: ApiGameweek, b: ApiGameweek) => a.id - b.id
        );
        // Only show GWs that have at least one played match
        const gws = allGws.filter((g) => g.hasPlayedMatches);
        setAllGWs(gws);

        // If no GWs have played matches yet, clear loading for empty state
        if (gws.length === 0) {
          setSelectedGwId(null);
          setLoading(false);
          return;
        }

        setSelectedGwId(gws[gws.length - 1].id);
      } catch { /* ignore */ }
    })();
  }, []);

  // Load dream team when GW changes
  React.useEffect(() => {
    if (selectedGwId === null) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/dream-team?gw_id=${selectedGwId}`, {
          credentials: "same-origin",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json?.error || "Failed to load dream team");

        setPlayers(json.players ?? []);
        setTotalPoints(json.totalPoints ?? 0);
        setStarPlayerId(json.starPlayerId ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedGwId]);

  // GW navigation
  const canGoPrev = allGWs.length > 0 && selectedGwId !== null && allGWs[0]?.id < selectedGwId;
  const canGoNext = allGWs.length > 0 && selectedGwId !== null && allGWs[allGWs.length - 1]?.id > selectedGwId;

  const goPrev = () => {
    if (!canGoPrev || selectedGwId === null) return;
    const idx = allGWs.findIndex((g) => g.id === selectedGwId);
    if (idx > 0) setSelectedGwId(allGWs[idx - 1].id);
  };
  const goNext = () => {
    if (!canGoNext || selectedGwId === null) return;
    const idx = allGWs.findIndex((g) => g.id === selectedGwId);
    if (idx >= 0 && idx < allGWs.length - 1) setSelectedGwId(allGWs[idx + 1].id);
  };

  // Group players by position
  const normalized = players.map((p) => ({
    ...p,
    position: normalizePosition(p.position),
  }));
  const groups = groupByPosition(normalized);

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-gradient-to-br from-[#062C30] via-[#0D5C63] to-[#14919B]",
            "shadow-sm"
          )}
        >
          <div className="p-4 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Link
                href="/dashboard/fantasy"
                className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20"
                aria-label="Back to Fantasy"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex-1 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-white/80">Dream Team</span>
              </div>
            </div>

            {/* GW selector */}
            <div className="flex items-center justify-center gap-4 mb-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev}
                className={cn(
                  "h-8 w-8 rounded-full grid place-items-center transition",
                  canGoPrev ? "bg-white/15 hover:bg-white/25 active:bg-white/30" : "opacity-30 cursor-default"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {allGWs.length > 1 ? (
                <select
                  value={selectedGwId ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setSelectedGwId(v);
                  }}
                  className="bg-white/15 text-white text-sm font-bold rounded-lg px-3 py-1.5 text-center appearance-none cursor-pointer hover:bg-white/25 transition border-0 outline-none"
                >
                  {allGWs.map((g) => (
                    <option key={g.id} value={g.id} className="text-black">
                      Gameweek {g.id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-center text-sm font-bold">
                  Gameweek {selectedGwId ?? "--"}
                </div>
              )}

              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className={cn(
                  "h-8 w-8 rounded-full grid place-items-center transition",
                  canGoNext ? "bg-white/15 hover:bg-white/25 active:bg-white/30" : "opacity-30 cursor-default"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Total points */}
            <div className="text-center pb-3">
              <div className="text-4xl font-extrabold tabular-nums">
                {loading ? "--" : totalPoints}
              </div>
              <div className="mt-1 text-xs font-semibold text-white/70">
                Combined Points
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-2">
        {loading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Loading dream team...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-sm text-red-500">{error}</div>
        ) : selectedGwId === null ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No matches have been played yet
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No data for Gameweek {selectedGwId}
          </div>
        ) : (
          <div className="-mx-4 overflow-visible">
            {/* Pitch */}
            <div
              style={{
                background: "linear-gradient(180deg, #2d8b4e 0%, #37a35c 8%, #2d8b4e 8%, #37a35c 16%, #2d8b4e 16%, #37a35c 24%, #2d8b4e 24%, #37a35c 32%, #2d8b4e 32%, #37a35c 40%, #2d8b4e 40%, #37a35c 48%, #2d8b4e 48%, #37a35c 56%, #2d8b4e 56%, #37a35c 64%, #2d8b4e 64%, #37a35c 72%, #2d8b4e 72%, #37a35c 80%, #2d8b4e 80%, #37a35c 88%, #2d8b4e 88%, #37a35c 96%, #2d8b4e 96%, #37a35c 100%)",
                position: "relative",
                padding: "4px 8px 8px",
                overflow: "visible",
              }}
            >
              {/* Pitch markings */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2.5, background: "rgba(255,255,255,0.4)" }} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 120, height: 120, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)" }} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
              <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2.5, background: "rgba(255,255,255,0.35)" }} />

              {/* Branding Bar */}
              <div style={{ display: "flex", height: 22, marginBottom: 2, marginLeft: -12, marginRight: -12 }}>
                <div
                  style={{
                    flex: 1,
                    background: "linear-gradient(90deg, #FFD700, #FFA500)",
                    display: "flex", alignItems: "center", paddingLeft: 16,
                    fontSize: 11, fontWeight: 800, color: "#fff",
                    textTransform: "uppercase", letterSpacing: 1,
                  }}
                >
                  Dream Team
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "linear-gradient(90deg, #FFA500, #FFD700)",
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    paddingRight: 16, fontSize: 11, fontWeight: 800, color: "#fff",
                    textTransform: "uppercase", letterSpacing: 1,
                  }}
                >
                  GW {selectedGwId}
                </div>
              </div>

              {/* GK Row */}
              <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
                {(groups.Goalkeepers ?? []).map((p: any) => (
                  <DreamPlayerCard key={p.id} player={p} isStar={p.id === starPlayerId} />
                ))}
              </div>

              {/* DEF Row */}
              <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "4px 4px" }}>
                {(groups.Defenders ?? []).map((p: any) => (
                  <DreamPlayerCard key={p.id} player={p} isStar={p.id === starPlayerId} />
                ))}
              </div>

              {/* MID Row */}
              <div style={{ display: "flex", justifyContent: "center", gap: 2, padding: "4px 4px" }}>
                {(groups.Midfielders ?? []).map((p: any) => (
                  <DreamPlayerCard key={p.id} player={p} isStar={p.id === starPlayerId} />
                ))}
              </div>

              {/* FWD Row */}
              <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "4px 4px 6px" }}>
                {(groups.Forwards ?? []).map((p: any) => (
                  <DreamPlayerCard key={p.id} player={p} isStar={p.id === starPlayerId} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auth Wrapper ──

export default function DreamTeamRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return <DreamTeamContent />;
}
