"use client";

import { BRAND, BASE_CONTAINER, type TemplateMatch } from "./shared";

type Props = {
  gameweekName: string;
  matches: TemplateMatch[];
  /** Base64 data URL of the logo (pre-loaded for SVG export) */
  logoDataUrl?: string;
};

/**
 * Matchday Announcement template — 1080×1080
 * Shows gameweek name + list of fixtures with team logos, names & kickoff times.
 */
export default function MatchdayTemplate({ gameweekName, matches, logoDataUrl }: Props) {
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-UG", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Kampala",
      });
    } catch {
      return "";
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-UG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Africa/Kampala",
      });
    } catch {
      return "";
    }
  };

  // Group matches by date
  const dateStr = matches[0]?.kickoffTime ? formatDate(matches[0].kickoffTime) : "";

  return (
    <div
      style={{
        ...BASE_CONTAINER,
        width: 1080,
        height: 1080,
        background: BRAND.gradient,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "48px 48px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: BRAND.gold,
              marginBottom: 8,
            }}
          >
            Matchday
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1 }}>
            {gameweekName}
          </div>
          {dateStr && (
            <div style={{ fontSize: 18, color: BRAND.offWhite, marginTop: 8, opacity: 0.8 }}>
              {dateStr}
            </div>
          )}
        </div>
        {logoDataUrl && (
          <img
            src={logoDataUrl}
            alt=""
            style={{ width: 80, height: 80, objectFit: "contain", opacity: 0.9 }}
          />
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 3, background: `${BRAND.gold}40`, margin: "0 48px" }} />

      {/* Fixtures list */}
      <div
        style={{
          flex: 1,
          padding: "24px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {matches.slice(0, 6).map((m, i) => (
          <div
            key={m.id || i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              padding: "20px 24px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(4px)",
            }}
          >
            {/* Home team */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, textAlign: "right" }}>
                {m.homeTeam.shortName}
              </span>
              {m.homeTeam.logoUrl && (
                <img
                  src={m.homeTeam.logoUrl}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8 }}
                />
              )}
            </div>

            {/* Time/VS */}
            <div
              style={{
                width: 100,
                textAlign: "center",
                fontSize: 20,
                fontWeight: 800,
                color: BRAND.gold,
                flexShrink: 0,
              }}
            >
              {m.kickoffTime ? formatTime(m.kickoffTime) : "TBD"}
            </div>

            {/* Away team */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 14,
              }}
            >
              {m.awayTeam.logoUrl && (
                <img
                  src={m.awayTeam.logoUrl}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8 }}
                />
              )}
              <span style={{ fontSize: 22, fontWeight: 700 }}>
                {m.awayTeam.shortName}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 48px 24px",
          textAlign: "center",
          fontSize: 14,
          color: BRAND.offWhite,
          opacity: 0.6,
          letterSpacing: 1,
        }}
      >
        THE BUDO LEAGUE
      </div>
    </div>
  );
}
