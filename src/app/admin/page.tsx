"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// Theme — matches voice admin
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
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";

interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch quick stats from your existing tables
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/dashboard-stats");
        if (res.ok) {
          const data = await res.json();
          setStats([
            { label: "Total Players", value: data.players || "—", icon: "⚽", color: ACCENT },
            { label: "Total Teams", value: data.teams || "—", icon: "🏟️", color: "#3B82F6" },
            { label: "Matches Played", value: data.matchesPlayed || "—", icon: "📋", color: WARNING },
            { label: "Fantasy Users", value: data.fantasyUsers || "—", icon: "👥", color: "#A855F7" },
            { label: "Current GW", value: data.currentGameweek || "—", icon: "📅", color: SUCCESS },
            { label: "Events Logged", value: data.eventsLogged || "—", icon: "🎙️", color: ERROR },
          ]);
        }
      } catch {
        // Stats API might not exist yet — use defaults
        setStats([
          { label: "Total Players", value: "—", icon: "⚽", color: ACCENT },
          { label: "Total Teams", value: "—", icon: "🏟️", color: "#3B82F6" },
          { label: "Matches Played", value: "—", icon: "📋", color: WARNING },
          { label: "Fantasy Users", value: "—", icon: "👥", color: "#A855F7" },
          { label: "Current GW", value: "—", icon: "📅", color: SUCCESS },
          { label: "Events Logged", value: "—", icon: "🎙️", color: ERROR },
        ]);
      }
      setLoading(false);
    }
    loadStats();
  }, []);

  const adminTools = [
    {
      title: "Voice Admin",
      description: "Enter match stats using voice or text. Whisper + GPT-4o powered.",
      icon: "🎙️",
      href: "/admin/voice",
      color: ACCENT,
      badge: "CORE",
    },
    {
      title: "Match Scores",
      description: "Update match results and scores for each gameweek.",
      icon: "📊",
      href: "/admin/scores",
      color: "#3B82F6",
      badge: "SCORES",
    },
    {
      title: "Calculate Scores",
      description: "Run the scoring engine to calculate fantasy points for a gameweek.",
      icon: "🧮",
      href: "/admin/voice",
      color: WARNING,
      badge: "SCORING",
      hashTab: "scoring",
    },
    {
      title: "Export CSV",
      description: "Download match event data as CSV for records and analysis.",
      icon: "📥",
      href: "/admin/voice",
      color: "#3B82F6",
      badge: "DATA",
    },
  ];

  const managementTools = [
    {
      title: "Add New Club",
      description: "Add a new club to the Budo League.",
      icon: "🏟️",
      href: "/dashboard/admin/teams/new",
      color: "#8B5CF6",
    },
    {
      title: "Add New Player",
      description: "Add a new player, set price and position.",
      icon: "👤",
      href: "/dashboard/admin/players/new",
      color: "#EC4899",
    },
    {
      title: "Schedule Match",
      description: "Add a new match or generate the full schedule.",
      icon: "📋",
      href: "/dashboard/admin/matches/new",
      color: "#F97316",
    },
        {
      title: "Fixtures & Events",
      description: "Schedule matches, tournaments, cups, and friendlies.",
      icon: "📅",
      href: "/admin/fixtures",
      color: "#F97316",
    },
    {
      title: "Send Notifications",
      description: "Send notifications to players and team members.",
      icon: "🔔",
      href: "/admin/notifications",
      color: "#14B8A6",
    },
  ];

  const dbTools = [
    {
      title: "Supabase Dashboard",
      description: "Direct database access for advanced operations.",
      icon: "🗄️",
      href: "https://supabase.com/dashboard",
      color: "#3ECF8E",
      external: true,
    },
    {
      title: "Vercel Dashboard",
      description: "Deployment settings, logs, and environment variables.",
      icon: "▲",
      href: "https://vercel.com/dashboard",
      color: TEXT_PRIMARY,
      external: true,
    },
  ];

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
        a { text-decoration: none; color: inherit; }
        .admin-card { transition: all 0.2s ease; cursor: pointer; }
        .admin-card:hover { transform: translateY(-2px); border-color: ${ACCENT}40 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        @media (max-width: 700px) {
          .admin-header { padding: 14px 16px !important; }
          .admin-user-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }
      `}</style>

      {/* Header */}
      <header
        className="admin-header"
        style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${BORDER}`,
          backgroundColor: BG_CARD,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            ⚡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Admin Dashboard</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>
              BUDO LEAGUE — Control Panel
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, marginLeft: "auto" }}>
          {session?.user?.name && (
            <span className="admin-user-name" style={{ fontSize: 13, color: TEXT_MUTED }}>
              👋 {session.user.name}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: `1px solid ${BORDER}`, backgroundColor: "transparent",
              color: TEXT_MUTED, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>

        {/* Quick Stats */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
            League Overview
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {stats.map((stat, i) => (
              <div key={i} style={{
                padding: "16px",
                backgroundColor: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                textAlign: "center",
              }}>
                <span style={{ fontSize: 24 }}>{stat.icon}</span>
                <div style={{
                  fontSize: 24, fontWeight: 700, color: stat.color,
                  fontFamily: "'JetBrains Mono', monospace",
                  margin: "6px 0 2px",
                }}>
                  {loading ? "..." : stat.value}
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 500 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Voice Admin & Scoring Tools */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
            Match Day Tools
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {adminTools.map((tool, i) => (
              <div
                key={i}
                className="admin-card"
                onClick={() => router.push(tool.href)}
                style={{
                  padding: "20px",
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  borderLeft: `3px solid ${tool.color}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{tool.icon}</span>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{tool.title}</h3>
                  </div>
                  {tool.badge && (
                    <span style={{
                      padding: "3px 8px", borderRadius: 4,
                      backgroundColor: `${tool.color}15`, color: tool.color,
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    }}>
                      {tool.badge}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5 }}>
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Management Tools */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
            League Management
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {managementTools.map((tool, i) => (
              <div
                key={i}
                className="admin-card"
                onClick={() => router.push(tool.href)}
                style={{
                  padding: "18px",
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    backgroundColor: `${tool.color}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>
                    {tool.icon}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{tool.title}</h3>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* External Tools */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
            External Tools
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {dbTools.map((tool, i) => (
              <a
                key={i}
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-card"
                style={{
                  padding: "18px",
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  display: "block",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    backgroundColor: `${tool.color}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>
                    {tool.icon}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{tool.title}</h3>
                    <span style={{ fontSize: 10, color: TEXT_MUTED }}>↗ Opens in new tab</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>
                  {tool.description}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          padding: "20px",
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          marginBottom: 32,
        }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
            Quick Actions
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "🎙️ Enter Match Stats", href: "/admin/voice" },
              { label: "🧮 Calculate GW Scores", href: "/admin/voice" },
              { label: "📥 Export CSV", href: "/admin/voice" },
              { label: "➕ Add New Club", href: "/dashboard/admin/teams/new" },
              { label: "➕ Add New Player", href: "/dashboard/admin/players/new" },
              { label: "📋 Schedule Match", href: "/dashboard/admin/matches/new" },
              { label: "🔔 Send Notification", href: "/admin/notifications" },
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => router.push(action.href)}
                style={{
                  padding: "10px 18px", borderRadius: 8,
                  border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                  color: TEXT_SECONDARY, fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = `${ACCENT}40`; e.currentTarget.style.color = ACCENT; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
