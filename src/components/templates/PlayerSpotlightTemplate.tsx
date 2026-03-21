"use client";

import { BRAND, BASE_CONTAINER, type TemplatePlayer } from "./shared";

type Props = {
  player: TemplatePlayer;
  gameweekName?: string;
  headline?: string; // e.g. "Player of the Week", "Top Scorer"
  logoDataUrl?: string;
};

/**
 * Player Spotlight template — 1080×1350 (portrait)
 * Player card with photo, name, team, and season stats.
 */
export default function PlayerSpotlightTemplate({
  player,
  gameweekName,
  headline = "Player Spotlight",
  logoDataUrl,
}: Props) {
  const stats = [
    { label: "Points", value: player.totalPoints, highlight: true },
    { label: "Goals", value: player.totalGoals },
    { label: "Assists", value: player.totalAssists },
    { label: "Apps", value: player.appearances },
    { label: "Ownership", value: `${player.ownership}%` },
  ];

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
          padding: "40px 48px 20px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: BRAND.gold,
            }}
          >
            {headline}
          </div>
          {gameweekName && (
            <div style={{ fontSize: 15, color: BRAND.muted, marginTop: 4 }}>{gameweekName}</div>
          )}
        </div>
        {logoDataUrl && (
          <img src={logoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} />
        )}
      </div>

      {/* Player photo area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 48px",
          position: "relative",
        }}
      >
        {/* Glow ring behind photo */}
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${BRAND.purple}80 0%, transparent 70%)`,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -65%)",
          }}
        />

        {/* Player avatar */}
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: "50%",
            overflow: "hidden",
            border: `4px solid ${BRAND.gold}60`,
            background: BRAND.darkCard,
            marginBottom: 28,
            position: "relative",
            zIndex: 1,
          }}
        >
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 72,
                fontWeight: 900,
                color: BRAND.purple,
                background: `${BRAND.purpleLight}30`,
              }}
            >
              {player.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Name & position */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginBottom: 8 }}>
            {player.webName || player.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: "4px 14px",
                borderRadius: 100,
                background: BRAND.purple,
                color: BRAND.gold,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {player.position}
            </span>
            {player.isLady && (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "4px 14px",
                  borderRadius: 100,
                  background: `${BRAND.red}30`,
                  color: BRAND.redLight,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Lady ★
              </span>
            )}
          </div>
          <div style={{ fontSize: 18, color: BRAND.muted, marginTop: 10 }}>
            {player.teamName}
          </div>
          {player.price != null && (
            <div style={{ fontSize: 16, color: BRAND.green, fontWeight: 700, marginTop: 4 }}>
              £{(player.price / 10).toFixed(1)}m
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          margin: "0 48px 40px",
          borderRadius: 20,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "24px 8px",
              borderRight: i < stats.length - 1 ? `1px solid ${BRAND.muted}20` : "none",
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: s.highlight ? BRAND.gold : BRAND.white,
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: BRAND.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginTop: 6,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "0 48px 28px",
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
