"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Theme — matches voice admin
const BG_DARK = "#0A0F1C";
const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#CBD5E1";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";

interface Match {
  id: number;
  gameweek_id: number;
  home_goals: number;
  away_goals: number;
  is_played: boolean;
  home_team: string;
  home_short: string;
  away_team: string;
  away_short: string;
}

interface GoalScorer {
  playerId: string;
  playerName: string;
  goals: number;
  penalties: number;
  team: "home" | "away";
}

interface Gameweek {
  id: number;
  matches: Match[];
}

export default function AdminScoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGW, setActiveGW] = useState<number | null>(null);
  const [editedScores, setEditedScores] = useState<Record<number, { home: number; away: number }>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [matchScorers, setMatchScorers] = useState<Record<number, GoalScorer[]>>({});
  const [savingPenalty, setSavingPenalty] = useState<string | null>(null);

  // Load matches
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/match-scores");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setGameweeks(data.gameweeks || []);
        // Set active GW to latest with unplayed matches, or latest overall
        const withUnplayed = data.gameweeks?.find((gw: Gameweek) =>
          gw.matches.some((m: Match) => !m.is_played)
        );
        setActiveGW(withUnplayed?.id || data.gameweeks?.[data.gameweeks.length - 1]?.id || 1);
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message });
      }
      setLoading(false);
    }
    load();
  }, []);

  // Initialize edited scores when GW changes
  useEffect(() => {
    if (!activeGW || gameweeks.length === 0) return;
    const gw = gameweeks.find((g) => g.id === activeGW);
    if (!gw) return;
    const initial: Record<number, { home: number; away: number }> = {};
    for (const m of gw.matches) {
      initial[m.id] = { home: m.home_goals || 0, away: m.away_goals || 0 };
    }
    setEditedScores(initial);
  }, [activeGW, gameweeks]);

  const updateScore = useCallback((matchId: number, side: "home" | "away", value: number) => {
    setEditedScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: Math.max(0, value),
      },
    }));
  }, []);

  // Save a single match
  const saveMatch = useCallback(async (matchId: number) => {
    const scores = editedScores[matchId];
    if (!scores) return;
    setSaving(matchId);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/match-scores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matches: [{ id: matchId, home_goals: scores.home, away_goals: scores.away }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      // Update local state
      setGameweeks((prev) =>
        prev.map((gw) => ({
          ...gw,
          matches: gw.matches.map((m) =>
            m.id === matchId ? { ...m, home_goals: scores.home, away_goals: scores.away, is_played: true } : m
          ),
        }))
      );
      setFeedback({ type: "success", message: `${data.updated || 1} match saved` });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSaving(null);
  }, [editedScores]);

  // Save all matches in active GW
  const saveAllInGW = useCallback(async () => {
    const gw = gameweeks.find((g) => g.id === activeGW);
    if (!gw) return;
    setSavingAll(true);
    setFeedback(null);
    try {
      const matches = gw.matches.map((m) => ({
        id: m.id,
        home_goals: editedScores[m.id]?.home ?? m.home_goals ?? 0,
        away_goals: editedScores[m.id]?.away ?? m.away_goals ?? 0,
      }));
      const res = await fetch("/api/admin/match-scores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      // Update local state
      setGameweeks((prev) =>
        prev.map((g) =>
          g.id === activeGW
            ? {
                ...g,
                matches: g.matches.map((m) => ({
                  ...m,
                  home_goals: editedScores[m.id]?.home ?? m.home_goals,
                  away_goals: editedScores[m.id]?.away ?? m.away_goals,
                  is_played: true,
                })),
              }
            : g
        )
      );
      setFeedback({ type: "success", message: `All ${data.updated} matches in GW${activeGW} saved!` });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSavingAll(false);
  }, [activeGW, gameweeks, editedScores]);

  // Fetch goal scorers for current GW matches
  const loadScorers = useCallback(async (matchIds: number[]) => {
    try {
      const res = await fetch(`/api/admin/match-scorers?matchIds=${matchIds.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      setMatchScorers((prev) => ({ ...prev, ...data.scorers }));
    } catch {
      // non-critical
    }
  }, []);

  // Load scorers when GW changes
  useEffect(() => {
    if (!activeGW || gameweeks.length === 0) return;
    const gw = gameweeks.find((g) => g.id === activeGW);
    if (!gw) return;
    const playedMatchIds = gw.matches.filter((m) => m.is_played).map((m) => m.id);
    if (playedMatchIds.length > 0) loadScorers(playedMatchIds);
  }, [activeGW, gameweeks, loadScorers]);

  const updatePenalty = useCallback(async (matchId: number, playerId: string, newPenalties: number) => {
    const key = `${matchId}-${playerId}`;
    setSavingPenalty(key);
    try {
      const res = await fetch("/api/admin/match-scorers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, playerId, penalties: newPenalties }),
      });
      if (!res.ok) throw new Error("Failed to update");
      // Update local state
      setMatchScorers((prev) => {
        const scorers = (prev[matchId] ?? []).map((s) =>
          s.playerId === playerId ? { ...s, penalties: newPenalties } : s
        );
        return { ...prev, [matchId]: scorers };
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSavingPenalty(null);
  }, []);

  const activeMatches = gameweeks.find((g) => g.id === activeGW)?.matches || [];
  const hasChanges = activeMatches.some((m) => {
    const edited = editedScores[m.id];
    return edited && (edited.home !== (m.home_goals || 0) || edited.away !== (m.away_goals || 0) || !m.is_played);
  });

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading matches...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
        input[type="number"]::-webkit-inner-spin-button { opacity: 1; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${BORDER}`,
        backgroundColor: BG_CARD,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/admin")}
            style={{
              background: "none", border: `1px solid ${BORDER}`, borderRadius: 8,
              color: TEXT_MUTED, padding: "6px 12px", fontSize: 12, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Match Scores</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
              BUDO LEAGUE — Update Results
            </p>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

        {/* Feedback banner */}
        {feedback && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            backgroundColor: feedback.type === "success" ? `${SUCCESS}15` : `${ERROR}15`,
            border: `1px solid ${feedback.type === "success" ? SUCCESS : ERROR}40`,
            color: feedback.type === "success" ? SUCCESS : ERROR,
            fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{feedback.type === "success" ? "✅" : "⚠️"} {feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16 }}
            >✕</button>
          </div>
        )}

        {/* GW Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {gameweeks.map((gw) => {
            const allPlayed = gw.matches.every((m) => m.is_played);
            const isActive = gw.id === activeGW;
            return (
              <button
                key={gw.id}
                onClick={() => setActiveGW(gw.id)}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: `1px solid ${isActive ? ACCENT + "60" : BORDER}`,
                  backgroundColor: isActive ? `${ACCENT}15` : "transparent",
                  color: isActive ? ACCENT : TEXT_MUTED,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                  position: "relative",
                }}
              >
                GW{gw.id}
                {allPlayed && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    width: 10, height: 10, borderRadius: "50%",
                    backgroundColor: SUCCESS, border: `2px solid ${BG_DARK}`,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Match Cards */}
        {activeMatches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
            <p>No matches found for this gameweek.</p>
          </div>
        ) : (
          <>
            {activeMatches.map((match) => {
              const scores = editedScores[match.id] || { home: 0, away: 0 };
              const isChanged = scores.home !== (match.home_goals || 0) || scores.away !== (match.away_goals || 0) || !match.is_played;
              const isSaving = saving === match.id;

              return (
                <div
                  key={match.id}
                  style={{
                    backgroundColor: BG_CARD,
                    border: `1px solid ${isChanged ? WARNING + "50" : match.is_played ? SUCCESS + "30" : BORDER}`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    marginBottom: 10,
                  }}
                >
                  {/* Status badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                      Match #{match.id}
                    </span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                      backgroundColor: match.is_played ? `${SUCCESS}15` : `${WARNING}15`,
                      color: match.is_played ? SUCCESS : WARNING,
                    }}>
                      {match.is_played ? "PLAYED" : "PENDING"}
                    </span>
                  </div>

                  {/* Score row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    {/* Home team */}
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{match.home_short}</div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{match.home_team}</div>
                    </div>

                    {/* Home score */}
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={scores.home}
                      onChange={(e) => updateScore(match.id, "home", parseInt(e.target.value) || 0)}
                      style={{
                        width: 52, height: 52, textAlign: "center",
                        fontSize: 22, fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        backgroundColor: BG_SURFACE, color: TEXT_PRIMARY,
                        border: `2px solid ${isChanged ? WARNING : BORDER}`,
                        borderRadius: 10, outline: "none",
                      }}
                    />

                    <span style={{ fontSize: 18, color: TEXT_MUTED, fontWeight: 700 }}>:</span>

                    {/* Away score */}
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={scores.away}
                      onChange={(e) => updateScore(match.id, "away", parseInt(e.target.value) || 0)}
                      style={{
                        width: 52, height: 52, textAlign: "center",
                        fontSize: 22, fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        backgroundColor: BG_SURFACE, color: TEXT_PRIMARY,
                        border: `2px solid ${isChanged ? WARNING : BORDER}`,
                        borderRadius: 10, outline: "none",
                      }}
                    />

                    {/* Away team */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{match.away_short}</div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{match.away_team}</div>
                    </div>
                  </div>

                  {/* Save individual match */}
                  {isChanged && (
                    <div style={{ textAlign: "center", marginTop: 12 }}>
                      <button
                        onClick={() => saveMatch(match.id)}
                        disabled={isSaving}
                        style={{
                          padding: "8px 20px", borderRadius: 8,
                          border: "none", backgroundColor: ACCENT,
                          color: BG_DARK, fontSize: 12, fontWeight: 700,
                          cursor: isSaving ? "wait" : "pointer",
                          fontFamily: "inherit", opacity: isSaving ? 0.6 : 1,
                        }}
                      >
                        {isSaving ? "Saving..." : "Save This Match"}
                      </button>
                    </div>
                  )}

                  {/* Goal scorers with penalty toggles */}
                  {match.is_played && matchScorers[match.id]?.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                        Goal Scorers — Penalty Tracking
                      </div>
                      {matchScorers[match.id].map((scorer) => {
                        const penKey = `${match.id}-${scorer.playerId}`;
                        const isSavingPen = savingPenalty === penKey;
                        return (
                          <div key={scorer.playerId} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "6px 0", borderBottom: `1px solid ${BORDER}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                                backgroundColor: scorer.team === "home" ? `${ACCENT}20` : `${WARNING}20`,
                                color: scorer.team === "home" ? ACCENT : WARNING,
                              }}>{scorer.team === "home" ? "H" : "A"}</span>
                              <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {scorer.playerName}
                              </span>
                              <span style={{ fontSize: 11, color: TEXT_MUTED }}>⚽{scorer.goals > 1 ? scorer.goals : ""}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              <span style={{ fontSize: 11, color: TEXT_MUTED, marginRight: 4 }}>Pen:</span>
                              <button
                                onClick={() => updatePenalty(match.id, scorer.playerId, Math.max(0, scorer.penalties - 1))}
                                disabled={scorer.penalties <= 0 || isSavingPen}
                                style={{
                                  width: 22, height: 22, borderRadius: 4, border: `1px solid ${BORDER}`,
                                  backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, cursor: scorer.penalties > 0 && !isSavingPen ? "pointer" : "not-allowed",
                                  fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                                  opacity: scorer.penalties > 0 ? 1 : 0.3,
                                }}
                              >−</button>
                              <span style={{
                                width: 22, textAlign: "center", fontSize: 13, fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                                color: scorer.penalties > 0 ? ACCENT : TEXT_MUTED,
                              }}>{scorer.penalties}</span>
                              <button
                                onClick={() => updatePenalty(match.id, scorer.playerId, Math.min(scorer.goals, scorer.penalties + 1))}
                                disabled={scorer.penalties >= scorer.goals || isSavingPen}
                                style={{
                                  width: 22, height: 22, borderRadius: 4, border: `1px solid ${BORDER}`,
                                  backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, cursor: scorer.penalties < scorer.goals && !isSavingPen ? "pointer" : "not-allowed",
                                  fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                                  opacity: scorer.penalties < scorer.goals ? 1 : 0.3,
                                }}
                              >+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Save All Button */}
            <div style={{
              position: "sticky", bottom: 16,
              padding: "16px", marginTop: 8,
              backgroundColor: BG_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                  GW{activeGW} — {activeMatches.length} matches
                </span>
                <br />
                <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                  {activeMatches.filter((m) => m.is_played).length} played · {activeMatches.filter((m) => !m.is_played).length} pending
                </span>
              </div>
              <button
                onClick={saveAllInGW}
                disabled={savingAll}
                style={{
                  padding: "12px 28px", borderRadius: 10,
                  border: "none",
                  backgroundColor: hasChanges ? ACCENT : TEXT_MUTED,
                  color: BG_DARK, fontSize: 14, fontWeight: 700,
                  cursor: savingAll ? "wait" : hasChanges ? "pointer" : "default",
                  fontFamily: "inherit", opacity: savingAll ? 0.6 : 1,
                }}
              >
                {savingAll ? "Saving All..." : `Save All GW${activeGW} Scores`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}