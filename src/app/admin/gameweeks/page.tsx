"use client";

import { useState, useEffect } from "react";
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

type Gameweek = {
  id: number;
  name: string | null;
  deadline_time: string | null;
  is_current: boolean | null;
  finalized: boolean | null;
};

function formatDeadline(iso: string | null) {
  if (!iso) return "No deadline set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  }).format(d);
}

export default function AdminGameweeksPage() {
  const router = useRouter();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [gwId, setGwId] = useState("");
  const [gwName, setGwName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadGameweeks() {
    try {
      const res = await fetch("/api/admin/gameweeks");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setGameweeks(json.gameweeks ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load gameweeks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGameweeks();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const id = Number(gwId);
    if (!Number.isFinite(id) || id < 1) {
      setFormError("Enter a valid gameweek number (1, 2, 3...)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/gameweeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: gwName.trim() || `Gameweek ${id}`,
          deadline_time: deadline || null,
          is_current: isCurrent,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");

      setFormSuccess(`Gameweek ${id} created!`);
      setGwId("");
      setGwName("");
      setDeadline("");
      setIsCurrent(false);
      await loadGameweeks();
    } catch (e: any) {
      setFormError(e?.message || "Failed to create gameweek");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleCurrent(gw: Gameweek) {
    try {
      const res = await fetch("/api/admin/gameweeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gw.id, is_current: !gw.is_current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      await loadGameweeks();
    } catch (e: any) {
      setError(e?.message || "Failed to update");
    }
  }

  async function toggleFinalized(gw: Gameweek) {
    try {
      const res = await fetch("/api/admin/gameweeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gw.id, finalized: !gw.finalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      await loadGameweeks();
    } catch (e: any) {
      setError(e?.message || "Failed to update");
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
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${WARNING} 0%, #D97706 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            📅
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Gameweeks</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
              Create & manage gameweek schedule
            </p>
          </div>
        </div>
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
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>

        {/* Create Form */}
        <div style={{
          padding: "24px",
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          marginBottom: 24,
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Add Gameweek</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {/* GW Number */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, fontWeight: 600, marginBottom: 6 }}>
                  GW Number *
                </label>
                <input
                  type="number"
                  min="1"
                  value={gwId}
                  onChange={(e) => setGwId(e.target.value)}
                  placeholder="e.g. 1"
                  required
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                    color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>

              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, fontWeight: 600, marginBottom: 6 }}>
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={gwName}
                  onChange={(e) => setGwName(e.target.value)}
                  placeholder="e.g. Gameweek 1"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                    color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Deadline */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, fontWeight: 600, marginBottom: 6 }}>
                Deadline (Kampala time)
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                  color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit",
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: TEXT_MUTED }}>
                When team picks lock for this gameweek
              </p>
            </div>

            {/* Is Current checkbox */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isCurrent}
                onChange={(e) => setIsCurrent(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: ACCENT }}
              />
              <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>Set as current gameweek</span>
            </label>

            {formError && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: ERROR }}>{formError}</p>
            )}
            {formSuccess && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: SUCCESS }}>{formSuccess}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 24px", borderRadius: 8,
                border: "none",
                background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
                color: "#000", fontSize: 14, fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Creating..." : "Create Gameweek"}
            </button>
          </form>
        </div>

        {/* Gameweeks List */}
        <div style={{
          padding: "24px",
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>
            All Gameweeks {!loading && `(${gameweeks.length})`}
          </h2>

          {loading ? (
            <p style={{ color: TEXT_MUTED, fontSize: 13 }}>Loading...</p>
          ) : error ? (
            <p style={{ color: ERROR, fontSize: 13 }}>{error}</p>
          ) : gameweeks.length === 0 ? (
            <p style={{ color: TEXT_MUTED, fontSize: 13 }}>No gameweeks yet. Create one above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gameweeks.map((gw) => (
                <div
                  key={gw.id}
                  style={{
                    padding: "14px 16px",
                    backgroundColor: BG_SURFACE,
                    border: `1px solid ${gw.is_current ? `${ACCENT}40` : BORDER}`,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 15, fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: gw.is_current ? ACCENT : TEXT_PRIMARY,
                      }}>
                        GW {gw.id}
                      </span>
                      {gw.name && gw.name !== `Gameweek ${gw.id}` && (
                        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{gw.name}</span>
                      )}
                      {gw.is_current && (
                        <span style={{
                          padding: "2px 8px", borderRadius: 4,
                          backgroundColor: `${ACCENT}15`, color: ACCENT,
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                        }}>
                          CURRENT
                        </span>
                      )}
                      {gw.finalized && (
                        <span style={{
                          padding: "2px 8px", borderRadius: 4,
                          backgroundColor: `${TEXT_MUTED}15`, color: TEXT_MUTED,
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                        }}>
                          FINALIZED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>
                      {formatDeadline(gw.deadline_time)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => toggleCurrent(gw)}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        border: `1px solid ${BORDER}`, backgroundColor: "transparent",
                        color: gw.is_current ? WARNING : TEXT_MUTED,
                        fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {gw.is_current ? "Unset Current" : "Set Current"}
                    </button>
                    <button
                      onClick={() => toggleFinalized(gw)}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        border: `1px solid ${BORDER}`, backgroundColor: "transparent",
                        color: gw.finalized ? SUCCESS : TEXT_MUTED,
                        fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {gw.finalized ? "Unfinalize" : "Finalize"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
