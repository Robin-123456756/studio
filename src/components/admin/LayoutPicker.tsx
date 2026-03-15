"use client";

/* ── Layout template picker for feed media ─────────────────────────────── */

const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const SURFACE = "#1A2236";

export type LayoutType =
  | "hero"        // Full-width image + headline overlay
  | "split"       // Image left, text right (2-column)
  | "feature"     // Large headline + subtitle + body + image below
  | "gallery"     // Multi-image carousel with captions
  | "quick"       // Text-only with accent border (no image required)
  | "video";      // Video with overlay text

type LayoutOption = {
  id: LayoutType;
  label: string;
  description: string;
  icon: string; // simple ASCII art representation
  requiresMedia: boolean;
};

const LAYOUTS: LayoutOption[] = [
  {
    id: "hero",
    label: "Hero",
    description: "Full-width image with headline overlay",
    icon: "🖼️",
    requiresMedia: true,
  },
  {
    id: "split",
    label: "Split",
    description: "Image left, text right",
    icon: "📐",
    requiresMedia: true,
  },
  {
    id: "feature",
    label: "Feature",
    description: "Big headline + image below",
    icon: "📰",
    requiresMedia: true,
  },
  {
    id: "gallery",
    label: "Gallery",
    description: "Multi-image carousel",
    icon: "🎞️",
    requiresMedia: true,
  },
  {
    id: "video",
    label: "Video",
    description: "Video with text overlay",
    icon: "🎬",
    requiresMedia: true,
  },
  {
    id: "quick",
    label: "Quick Update",
    description: "Text-only, no media needed",
    icon: "⚡",
    requiresMedia: false,
  },
];

type Props = {
  selected: LayoutType;
  onChange: (layout: LayoutType) => void;
};

export default function LayoutPicker({ selected, onChange }: Props) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, color: MUTED, marginBottom: 8 }}>
        Content Template
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {LAYOUTS.map((l) => {
          const active = selected === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "12px 8px",
                borderRadius: 10,
                border: `2px solid ${active ? ACCENT : BORDER}`,
                background: active ? ACCENT + "10" : SURFACE,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <span style={{ fontSize: 22 }}>{l.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? ACCENT : TEXT }}>
                {l.label}
              </span>
              <span style={{ fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.3 }}>
                {l.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { LAYOUTS };
