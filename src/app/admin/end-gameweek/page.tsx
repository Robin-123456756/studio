"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT, ACCENT_DIM,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, WARNING, SUCCESS,
} from "@/lib/admin-theme";

type StepKey = "review" | "calculate" | "finalize" | "advance";
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

const STEPS: { key: StepKey; label: string; icon: string }[] = [
  { key: "review", label: "Review", icon: "1" },
  { key: "calculate", label: "Calculate", icon: "2" },
  { key: "finalize", label: "Finalize", icon: "3" },
  { key: "advance", label: "Advance", icon: "4" },
];

export default function EndGameweekPage() {
  const router = useRouter();
  const [gwInfo, setGwInfo] = useState<GwInfo | null>(null);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    review: "pending",
    calculate: "pending",
    finalize: "pending",
    advance: "pending",
  });
  const [stepResults, setStepResults] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
              Calculate scores, finalize & advance
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
              gap: 0, marginBottom: 32, padding: "0 20px",
            }}>
              {STEPS.map((step, i) => {
                const st = stepStatuses[step.key];
                const circleColor = st === "done" || st === "skipped" ? SUCCESS : st === "running" ? ACCENT : st === "error" ? ERROR : TEXT_MUTED;
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        backgroundColor: circleColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700,
                        color: st === "done" || st === "skipped" ? "#000" : st === "running" ? "#000" : BG_DARK,
                        animation: st === "running" ? "pulse 1.5s infinite" : "none",
                      }}>
                        {st === "done" || st === "skipped" ? "✓" : step.icon}
                      </div>
                      <div style={{ fontSize: 10, color: circleColor, fontWeight: 600, marginTop: 4 }}>{step.label}</div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{
                        width: 60, height: 2, margin: "0 4px",
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

            {/* Step 2: Calculate */}
            <StepCard title="Step 2: Calculate Fantasy Points" status={stepStatuses.calculate}>
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
                  disabled={stepStatuses.calculate === "running"}
                  style={{
                    ...btnStyle,
                    opacity: stepStatuses.calculate === "running" ? 0.6 : 1,
                    cursor: stepStatuses.calculate === "running" ? "not-allowed" : "pointer",
                  }}
                >
                  {stepStatuses.calculate === "running" ? "Calculating..." : "Calculate & Save Scores"}
                </button>
              )}
            </StepCard>

            {/* Step 3: Finalize */}
            <StepCard title="Step 3: Finalize Gameweek" status={stepStatuses.finalize}>
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

            {/* Step 4: Advance */}
            <StepCard title="Step 4: Advance to Next Gameweek" status={stepStatuses.advance}>
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
