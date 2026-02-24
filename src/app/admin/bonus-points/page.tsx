"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING,
  btnGreen, btnMuted, globalResetCSS,
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
interface Performer {
  playerId: string;
  playerName: string;
  position: string;
  matchPoints: number;
  currentBonus: number;
}

const POS_COLORS: Record<string, string> = { GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444" };

export default function BonusPointsPage() {
  const router = useRouter();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [bonusAssignments, setBonusAssignments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/bonus-points?match_id=${matchId}`);
      const data = await res.json();
      const perfs = data.performers || [];
      setPerformers(perfs);

      // Pre-fill existing bonus assignments
      const existing: Record<string, number> = {};
      for (const p of perfs) {
        if (p.currentBonus > 0) existing[p.playerId] = p.currentBonus;
      }
      setBonusAssignments(existing);
    } catch {
      setPerformers([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleBonus(playerId: string, points: number) {
    setBonusAssignments((prev) => {
      const next = { ...prev };
      if (next[playerId] === points) {
        delete next[playerId];
      } else {
        // Check if this bonus value is already assigned to someone else
        const existing = Object.entries(next).find(([pid, pts]) => pts === points && pid !== playerId);
        if (existing) delete next[existing[0]];
        next[playerId] = points;
      }
      return next;
    });
  }

  async function saveBonus() {
    if (!selectedMatch) return;
    setSaving(true);
    setMessage(null);
    try {
      const bonuses = Object.entries(bonusAssignments).map(([player_id, points]) => ({ player_id, points }));
      const res = await fetch("/api/admin/bonus-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: selectedMatch, bonuses }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: "Bonus points saved!" });
    } catch {
      setMessage({ type: "error", text: "Failed to save bonus points." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Bonus Points</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>
            Assign 3/2/1 bonus points to top performers in each match.
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

          {/* Performers Table */}
          {selectedMatch && (
            loading ? (
              <div style={{ padding: 30, textAlign: "center", color: TEXT_MUTED }}>Loading performers...</div>
            ) : performers.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: TEXT_MUTED }}>No player events for this match.</div>
            ) : (
              <>
                <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 60px 80px 50px 50px 50px",
                    padding: "10px 14px",
                    background: BG_SURFACE,
                    fontSize: 11,
                    fontWeight: 600,
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    gap: 8,
                  }}>
                    <div>Player</div>
                    <div>Pos</div>
                    <div style={{ textAlign: "right" }}>Match Pts</div>
                    <div style={{ textAlign: "center" }}>3</div>
                    <div style={{ textAlign: "center" }}>2</div>
                    <div style={{ textAlign: "center" }}>1</div>
                  </div>

                  {performers.slice(0, 15).map((p, i) => (
                    <div key={p.playerId} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 60px 80px 50px 50px 50px",
                      padding: "10px 14px",
                      background: i % 2 === 0 ? BG_CARD : BG_DARK,
                      fontSize: 13,
                      gap: 8,
                      alignItems: "center",
                      borderBottom: `1px solid ${BORDER}22`,
                    }}>
                      <div style={{ fontWeight: 600 }}>{p.playerName}</div>
                      <div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                          background: `${POS_COLORS[p.position] || TEXT_MUTED}22`,
                          color: POS_COLORS[p.position] || TEXT_MUTED,
                        }}>{p.position}</span>
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{p.matchPoints}</div>
                      {[3, 2, 1].map((pts) => (
                        <div key={pts} style={{ textAlign: "center" }}>
                          <button
                            onClick={() => toggleBonus(p.playerId, pts)}
                            style={{
                              width: 30, height: 30, borderRadius: "50%",
                              border: bonusAssignments[p.playerId] === pts ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                              background: bonusAssignments[p.playerId] === pts ? ACCENT : "transparent",
                              color: bonusAssignments[p.playerId] === pts ? "#000" : TEXT_MUTED,
                              fontWeight: 700, fontSize: 12, cursor: "pointer",
                            }}
                          >
                            {pts}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Summary + Save */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {Object.keys(bonusAssignments).length === 0
                      ? "Click circles to assign bonus points"
                      : `${Object.keys(bonusAssignments).length} player(s) assigned bonus`}
                  </div>
                  <button
                    onClick={saveBonus}
                    disabled={saving}
                    style={{ ...btnGreen, opacity: saving ? 0.5 : 1 }}
                  >
                    {saving ? "Saving..." : "Save Bonus Points"}
                  </button>
                </div>

                {message && (
                  <div style={{
                    marginTop: 12, padding: 10, borderRadius: 8, fontSize: 13,
                    background: message.type === "success" ? `${SUCCESS}15` : `${ERROR}15`,
                    color: message.type === "success" ? SUCCESS : ERROR,
                    border: `1px solid ${message.type === "success" ? SUCCESS : ERROR}44`,
                  }}>
                    {message.text}
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
