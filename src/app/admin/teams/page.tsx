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

type Team = {
  id: number;
  team_uuid: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  team_code: string | null;
  playerCount: number;
};

export default function AdminTeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Inline add form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addShort, setAddShort] = useState("");
  const [addLogo, setAddLogo] = useState("");
  const [adding, setAdding] = useState(false);

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; short_name: string; logo_url: string }>({ name: "", short_name: "", logo_url: "" });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Messages
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setTeams(json.teams ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const filtered = teams.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.short_name.toLowerCase().includes(q);
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addShort.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), short_name: addShort.trim(), logo_url: addLogo.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      setMsg({ type: "ok", text: `${addName.trim()} created!` });
      setAddName("");
      setAddShort("");
      setAddLogo("");
      setShowAdd(false);
      await loadTeams();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Failed to create team" });
    } finally {
      setAdding(false);
    }
  }

  function startEdit(t: Team) {
    setEditingId(t.team_uuid);
    setEditData({ name: t.name, short_name: t.short_name, logo_url: t.logo_url || "" });
    setMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({ name: "", short_name: "", logo_url: "" });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_uuid: editingId,
          name: editData.name,
          short_name: editData.short_name,
          logo_url: editData.logo_url || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setMsg({ type: "ok", text: "Team updated!" });
      cancelEdit();
      await loadTeams();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/teams?team_uuid=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      setMsg({ type: "ok", text: "Team deleted." });
      setDeleteId(null);
      await loadTeams();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Delete failed" });
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
            background: `linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            🏟️
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Team Management</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
              Browse, edit & manage clubs
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowAdd(!showAdd); setMsg(null); }}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
              color: "#000", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {showAdd ? "Cancel" : "+ Add Club"}
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

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>

        {/* Inline Add Form */}
        {showAdd && (
          <form onSubmit={handleAdd} style={{
            padding: "20px",
            backgroundColor: BG_CARD,
            border: `1px solid ${ACCENT}30`,
            borderRadius: 12,
            marginBottom: 20,
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>New Club</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Club Name *</label>
                <input
                  type="text" required value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Kampala Warriors"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Short *</label>
                <input
                  type="text" required maxLength={5} value={addShort}
                  onChange={(e) => setAddShort(e.target.value)}
                  placeholder="KAW"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Logo URL</label>
                <input
                  type="text" value={addLogo}
                  onChange={(e) => setAddLogo(e.target.value)}
                  placeholder="https://..."
                  style={inputStyle}
                />
              </div>
            </div>
            <button type="submit" disabled={adding} style={btnGreen}>
              {adding ? "Creating..." : "Create Club"}
            </button>
          </form>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search clubs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16, maxWidth: "100%" }}
        />

        {/* Messages */}
        {msg && (
          <div style={{
            padding: "10px 16px", borderRadius: 8, marginBottom: 16,
            backgroundColor: msg.type === "ok" ? `${SUCCESS}15` : `${ERROR}15`,
            border: `1px solid ${msg.type === "ok" ? SUCCESS : ERROR}30`,
            color: msg.type === "ok" ? SUCCESS : ERROR,
            fontSize: 13, fontWeight: 500,
          }}>
            {msg.text}
          </div>
        )}

        {/* Teams List */}
        <div style={{
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* Table Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 80px 80px 100px",
            gap: 8,
            padding: "12px 16px",
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 11,
            fontWeight: 600,
            color: TEXT_MUTED,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}>
            <span>Short</span>
            <span>Club Name</span>
            <span>Players</span>
            <span>Logo</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>Loading teams...</div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: "center", color: ERROR, fontSize: 13 }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>
              {teams.length === 0 ? "No clubs yet. Add one above." : "No clubs match your search."}
            </div>
          ) : (
            filtered.map((t) => {
              const isEditing = editingId === t.team_uuid;
              const isDelTarget = deleteId === t.team_uuid;

              // Edit row
              if (isEditing) {
                return (
                  <div key={t.team_uuid} style={{
                    padding: "14px 16px",
                    backgroundColor: `${ACCENT}08`,
                    borderBottom: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>Club Name</label>
                        <input
                          type="text" value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Short</label>
                        <input
                          type="text" maxLength={5} value={editData.short_name}
                          onChange={(e) => setEditData({ ...editData, short_name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Logo URL</label>
                        <input
                          type="text" value={editData.logo_url}
                          onChange={(e) => setEditData({ ...editData, logo_url: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
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
                  <div key={t.team_uuid} style={{
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
                      Delete <strong>{t.name}</strong>? {t.playerCount > 0 && `(${t.playerCount} players still assigned)`}
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
                  key={t.team_uuid}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 80px 80px 100px",
                    gap: 8,
                    padding: "12px 16px",
                    borderBottom: `1px solid ${BORDER}`,
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  {/* Short name badge */}
                  <span style={{
                    display: "inline-block",
                    padding: "3px 8px", borderRadius: 4,
                    backgroundColor: `#8B5CF618`,
                    color: "#A78BFA",
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                    textAlign: "center",
                    width: "fit-content",
                  }}>
                    {t.short_name}
                  </span>

                  {/* Name */}
                  <span style={{ fontWeight: 600, color: TEXT_PRIMARY }}>{t.name}</span>

                  {/* Player count */}
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: t.playerCount > 0 ? ACCENT : TEXT_MUTED,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {t.playerCount}
                  </span>

                  {/* Logo */}
                  <span style={{ fontSize: 11, color: t.logo_url ? SUCCESS : TEXT_MUTED }}>
                    {t.logo_url ? "Set" : "None"}
                  </span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button onClick={() => startEdit(t)} style={btnSmall}>Edit</button>
                    <button onClick={() => { setDeleteId(t.team_uuid); setMsg(null); }} style={{ ...btnSmall, color: ERROR }}>Del</button>
                  </div>
                </div>
              );
            })
          )}

          {/* Footer */}
          {!loading && !error && (
            <div style={{ padding: "10px 16px", fontSize: 11, color: TEXT_MUTED, borderTop: `1px solid ${BORDER}` }}>
              {filtered.length} club{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== teams.length && ` (of ${teams.length} total)`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 6,
  border: "1px solid #1E293B", backgroundColor: "#1A2236",
  color: "#F1F5F9", fontSize: 13, fontFamily: "'Outfit', system-ui, sans-serif",
  outline: "none",
};

const btnGreen: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, border: "none",
  background: "linear-gradient(135deg, #00E676 0%, #00C853 100%)",
  color: "#000", fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
};

const btnMuted: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6,
  border: "1px solid #1E293B", backgroundColor: "transparent",
  color: "#64748B", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
};

const btnDanger: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, border: "none",
  backgroundColor: "#EF4444", color: "#fff", fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
};

const btnSmall: React.CSSProperties = {
  padding: "5px 10px", borderRadius: 6,
  border: "1px solid #1E293B", backgroundColor: "transparent",
  color: "#64748B", fontSize: 11, fontWeight: 600,
  cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
};
