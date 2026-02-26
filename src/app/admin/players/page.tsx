"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER,
  ACCENT, ACCENT_DIM,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  ERROR, SUCCESS, WARNING,
  inputStyle, btnGreen, btnMuted, btnDanger, btnSmall, labelStyle,
  globalResetCSS,
} from "@/lib/admin-theme";

type Team = {
  id: number;
  team_uuid: string;
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
  teamId: string; // UUID (players.team_id → teams.team_uuid)
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
  const [editData, setEditData] = useState<Partial<{
    name: string;
    web_name: string;
    position: string;
    price: number;
    teamId: string; // UUID
    isLady: boolean;
    status: string;
  }>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Avatar upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Add Player form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addData, setAddData] = useState({
    name: "",
    web_name: "",
    position: "MID",
    team_id: "",
    now_cost: 5.0,
    is_lady: false,
    status: "available",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
      const raw = Array.isArray(json) ? json : json.teams ?? [];
      setTeams(
        raw.map((t: any) => ({
          id: t.id,
          team_uuid: t.team_uuid,
          name: t.name,
          short_name: t.short_name ?? t.shortName ?? "",
        }))
      );
    } catch {
      // Teams load is non-critical
    }
  }, []);

  useEffect(() => {
    loadPlayers();
    loadTeams();
  }, [loadPlayers, loadTeams]);

  // Filter logic — team filter uses team_uuid
  const filtered = players.filter((p) => {
    if (filterPos !== "ALL" && p.position !== filterPos) return false;
    if (filterTeam !== "ALL" && p.teamId !== filterTeam) return false;
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

  // --- Add Player ---
  async function handleAddPlayer() {
    if (!addData.name.trim() || !addData.position || !addData.team_id) {
      setAddMsg({ type: "err", text: "Name, position, and team are required." });
      return;
    }
    setAddSaving(true);
    setAddMsg(null);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: addData.name.trim(),
          web_name: addData.web_name.trim() || undefined,
          position: addData.position,
          team_id: addData.team_id,
          now_cost: addData.now_cost,
          is_lady: addData.is_lady,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create player");
      setAddMsg({ type: "ok", text: `Created ${json.name || addData.name}!` });
      setAddData({ name: "", web_name: "", position: "MID", team_id: "", now_cost: 5.0, is_lady: false, status: "available" });
      await loadPlayers();
      // Keep form open briefly so user sees success, then collapse
      setTimeout(() => { setShowAddForm(false); setAddMsg(null); }, 1500);
    } catch (e: any) {
      setAddMsg({ type: "err", text: e?.message || "Create failed" });
    } finally {
      setAddSaving(false);
    }
  }

  // --- Edit ---
  function startEdit(p: Player) {
    setEditingId(p.id);
    setEditData({
      name: p.fullName || p.name,
      web_name: p.name,
      position: p.position,
      price: p.price,
      teamId: p.teamId, // UUID
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
          team_id: editData.teamId, // UUID
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

  // --- Delete ---
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
      <style>{globalResetCSS(BG_DARK)}</style>

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              ...btnGreen,
              padding: "8px 16px",
              fontSize: 12,
              background: showAddForm
                ? `linear-gradient(135deg, ${WARNING} 0%, #D97706 100%)`
                : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
            }}
          >
            {showAddForm ? "− Close Form" : "+ Add Player"}
          </button>
          <button
            onClick={() => router.push("/admin/players/import")}
            style={{ ...btnSmall, padding: "8px 16px", fontSize: 12 }}
          >
            Import CSV
          </button>
          <button
            onClick={() => router.push("/admin")}
            style={{ ...btnSmall, padding: "8px 16px", fontSize: 12 }}
          >
            ← Back
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Add Player Form (collapsible) */}
        {showAddForm && (
          <div style={{
            backgroundColor: BG_CARD,
            border: `1px solid ${ACCENT}30`,
            borderRadius: 12,
            padding: "20px 16px",
            marginBottom: 20,
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: ACCENT }}>
              New Player
            </h2>

            {addMsg && (
              <div style={{
                padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                backgroundColor: addMsg.type === "ok" ? `${SUCCESS}15` : `${ERROR}15`,
                border: `1px solid ${addMsg.type === "ok" ? SUCCESS : ERROR}30`,
                color: addMsg.type === "ok" ? SUCCESS : ERROR,
                fontSize: 12, fontWeight: 500,
              }}>
                {addMsg.text}
              </div>
            )}

            {/* Row 1: Names */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={addData.name}
                  onChange={(e) => setAddData({ ...addData, name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Doe"
                  value={addData.web_name}
                  onChange={(e) => setAddData({ ...addData, web_name: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Row 2: Position + Team */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Position *</label>
                <select
                  value={addData.position}
                  onChange={(e) => setAddData({ ...addData, position: e.target.value })}
                  style={inputStyle}
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{POS_LABELS[pos]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Team *</label>
                <select
                  value={addData.team_id}
                  onChange={(e) => setAddData({ ...addData, team_id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select team...</option>
                  {teams.map((t) => (
                    <option key={t.team_uuid} value={t.team_uuid}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Price + Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Price (m)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={addData.now_cost}
                  onChange={(e) => setAddData({ ...addData, now_cost: parseFloat(e.target.value) || 5.0 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={addData.status}
                  onChange={(e) => setAddData({ ...addData, status: e.target.value })}
                  style={inputStyle}
                >
                  {STATUS_LABELS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lady toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={addData.is_lady}
                onChange={(e) => setAddData({ ...addData, is_lady: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: "#EC4899" }}
              />
              <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>Lady Player</span>
            </label>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAddPlayer} disabled={addSaving} style={btnGreen}>
                {addSaving ? "Creating..." : "Create Player"}
              </button>
              <button onClick={() => { setShowAddForm(false); setAddMsg(null); }} style={btnMuted}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10, marginBottom: 20 }}>
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
                  {pos === "ALL" ? "All" : POS_LABELS[pos] + "s"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Search + Team Filter + Status Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by name or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...inputStyle,
              flex: "1 1 200px",
              padding: "10px 14px",
              fontSize: 14,
            }}
          />
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{
              ...inputStyle,
              width: "auto",
              flex: "0 1 auto",
              padding: "10px 14px",
              fontSize: 14,
              minWidth: 140,
            }}
          >
            <option value="ALL">All Teams</option>
            {teams.map((t) => (
              <option key={t.team_uuid} value={t.team_uuid}>{t.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              ...inputStyle,
              width: "auto",
              flex: "0 1 auto",
              padding: "10px 14px",
              fontSize: 14,
              minWidth: 130,
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

        {/* Player List — mobile-friendly cards */}
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>Loading players...</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: "center", color: ERROR, fontSize: 13 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>
            {players.length === 0 ? "No players yet. Add one above." : "No players match your filters."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((p) => {
              const isEditing = editingId === p.id;
              const isDelTarget = deleteId === p.id;

              // Edit card
              if (isEditing) {
                return (
                  <div key={p.id} style={{
                    padding: "16px",
                    backgroundColor: BG_CARD,
                    border: `1px solid ${ACCENT}40`,
                    borderRadius: 12,
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>Full Name</label>
                        <input
                          type="text"
                          value={editData.name || ""}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Display Name</label>
                        <input
                          type="text"
                          value={editData.web_name || ""}
                          onChange={(e) => setEditData({ ...editData, web_name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>Position</label>
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
                      <div>
                        <label style={labelStyle}>Team</label>
                        <select
                          value={editData.teamId || ""}
                          onChange={(e) => setEditData({ ...editData, teamId: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">Select team...</option>
                          {teams.map((t) => (
                            <option key={t.team_uuid} value={t.team_uuid}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>Price (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={editData.price ?? ""}
                          onChange={(e) => setEditData({ ...editData, price: parseFloat(e.target.value) || 0 })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Status</label>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!editData.isLady}
                          onChange={(e) => setEditData({ ...editData, isLady: e.target.checked })}
                          style={{ width: 16, height: 16, accentColor: "#EC4899" }}
                        />
                        <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Lady Player</span>
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
                          ...btnSmall,
                          cursor: uploading ? "wait" : "pointer",
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
                        marginBottom: 8, fontSize: 11, fontWeight: 500,
                        color: uploadMsg.type === "ok" ? SUCCESS : ERROR,
                      }}>
                        {uploadMsg.text}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveEdit} disabled={saving} style={btnGreen}>
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={btnMuted}>Cancel</button>
                    </div>
                  </div>
                );
              }

              // Delete confirmation card
              if (isDelTarget) {
                return (
                  <div key={p.id} style={{
                    padding: "16px",
                    backgroundColor: `${ERROR}08`,
                    border: `1px solid ${ERROR}30`,
                    borderRadius: 12,
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

              // Normal player card (mobile-friendly)
              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: BG_CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                  }}
                >
                  {/* Top row: position badge + name + price */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px", borderRadius: 4,
                      backgroundColor: `${POS_COLORS[p.position] || TEXT_MUTED}18`,
                      color: POS_COLORS[p.position] || TEXT_MUTED,
                      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                      flexShrink: 0,
                    }}>
                      {p.position}
                    </span>
                    <span style={{
                      fontWeight: 600, color: TEXT_PRIMARY, fontSize: 14,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      flex: 1, minWidth: 0,
                    }}>
                      {p.fullName || p.name}
                      {p.isLady && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: "#EC4899", fontWeight: 700 }}>♀</span>
                      )}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                      color: ACCENT, fontSize: 13, flexShrink: 0,
                    }}>
                      {formatPrice(p.price)}
                    </span>
                  </div>

                  {/* Bottom row: team + status + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: TEXT_SECONDARY, fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.teamName || "No team"}
                      {p.fullName && p.name !== p.fullName && (
                        <span style={{ color: TEXT_MUTED, marginLeft: 6 }}>({p.name})</span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      padding: "2px 6px", borderRadius: 4,
                      backgroundColor: `${STATUS_COLORS[p.status] || STATUS_COLORS.available}18`,
                      color: STATUS_COLORS[p.status] || STATUS_COLORS.available,
                      textTransform: "uppercase" as const,
                      flexShrink: 0,
                    }}>
                      {p.status || "available"}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(p)}
                        style={btnSmall}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteId(p.id); setSaveMsg(null); }}
                        style={{ ...btnSmall, color: ERROR }}
                      >
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && !error && (
          <div style={{ padding: "12px 0", fontSize: 11, color: TEXT_MUTED, textAlign: "center", marginTop: 8 }}>
            Showing {filtered.length} of {players.length} players
          </div>
        )}
      </div>
    </div>
  );
}
