"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING,
  inputStyle, btnGreen, btnMuted, btnDanger, globalResetCSS,
} from "@/lib/admin-theme";

interface User {
  userId: string;
  teamName: string;
  totalPoints: number;
  currentGwPoints: number;
  gwsPlayed: number;
  transfersUsed: number;
  chipsUsed: number;
}

interface RosterEntry {
  playerId: string;
  playerName: string;
  position: string;
  isStarting: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  multiplier: number;
}

interface Transfer {
  gameweek_id: number;
  player_out_id: string;
  player_in_id: string;
  created_at: string;
}

interface Chip {
  gameweek_id: number;
  chip: string;
  activated_at: string;
}

interface GwScore {
  gameweek_id: number;
  total_weekly_points: number;
}

interface UserDetail {
  teamName: string;
  roster: RosterEntry[];
  transfers: Transfer[];
  chips: Chip[];
  gwScores: GwScore[];
}

const POS_COLORS: Record<string, string> = {
  GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentGwId, setCurrentGwId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Expanded user detail
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"roster" | "transfers" | "chips" | "scores">("roster");

  // Edit team name
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
      setCurrentGwId(data.currentGwId ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setDetail(null);
      return;
    }
    setExpandedUserId(userId);
    setDetail(null);
    setDetailLoading(true);
    setDetailTab("roster");
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error("Failed to load detail");
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveTeamName(userId: string) {
    if (!editNameValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editNameValue.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, teamName: editNameValue.trim() } : u))
      );
      setEditingName(null);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter((u) =>
    u.teamName.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Fantasy Managers</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>
            {users.length} manager{users.length !== 1 ? "s" : ""} registered
            {currentGwId ? ` · GW ${currentGwId}` : ""}
          </p>

          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              placeholder="Search by team name or user ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, maxWidth: 400 }}
            />
          </div>

          {error && (
            <div style={{ padding: 12, borderRadius: 8, background: `${ERROR}22`, border: `1px solid ${ERROR}44`, color: ERROR, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: TEXT_MUTED }}>Loading managers...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: TEXT_MUTED }}>
              {search ? "No managers match your search." : "No fantasy managers found."}
            </div>
          ) : (
            <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {/* Table Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 100px 100px 80px 80px 60px",
                padding: "10px 14px",
                background: BG_SURFACE,
                fontSize: 11,
                fontWeight: 600,
                color: TEXT_MUTED,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                gap: 8,
              }}>
                <div>#</div>
                <div>Team Name</div>
                <div style={{ textAlign: "right" }}>Total Pts</div>
                <div style={{ textAlign: "right" }}>GW Pts</div>
                <div style={{ textAlign: "right" }}>GWs</div>
                <div style={{ textAlign: "right" }}>Transfers</div>
                <div style={{ textAlign: "right" }}>Chips</div>
              </div>

              {/* Rows */}
              {filtered.map((u, i) => (
                <div key={u.userId}>
                  <div
                    onClick={() => toggleExpand(u.userId)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 100px 100px 80px 80px 60px",
                      padding: "12px 14px",
                      background: expandedUserId === u.userId ? BG_SURFACE : i % 2 === 0 ? BG_CARD : BG_DARK,
                      fontSize: 13,
                      cursor: "pointer",
                      gap: 8,
                      alignItems: "center",
                      borderBottom: `1px solid ${BORDER}`,
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{ color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{i + 1}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {editingName === u.userId ? (
                        <div style={{ display: "flex", gap: 6, flex: 1 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveTeamName(u.userId)}
                            style={{ ...inputStyle, flex: 1, maxWidth: 200 }}
                            autoFocus
                          />
                          <button onClick={() => saveTeamName(u.userId)} disabled={saving} style={{ ...btnGreen, padding: "5px 10px", fontSize: 11 }}>
                            {saving ? "..." : "Save"}
                          </button>
                          <button onClick={() => setEditingName(null)} style={{ ...btnMuted, padding: "5px 10px", fontSize: 11 }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600 }}>{u.teamName}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingName(u.userId); setEditNameValue(u.teamName); }}
                            style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 12, padding: 2 }}
                            title="Edit team name"
                          >✎</button>
                        </>
                      )}
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT }}>{u.totalPoints}</div>
                    <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{u.currentGwPoints}</div>
                    <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY }}>{u.gwsPlayed}</div>
                    <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY }}>{u.transfersUsed}</div>
                    <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY }}>{u.chipsUsed}</div>
                  </div>

                  {/* Expanded Detail */}
                  {expandedUserId === u.userId && (
                    <div style={{ background: BG_SURFACE, padding: "16px 14px", borderBottom: `1px solid ${BORDER}` }}>
                      {detailLoading ? (
                        <div style={{ color: TEXT_MUTED, padding: 20, textAlign: "center" }}>Loading detail...</div>
                      ) : !detail ? (
                        <div style={{ color: TEXT_MUTED, padding: 20, textAlign: "center" }}>Failed to load detail.</div>
                      ) : (
                        <>
                          {/* Tabs */}
                          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                            {(["roster", "transfers", "chips", "scores"] as const).map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setDetailTab(tab)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: detailTab === tab ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                                  background: detailTab === tab ? `${ACCENT}18` : "transparent",
                                  color: detailTab === tab ? ACCENT : TEXT_MUTED,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  textTransform: "capitalize",
                                }}
                              >
                                {tab === "scores" ? "GW Scores" : tab}
                                {tab === "roster" && ` (${detail.roster.length})`}
                                {tab === "transfers" && ` (${detail.transfers.length})`}
                                {tab === "chips" && ` (${detail.chips.length})`}
                              </button>
                            ))}
                          </div>

                          {/* Roster Tab */}
                          {detailTab === "roster" && (
                            detail.roster.length === 0 ? (
                              <div style={{ color: TEXT_MUTED, fontSize: 13 }}>No roster for current GW.</div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                                {detail.roster
                                  .sort((a, b) => {
                                    const order = ["GK", "DEF", "MID", "FWD"];
                                    return (order.indexOf(a.position) - order.indexOf(b.position)) || a.playerName.localeCompare(b.playerName);
                                  })
                                  .map((r) => (
                                    <div key={r.playerId} style={{
                                      padding: "8px 10px",
                                      borderRadius: 8,
                                      background: BG_CARD,
                                      border: `1px solid ${r.isStarting ? BORDER : `${TEXT_MUTED}44`}`,
                                      opacity: r.isStarting ? 1 : 0.6,
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{
                                          fontSize: 9,
                                          fontWeight: 700,
                                          padding: "2px 5px",
                                          borderRadius: 4,
                                          background: `${POS_COLORS[r.position] || TEXT_MUTED}22`,
                                          color: POS_COLORS[r.position] || TEXT_MUTED,
                                        }}>{r.position}</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.playerName}</span>
                                        {r.isCaptain && <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "1px 5px", borderRadius: 4 }}>C</span>}
                                        {r.isViceCaptain && <span style={{ fontSize: 10, fontWeight: 700, color: WARNING, background: `${WARNING}22`, padding: "1px 5px", borderRadius: 4 }}>VC</span>}
                                      </div>
                                      <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
                                        {r.isStarting ? "Starting IX" : "Bench"}{r.multiplier > 1 ? ` · ×${r.multiplier}` : ""}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )
                          )}

                          {/* Transfers Tab */}
                          {detailTab === "transfers" && (
                            detail.transfers.length === 0 ? (
                              <div style={{ color: TEXT_MUTED, fontSize: 13 }}>No transfers recorded.</div>
                            ) : (
                              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ color: TEXT_MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` }}>GW</th>
                                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` }}>Out</th>
                                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` }}>In</th>
                                      <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` }}>Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.transfers.map((t, i) => (
                                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                                        <td style={{ padding: "6px 8px", color: TEXT_SECONDARY }}>GW {t.gameweek_id}</td>
                                        <td style={{ padding: "6px 8px", color: ERROR, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{t.player_out_id.slice(0, 8)}...</td>
                                        <td style={{ padding: "6px 8px", color: SUCCESS, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{t.player_in_id.slice(0, 8)}...</td>
                                        <td style={{ padding: "6px 8px", textAlign: "right", color: TEXT_MUTED }}>{new Date(t.created_at).toLocaleDateString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          )}

                          {/* Chips Tab */}
                          {detailTab === "chips" && (
                            detail.chips.length === 0 ? (
                              <div style={{ color: TEXT_MUTED, fontSize: 13 }}>No chips used.</div>
                            ) : (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {detail.chips.map((c, i) => (
                                  <div key={i} style={{
                                    padding: "8px 14px",
                                    borderRadius: 8,
                                    background: BG_CARD,
                                    border: `1px solid ${BORDER}`,
                                  }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: WARNING, textTransform: "uppercase" }}>{c.chip}</div>
                                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                                      GW {c.gameweek_id} · {new Date(c.activated_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          )}

                          {/* GW Scores Tab */}
                          {detailTab === "scores" && (
                            detail.gwScores.length === 0 ? (
                              <div style={{ color: TEXT_MUTED, fontSize: 13 }}>No scores recorded.</div>
                            ) : (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
                                {detail.gwScores.map((s) => {
                                  const max = Math.max(...detail.gwScores.map((x) => x.total_weekly_points), 1);
                                  const heightPct = (s.total_weekly_points / max) * 100;
                                  return (
                                    <div key={s.gameweek_id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY }}>{s.total_weekly_points}</span>
                                      <div style={{
                                        width: 28,
                                        height: Math.max(heightPct * 1.2, 4),
                                        borderRadius: 4,
                                        background: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT}44 100%)`,
                                      }} />
                                      <span style={{ fontSize: 9, color: TEXT_MUTED }}>GW{s.gameweek_id}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          )}

                          {/* User ID for reference */}
                          <div style={{ marginTop: 12, fontSize: 10, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                            User ID: {u.userId}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
