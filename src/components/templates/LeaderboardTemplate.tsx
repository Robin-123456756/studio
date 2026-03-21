"use client";

import { BRAND, BASE_CONTAINER, type TemplateStandingsRow } from "./shared";

type Props = {
  rows: TemplateStandingsRow[];
  title?: string;
  subtitle?: string;
  logoDataUrl?: string;
};

/**
 * Leaderboard template — 1080×1350 (portrait)
 * League standings table with position movement arrows.
 */
export default function LeaderboardTemplate({
  rows,
  title = "League Standings",
  subtitle,
  logoDataUrl,
}: Props) {
  const displayRows = rows.slice(0, 10);

  return (
    <div
      style={{
        ...BASE_CONTAINER,
        width: 1080,
        height: 1350,
        background: BRAND.gradientDark,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "40px 48px 16px",
        }}
      >
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 16, color: BRAND.muted, marginTop: 6 }}>{subtitle}</div>
          )}
        </div>
        {logoDataUrl && (
          <img src={logoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} />
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: `${BRAND.gold}30`, margin: "0 48px 12px" }} />

      {/* Table header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 48px",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: BRAND.muted,
        }}
      >
        <span style={{ width: 40 }}>#</span>
        <span style={{ flex: 1 }}>Team</span>
        <span style={{ width: 50, textAlign: "center" }}>PL</span>
        <span style={{ width: 50, textAlign: "center" }}>W</span>
        <span style={{ width: 50, textAlign: "center" }}>D</span>
        <span style={{ width: 50, textAlign: "center" }}>L</span>
        <span style={{ width: 60, textAlign: "center" }}>GD</span>
        <span style={{ width: 70, textAlign: "center", color: BRAND.gold }}>PTS</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, padding: "0 48px", display: "flex", flexDirection: "column", gap: 4 }}>
        {displayRows.map((row, i) => {
          const isTop3 = i < 3;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 0",
                borderRadius: 12,
                background: isTop3 ? `${BRAND.gold}08` : "transparent",
                borderBottom: `1px solid ${BRAND.muted}15`,
              }}
            >
              {/* Rank + movement */}
              <div
                style={{
                  width: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: isTop3 ? BRAND.gold : BRAND.white,
                  }}
                >
                  {row.rank}
                </span>
                {row.movement !== 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: row.movement > 0 ? BRAND.green : BRAND.red,
                    }}
                  >
                    {row.movement > 0 ? "▲" : "▼"}
                  </span>
                )}
              </div>

              {/* Team name + logo */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                {row.logoUrl && (
                  <img
                    src={row.logoUrl}
                    alt=""
                    style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4 }}
                  />
                )}
                <span style={{ fontSize: 18, fontWeight: 700 }}>{row.teamName}</span>
              </div>

              {/* Stats */}
              <span style={{ width: 50, textAlign: "center", fontSize: 16, color: BRAND.offWhite }}>{row.played}</span>
              <span style={{ width: 50, textAlign: "center", fontSize: 16, color: BRAND.offWhite }}>{row.won}</span>
              <span style={{ width: 50, textAlign: "center", fontSize: 16, color: BRAND.offWhite }}>{row.drawn}</span>
              <span style={{ width: 50, textAlign: "center", fontSize: 16, color: BRAND.offWhite }}>{row.lost}</span>
              <span
                style={{
                  width: 60,
                  textAlign: "center",
                  fontSize: 16,
                  color: row.gd > 0 ? BRAND.green : row.gd < 0 ? BRAND.red : BRAND.muted,
                }}
              >
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </span>
              <span
                style={{
                  width: 70,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: 900,
                  color: isTop3 ? BRAND.gold : BRAND.white,
                }}
              >
                {row.points}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 48px 28px",
          textAlign: "center",
          fontSize: 14,
          color: BRAND.offWhite,
          opacity: 0.5,
          letterSpacing: 1,
        }}
      >
        THE BUDO LEAGUE
      </div>
    </div>
  );
}
