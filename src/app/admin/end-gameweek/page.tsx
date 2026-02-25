"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT, ACCENT_DIM,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, WARNING, SUCCESS,
} from "@/lib/admin-theme";

type StepKey = "review" | "appearances" | "calculate" | "finalize" | "advance";
type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

interface GwInfo {
  hasCurrentGw: boolean;
  gwId?: number;
  gwName?: string;
  deadline?: string | null;
  finalized?: boolean;
  totalMatches?: number;
  scoredMatches?: number;
  unscoredMatches?: number;
  allScoresEntered?: boolean;
  scoresCalculated?: boolean;
  usersPicked?: number;
}

interface Gameweek {
  id: number;
  name: string | null;
  is_current: boolean | null;
  is_next: boolean | null;
  finalized: boolean | null;
}

interface MatchPlayer {
  id: string;
  name: string;
  position: string | null;
  isLady: boolean | null;
  hasEvents: boolean;
  markedDidPlay: boolean;
  didPlay: boolean;
}

interface MatchTeam {
  teamUuid: string | null;
  teamName: string;
  shortName: string;
  players: MatchPlayer[];
}

interface MatchAppearance {
  matchId: number;
  homeGoals: number | null;
  awayGoals: number | null;
  isPlayed: boolean | null;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
}

const STEPS: { key: StepKey; label: string; icon: string }[] = [
  { key: "review", label: "Review", icon: "1" },
  { key: "appearances", label: "Appear.", icon: "2" },
  { key: "calculate", label: "Calculate", icon: "3" },
  { key: "finalize", label: "Finalize", icon: "4" },
  { key: "advance", label: "Advance", icon: "5" },
];

