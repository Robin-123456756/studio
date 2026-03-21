"use client";

import {
  BRAND,
  BASE_CONTAINER,
  type TemplateMatch,
  type TemplateMatchEvent,
} from "./shared";

type Props = {
  match: TemplateMatch;
  homeEvents: TemplateMatchEvent[];
  awayEvents: TemplateMatchEvent[];
  gameweekName: string;
  motm?: string; // Man of the Match name
  logoDataUrl?: string;
};

/**
 * Score Result template — 1080×1080
 * Post-match graphic with final score, goal scorers, and MOTM.
 */
export default function ScoreResultTemplate({
  match,
  homeEvents,
  awayEvents,
  gameweekName,
  motm,
  logoDataUrl,
}: Props) {
  const goalScorers = (events: TemplateMatchEvent[]) =>
    events
      .filter((e) => e.goals > 0)
      .map((e) => `${e.playerName}${e.goals > 1 ? ` ×${e.goals}` : ""}${e.isLady ? " ★" : ""}`)
      .join(", ");

  const assisters = (events: TemplateMatchEvent[]) =>
    events
      .filter((e) => e.assists > 0)
      .map((e) => `${e.playerName}${e.assists > 1 ? ` ×${e.assists}` : ""}`)
      .join(", ");

  return (
    <div
      style={{
        ...BASE_CONTAINER,
        width: 1080,
        height: 1080,
        background: BRAND.gradientDark,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "36px 48px 20px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: BRAND.red,
            }}
          >
            Full Time
          </div>
          <div style={{ fontSize: 16, color: BRAND.muted, marginTop: 4 }}>
            {gameweekName}
          </div>
        </div>
        {logoDataUrl && (
          <img src={logoDataUrl} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />
        )}
      </div>

      {/* Score card */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 48px",
        }}
      >
        {/* Teams & Score */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            marginBottom: 40,
          }}
        >
          {/* Home */}
          <div style={{ textAlign: "center", minWidth: 200 }}>
            {match.homeTeam.logoUrl && (
              <img
                src={match.homeTeam.logoUrl}
                alt=""
                style={{ width: 100, height: 100, objectFit: "contain", margin: "0 auto 16px" }}
              />
            )}
            <div style={{ fontSize: 28, fontWeight: 800 }}>{match.homeTeam.shortName}</div>
          </div>

          {/* Score */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "20px 36px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <span style={{ fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {match.homeGoals ?? 0}
            </span>
            <span style={{ fontSize: 36, fontWeight: 300, color: BRAND.muted }}>–</span>
            <span style={{ fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {match.awayGoals ?? 0}
            </span>
          </div>

          {/* Away */}
          <div style={{ textAlign: "center", minWidth: 200 }}>
            {match.awayTeam.logoUrl && (
              <img
                src={match.awayTeam.logoUrl}
                alt=""
                style={{ width: 100, height: 100, objectFit: "contain", margin: "0 auto 16px" }}
              />
            )}
            <div style={{ fontSize: 28, fontWeight: 800 }}>{match.awayTeam.shortName}</div>
          </div>
        </div>

        {/* Goal scorers */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 60,
            width: "100%",
            maxWidth: 800,
          }}
        >
          <div style={{ flex: 1, textAlign: "right" }}>
            {goalScorers(homeEvents) && (
              <>
                <div style={{ fontSize: 13, color: BRAND.gold, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                  Goals
                </div>
                <div style={{ fontSize: 17, lineHeight: 1.6 }}>
                  {goalScorers(homeEvents)}
                </div>
              </>
            )}
            {assisters(homeEvents) && (
              <>
                <div style={{ fontSize: 13, color: BRAND.muted, fontWeight: 700, marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                  Assists
                </div>
                <div style={{ fontSize: 15, color: BRAND.offWhite, lineHeight: 1.6 }}>
                  {assisters(homeEvents)}
                </div>
              </>
            )}
          </div>

          <div style={{ width: 1, background: `${BRAND.muted}30` }} />

          <div style={{ flex: 1, textAlign: "left" }}>
            {goalScorers(awayEvents) && (
              <>
                <div style={{ fontSize: 13, color: BRAND.gold, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                  Goals
                </div>
                <div style={{ fontSize: 17, lineHeight: 1.6 }}>
                  {goalScorers(awayEvents)}
                </div>
              </>
            )}
            {assisters(awayEvents) && (
              <>
                <div style={{ fontSize: 13, color: BRAND.muted, fontWeight: 700, marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                  Assists
                </div>
                <div style={{ fontSize: 15, color: BRAND.offWhite, lineHeight: 1.6 }}>
                  {assisters(awayEvents)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* MOTM */}
        {motm && (
          <div
            style={{
              marginTop: 36,
              padding: "12px 32px",
              borderRadius: 100,
              background: `${BRAND.gold}20`,
              border: `1px solid ${BRAND.gold}40`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: BRAND.gold }}>
              MOTM: {motm}
            </span>
          </div>
        )}
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
