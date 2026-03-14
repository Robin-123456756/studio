"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING,
  btnMuted, globalResetCSS,
} from "@/lib/admin-theme";

interface Gameweek { id: number; name: string | null; is_current: boolean | null }
interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  is_played: boolean;
}
interface BpsPerformer {
  playerId: string;
  playerName: string;
  position: string;
  bpsScore: number;
  bonus: number;
}

const POS_COLORS: Record<string, string> = { GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444" };
const BONUS_COLORS: Record<number, string> = { 3: "#FFD700", 2: "#C0C0C0", 1: "#CD7F32" };

export default function BonusPointsPage() {
  const router = useRouter();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [performers, setPerformers] = useState<BpsPerformer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/gameweeks")
      .then((r) => r.json())
      .then((d) => {
        const gws = d.gameweeks || [];
        setGameweeks(gws);
        const current = gws.find((g: Gameweek) => g.is_current);
        if (current) setSelectedGw(current.id);
      });
  }, []);

  useEffect(() => {
    if (!selectedGw) { setMatches([]); return; }
    fetch(`/api/matches?gameweek_id=${selectedGw}`)
      .then((r) => r.json())
      .then((d) => {
        const played = (d.matches || []).filter((m: any) => m.is_played);
        setMatches(played.map((m: any) => ({
          id: m.id,
          home_team: m.home_team?.name || m.home_team_name || "Home",
          away_team: m.away_team?.name || m.away_team_name || "Away",
          home_goals: m.home_goals ?? 0,
          away_goals: m.away_goals ?? 0,
          is_played: true,
        })));
        setSelectedMatch(null);
        setPerformers([]);
      });
  }, [selectedGw]);

  async function loadPerformers(matchId: string) {
    setSelectedMatch(matchId);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bonus-points?match_id=${matchId}`);
      const data = await res.json();
      setPerformers(data.performers || []);
    } catch {
      setPerformers([]);
    } finally {
      setLoading(false);
    }
  }

  const bonusWinners = performers.filter((p) => p.bonus > 0);

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Bonus Points (Auto)</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>
            Top 3 performers per match are automatically awarded 3/2/1 bonus points based on BPS ranking. Ties share the same bonus.
          </p>

          {/* GW Selector */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {gameweeks.map((gw) => (
              <button
                key={gw.id}
                onClick={() => setSelectedGw(gw.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: selectedGw === gw.id ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                  background: selectedGw === gw.id ? `${ACCENT}18` : "transparent",
                  color: selectedGw === gw.id ? ACCENT : TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                GW {gw.id}
                {gw.is_current && " (Current)"}
              </button>
            ))}
          </div>

          {/* Matches */}
          {matches.length === 0 && selectedGw && (
            <div style={{ padding: 30, textAlign: "center", color: TEXT_MUTED }}>No played matches in this gameweek.</div>
          )}

          {matches.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 20 }}>
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => loadPerformers(m.id)}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: selectedMatch === m.id ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                    background: selectedMatch === m.id ? `${ACCENT}10` : BG_CARD,
                    cursor: "pointer",
                    textAlign: "center",
                    color: TEXT_PRIMARY,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.home_team} vs {m.away_team}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                    {m.home_goals} — {m.away_goals}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* BPS Rankings */}
          {selectedMatch && (
            loading ? (
              <div style={{ padding: 30, textAlign: "center", color: TEXT_MUTED }}>Loading BPS rankings...</div>
            ) : performers.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: TEXT_MUTED }}>No player events for this match yet.</div>
            ) : (
              <>
                {/* Bonus winners banner */}
                {bonusWinners.length > 0 && (
                  <div style={{
                    display: "flex", gap: 12, marginBottom: 16, padding: "14px 16px",
                    backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
                    flexWrap: "wrap",
                  }}>
                    {bonusWinners
                      .sort((a, b) => b.bonus - a.bonus)
                      .map((w) => (
                      <div key={w.playerId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: "50%", display: "inline-flex",
                          alignItems: "center", justifyContent: "center",
                          backgroundColor: BONUS_COLORS[w.bonus] ?? TEXT_MUTED,
                          color: "#000", fontWeight: 700, fontSize: 13,
                        }}>{w.bonus}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{w.playerName}</div>
                          <div style={{ fontSize: 10, color: TEXT_MUTED }}>BPS: {w.bpsScore}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full BPS table */}
                <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 60px 80px 60px",
                    padding: "10px 14px",
                    background: BG_SURFACE,
                    fontSize: 11,
                    fontWeight: 600,
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    gap: 8,
                  }}>
                    <div>#</div>
                    <div>Player</div>
                    <div>Pos</div>
                    <div style={{ textAlign: "right" }}>BPS</div>
                    <div style={{ textAlign: "center" }}>Bonus</div>
                  </div>

                  {performers.slice(0, 20).map((p, i) => (
                    <div key={p.playerId} style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 60px 80px 60px",
                      padding: "10px 14px",
                      background: p.bonus > 0 ? `${BONUS_COLORS[p.bonus]}08` : i % 2 === 0 ? BG_CARD : BG_DARK,
                      fontSize: 13,
                      gap: 8,
                      alignItems: "center",
                      borderBottom: `1px solid ${BORDER}22`,
                    }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED, fontSize: 12 }}>{i + 1}</div>
                      <div style={{ fontWeight: 600 }}>{p.playerName}</div>
                      <div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                          background: `${POS_COLORS[p.position] || TEXT_MUTED}22`,
                          color: POS_COLORS[p.position] || TEXT_MUTED,
                        }}>{p.position}</span>
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        {p.bpsScore}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        {p.bonus > 0 ? (
                          <span style={{
                            display: "inline-flex", width: 28, height: 28, borderRadius: "50%",
                            alignItems: "center", justifyContent: "center",
                            backgroundColor: BONUS_COLORS[p.bonus],
                            color: "#000", fontWeight: 700, fontSize: 12,
                          }}>{p.bonus}</span>
                        ) : (
                          <span style={{ color: TEXT_MUTED, fontSize: 11 }}>—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: "center" }}>
                  Bonus is auto-calculated from BPS. No manual assignment needed.
                </div>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
