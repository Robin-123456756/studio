"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING,
  inputStyle, btnGreen, btnMuted, btnDanger, globalResetCSS,
} from "@/lib/admin-theme";

interface SeasonStats {
  totalGameweeks: number;
  totalMatches: number;
  matchesPlayed: number;
  totalPlayers: number;
  totalTeams: number;
  totalManagers: number;
  topScorer: { userId: string; points: number };
  avgScorePerGw: number;
}

export default function SeasonPage() {
  const router = useRouter();
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/season/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, []);

  async function handleReset() {
    if (confirmation !== "RESET SEASON") return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch("/api/admin/season/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetResult({ success: true, message: data.message || "Season reset complete." });
        setConfirmation("");
        // Reload stats
        const statsRes = await fetch("/api/admin/season/stats");
        const newStats = await statsRes.json();
        setStats(newStats);
      } else {
        setResetResult({ success: false, message: data.error || "Reset failed." });
      }
    } catch (e: any) {
      setResetResult({ success: false, message: e.message });
    } finally {
      setResetting(false);
    }
  }

  function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
      <div style={{ padding: 16, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER}`, textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: color || ACCENT }}>{value}</div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>{label}</div>
      </div>
    );
  }

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Season Management</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 24px" }}>
            View season overview and manage season lifecycle.
          </p>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: TEXT_MUTED }}>Loading stats...</div>
          ) : stats ? (
            <>
              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 30 }}>
                <StatCard label="Gameweeks" value={stats.totalGameweeks} />
                <StatCard label="Matches" value={`${stats.matchesPlayed}/${stats.totalMatches}`} />
                <StatCard label="Players" value={stats.totalPlayers} />
                <StatCard label="Teams" value={stats.totalTeams} />
                <StatCard label="Managers" value={stats.totalManagers} />
                <StatCard label="Avg Score/GW" value={stats.avgScorePerGw} color={TEXT_SECONDARY} />
              </div>

              {stats.topScorer.points > 0 && (
                <div style={{ padding: 16, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER}`, marginBottom: 30 }}>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Top Fantasy Manager</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY }}>
                      {stats.topScorer.userId.slice(0, 12)}...
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT }}>
                      {stats.topScorer.points} pts
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: ERROR }}>Failed to load stats.</div>
          )}

          {/* Danger Zone */}
          <div style={{
            padding: 20,
            borderRadius: 12,
            background: `${ERROR}08`,
            border: `2px solid ${ERROR}33`,
            marginTop: 10,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: ERROR, margin: "0 0 8px" }}>Danger Zone</h2>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: "0 0 16px" }}>
              Reset all season data. This will delete all rosters, scores, transfers, chips, player stats,
              match events, voice logs, and activity feed. Player total points will be reset to 0.
              <strong style={{ color: ERROR }}> This action cannot be undone.</strong>
            </p>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                placeholder='Type "RESET SEASON" to confirm'
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                style={{ ...inputStyle, maxWidth: 280, borderColor: confirmation === "RESET SEASON" ? ERROR : BORDER }}
              />
              <button
                onClick={handleReset}
                disabled={confirmation !== "RESET SEASON" || resetting}
                style={{
                  ...btnDanger,
                  opacity: confirmation !== "RESET SEASON" || resetting ? 0.4 : 1,
                }}
              >
                {resetting ? "Resetting..." : "Reset Season Data"}
              </button>
            </div>

            {resetResult && (
              <div style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                fontSize: 13,
                background: resetResult.success ? `${SUCCESS}15` : `${ERROR}15`,
                color: resetResult.success ? SUCCESS : ERROR,
                border: `1px solid ${resetResult.success ? SUCCESS : ERROR}44`,
              }}>
                {resetResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
