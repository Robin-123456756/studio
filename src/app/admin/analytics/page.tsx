"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT, ACCENT_DIM,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING, INFO,
  btnMuted, globalResetCSS,
} from "@/lib/admin-theme";

type Tab = "overview" | "players" | "teams" | "engagement";

interface GwBreakdown {
  gameweek: number;
  avg: number;
  high: number;
  low: number;
  managers: number;
}

interface PlayerStat {
  playerId: string;
  name: string;
  position: string;
  teamName: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  points: number;
}

interface TeamRanking {
  teamId: number;
  name: string;
  shortName: string;
  totalPoints: number;
}

interface EngagementData {
  pickBreakdown: { gameweek: number; managers: number }[];
  transferBreakdown: { gameweek: number; transfers: number }[];
  chipBreakdown: { chip: string; count: number }[];
}

const POS_COLORS: Record<string, string> = { GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444" };

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "players", label: "Players" },
  { key: "teams", label: "Teams" },
  { key: "engagement", label: "Engagement" },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  function BarChart({ items, labelKey, valueKey, maxWidth = 200, color = ACCENT }: {
    items: any[]; labelKey: string; valueKey: string; maxWidth?: number; color?: string;
  }) {
    const max = Math.max(...items.map((i) => i[valueKey] || 0), 1);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY, minWidth: 80, textAlign: "right" }}>{item[labelKey]}</span>
            <div style={{ flex: 1, maxWidth }}>
              <div style={{
                height: 20,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${color} 0%, ${color}66 100%)`,
                width: `${(item[valueKey] / max) * 100}%`,
                minWidth: item[valueKey] > 0 ? 4 : 0,
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: TEXT_PRIMARY, minWidth: 40 }}>
              {item[valueKey]}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function SortableTable({ columns, rows, defaultSort }: {
    columns: { key: string; label: string; align?: string; color?: string }[];
    rows: any[];
    defaultSort?: string;
  }) {
    const [sortKey, setSortKey] = useState(defaultSort || columns[0]?.key);
    const [asc, setAsc] = useState(false);

    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    return (
      <div style={{ borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: BG_SURFACE }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => { if (sortKey === col.key) setAsc(!asc); else { setSortKey(col.key); setAsc(false); } }}
                  style={{
                    padding: "8px 10px",
                    textAlign: (col.align as any) || "left",
                    color: TEXT_MUTED,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    userSelect: "none",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  {col.label} {sortKey === col.key ? (asc ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? BG_CARD : BG_DARK, borderBottom: `1px solid ${BORDER}22` }}>
                {columns.map((col) => (
                  <td key={col.key} style={{
                    padding: "7px 10px",
                    textAlign: (col.align as any) || "left",
                    fontFamily: typeof row[col.key] === "number" ? "'JetBrains Mono', monospace" : undefined,
                    color: col.color || TEXT_PRIMARY,
                  }}>
                    {col.key === "position" ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: `${POS_COLORS[row[col.key]] || TEXT_MUTED}22`,
                        color: POS_COLORS[row[col.key]] || TEXT_MUTED,
                      }}>{row[col.key]}</span>
                    ) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Analytics & Reports</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>
            Season-wide statistics and insights.
          </p>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${BORDER}`, paddingBottom: 1 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px 6px 0 0",
                  border: "none",
                  background: tab === t.key ? BG_SURFACE : "transparent",
                  color: tab === t.key ? ACCENT : TEXT_MUTED,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderBottom: tab === t.key ? `2px solid ${ACCENT}` : "2px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: TEXT_MUTED }}>Loading analytics...</div>
          ) : !data ? (
            <div style={{ padding: 40, textAlign: "center", color: TEXT_MUTED }}>Failed to load data.</div>
          ) : (
            <>
              {/* Overview Tab */}
              {tab === "overview" && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                    GW-by-GW Score Breakdown
                  </h3>
                  {(data.overview?.gwBreakdown?.length ?? 0) === 0 ? (
                    <div style={{ color: TEXT_MUTED, padding: 20 }}>No score data yet.</div>
                  ) : (
                    <div style={{ borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: BG_SURFACE }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: TEXT_MUTED, fontSize: 11 }}>GW</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: TEXT_MUTED, fontSize: 11 }}>Avg</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: TEXT_MUTED, fontSize: 11 }}>High</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: TEXT_MUTED, fontSize: 11 }}>Low</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", color: TEXT_MUTED, fontSize: 11 }}>Managers</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: TEXT_MUTED, fontSize: 11, width: "30%" }}>Range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.overview.gwBreakdown as GwBreakdown[]).map((gw, i) => {
                            const maxH = Math.max(...data.overview.gwBreakdown.map((g: GwBreakdown) => g.high), 1);
                            return (
                              <tr key={gw.gameweek} style={{ background: i % 2 === 0 ? BG_CARD : BG_DARK }}>
                                <td style={{ padding: "7px 10px", fontWeight: 600 }}>GW {gw.gameweek}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{gw.avg}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: SUCCESS }}>{gw.high}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: ERROR }}>{gw.low}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY }}>{gw.managers}</td>
                                <td style={{ padding: "7px 10px" }}>
                                  <div style={{ position: "relative", height: 16, background: `${BORDER}`, borderRadius: 4 }}>
                                    <div style={{
                                      position: "absolute",
                                      left: `${(gw.low / maxH) * 100}%`,
                                      width: `${((gw.high - gw.low) / maxH) * 100}%`,
                                      height: "100%",
                                      borderRadius: 4,
                                      background: `linear-gradient(90deg, ${ERROR}88, ${SUCCESS}88)`,
                                    }} />
                                    <div style={{
                                      position: "absolute",
                                      left: `${(gw.avg / maxH) * 100}%`,
                                      top: 0, width: 2, height: "100%",
                                      background: ACCENT,
                                    }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Players Tab */}
              {tab === "players" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                      Top Scorers
                    </h3>
                    <SortableTable
                      columns={[
                        { key: "name", label: "Player" },
                        { key: "position", label: "Pos" },
                        { key: "teamName", label: "Team" },
                        { key: "goals", label: "Goals", align: "right" },
                        { key: "assists", label: "Assists", align: "right" },
                        { key: "points", label: "Points", align: "right", color: ACCENT },
                      ]}
                      rows={data.players?.topScorers || []}
                      defaultSort="points"
                    />
                  </div>

                  {(data.players?.topCleanSheets?.length ?? 0) > 0 && (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                        Clean Sheets (GK/DEF)
                      </h3>
                      <SortableTable
                        columns={[
                          { key: "name", label: "Player" },
                          { key: "position", label: "Pos" },
                          { key: "teamName", label: "Team" },
                          { key: "cleanSheets", label: "Clean Sheets", align: "right", color: INFO },
                        ]}
                        rows={data.players?.topCleanSheets || []}
                        defaultSort="cleanSheets"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Teams Tab */}
              {tab === "teams" && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                    Fantasy Points by Real Team
                  </h3>
                  {(data.teams?.teamRankings?.length ?? 0) === 0 ? (
                    <div style={{ color: TEXT_MUTED, padding: 20 }}>No team data.</div>
                  ) : (
                    <BarChart
                      items={(data.teams.teamRankings as TeamRanking[]).slice(0, 15).map((t) => ({ label: t.shortName || t.name, value: t.totalPoints }))}
                      labelKey="label"
                      valueKey="value"
                      maxWidth={400}
                    />
                  )}
                </div>
              )}

              {/* Engagement Tab */}
              {tab === "engagement" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* Picks per GW */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                      Picks per Gameweek
                    </h3>
                    {(data.engagement?.pickBreakdown?.length ?? 0) === 0 ? (
                      <div style={{ color: TEXT_MUTED }}>No pick data.</div>
                    ) : (
                      <BarChart
                        items={data.engagement.pickBreakdown.map((p: any) => ({ label: `GW ${p.gameweek}`, value: p.managers }))}
                        labelKey="label"
                        valueKey="value"
                        color={INFO}
                      />
                    )}
                  </div>

                  {/* Transfers per GW */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                      Transfer Activity
                    </h3>
                    {(data.engagement?.transferBreakdown?.length ?? 0) === 0 ? (
                      <div style={{ color: TEXT_MUTED }}>No transfer data.</div>
                    ) : (
                      <BarChart
                        items={data.engagement.transferBreakdown.map((t: any) => ({ label: `GW ${t.gameweek}`, value: t.transfers }))}
                        labelKey="label"
                        valueKey="value"
                        color={WARNING}
                      />
                    )}
                  </div>

                  {/* Chips usage */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                      Chip Usage
                    </h3>
                    {(data.engagement?.chipBreakdown?.length ?? 0) === 0 ? (
                      <div style={{ color: TEXT_MUTED }}>No chip data.</div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {data.engagement.chipBreakdown.map((c: any) => (
                          <div key={c.chip} style={{
                            padding: "14px 20px",
                            borderRadius: 10,
                            background: BG_CARD,
                            border: `1px solid ${BORDER}`,
                            textAlign: "center",
                            minWidth: 100,
                          }}>
                            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT }}>{c.count}</div>
                            <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase", marginTop: 2 }}>{c.chip}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
