"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const BG_DARK = "#0A0F1C";
const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#CBD5E1";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";

interface Team {
  team_uuid: string;
  name: string;
  short_name: string;
}

interface Event {
  id: number;
  type: "match" | "tournament" | "cup" | "friendly";
  title: string;
  description: string | null;
  gameweek_id: number | null;
  home_team_uuid: string | null;
  away_team_uuid: string | null;
  home_team?: string;
  away_team?: string;
  venue: string | null;
  kickoff_time: string | null;
  is_played: boolean;
}

type TabType = "schedule_match" | "create_event" | "upcoming";

export default function AdminFixturesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("schedule_match");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Match form state
  const [matchForm, setMatchForm] = useState({
    gameweek_id: "",
    home_team_uuid: "",
    away_team_uuid: "",
    kickoff_time: "",
    venue: "",
  });

  // Event form state
  const [eventForm, setEventForm] = useState({
    type: "tournament" as "tournament" | "cup" | "friendly",
    title: "",
    description: "",
    kickoff_time: "",
    venue: "",
    home_team_uuid: "",
    away_team_uuid: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [teamsRes, eventsRes] = await Promise.all([
          fetch("/api/admin/fixtures?type=teams"),
          fetch("/api/admin/fixtures?type=events"),
        ]);
        if (teamsRes.ok) {
          const t = await teamsRes.json();
          setTeams(t.teams || []);
        }
        if (eventsRes.ok) {
          const e = await eventsRes.json();
          setEvents(e.events || []);
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message });
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleScheduleMatch = useCallback(async () => {
    if (!matchForm.home_team_uuid || !matchForm.away_team_uuid || !matchForm.gameweek_id) {
      setFeedback({ type: "error", message: "Select both teams and gameweek" });
      return;
    }
    if (matchForm.home_team_uuid === matchForm.away_team_uuid) {
      setFeedback({ type: "error", message: "Home and away teams must be different" });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_match",
          ...matchForm,
          gameweek_id: parseInt(matchForm.gameweek_id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule match");
      setFeedback({ type: "success", message: "Match scheduled!" });
      setMatchForm({ gameweek_id: "", home_team_uuid: "", away_team_uuid: "", kickoff_time: "", venue: "" });
      // Refresh events
      const eventsRes = await fetch("/api/admin/fixtures?type=events");
      if (eventsRes.ok) {
        const e = await eventsRes.json();
        setEvents(e.events || []);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSaving(false);
  }, [matchForm]);

  const handleCreateEvent = useCallback(async () => {
    if (!eventForm.title) {
      setFeedback({ type: "error", message: "Event title is required" });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_event",
          ...eventForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      setFeedback({ type: "success", message: "Event created!" });
      setEventForm({ type: "tournament", title: "", description: "", kickoff_time: "", venue: "", home_team_uuid: "", away_team_uuid: "" });
      const eventsRes = await fetch("/api/admin/fixtures?type=events");
      if (eventsRes.ok) {
        const e = await eventsRes.json();
        setEvents(e.events || []);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSaving(false);
  }, [eventForm]);

  const handleDeleteEvent = useCallback(async (id: number) => {
    if (!confirm("Delete this event?")) return;
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setFeedback({ type: "success", message: "Event deleted" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
      " at " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
    color: TEXT_PRIMARY, fontSize: 14, fontFamily: "inherit", outline: "none",
  };

  const labelStyle = {
    display: "block" as const, fontSize: 11, fontWeight: 600, color: TEXT_MUTED,
    textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6,
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
        select option { background: ${BG_SURFACE}; color: ${TEXT_PRIMARY}; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "16px 24px", borderBottom: `1px solid ${BORDER}`,
        backgroundColor: BG_CARD, display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => router.push("/admin")}
          style={{
            background: "none", border: `1px solid ${BORDER}`, borderRadius: 8,
            color: TEXT_MUTED, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Fixtures & Events</h1>
          <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
            BUDO LEAGUE — Schedule Matches & Tournaments
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            backgroundColor: feedback.type === "success" ? `${SUCCESS}15` : `${ERROR}15`,
            border: `1px solid ${feedback.type === "success" ? SUCCESS : ERROR}40`,
            color: feedback.type === "success" ? SUCCESS : ERROR,
            fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{feedback.type === "success" ? "✅" : "⚠️"} {feedback.message}</span>
            <button onClick={() => setFeedback(null)}
              style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {([
            { key: "schedule_match", label: "⚽ Schedule Match" },
            { key: "create_event", label: "🏆 Create Event" },
            { key: "upcoming", label: "📅 Upcoming" },
          ] as { key: TabType; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 18px", borderRadius: 8,
                border: `1px solid ${activeTab === tab.key ? ACCENT + "60" : BORDER}`,
                backgroundColor: activeTab === tab.key ? `${ACCENT}15` : "transparent",
                color: activeTab === tab.key ? ACCENT : TEXT_MUTED,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Schedule Match Tab */}
        {activeTab === "schedule_match" && (
          <div style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Schedule a League Match</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Gameweek</label>
              <select
                value={matchForm.gameweek_id}
                onChange={(e) => setMatchForm((p) => ({ ...p, gameweek_id: e.target.value }))}
                style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as any }}
              >
                <option value="">Select gameweek...</option>
                {Array.from({ length: 20 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Gameweek {i + 1}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 16, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Home Team</label>
                <select
                  value={matchForm.home_team_uuid}
                  onChange={(e) => setMatchForm((p) => ({ ...p, home_team_uuid: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as any }}
                >
                  <option value="">Select...</option>
                  {teams.map((t) => (
                    <option key={t.team_uuid} value={t.team_uuid}>{t.name} ({t.short_name})</option>
                  ))}
                </select>
              </div>
              <div style={{ paddingBottom: 12, fontSize: 16, fontWeight: 700, color: TEXT_MUTED }}>VS</div>
              <div>
                <label style={labelStyle}>Away Team</label>
                <select
                  value={matchForm.away_team_uuid}
                  onChange={(e) => setMatchForm((p) => ({ ...p, away_team_uuid: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as any }}
                >
                  <option value="">Select...</option>
                  {teams.map((t) => (
                    <option key={t.team_uuid} value={t.team_uuid}>{t.name} ({t.short_name})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Kickoff Time</label>
                <input
                  type="datetime-local"
                  value={matchForm.kickoff_time}
                  onChange={(e) => setMatchForm((p) => ({ ...p, kickoff_time: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Venue</label>
                <input
                  type="text"
                  value={matchForm.venue}
                  onChange={(e) => setMatchForm((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="e.g. Budo Grounds"
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              onClick={handleScheduleMatch}
              disabled={saving}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 10,
                border: "none", backgroundColor: ACCENT, color: BG_DARK,
                fontSize: 15, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                fontFamily: "inherit", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Scheduling..." : "Schedule Match"}
            </button>
          </div>
        )}

        {/* Create Event Tab */}
        {activeTab === "create_event" && (
          <div style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Create a Tournament / Cup / Friendly</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Event Type</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm((p) => ({ ...p, type: e.target.value as any }))}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as any }}
                >
                  <option value="tournament">🏆 Tournament</option>
                  <option value="cup">🏅 Cup Match</option>
                  <option value="friendly">🤝 Friendly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Event Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Budo Cup Quarter Final"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description (optional)</label>
              <textarea
                value={eventForm.description}
                onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Details about the event..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical" as any }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 16, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Home Team (optional)</label>
                <select
                  value={eventForm.home_team_uuid}
                  onChange={(e) => setEventForm((p) => ({ ...p, home_team_uuid: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as any }}
                >
                  <option value="">Select...</option>
                  {teams.map((t) => (
                    <option key={t.team_uuid} value={t.team_uuid}>{t.name} ({t.short_name})</option>
                  ))}
                </select>
              </div>
              <div style={{ paddingBottom: 12, fontSize: 16, fontWeight: 700, color: TEXT_MUTED }}>VS</div>
              <div>
                <label style={labelStyle}>Away Team (optional)</label>
                <select
                  value={eventForm.away_team_uuid}
                  onChange={(e) => setEventForm((p) => ({ ...p, away_team_uuid: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as any }}
                >
                  <option value="">Select...</option>
                  {teams.map((t) => (
                    <option key={t.team_uuid} value={t.team_uuid}>{t.name} ({t.short_name})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={eventForm.kickoff_time}
                  onChange={(e) => setEventForm((p) => ({ ...p, kickoff_time: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Venue</label>
                <input
                  type="text"
                  value={eventForm.venue}
                  onChange={(e) => setEventForm((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="e.g. Budo Grounds"
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              onClick={handleCreateEvent}
              disabled={saving}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 10,
                border: "none", backgroundColor: WARNING, color: BG_DARK,
                fontSize: 15, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                fontFamily: "inherit", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Creating..." : "Create Event"}
            </button>
          </div>
        )}

        {/* Upcoming Tab */}
        {activeTab === "upcoming" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              Upcoming Fixtures & Events ({events.length})
            </h2>

            {events.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📅</p>
                <p>No upcoming events scheduled.</p>
              </div>
            ) : (
              events.map((event) => {
                const typeEmoji = event.type === "match" ? "⚽" : event.type === "tournament" ? "🏆" : event.type === "cup" ? "🏅" : "🤝";
                const typeColor = event.type === "match" ? ACCENT : event.type === "tournament" ? WARNING : event.type === "cup" ? "#A855F7" : "#3B82F6";

                return (
                  <div
                    key={event.id}
                    style={{
                      backgroundColor: BG_CARD, border: `1px solid ${BORDER}`,
                      borderRadius: 12, padding: "16px 20px", marginBottom: 10,
                      borderLeft: `3px solid ${typeColor}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{typeEmoji}</span>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          backgroundColor: `${typeColor}15`, color: typeColor,
                          textTransform: "uppercase",
                        }}>
                          {event.type}{event.gameweek_id ? ` · GW${event.gameweek_id}` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        style={{
                          background: "none", border: `1px solid ${ERROR}30`,
                          borderRadius: 6, color: ERROR, padding: "4px 10px",
                          fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    {event.title && (
                      <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>{event.title}</h3>
                    )}

                    {event.home_team && event.away_team && (
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                        {event.home_team} <span style={{ color: TEXT_MUTED }}>vs</span> {event.away_team}
                      </div>
                    )}

                    {event.description && (
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: TEXT_SECONDARY }}>{event.description}</p>
                    )}

                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: TEXT_MUTED }}>
                      {event.kickoff_time && (
                        <span>📅 {formatDate(event.kickoff_time)}</span>
                      )}
                      {event.venue && (
                        <span>📍 {event.venue}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}