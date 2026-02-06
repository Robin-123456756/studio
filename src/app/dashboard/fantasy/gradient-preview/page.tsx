"use client";

import * as React from "react";
import Link from "next/link";

const GRADIENTS = [
  {
    name: "A: Crimson → Black → Gold",
    bg: "linear-gradient(135deg, #DC143C 0%, #8B0000 20%, #1a0a0a 45%, #2a1a00 70%, #D4A843 90%, #FFD700 100%)",
    swirl1: "linear-gradient(160deg, transparent 20%, rgba(255,215,0,0.12) 40%, rgba(212,168,67,0.18) 60%, rgba(255,215,0,0.08) 80%)",
    swirl2: "linear-gradient(180deg, rgba(255,215,0,0.06), rgba(212,168,67,0.12))",
    accent: "#FFD700",
    accentRgba: "rgba(255,215,0,",
    desc: "Premium sports — Arsenal/Man Utd energy",
  },
  {
    name: "B: Wine → Maroon → Rose",
    bg: "linear-gradient(135deg, #722F37 0%, #4A0E1B 20%, #2D0A12 45%, #5C1A2A 65%, #D4849A 85%, #F5C6D0 100%)",
    swirl1: "linear-gradient(160deg, transparent 20%, rgba(212,132,154,0.15) 40%, rgba(245,198,208,0.18) 60%, rgba(212,132,154,0.1) 80%)",
    swirl2: "linear-gradient(180deg, rgba(245,198,208,0.06), rgba(212,132,154,0.12))",
    accent: "#F5C6D0",
    accentRgba: "rgba(245,198,208,",
    desc: "Elegant luxury — modern & sophisticated",
  },
  {
    name: "C: Red → Dark Purple → Silver",
    bg: "linear-gradient(135deg, #C8102E 0%, #8B0000 18%, #37003C 42%, #2A0030 60%, #8C8C9E 82%, #E8E8EE 100%)",
    swirl1: "linear-gradient(160deg, transparent 20%, rgba(200,200,220,0.15) 40%, rgba(232,232,238,0.2) 60%, rgba(200,200,220,0.1) 80%)",
    swirl2: "linear-gradient(180deg, rgba(232,232,238,0.06), rgba(200,200,220,0.12))",
    accent: "#E8E8EE",
    accentRgba: "rgba(232,232,238,",
    desc: "Ties into Budo League brand colors",
  },
];

export default function GradientPreview() {
  return (
    <div style={{
      maxWidth: 460, margin: "0 auto", padding: "16px 0 40px",
      fontFamily: "'Outfit', 'DM Sans', -apple-system, sans-serif",
      background: "#f2f2f2", minHeight: "100vh",
    }}>
      <div style={{ padding: "0 16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/dashboard/fantasy" style={{ color: "#37003C", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          ← Back
        </Link>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e" }}>Gradient Preview</span>
      </div>

      {GRADIENTS.map((g, i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          {/* Label */}
          <div style={{ padding: "0 16px 8px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>{g.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{g.desc}</div>
          </div>

          {/* Hero preview */}
          <div style={{
            background: g.bg,
            padding: "0 0 24px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Swirl decorations */}
            <div style={{
              position: "absolute", top: -40, right: -60,
              width: 280, height: 380,
              background: g.swirl1,
              borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
              transform: "rotate(-15deg)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: 80, right: -30,
              width: 200, height: 300,
              background: g.swirl2,
              borderRadius: "60% 40% 30% 70% / 50% 60% 40% 50%",
              transform: "rotate(25deg)",
              pointerEvents: "none",
            }} />

            {/* Team Info */}
            <div style={{
              display: "flex", alignItems: "center",
              padding: "16px 20px 14px", gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "rgba(255,255,255,0.15)",
                border: "1.5px solid rgba(255,255,255,0.25)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                  <path d="M12 8v4l3 3" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 6, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 1 }}>Generate</span>
                <span style={{ fontSize: 5, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>team badge</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>Barca fc</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <div style={{ width: 18, height: 12, borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ flex: 1, background: "#000" }} />
                    <div style={{ flex: 1, background: "#FCDC04" }} />
                    <div style={{ flex: 1, background: "#D90000" }} />
                    <div style={{ flex: 1, background: "#000" }} />
                    <div style={{ flex: 1, background: "#FCDC04" }} />
                    <div style={{ flex: 1, background: "#D90000" }} />
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 500 }}>
                    James Robin Wambi
                  </span>
                </div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Divider */}
            <div style={{ width: 60, height: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px", borderRadius: 1 }} />

            {/* GW label */}
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Gameweek 24
            </div>

            {/* Points Row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 20px 16px" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>55</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 4 }}>Average</div>
              </div>
              <div style={{ flex: 1.2, textAlign: "center" }}>
                <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1 }}>58</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: g.accent, fontWeight: 700 }}>Points</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke={g.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>126</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Highest</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 60, height: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px", borderRadius: 1 }} />

            {/* Deadline */}
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>Gameweek 25</div>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginTop: 4 }}>
                Deadline: Friday 6 Feb at 21:30
              </div>
            </div>

            {/* CTA Buttons */}
            <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                width: "100%", padding: "14px 0",
                background: `linear-gradient(90deg, ${g.accentRgba}0.2), ${g.accentRgba}0.12))`,
                border: "1.5px solid rgba(255,255,255,0.2)",
                borderRadius: 28,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L9 9H2l6 4.5L5.5 22 12 17l6.5 5-2.5-8.5L22 9h-7L12 2z" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.15)" />
                </svg>
                <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Pick Team</span>
              </div>
              <div style={{
                width: "100%", padding: "14px 0",
                background: `linear-gradient(90deg, ${g.accentRgba}0.2), ${g.accentRgba}0.12))`,
                border: "1.5px solid rgba(255,255,255,0.2)",
                borderRadius: 28,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Transfers</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
