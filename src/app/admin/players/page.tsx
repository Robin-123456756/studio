"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Theme — matches admin dashboard
const BG_DARK = "#0A0F1C";
const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const ACCENT_DIM = "#00C853";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#CBD5E1";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";

type Team = {
  id: number;
  name: string;
  short_name: string;
};

type Player = {
  id: string;
  name: string;
  fullName: string;
  position: string;
  price: number;
  points: number;
  avatarUrl: string | null;
  isLady: boolean;
  teamId: number;
  teamName: string | null;
  teamShort: string | null;
  status: string;
};

const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;

const POS_COLORS: Record<string, string> = {
  GK: "#F59E0B",
  DEF: "#3B82F6",
  MID: "#10B981",
  FWD: "#EF4444",
};

const STATUS_COLORS: Record<string, string> = {
  available: "#10B981",
  injured: "#EF4444",
  suspended: "#F59E0B",
  unavailable: "#64748B",
};

const STATUS_LABELS = ["available", "injured", "suspended", "unavailable"] as const;

const POS_LABELS: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

function formatPrice(v: number) {
  return `${v.toFixed(1)}m`;
}

export default function AdminPlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterPos, setFilterPos] = useState<string>("ALL");
  const [filterTeam, setFilterTeam] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Player & { web_name: string; status: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Avatar upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/players");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setPlayers(json.players ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const json = await res.json();
      if (Array.isArray(json)) {
        setTeams(json.map((t: any) => ({ id: t.id, name: t.name, short_name: t.short_name ?? t.shortName ?? "" })));
      } else if (json.teams) {
        setTeams(json.teams.map((t: any) => ({ id: t.id, name: t.name, short_name: t.short_name ?? t.shortName ?? "" })));
      }
    } catch {
      // Teams load is non-critical
    }
  }, []);

  useEffect(() => {
    loadPlayers();
    loadTeams();
  }, [loadPlayers, loadTeams]);

  // Filter logic
  const filtered = players.filter((p) => {
    if (filterPos !== "ALL" && p.position !== filterPos) return false;
    if (filterTeam !== "ALL" && String(p.teamId) !== filterTeam) return false;
    if (filterStatus !== "ALL" && (p.status || "available") !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesName = (p.fullName || p.name || "").toLowerCase().includes(q);
      const matchesTeam = (p.teamName || "").toLowerCase().includes(q);
      if (!matchesName && !matchesTeam) return false;
    }
    return true;
  });

  // Counts per position
  const posCounts = { ALL: players.length, GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) {
    if (p.position in posCounts) posCounts[p.position as keyof typeof posCounts]++;
  }

  function startEdit(p: Player) {
    setEditingId(p.id);
    setEditData({
      name: p.fullName || p.name,
      web_name: p.name,
      position: p.position,
      price: p.price,
      teamId: p.teamId,
      isLady: p.isLady,
      status: p.status || "available",
    });
    setSaveMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
    setSaveMsg(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editData.name,
          web_name: editData.web_name,
          position: editData.position,
          now_cost: editData.price,
          team_id: editData.teamId,
          is_lady: editData.isLady,
          status: editData.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSaveMsg({ type: "ok", text: "Saved!" });
      setEditingId(null);
      setEditData({});
      await loadPlayers();
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/players?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      setDeleteId(null);
      await loadPlayers();
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e?.message || "Delete failed" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${BORDER}`,
        backgroundColor: BG_CARD,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, #EC4899 0%, #A855F7 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            👥
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Player Management</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
              Browse, edit prices, positions & details
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/dashboard/admin/players/new")}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
              color: "#000", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            + Add Player
          </button>
          <button
            onClick={() => router.push("/admin")}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: `1px solid ${BORDER}`, backgroundColor: "transparent",
              color: TEXT_MUTED, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
          {(["ALL", ...POSITIONS] as const).map((pos) => {
            const count = pos === "ALL" ? posCounts.ALL : posCounts[pos];
            const isActive = filterPos === pos;
            return (
              <button
                key={pos}
                onClick={() => setFilterPos(pos)}
                style={{
                  padding: "12px 10px",
                  backgroundColor: isActive ? BG_SURFACE : BG_CARD,
                  border: `1px solid ${isActive ? (pos === "ALL" ? ACCENT : POS_COLORS[pos]) + "60" : BORDER}`,
                  borderRadius: 10,
                  textAlign: "center",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: TEXT_PRIMARY,
                }}
              >
                <div style={{
                  fontSize: 20, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: pos === "ALL" ? ACCENT : POS_COLORS[pos],
                }}>
                  {count}
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 500, marginTop: 2 }}>
                  {pos === "ALL" ? "All Players" : POS_LABELS[pos] + "s"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Search + Team Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by name or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 240px", padding: "10px 14px", borderRadius: 8,
              border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
              color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit",
              outline: "none",
            }}
          />
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{
              padding: "10px 14px", borderRadius: 8,
              border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
              color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit",
              outline: "none", minWidth: 160,
            }}
          >
            <option value="ALL">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "10px 14px", borderRadius: 8,
              border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
              color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit",
              outline: "none", minWidth: 140,
            }}
          >
            <option value="ALL">All Status</option>
            {STATUS_LABELS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Global messages */}
        {saveMsg && (
          <div style={{
            padding: "10px 16px", borderRadius: 8, marginBottom: 16,
            backgroundColor: saveMsg.type === "ok" ? `${SUCCESS}15` : `${ERROR}15`,
            border: `1px solid ${saveMsg.type === "ok" ? SUCCESS : ERROR}30`,
            color: saveMsg.type === "ok" ? SUCCESS : ERROR,
            fontSize: 13, fontWeight: 500,
          }}>
            {saveMsg.text}
          </div>
        )}

        {/* Player List */}
        <div style={{
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* Table Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 140px 70px 50px 100px",
            gap: 8,
            padding: "12px 16px",
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 11,
            fontWeight: 600,
            color: TEXT_MUTED,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}>
            <span>Player</span>
            <span>Pos</span>
            <span>Team</span>
            <span>Price</span>
            <span>Pts</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>Loading players...</div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: "center", color: ERROR, fontSize: 13 }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>
              {players.length === 0 ? "No players yet. Add one above." : "No players match your filters."}
            </div>
          ) : (
            filtered.map((p) => {
              const isEditing = editingId === p.id;
              const isDelTarget = deleteId === p.id;

              // Edit row
              if (isEditing) {
                return (
                  <div key={p.id} style={{
                    padding: "14px 16px",
                    backgroundColor: `${ACCENT}08`,
                    borderBottom: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      {/* Full name */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                        <input
                          type="text"
                          value={editData.name || ""}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      {/* Web name */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Display Name</label>
                        <input
                          type="text"
                          value={editData.web_name || ""}
                          onChange={(e) => setEditData({ ...editData, web_name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                      {/* Position */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Position</label>
                        <select
                          value={editData.position || ""}
                          onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                          style={inputStyle}
                        >
                          {POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>{POS_LABELS[pos]}</option>
                          ))}
                        </select>
                      </div>
                      {/* Team */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Team</label>
                        <select
                          value={String(editData.teamId || "")}
                          onChange={(e) => setEditData({ ...editData, teamId: Number(e.target.value) })}
                          style={inputStyle}
                        >
                          {teams.map((t) => (
                            <option key={t.id} value={String(t.id)}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      {/* Price */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Price (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={editData.price ?? ""}
                          onChange={(e) => setEditData({ ...editData, price: parseFloat(e.target.value) || 0 })}
                          style={inputStyle}
                        />
                      </div>
                      {/* Status */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Status</label>
                        <select
                          value={editData.status || "available"}
                          onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                          style={inputStyle}
                        >
                          {STATUS_LABELS.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                      {/* Lady toggle */}
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!editData.isLady}
                          onChange={(e) => setEditData({ ...editData, isLady: e.target.checked })}
                          style={{ width: 16, height: 16, accentColor: ACCENT }}
                        />
                        <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Lady</span>
                      </label>

                      {/* Avatar Upload */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                        {p.avatarUrl && (
                          <img
                            src={p.avatarUrl}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: `1px solid ${BORDER}` }}
                          />
                        )}
                        <label style={{
                          padding: "5px 12px", borderRadius: 6,
                          border: `1px solid ${BORDER}`, backgroundColor: "transparent",
                          color: TEXT_MUTED, fontSize: 11, fontWeight: 600,
                          cursor: uploading ? "wait" : "pointer", fontFamily: "inherit",
                          opacity: uploading ? 0.5 : 1,
                        }}>
                          {uploading ? "Uploading..." : "Upload Photo"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            disabled={uploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(true);
                              setUploadMsg(null);
                              try {
                                const fd = new FormData();
                                fd.append("file", file);
                                fd.append("playerId", p.id);
                                const res = await fetch("/api/admin/players/upload-avatar", { method: "POST", body: fd });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Upload failed");
                                setUploadMsg({ type: "ok", text: "Photo uploaded!" });
                                await loadPlayers();
                              } catch (err: any) {
                                setUploadMsg({ type: "err", text: err.message });
                              } finally {
                                setUploading(false);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    {uploadMsg && editingId === p.id && (
                      <div style={{
                        marginTop: 6, fontSize: 11, fontWeight: 500,
                        color: uploadMsg.type === "ok" ? SUCCESS : ERROR,
                      }}>
                        {uploadMsg.text}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={saveEdit} disabled={saving} style={btnGreen}>
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={btnMuted}>Cancel</button>
                    </div>
                  </div>
                );
              }

              // Delete confirmation
              if (isDelTarget) {
                return (
                  <div key={p.id} style={{
                    padding: "14px 16px",
                    backgroundColor: `${ERROR}08`,
                    borderBottom: `1px solid ${BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>
                      Delete <strong>{p.fullName || p.name}</strong>? This cannot be undone.
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={confirmDelete} disabled={deleting} style={btnDanger}>
                        {deleting ? "Deleting..." : "Yes, Delete"}
                      </button>
                      <button onClick={() => setDeleteId(null)} style={btnMuted}>Cancel</button>
                    </div>
                  </div>
                );
              }

              // Normal row
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 140px 70px 50px 100px",
                    gap: 8,
                    padding: "12px 16px",
                    borderBottom: `1px solid ${BORDER}`,
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  {/* Player */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.fullName || p.name}
                      {p.isLady && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: "#EC4899", fontWeight: 700 }}>LADY</span>
                      )}
                      {p.status && p.status !== "available" && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                          padding: "1px 5px", borderRadius: 3,
                          backgroundColor: `${STATUS_COLORS[p.status] || TEXT_MUTED}18`,
                          color: STATUS_COLORS[p.status] || TEXT_MUTED,
                          textTransform: "uppercase" as const,
                        }}>
                          {p.status}
                        </span>
                      )}
                    </div>
                    {p.fullName && p.name !== p.fullName && (
                      <div style={{ fontSize: 11, color: TEXT_MUTED }}>{p.name}</div>
                    )}
                  </div>

                  {/* Position */}
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px", borderRadius: 4,
                    backgroundColor: `${POS_COLORS[p.position] || TEXT_MUTED}18`,
                    color: POS_COLORS[p.position] || TEXT_MUTED,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                    width: "fit-content",
                  }}>
                    {p.position}
                  </span>

                  {/* Team */}
                  <span style={{ color: TEXT_SECONDARY, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.teamName || `Team ${p.teamId}`}
                  </span>

                  {/* Price */}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: ACCENT, fontSize: 12 }}>
                    {formatPrice(p.price)}
                  </span>

                  {/* Points */}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY, fontSize: 12 }}>
                    {p.points}
                  </span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => startEdit(p)}
                      style={{
                        padding: "5px 10px", borderRadius: 6,
                        border: `1px solid ${BORDER}`, backgroundColor: "transparent",
                        color: TEXT_MUTED, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setDeleteId(p.id); setSaveMsg(null); }}
                      style={{
                        padding: "5px 10px", borderRadius: 6,
                        border: `1px solid ${BORDER}`, backgroundColor: "transparent",
                        color: ERROR, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Del
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Footer count */}
          {!loading && !error && (
            <div style={{ padding: "10px 16px", fontSize: 11, color: TEXT_MUTED, borderTop: `1px solid ${BORDER}` }}>
              Showing {filtered.length} of {players.length} players
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared input style
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: BG_SURFACE,
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontFamily: "'Outfit', system-ui, sans-serif",
  outline: "none",
};

const btnGreen: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
  color: "#000",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

const btnMuted: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: "transparent",
  color: TEXT_MUTED,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

const btnDanger: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  backgroundColor: ERROR,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};