export default function EndGameweekPage() {
  const router = useRouter();
  const [gwInfo, setGwInfo] = useState<GwInfo | null>(null);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    review: "pending",
    appearances: "pending",
    calculate: "pending",
    finalize: "pending",
    advance: "pending",
  });
  const [stepResults, setStepResults] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Appearances state
  const [matchData, setMatchData] = useState<MatchAppearance[]>([]);
  const [checkedPlayers, setCheckedPlayers] = useState<Record<string, boolean>>({});
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set());
  const [appearancesLoading, setAppearancesLoading] = useState(false);
  const [appearancesSaving, setAppearancesSaving] = useState(false);

  // Load GW status + all gameweeks
  useEffect(() => {
    async function load() {
      try {
        const [statusRes, gwRes] = await Promise.all([
          fetch("/api/admin/gw-status"),
          fetch("/api/admin/gameweeks"),
        ]);
        if (statusRes.ok) {
          const data = await statusRes.json();
          setGwInfo(data);
          if (data.hasCurrentGw) {
            // Auto-complete review step
            setStepStatuses((s) => ({ ...s, review: "done" }));
            // If already finalized, skip finalize step
            if (data.finalized) {
              setStepStatuses((s) => ({ ...s, finalize: "skipped" }));
            }
            // If scores already calculated, mark that
            if (data.scoresCalculated) {
              setStepStatuses((s) => ({ ...s, calculate: "done" }));
            }
          }
        }
        if (gwRes.ok) {
          const data = await gwRes.json();
          setGameweeks(data.gameweeks ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const currentGwId = gwInfo?.gwId;
  const nextGw = gameweeks.find((gw) => gw.id === (currentGwId ? currentGwId + 1 : null))
    || gameweeks.find((gw) => gw.is_next)
    || gameweeks.find((gw) => currentGwId && gw.id > currentGwId && !gw.finalized);

  // Load match appearances data
  async function loadAppearances() {
    if (!currentGwId) return;
    setAppearancesLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/match-appearances?gw_id=${currentGwId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load appearances");

      const matches: MatchAppearance[] = json.matches ?? [];
      setMatchData(matches);

      // Pre-check players who already have events or did_play
      const initial: Record<string, boolean> = {};
      for (const match of matches) {
        for (const p of match.homeTeam.players) {
          initial[p.id] = p.didPlay;
        }
        for (const p of match.awayTeam.players) {
          initial[p.id] = p.didPlay;
        }
      }
      setCheckedPlayers(initial);

      // Auto-expand all matches
      setExpandedMatches(new Set(matches.map((m) => m.matchId)));
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load appearances");
    }
    setAppearancesLoading(false);
  }

  // Save appearances
  async function handleSaveAppearances() {
    if (!currentGwId) return;
    setAppearancesSaving(true);
    setErrorMsg(null);
    try {
      // Collect all players from all matches
      const appearances: { playerId: string; didPlay: boolean }[] = [];
      const seen = new Set<string>();
      for (const match of matchData) {
        for (const p of [...match.homeTeam.players, ...match.awayTeam.players]) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          appearances.push({ playerId: p.id, didPlay: checkedPlayers[p.id] ?? false });
        }
      }

      const res = await fetch("/api/admin/match-appearances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameweekId: currentGwId, appearances }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");

      setStepResults((r) => ({ ...r, appearances: json }));
      setStepStatuses((s) => ({ ...s, appearances: "done" }));
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save appearances");
      setStepStatuses((s) => ({ ...s, appearances: "error" }));
    }
    setAppearancesSaving(false);
  }

  // Skip appearances step
  function handleSkipAppearances() {
    setStepStatuses((s) => ({ ...s, appearances: "skipped" }));
  }

  function togglePlayer(playerId: string) {
    setCheckedPlayers((prev) => ({ ...prev, [playerId]: !prev[playerId] }));
  }

  function toggleMatch(matchId: number) {
    setExpandedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }

  // Select/deselect all players in a team for a match
  function toggleAllTeamPlayers(teamPlayers: MatchPlayer[], checked: boolean) {
    setCheckedPlayers((prev) => {
      const next = { ...prev };
      for (const p of teamPlayers) {
        // Don't uncheck players who have events (they definitely played)
        if (!checked && p.hasEvents) continue;
        next[p.id] = checked;
      }
      return next;
    });
  }

  async function handleCalculate() {
    if (!currentGwId) return;
    setStepStatuses((s) => ({ ...s, calculate: "running" }));
    setErrorMsg(null);
    try {
      const res = await fetch("/api/voice-admin/calculate-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameweekId: currentGwId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to calculate scores");
      setStepResults((r) => ({ ...r, calculate: json }));
      setStepStatuses((s) => ({ ...s, calculate: "done" }));
    } catch (e: any) {
      setErrorMsg(e?.message || "Calculation failed");
      setStepStatuses((s) => ({ ...s, calculate: "error" }));
    }
  }

  async function handleFinalize() {
    if (!currentGwId) return;
    setStepStatuses((s) => ({ ...s, finalize: "running" }));
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/gameweeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentGwId, finalized: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to finalize");
      setStepStatuses((s) => ({ ...s, finalize: "done" }));
    } catch (e: any) {
      setErrorMsg(e?.message || "Finalization failed");
      setStepStatuses((s) => ({ ...s, finalize: "error" }));
    }
  }

  async function handleAdvance() {
    if (!currentGwId || !nextGw) return;
    setStepStatuses((s) => ({ ...s, advance: "running" }));
    setErrorMsg(null);
    try {
      // Set next GW as current (the API auto-unsets previous current)
      const res = await fetch("/api/admin/gameweeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nextGw.id, is_current: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to advance");
      setStepStatuses((s) => ({ ...s, advance: "done" }));
      setStepResults((r) => ({ ...r, advance: { nextGwId: nextGw.id } }));
    } catch (e: any) {
      setErrorMsg(e?.message || "Advance failed");
      setStepStatuses((s) => ({ ...s, advance: "error" }));
    }
  }

  const allDone = STEPS.every((s) => stepStatuses[s.key] === "done" || stepStatuses[s.key] === "skipped");
  const appearancesDoneOrSkipped = stepStatuses.appearances === "done" || stepStatuses.appearances === "skipped";

  // Count checked players
  const checkedCount = Object.values(checkedPlayers).filter(Boolean).length;
  const totalPlayers = Object.keys(checkedPlayers).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${BORDER}`,
        backgroundColor: BG_CARD,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            🏁
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>End Gameweek</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
              Mark appearances, calculate scores, finalize & advance
            </p>
          </div>
        </div>
        <button onClick={() => router.push("/admin")} style={{
          padding: "8px 16px", borderRadius: 8,
          border: `1px solid ${BORDER}`, backgroundColor: "transparent",
          color: TEXT_MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          ← Back
        </button>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

        {loading ? (
          <div style={{ textAlign: "center", color: TEXT_MUTED, padding: 40 }}>Loading...</div>
        ) : !gwInfo?.hasCurrentGw ? (
          <div style={{
            padding: 32, backgroundColor: BG_CARD, border: `1px solid ${WARNING}30`, borderRadius: 12, textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: WARNING, marginBottom: 8 }}>No Current Gameweek</div>
            <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 16 }}>
              Set a gameweek as current before you can end it.
            </div>
            <button onClick={() => router.push("/admin/gameweeks")} style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
              color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Go to Gameweeks
            </button>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 0, marginBottom: 32, padding: "0 8px",
            }}>
              {STEPS.map((step, i) => {
                const st = stepStatuses[step.key];
                const circleColor = st === "done" || st === "skipped" ? SUCCESS : st === "running" ? ACCENT : st === "error" ? ERROR : TEXT_MUTED;
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        backgroundColor: circleColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700,
                        color: st === "done" || st === "skipped" ? "#000" : st === "running" ? "#000" : BG_DARK,
                        animation: st === "running" ? "pulse 1.5s infinite" : "none",
                      }}>
                        {st === "done" || st === "skipped" ? "✓" : step.icon}
                      </div>
                      <div style={{ fontSize: 9, color: circleColor, fontWeight: 600, marginTop: 4 }}>{step.label}</div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{
                        width: 40, height: 2, margin: "0 3px",
                        backgroundColor: stepStatuses[STEPS[i + 1].key] === "done" || stepStatuses[STEPS[i + 1].key] === "skipped" ? SUCCESS : `${TEXT_MUTED}30`,
                        marginBottom: 18,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error message */}
            {errorMsg && (
              <div style={{
                padding: "12px 16px", marginBottom: 16, borderRadius: 8,
                backgroundColor: `${ERROR}15`, border: `1px solid ${ERROR}30`, color: ERROR, fontSize: 13,
              }}>
                {errorMsg}
              </div>
            )}

            {/* Step 1: Review */}
            <StepCard title="Step 1: Review Current Gameweek" status={stepStatuses.review}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <StatBox label="Gameweek" value={`GW ${gwInfo.gwId}`} color={ACCENT} />
                <StatBox label="Users Picked" value={String(gwInfo.usersPicked || 0)} color="#A855F7" />
                <StatBox label="Matches Scored" value={`${gwInfo.scoredMatches}/${gwInfo.totalMatches}`} color={gwInfo.allScoresEntered ? SUCCESS : WARNING} />
                <StatBox label="Status" value={gwInfo.finalized ? "Finalized" : "Active"} color={gwInfo.finalized ? SUCCESS : ACCENT} />
              </div>
              {(gwInfo.unscoredMatches || 0) > 0 && (
                <div style={{
                  padding: "8px 12px", borderRadius: 6, backgroundColor: `${WARNING}15`,
                  border: `1px solid ${WARNING}30`, fontSize: 12, color: WARNING, marginBottom: 8,
                }}>
                  ⚠️ {gwInfo.unscoredMatches} match{(gwInfo.unscoredMatches || 0) > 1 ? "es" : ""} still need scores.
                  <span style={{ color: ACCENT, cursor: "pointer", marginLeft: 6 }} onClick={() => router.push("/admin/scores")}>Enter scores →</span>
                </div>
              )}
            </StepCard>

            {/* Step 2: Mark Appearances */}
            <StepCard title="Step 2: Mark Appearances" status={stepStatuses.appearances}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: TEXT_MUTED }}>
                Check off which players appeared in each match. Players with recorded events are pre-checked.
                This ensures auto-substitution works correctly for fantasy scoring.
              </p>

              {stepStatuses.appearances === "done" ? (
                <div style={{ fontSize: 13, color: SUCCESS, fontWeight: 600 }}>
                  ✓ {stepResults.appearances?.markedCount ?? checkedCount} players marked as appeared
                </div>
              ) : stepStatuses.appearances === "skipped" ? (
                <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                  Skipped — scoring will use event data only.
                </div>
              ) : matchData.length === 0 ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={loadAppearances}
                    disabled={appearancesLoading || stepStatuses.review !== "done"}
                    style={{
                      ...btnStyle,
                      opacity: (appearancesLoading || stepStatuses.review !== "done") ? 0.5 : 1,
                      cursor: (appearancesLoading || stepStatuses.review !== "done") ? "not-allowed" : "pointer",
                    }}
                  >
                    {appearancesLoading ? "Loading..." : "Load Match Players"}
                  </button>
                  <button
                    onClick={handleSkipAppearances}
                    style={{
                      ...btnMutedStyle,
                      opacity: stepStatuses.review !== "done" ? 0.5 : 1,
                    }}
                  >
                    Skip
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div style={{
                    padding: "8px 12px", borderRadius: 6, backgroundColor: BG_SURFACE,
                    border: `1px solid ${BORDER}`, fontSize: 12, color: TEXT_SECONDARY,
                    marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>{checkedCount} / {totalPlayers} players checked</span>
                    <span style={{ color: TEXT_MUTED }}>{matchData.length} match{matchData.length !== 1 ? "es" : ""}</span>
                  </div>

                  {/* Matches with team/player checkboxes */}
                  {matchData.map((match) => (
                    <div key={match.matchId} style={{
                      marginBottom: 10, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden",
                    }}>
                      {/* Match header (collapsible) */}
                      <div
                        onClick={() => toggleMatch(match.matchId)}
                        style={{
                          padding: "10px 12px", backgroundColor: BG_SURFACE, cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          <span style={{ color: TEXT_PRIMARY }}>{match.homeTeam.shortName}</span>
                          <span style={{ color: TEXT_MUTED, margin: "0 6px" }}>
                            {match.homeGoals != null ? `${match.homeGoals} - ${match.awayGoals}` : "vs"}
                          </span>
                          <span style={{ color: TEXT_PRIMARY }}>{match.awayTeam.shortName}</span>
                        </div>
                        <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                          {expandedMatches.has(match.matchId) ? "▼" : "▶"}
                        </span>
                      </div>

                      {/* Expanded: show teams & players */}
                      {expandedMatches.has(match.matchId) && (
                        <div style={{ padding: "8px 12px" }}>
                          <TeamCheckboxes
                            label={match.homeTeam.teamName}
                            players={match.homeTeam.players}
                            checked={checkedPlayers}
                            onToggle={togglePlayer}
                            onToggleAll={(checked) => toggleAllTeamPlayers(match.homeTeam.players, checked)}
                          />
                          <div style={{ height: 1, backgroundColor: BORDER, margin: "8px 0" }} />
                          <TeamCheckboxes
                            label={match.awayTeam.teamName}
                            players={match.awayTeam.players}
                            checked={checkedPlayers}
                            onToggle={togglePlayer}
                            onToggleAll={(checked) => toggleAllTeamPlayers(match.awayTeam.players, checked)}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Save / Skip buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      onClick={handleSaveAppearances}
                      disabled={appearancesSaving}
                      style={{
                        ...btnStyle,
                        opacity: appearancesSaving ? 0.6 : 1,
                        cursor: appearancesSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      {appearancesSaving ? "Saving..." : `Save Appearances (${checkedCount})`}
                    </button>
                    <button onClick={handleSkipAppearances} style={btnMutedStyle}>
                      Skip
                    </button>
                  </div>
                </>
              )}
            </StepCard>

            {/* Step 3: Calculate */}
            <StepCard title="Step 3: Calculate Fantasy Points" status={stepStatuses.calculate}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: TEXT_MUTED }}>
                Runs the scoring engine to compute each user&apos;s GW points from match events and saves to the leaderboard.
              </p>
              {stepResults.calculate?.leaderboard && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 600, marginBottom: 6 }}>Top Scorers:</div>
                  {(stepResults.calculate.leaderboard as any[]).slice(0, 5).map((entry: any, i: number) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", padding: "4px 0",
                      fontSize: 12, color: TEXT_SECONDARY,
                    }}>
                      <span>{i + 1}. {entry.team_name || entry.teamName || `User ${i + 1}`}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: ACCENT, fontWeight: 600 }}>
                        {entry.total_weekly_points ?? entry.totalPoints ?? 0} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {stepStatuses.calculate !== "done" && (
                <button
                  onClick={handleCalculate}
                  disabled={stepStatuses.calculate === "running" || !appearancesDoneOrSkipped}
                  style={{
                    ...btnStyle,
                    opacity: (stepStatuses.calculate === "running" || !appearancesDoneOrSkipped) ? 0.5 : 1,
                    cursor: (stepStatuses.calculate === "running" || !appearancesDoneOrSkipped) ? "not-allowed" : "pointer",
                  }}
                >
                  {stepStatuses.calculate === "running" ? "Calculating..." : "Calculate & Save Scores"}
                </button>
              )}
            </StepCard>

            {/* Step 4: Finalize */}
            <StepCard title="Step 4: Finalize Gameweek" status={stepStatuses.finalize}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: TEXT_MUTED }}>
                Marks GW {gwInfo.gwId} as finalized. Scores become permanent and the GW is locked.
              </p>
              {stepStatuses.finalize === "skipped" ? (
                <div style={{ fontSize: 12, color: SUCCESS }}>Already finalized.</div>
              ) : stepStatuses.finalize !== "done" ? (
                <button
                  onClick={handleFinalize}
                  disabled={stepStatuses.finalize === "running" || stepStatuses.calculate !== "done"}
                  style={{
                    ...btnStyle,
                    opacity: (stepStatuses.finalize === "running" || stepStatuses.calculate !== "done") ? 0.5 : 1,
                    cursor: (stepStatuses.finalize === "running" || stepStatuses.calculate !== "done") ? "not-allowed" : "pointer",
                  }}
                >
                  {stepStatuses.finalize === "running" ? "Finalizing..." : "Finalize GW " + gwInfo.gwId}
                </button>
              ) : null}
            </StepCard>

            {/* Step 5: Advance */}
            <StepCard title="Step 5: Advance to Next Gameweek" status={stepStatuses.advance}>
              {nextGw ? (
                <>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: TEXT_MUTED }}>
                    Set <strong style={{ color: TEXT_PRIMARY }}>GW {nextGw.id}</strong> ({nextGw.name || `Gameweek ${nextGw.id}`}) as the new current gameweek.
                  </p>
                  {stepStatuses.advance === "done" ? (
                    <div style={{ fontSize: 13, color: SUCCESS, fontWeight: 600 }}>
                      ✓ Advanced to GW {stepResults.advance?.nextGwId || nextGw.id}
                    </div>
                  ) : (
                    <button
                      onClick={handleAdvance}
                      disabled={stepStatuses.advance === "running" || (stepStatuses.finalize !== "done" && stepStatuses.finalize !== "skipped")}
                      style={{
                        ...btnStyle,
                        opacity: (stepStatuses.advance === "running" || (stepStatuses.finalize !== "done" && stepStatuses.finalize !== "skipped")) ? 0.5 : 1,
                        cursor: (stepStatuses.advance === "running" || (stepStatuses.finalize !== "done" && stepStatuses.finalize !== "skipped")) ? "not-allowed" : "pointer",
                      }}
                    >
                      {stepStatuses.advance === "running" ? "Advancing..." : `Advance to GW ${nextGw.id}`}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: WARNING }}>
                    No next gameweek found. Create one first.
                  </p>
                  <button onClick={() => router.push("/admin/gameweeks")} style={btnStyle}>
                    Go to Gameweeks
                  </button>
                </div>
              )}
            </StepCard>

            {/* Completion */}
            {allDone && (
              <div style={{
                padding: "20px", backgroundColor: `${SUCCESS}10`, border: `1px solid ${SUCCESS}30`,
                borderRadius: 12, textAlign: "center", marginTop: 8,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: SUCCESS, marginBottom: 4 }}>Gameweek Complete!</div>
                <div style={{ fontSize: 13, color: TEXT_MUTED }}>
                  All steps finished. The league has moved to the next gameweek.
                </div>
                <button onClick={() => router.push("/admin")} style={{ ...btnStyle, marginTop: 12 }}>
                  Return to Dashboard
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */

function TeamCheckboxes({
  label,
  players,
  checked,
  onToggle,
  onToggleAll,
}: {
  label: string;
  players: MatchPlayer[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const allChecked = players.every((p) => checked[p.id]);
  const someChecked = players.some((p) => checked[p.id]);

  return (
    <div>
      {/* Team header with select all */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6, paddingBottom: 4,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY }}>{label}</span>
        <button
          onClick={() => onToggleAll(!allChecked)}
          style={{
            background: "none", border: "none", color: ACCENT,
            fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "2px 6px",
            fontFamily: "'Outfit', system-ui, sans-serif",
          }}
        >
          {allChecked ? "Deselect all" : someChecked ? "Select all" : "Select all"}
        </button>
      </div>

      {/* Player checkboxes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
        {players.map((p) => {
          const isChecked = checked[p.id] ?? false;
          const posColor = p.position?.toLowerCase().includes("goal") ? "#F59E0B"
            : p.position?.toLowerCase().includes("def") ? "#3B82F6"
            : p.position?.toLowerCase().includes("mid") ? "#10B981"
            : "#EF4444";

          return (
            <label
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 6px", borderRadius: 4, cursor: "pointer",
                backgroundColor: isChecked ? `${ACCENT}10` : "transparent",
                opacity: p.hasEvents ? 0.7 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(p.id)}
                disabled={p.hasEvents} // Players with events can't be unchecked
                style={{ accentColor: ACCENT, width: 14, height: 14, cursor: p.hasEvents ? "default" : "pointer" }}
              />
              <span style={{
                fontSize: 10, fontWeight: 700, color: posColor,
                width: 28, textAlign: "center", flexShrink: 0,
              }}>
                {p.position?.slice(0, 3).toUpperCase() ?? "???"}
              </span>
              <span style={{ fontSize: 12, color: isChecked ? TEXT_PRIMARY : TEXT_MUTED, fontWeight: isChecked ? 500 : 400 }}>
                {p.name}
              </span>
              {p.isLady && (
                <span style={{ fontSize: 9, color: "#F472B6", fontWeight: 700 }}>L</span>
              )}
              {p.hasEvents && (
                <span style={{ fontSize: 9, color: ACCENT, fontWeight: 600, marginLeft: "auto" }}>EVT</span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({ title, status, children }: { title: string; status: StepStatus; children: React.ReactNode }) {
  const borderColor = status === "done" || status === "skipped" ? `${SUCCESS}30` : status === "error" ? `${ERROR}30` : BORDER;
  return (
    <div style={{
      padding: "18px 20px", backgroundColor: BG_CARD, border: `1px solid ${borderColor}`,
      borderRadius: 12, marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{title}</h3>
        {(status === "done" || status === "skipped") && (
          <span style={{ fontSize: 10, fontWeight: 700, color: SUCCESS, padding: "2px 8px", borderRadius: 4, backgroundColor: `${SUCCESS}15` }}>
            {status === "skipped" ? "SKIPPED" : "DONE"}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: "10px 12px", backgroundColor: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 8, border: "none",
  background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
  color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

const btnMutedStyle: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 8,
  border: `1px solid ${BORDER}`, backgroundColor: "transparent",
  color: TEXT_MUTED, fontSize: 13, fontWeight: 600, cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};
