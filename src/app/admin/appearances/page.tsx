"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  ERROR, WARNING, SUCCESS,
} from "@/lib/admin-theme";

type AppearanceStatus = "started" | "sub" | "not_played";

interface Player {
  id: string;
  name: string;
  position: string | null;
  isLady: boolean;
  hasEvents: boolean;
  markedDidPlay: boolean;
  didPlay: boolean;
  status: AppearanceStatus;
}

interface TeamData {
  teamUuid: string | null;
  teamName: string;
  shortName: string;
  players: Player[];
}

interface MatchData {
  matchId: number;
  homeGoals: number | null;
  awayGoals: number | null;
  isPlayed: boolean;
  homeTeam: TeamData;
  awayTeam: TeamData;
}

interface Gameweek {
  id: number;
  name: string;
  is_current: boolean;
  finalized: boolean;
}

const POS_ORDER: Record<string, number> = {
  GK: 0, Goalkeeper: 0, DEF: 1, Defender: 1, MID: 2, Midfielder: 2, FWD: 3, Forward: 3,
};

function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => {
    const pa = POS_ORDER[a.position ?? ""] ?? 4;
    const pb = POS_ORDER[b.position ?? ""] ?? 4;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

function posTag(pos: string | null) {
  const p = (pos ?? "").slice(0, 3).toUpperCase();
  const colors: Record<string, string> = {
    GOA: "#F59E0B", GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444", FOR: "#EF4444",
  };
  return { label: p || "???", color: colors[p] ?? TEXT_MUTED };
}

export default function AdminAppearancesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Track local status changes: matchId -> playerId -> status
  const [localStatus, setLocalStatus] = useState<Map<number, Map<string, AppearanceStatus>>>(new Map());

  // Load gameweeks
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/gameweeks");
        if (res.ok) {
          const data = await res.json();
          const gws: Gameweek[] = data.gameweeks || [];
          setGameweeks(gws);
          const current = gws.find((g) => g.is_current);
          if (current) setSelectedGw(current.id);
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  // Load matches when GW changes
  const loadMatches = useCallback(async (gwId: number) => {
    setMatchesLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/match-appearances?gw_id=${gwId}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        // Initialize local status from server data
        const statusMap = new Map<number, Map<string, AppearanceStatus>>();
        for (const m of data.matches || []) {
          const playerMap = new Map<string, AppearanceStatus>();
          for (const p of [...m.homeTeam.players, ...m.awayTeam.players]) {
            playerMap.set(p.id, p.status);
          }
          statusMap.set(m.matchId, playerMap);
        }
        setLocalStatus(statusMap);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to load matches" });
    }
    setMatchesLoading(false);
  }, []);

  useEffect(() => {
    if (selectedGw) loadMatches(selectedGw);
  }, [selectedGw, loadMatches]);

  const getStatus = (matchId: number, playerId: string): AppearanceStatus => {
    return localStatus.get(matchId)?.get(playerId) ?? "not_played";
  };

  const setPlayerStatus = (matchId: number, playerId: string, st: AppearanceStatus) => {
    setLocalStatus((prev) => {
      const next = new Map(prev);
      const matchMap = new Map(next.get(matchId) ?? new Map());
      matchMap.set(playerId, st);
      next.set(matchId, matchMap);
      return next;
    });
  };

  const handleSaveMatch = useCallback(async (matchId: number) => {
    if (!selectedGw) return;
    const matchMap = localStatus.get(matchId);
    if (!matchMap) return;

    setSaving(matchId);
    setFeedback(null);
    try {
      const appearances = [...matchMap.entries()].map(([playerId, st]) => ({
        playerId,
        status: st,
      }));

      const res = await fetch("/api/admin/match-appearances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameweekId: selectedGw, matchId, appearances }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setFeedback({
        type: "success",
        message: `Saved: ${data.startedCount} started, ${data.subCount} subs`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSaving(null);
  }, [selectedGw, localStatus]);

  // Bulk actions for a team in a match
  const setAllTeam = (matchId: number, players: Player[], st: AppearanceStatus) => {
    setLocalStatus((prev) => {
      const next = new Map(prev);
      const matchMap = new Map(next.get(matchId) ?? new Map());
      for (const p of players) {
        matchMap.set(p.id, st);
      }
      next.set(matchId, matchMap);
      return next;
    });
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
        select option { background: ${BG_SURFACE}; color: ${TEXT_PRIMARY}; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "16px 24px", borderBottom: `1px solid ${BORDER}`,
        backgroundColor: BG_CARD, display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => router.push("/admin")}
          style={{
            background: "none", border: `1px solid ${BORDER}`, borderRadius: 8,
            color: TEXT_MUTED, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          &larr; Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Appearances</h1>
          <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
            Mark starters &amp; substitutes per match
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            backgroundColor: feedback.type === "success" ? `${SUCCESS}15` : `${ERROR}15`,
            border: `1px solid ${feedback.type === "success" ? SUCCESS : ERROR}40`,
            color: feedback.type === "success" ? SUCCESS : ERROR,
            fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)}
              style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16 }}>&times;</button>
          </div>
        )}

        {/* GW Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Gameweek
          </label>
          <select
            value={selectedGw ?? ""}
            onChange={(e) => setSelectedGw(Number(e.target.value))}
            style={{
              width: "100%", maxWidth: 300, padding: "12px 14px", borderRadius: 10,
              border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
              color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <option value="">Select gameweek...</option>
            {gameweeks.map((gw) => (
              <option key={gw.id} value={gw.id}>
                GW {gw.id} &mdash; {gw.name}{gw.is_current ? " (Current)" : gw.finalized ? " (Finalized)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Matches */}
        {matchesLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED, fontSize: 14 }}>
            Loading matches...
          </div>
        ) : matches.length === 0 && selectedGw ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED, fontSize: 14 }}>
            No matches found for this gameweek.
          </div>
        ) : (
          matches.map((match) => {
            const isSaving = saving === match.matchId;
            return (
              <div key={match.matchId} style={{
                backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
                marginBottom: 16, overflow: "hidden",
              }}>
                {/* Match header */}
                <div style={{
                  padding: "14px 16px", borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      {match.homeTeam.shortName}
                    </span>
                    {match.isPlayed ? (
                      <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>
                        {match.homeGoals} - {match.awayGoals}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: TEXT_MUTED }}>vs</span>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      {match.awayTeam.shortName}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSaveMatch(match.matchId)}
                    disabled={isSaving}
                    style={{
                      padding: "8px 20px", borderRadius: 8, border: "none",
                      backgroundColor: ACCENT, color: BG_DARK,
                      fontSize: 13, fontWeight: 700, cursor: isSaving ? "wait" : "pointer",
                      fontFamily: "inherit", opacity: isSaving ? 0.6 : 1,
                    }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>

                {/* Two-column: home and away teams */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {[match.homeTeam, match.awayTeam].map((team, ti) => (
                    <div key={ti} style={{
                      padding: "12px",
                      borderRight: ti === 0 ? `1px solid ${BORDER}` : "none",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 10,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY }}>
                          {team.shortName}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => setAllTeam(match.matchId, team.players, "started")}
                            style={{
                              padding: "2px 6px", borderRadius: 4, border: `1px solid ${SUCCESS}40`,
                              backgroundColor: "transparent", color: SUCCESS, fontSize: 9,
                              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                            }}
                          >
                            All Start
                          </button>
                          <button
                            onClick={() => setAllTeam(match.matchId, team.players, "not_played")}
                            style={{
                              padding: "2px 6px", borderRadius: 4, border: `1px solid ${TEXT_MUTED}40`,
                              backgroundColor: "transparent", color: TEXT_MUTED, fontSize: 9,
                              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {sortPlayers(team.players).map((player) => {
                        const st = getStatus(match.matchId, player.id);
                        const pt = posTag(player.position);
                        return (
                          <div key={player.id} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 8px", marginBottom: 4, borderRadius: 6,
                            backgroundColor: st === "started" ? `${SUCCESS}10` : st === "sub" ? `${WARNING}10` : "transparent",
                          }}>
                            {/* Position tag */}
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                              backgroundColor: `${pt.color}20`, color: pt.color,
                              minWidth: 28, textAlign: "center",
                            }}>
                              {pt.label}
                            </span>
                            {/* Player name */}
                            <span style={{
                              flex: 1, fontSize: 12, fontWeight: 500,
                              color: st === "not_played" ? TEXT_MUTED : TEXT_PRIMARY,
                            }}>
                              {player.name}
                              {player.isLady && <span style={{ color: "#EC4899", marginLeft: 4, fontSize: 10 }}>L</span>}
                            </span>
                            {/* Status buttons: S = Started, B = Bench/Sub, X = Did not play */}
                            <div style={{ display: "flex", gap: 2 }}>
                              {(["started", "sub", "not_played"] as AppearanceStatus[]).map((s) => {
                                const active = st === s;
                                const label = s === "started" ? "S" : s === "sub" ? "B" : "X";
                                const color = s === "started" ? SUCCESS : s === "sub" ? WARNING : TEXT_MUTED;
                                return (
                                  <button
                                    key={s}
                                    onClick={() => setPlayerStatus(match.matchId, player.id, s)}
                                    title={s === "started" ? "Started (2 pts)" : s === "sub" ? "Came off bench (1 pt)" : "Did not play"}
                                    style={{
                                      width: 24, height: 24, borderRadius: 4,
                                      border: `1px solid ${active ? color : BORDER}`,
                                      backgroundColor: active ? `${color}25` : "transparent",
                                      color: active ? color : `${TEXT_MUTED}60`,
                                      fontSize: 10, fontWeight: 700,
                                      cursor: "pointer", fontFamily: "inherit",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div style={{
                  padding: "8px 16px", borderTop: `1px solid ${BORDER}`,
                  display: "flex", gap: 16, fontSize: 10, color: TEXT_MUTED,
                }}>
                  <span><strong style={{ color: SUCCESS }}>S</strong> = Started (2 pts)</span>
                  <span><strong style={{ color: WARNING }}>B</strong> = Bench/Sub (1 pt)</span>
                  <span><strong style={{ color: TEXT_MUTED }}>X</strong> = Did not play</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
