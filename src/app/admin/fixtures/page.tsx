"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  ERROR, WARNING, SUCCESS,
} from "@/lib/admin-theme";

const EAT_TIMEZONE = "Africa/Kampala";
const EAT_OFFSET = "+03:00";

interface Team {
  team_uuid: string;
  name: string;
  short_name: string;
}

interface Gameweek {
  id: number;
  name: string;
  deadline_time: string | null;
  is_current: boolean;
  is_next: boolean;
  finalized: boolean;
}

interface Fixture {
  id: string;
  home_team_uuid: string;
  away_team_uuid: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean;
  is_final: boolean;
  status: "final" | "played" | "scheduled";
  venue: string;
  home_team: { team_uuid: string; name: string; short_name: string; logo_url: string | null } | null;
  away_team: { team_uuid: string; name: string; short_name: string; logo_url: string | null } | null;
  gameweek: { id: number; name: string } | null;
}

type TabType = "schedule_match" | "create_event" | "schedule";

function toIsoAssumingEAT(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  const normalized = hasZone ? raw : `${raw}${EAT_OFFSET}`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function AdminFixturesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [allMatches, setAllMatches] = useState<Fixture[]>([]);
  const [expandedGws, setExpandedGws] = useState<Set<number>>(new Set());
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
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

  // Load teams and gameweeks on mount
  useEffect(() => {
    async function load() {
      try {
        const [teamsRes, gwRes] = await Promise.all([
          fetch("/api/admin/fixtures?type=teams"),
          fetch("/api/admin/gameweeks"),
        ]);
        if (teamsRes.ok) {
          const t = await teamsRes.json();
          setTeams(t.teams || []);
        }
        if (gwRes.ok) {
          const g = await gwRes.json();
          const gws: Gameweek[] = g.gameweeks || [];
          setGameweeks(gws);
          // Expand current GW by default
          const current = gws.find((gw) => gw.is_current);
          if (current) setExpandedGws(new Set([current.id]));
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message });
      }
      setLoading(false);
    }
    load();
  }, []);

  // Load all matches for season schedule
  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/fixtures");
      if (res.ok) {
        const data = await res.json();
        setAllMatches(data.fixtures || []);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to load schedule" });
    }
    setScheduleLoading(false);
  }, []);

  // Lazy-load schedule on first tab visit
  useEffect(() => {
    if (activeTab === "schedule" && !scheduleLoaded) {
      setScheduleLoaded(true);
      loadSchedule();
    }
  }, [activeTab, scheduleLoaded, loadSchedule]);

  const handleScheduleMatch = useCallback(async () => {
    if (!matchForm.home_team_uuid || !matchForm.away_team_uuid || !matchForm.gameweek_id) {
      setFeedback({ type: "error", message: "Select both teams and gameweek" });
      return;
    }
    if (matchForm.home_team_uuid === matchForm.away_team_uuid) {
      setFeedback({ type: "error", message: "Home and away teams must be different" });
      return;
    }
    const kickoffIso = matchForm.kickoff_time
      ? toIsoAssumingEAT(matchForm.kickoff_time)
      : null;
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
          kickoff_time: kickoffIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule match");
      setFeedback({ type: "success", message: "Match scheduled!" });
      setMatchForm({ gameweek_id: "", home_team_uuid: "", away_team_uuid: "", kickoff_time: "", venue: "" });
      // Refresh schedule if it was already loaded
      if (scheduleLoaded) loadSchedule();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSaving(false);
  }, [matchForm, scheduleLoaded, loadSchedule]);

  const handleCreateEvent = useCallback(async () => {
    if (!eventForm.title) {
      setFeedback({ type: "error", message: "Event title is required" });
      return;
    }
    const kickoffIso = eventForm.kickoff_time
      ? toIsoAssumingEAT(eventForm.kickoff_time)
      : null;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_event",
          ...eventForm,
          kickoff_time: kickoffIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      setFeedback({ type: "success", message: "Event created!" });
      setEventForm({ type: "tournament", title: "", description: "", kickoff_time: "", venue: "", home_team_uuid: "", away_team_uuid: "" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
    setSaving(false);
  }, [eventForm]);

  const handleDeleteMatch = useCallback(async (matchId: string) => {
    if (!confirm("Delete this scheduled match?")) return;
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(matchId), type: "match" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete match");
      setAllMatches((prev) => prev.filter((m) => m.id !== matchId));
      setFeedback({ type: "success", message: "Match deleted" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "Invalid date";
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: EAT_TIMEZONE,
    }) +
      " at " +
      d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: EAT_TIMEZONE,
      }) +
      " EAT";
  };

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
      timeZone: EAT_TIMEZONE,
    });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", timeZone: EAT_TIMEZONE,
    });
  };

  // --- Season schedule helpers ---
  const matchesByGw = new Map<number, Fixture[]>();
  for (const m of allMatches) {
    const gwId = m.gameweek_id;
    if (!matchesByGw.has(gwId)) matchesByGw.set(gwId, []);
    matchesByGw.get(gwId)!.push(m);
  }

  // Sort GWs: current first, then upcoming (ascending), then past (descending)
  const sortedGws = [...gameweeks].sort((a, b) => {
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    if (!a.finalized && b.finalized) return -1;
    if (a.finalized && !b.finalized) return 1;
    if (!a.finalized) return a.id - b.id;
    return b.id - a.id;
  });

  const toggleGw = (gwId: number) => {
    setExpandedGws((prev) => {
      const next = new Set(prev);
      if (next.has(gwId)) next.delete(gwId);
      else next.add(gwId);
      return next;
    });
  };

  const getGwStatus = (gw: Gameweek) => {
    if (gw.is_current) return { label: "CURRENT", color: ACCENT };
    if (gw.finalized) return { label: "FINALIZED", color: TEXT_MUTED };
    return { label: "UPCOMING", color: WARNING };
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
            { key: "schedule", label: "📅 Schedule" },
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
                {gameweeks.length === 0 ? (
                  <option disabled value="">No gameweeks — create them in Gameweeks page</option>
                ) : (
                  gameweeks.map((gw) => (
                    <option key={gw.id} value={gw.id}>
                      GW {gw.id} — {gw.name}
                      {gw.is_current ? " (Current)" : gw.finalized ? " (Finalized)" : ""}
                    </option>
                  ))
                )}
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
                <label style={labelStyle}>Kickoff Time (optional, EAT)</label>
                <input
                  type="datetime-local"
                  value={matchForm.kickoff_time}
                  onChange={(e) => setMatchForm((p) => ({ ...p, kickoff_time: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Venue (optional)</label>
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
                <label style={labelStyle}>Date & Time (optional, EAT)</label>
                <input
                  type="datetime-local"
                  value={eventForm.kickoff_time}
                  onChange={(e) => setEventForm((p) => ({ ...p, kickoff_time: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Venue (optional)</label>
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

        {/* Season Schedule Tab */}
        {activeTab === "schedule" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Season Schedule</h2>
              <button
                onClick={() => { setScheduleLoaded(false); loadSchedule(); setScheduleLoaded(true); }}
                style={{
                  background: "none", border: `1px solid ${BORDER}`, borderRadius: 6,
                  color: TEXT_MUTED, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Refresh
              </button>
            </div>

            {scheduleLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED }}>
                <p style={{ fontSize: 14 }}>Loading schedule...</p>
              </div>
            ) : gameweeks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📅</p>
                <p>No gameweeks created yet.</p>
                <p style={{ fontSize: 12 }}>Create gameweeks first in the Gameweeks page.</p>
              </div>
            ) : (
              sortedGws.map((gw) => {
                const gwMatches = matchesByGw.get(gw.id) || [];
                const isExpanded = expandedGws.has(gw.id);
                const gwStatus = getGwStatus(gw);

                return (
                  <div key={gw.id} style={{ marginBottom: 8 }}>
                    {/* GW Header */}
                    <button
                      onClick={() => toggleGw(gw.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "14px 16px",
                        borderRadius: isExpanded ? "12px 12px 0 0" : 12,
                        border: `1px solid ${BORDER}`,
                        borderBottom: isExpanded ? "none" : `1px solid ${BORDER}`,
                        backgroundColor: BG_CARD, color: TEXT_PRIMARY,
                        cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <span style={{ flex: 1 }}>
                        GW {gw.id} — {gw.name}
                      </span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        backgroundColor: `${gwStatus.color}15`, color: gwStatus.color,
                        letterSpacing: 0.5,
                      }}>
                        {gwStatus.label}
                      </span>
                      <span style={{ fontSize: 12, color: TEXT_MUTED, minWidth: 70, textAlign: "right" }}>
                        {gwMatches.length} {gwMatches.length === 1 ? "match" : "matches"}
                      </span>
                    </button>

                    {/* GW Matches (expanded) */}
                    {isExpanded && (
                      <div style={{
                        border: `1px solid ${BORDER}`, borderTop: "none",
                        borderRadius: "0 0 12px 12px", padding: 12,
                        backgroundColor: `${BG_CARD}CC`,
                      }}>
                        {/* Deadline info */}
                        {gw.deadline_time && (
                          <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 10, paddingLeft: 2 }}>
                            Deadline: {formatDate(gw.deadline_time)}
                          </div>
                        )}

                        {gwMatches.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "20px 0", color: TEXT_MUTED, fontSize: 13 }}>
                            No matches scheduled for this gameweek
                          </div>
                        ) : (
                          gwMatches.map((match) => (
                            <div key={match.id} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "12px 14px", backgroundColor: BG_SURFACE,
                              border: `1px solid ${BORDER}`, borderRadius: 8,
                              marginBottom: 6,
                            }}>
                              {/* Match info */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                                    {match.home_team?.short_name || "?"}
                                  </span>
                                  {match.is_played ? (
                                    <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>
                                      {match.home_goals} - {match.away_goals}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 12, color: TEXT_MUTED }}>vs</span>
                                  )}
                                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                                    {match.away_team?.short_name || "?"}
                                  </span>
                                  {match.is_final && (
                                    <span style={{
                                      padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                                      backgroundColor: `${SUCCESS}20`, color: SUCCESS,
                                    }}>FT</span>
                                  )}
                                  {match.is_played && !match.is_final && (
                                    <span style={{
                                      padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                                      backgroundColor: `${WARNING}20`, color: WARNING,
                                    }}>LIVE</span>
                                  )}
                                  {!match.is_played && (
                                    <span style={{
                                      padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                                      backgroundColor: `${TEXT_MUTED}20`, color: TEXT_MUTED,
                                    }}>SCH</span>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 12, fontSize: 11, color: TEXT_MUTED }}>
                                  {match.kickoff_time ? (
                                    <span>{formatShortDate(match.kickoff_time)} {formatTime(match.kickoff_time)}</span>
                                  ) : (
                                    <span>TBD</span>
                                  )}
                                </div>
                              </div>

                              {/* Delete button for unplayed matches only */}
                              {!match.is_played && (
                                <button
                                  onClick={() => handleDeleteMatch(match.id)}
                                  style={{
                                    background: "none", border: `1px solid ${ERROR}30`,
                                    borderRadius: 6, color: ERROR, padding: "4px 10px",
                                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
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
