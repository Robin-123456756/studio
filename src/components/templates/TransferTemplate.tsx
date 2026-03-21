"use client";

import { BRAND, BASE_CONTAINER, type TemplatePlayer, type TemplateTeam } from "./shared";

type Props = {
  player: TemplatePlayer;
  fromTeam: TemplateTeam;
  toTeam: TemplateTeam;
  headline?: string; // e.g. "TRANSFER CONFIRMED", "NEW SIGNING"
  logoDataUrl?: string;
};

/**
 * Transfer Announcement template — 1080×1080
 * "CONFIRMED" style graphic showing player moving between teams.
 */
export default function TransferTemplate({
  player,
  fromTeam,
  toTeam,
  headline = "TRANSFER CONFIRMED",
  logoDataUrl,
}: Props) {
  return (
    <div
      style={{
        ...BASE_CONTAINER,
        width: 1080,
        height: 1080,
        background: BRAND.gradientDark,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Top badge */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 48,
          right: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 4,
            color: BRAND.red,
            padding: "6px 16px",
            borderRadius: 6,
            background: `${BRAND.red}15`,
            border: `1px solid ${BRAND.red}40`,
          }}
        >
          {headline}
        </div>
        {logoDataUrl && (
          <img src={logoDataUrl} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
        )}
      </div>

      {/* Player photo */}
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          overflow: "hidden",
          border: `4px solid ${BRAND.gold}60`,
          background: BRAND.darkCard,
          marginBottom: 28,
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
              fontSize: 64,
              fontWeight: 900,
              color: BRAND.purple,
              background: `${BRAND.purpleLight}30`,
            }}
          >
            {player.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Player name */}
      <div
        style={{
          fontSize: 38,
          fontWeight: 900,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {player.webName || player.name}
      </div>

      {/* Position & lady badge */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        <span
          style={{
            fontSize: 13,
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
              fontSize: 13,
              fontWeight: 700,
              padding: "4px 14px",
              borderRadius: 100,
              background: `${BRAND.red}30`,
              color: BRAND.redLight,
            }}
          >
            Lady ★
          </span>
        )}
      </div>

      {/* Transfer arrow: From → To */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          padding: "28px 48px",
          borderRadius: 20,
          background: "rgba(255,255,255,0.05)",
        }}
      >
        {/* From team */}
        <div style={{ textAlign: "center", minWidth: 160 }}>
          {fromTeam.logoUrl && (
            <img
              src={fromTeam.logoUrl}
              alt=""
              style={{ width: 72, height: 72, objectFit: "contain", margin: "0 auto 10px", opacity: 0.5 }}
            />
          )}
          <div style={{ fontSize: 18, fontWeight: 700, color: BRAND.muted }}>
            {fromTeam.shortName}
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 40, color: BRAND.gold }}>→</div>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            Transfer
          </div>
        </div>

        {/* To team */}
        <div style={{ textAlign: "center", minWidth: 160 }}>
          {toTeam.logoUrl && (
            <img
              src={toTeam.logoUrl}
              alt=""
              style={{ width: 72, height: 72, objectFit: "contain", margin: "0 auto 10px" }}
            />
          )}
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {toTeam.shortName}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
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
