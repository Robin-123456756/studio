"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import dynamic_import from "next/dynamic";

const LiveActivityFeed = dynamic_import(() => import("@/components/LiveActivityFeed"), { ssr: false });

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

interface GwStatus {
  hasCurrentGw: boolean;
  gwId?: number;
  gwName?: string;
  deadline?: string | null;
  finalized?: boolean;
  totalMatches?: number;
  scoredMatches?: number;
  unscoredMatches?: number;
  allScoresEntered?: boolean;
  scoresCalculated?: boolean;
  usersPicked?: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [gwStatus, setGwStatus] = useState<GwStatus | null>(null);
  const [healthWarnings, setHealthWarnings] = useState<Array<{ key: string; severity: string; message: string; count: number; link?: string }>>([]);

  useEffect(() => {
    // Fetch quick stats from your existing tables
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/players/dashboard-stats");
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

    async function loadGwStatus() {
      try {
        const res = await fetch("/api/admin/gw-status");
        if (res.ok) setGwStatus(await res.json());
      } catch {
        // GW status is non-critical
      }
    }

    async function loadHealth() {
      try {
        const res = await fetch("/api/admin/data-health");
        if (res.ok) {
          const json = await res.json();
          setHealthWarnings(json.warnings ?? []);
        }
      } catch { /* non-critical */ }
    }

    loadStats();
    loadGwStatus();
    loadHealth();
  }, []);

  const userRole = (session?.user as any)?.role as string | undefined;
  const isSuperAdmin = !userRole || userRole === "superadmin";

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
      href: "/admin/voice#scoring",
      color: WARNING,
      badge: "SCORING",
    },
    {
      title: "Export CSV",
      description: "Download match event data as CSV for records and analysis.",
      icon: "📥",
      href: "/admin/voice#capture",
      color: "#3B82F6",
      badge: "DATA",
    },
    {
      title: "End Gameweek",
      description: "One-click workflow: calculate scores, finalize, and advance.",
      icon: "🏁",
      href: "/admin/end-gameweek",
      color: "#A855F7",
      badge: "WORKFLOW",
    },
  ];

  const managementTools = [
    {
      title: "Manage Clubs",
      description: "Browse, edit and manage league clubs.",
      icon: "🏟️",
      href: "/admin/teams",
      color: "#8B5CF6",
    },
    {
      title: "Manage Players",
      description: "Browse, edit prices, positions, and player details.",
      icon: "👥",
      href: "/admin/players",
      color: "#EC4899",
    },
    {
      title: "Gameweeks",
      description: "Create and manage gameweek schedule and deadlines.",
      icon: "📅",
      href: "/admin/gameweeks",
      color: "#F59E0B",
    },
    {
      title: "Fixtures & Events",
      description: "Schedule matches, tournaments, cups, and friendlies.",
      icon: "📋",
      href: "/admin/fixtures",
      color: "#F97316",
    },
    {
      title: "Send Notifications",
      description: "Send notifications to all fantasy managers.",
      icon: "🔔",
      href: "/admin/notifications/send",
      color: "#14B8A6",
    },
    {
      title: "Fantasy Managers",
      description: "View all users, their teams, points, and picks.",
      icon: "🧑‍💼",
      href: "/admin/users",
      color: "#3B82F6",
    },
    {
      title: "Bonus Points",
      description: "Award 3-2-1 bonus points to top match performers.",
      icon: "⭐",
      href: "/admin/bonus-points",
      color: "#F59E0B",
    },
    {
      title: "Import Players",
      description: "Bulk import players from a CSV file.",
      icon: "📤",
      href: "/admin/players/import",
      color: "#6366F1",
    },
    {
      title: "Audit Log",
      description: "View all admin actions and voice entries.",
      icon: "📜",
      href: "/admin/audit-log",
      color: "#64748B",
    },
    {
      title: "Season",
      description: "Season overview, archive, and reset for new season.",
      icon: "🏆",
      href: "/admin/season",
      color: "#EF4444",
    },
    {
      title: "Analytics",
      description: "Stats, reports, and engagement metrics.",
      icon: "📈",
      href: "/admin/analytics",
      color: "#06B6D4",
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
            <span className="admin-user-name" style={{ fontSize: 13, color: TEXT_MUTED, display: "flex", alignItems: "center", gap: 6 }}>
              👋 {session.user.name}
              {userRole && (
                <span style={{
                  padding: "2px 8px", borderRadius: 4,
                  backgroundColor: isSuperAdmin ? `${ACCENT}15` : `${WARNING}15`,
                  color: isSuperAdmin ? ACCENT : WARNING,
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                  textTransform: "uppercase" as const,
                }}>
                  {userRole.replace("_", " ")}
                </span>
              )}
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

        {/* GW Status Widget */}
        {gwStatus && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
              Gameweek Status
            </h2>
            {!gwStatus.hasCurrentGw ? (
              <div style={{
                padding: "20px",
                backgroundColor: BG_CARD,
                border: `1px solid ${WARNING}30`,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: WARNING }}>No current gameweek set</div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>
                    Go to <span style={{ color: ACCENT, cursor: "pointer" }} onClick={() => router.push("/admin/gameweeks")}>Gameweeks</span> to set one as current.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: "20px",
                backgroundColor: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
              }}>
                {/* GW Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 22, fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: ACCENT,
                    }}>
                      GW {gwStatus.gwId}
                    </span>
                    {gwStatus.finalized && (
                      <span style={{
                        padding: "3px 10px", borderRadius: 4,
                        backgroundColor: `${SUCCESS}15`, color: SUCCESS,
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      }}>
                        FINALIZED
                      </span>
                    )}
                  </div>
                  {gwStatus.deadline && (
                    <DeadlineCountdown deadline={gwStatus.deadline} />
                  )}
                </div>

                {/* Checklist */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  <ChecklistItem
                    label="Scores entered"
                    detail={`${gwStatus.scoredMatches}/${gwStatus.totalMatches} matches`}
                    done={!!gwStatus.allScoresEntered}
                    href="/admin/scores"
                    router={router}
                  />
                  <ChecklistItem
                    label="Points calculated"
                    detail={gwStatus.scoresCalculated ? "Done" : "Not yet"}
                    done={!!gwStatus.scoresCalculated}
                    href="/admin/voice#scoring"
                    router={router}
                  />
                  <ChecklistItem
                    label="GW finalized"
                    detail={gwStatus.finalized ? "Locked" : "Pending"}
                    done={!!gwStatus.finalized}
                    href="/admin/gameweeks"
                    router={router}
                  />
                  <div style={{
                    padding: "12px 14px",
                    backgroundColor: BG_SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Users picked</div>
                    <div style={{
                      fontSize: 18, fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: (gwStatus.usersPicked || 0) > 0 ? ACCENT : TEXT_MUTED,
                    }}>
                      {gwStatus.usersPicked || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Health Warnings — super admin only */}
        {isSuperAdmin && healthWarnings.length > 0 ? (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
              Data Health
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {healthWarnings.map((w) => (
                <div
                  key={w.key}
                  onClick={() => w.link && router.push(w.link)}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: BG_CARD,
                    border: `1px solid ${w.severity === "error" ? `${ERROR}30` : `${WARNING}30`}`,
                    borderLeft: `3px solid ${w.severity === "error" ? ERROR : WARNING}`,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: w.link ? "pointer" : "default",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{w.severity === "error" ? "🔴" : "🟡"}</span>
                    <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{w.message}</span>
                  </div>
                  {w.link && (
                    <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600, whiteSpace: "nowrap" }}>Fix →</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : isSuperAdmin && !loading ? (
          <div style={{
            marginBottom: 32, padding: "12px 16px",
            backgroundColor: `${SUCCESS}08`,
            border: `1px solid ${SUCCESS}20`,
            borderRadius: 8,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <span style={{ fontSize: 13, color: SUCCESS, fontWeight: 500 }}>All data checks passed — no issues found</span>
          </div>
        ) : null}

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

        {isSuperAdmin && (
          <>
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

            {/* Quick Actions — super admin */}
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
                  { label: "🏁 End Gameweek", href: "/admin/end-gameweek" },
                  { label: "🎙️ Enter Match Stats", href: "/admin/voice" },
                  { label: "🧮 Calculate GW Scores", href: "/admin/voice#scoring" },
                  { label: "📥 Export CSV", href: "/admin/voice#capture" },
                  { label: "🏟️ Manage Clubs", href: "/admin/teams" },
                  { label: "👥 Manage Players", href: "/admin/players" },
                  { label: "🧑‍💼 Fantasy Managers", href: "/admin/users" },
                  { label: "📅 Manage Gameweeks", href: "/admin/gameweeks" },
                  { label: "📋 Schedule Match", href: "/admin/fixtures" },
                  { label: "⭐ Bonus Points", href: "/admin/bonus-points" },
                  { label: "📤 Import Players", href: "/admin/players/import" },
                  { label: "📜 Audit Log", href: "/admin/audit-log" },
                  { label: "📈 Analytics", href: "/admin/analytics" },
                  { label: "🔔 Send Notification", href: "/admin/notifications/send" },
                  { label: "🏆 Season", href: "/admin/season" },
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
          </>
        )}

        {/* Scorer Quick Actions — match-day only */}
        {!isSuperAdmin && (
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
                { label: "📊 Match Scores", href: "/admin/scores" },
                { label: "🧮 Calculate GW Scores", href: "/admin/voice#scoring" },
                { label: "⭐ Bonus Points", href: "/admin/bonus-points" },
                { label: "🏁 End Gameweek", href: "/admin/end-gameweek" },
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
        )}

        {/* Recent Activity Feed */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
            Recent Activity
          </h2>
          <div style={{
            backgroundColor: BG_CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: "16px",
            maxHeight: 320,
            overflow: "auto",
          }}>
            <LiveActivityFeed />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Helper Components ── */

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const deadlineMs = new Date(deadline).getTime();
  const diff = deadlineMs - now;

  if (Number.isNaN(deadlineMs)) {
    return <span style={{ fontSize: 12, color: TEXT_MUTED }}>Invalid deadline</span>;
  }

  if (diff <= 0) {
    return (
      <span style={{
        padding: "4px 12px", borderRadius: 6,
        backgroundColor: `${ERROR}15`, color: ERROR,
        fontSize: 12, fontWeight: 600,
      }}>
        Deadline passed
      </span>
    );
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${mins}m`);

  const isUrgent = diff < 3_600_000; // < 1 hour

  return (
    <span style={{
      padding: "4px 12px", borderRadius: 6,
      backgroundColor: isUrgent ? `${ERROR}15` : `${WARNING}15`,
      color: isUrgent ? ERROR : WARNING,
      fontSize: 12, fontWeight: 600,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {parts.join(" ")} to deadline
    </span>
  );
}

function ChecklistItem({ label, detail, done, href, router }: {
  label: string;
  detail: string;
  done: boolean;
  href: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div
      onClick={() => router.push(href)}
      style={{
        padding: "12px 14px",
        backgroundColor: BG_SURFACE,
        border: `1px solid ${done ? `${SUCCESS}30` : BORDER}`,
        borderRadius: 8,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 18, height: 18, borderRadius: "50%",
          backgroundColor: done ? SUCCESS : `${TEXT_MUTED}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: done ? "#000" : TEXT_MUTED, fontWeight: 700,
        }}>
          {done ? "✓" : ""}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: done ? SUCCESS : TEXT_SECONDARY }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, paddingLeft: 26 }}>{detail}</div>
    </div>
  );
}
