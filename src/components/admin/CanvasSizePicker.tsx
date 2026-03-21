"use client";

/* ── Canva-style canvas size picker for feed media ──────────────────────── */

const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const SURFACE = "#1A2236";

export type CanvasSize = {
  id: string;
  label: string;
  /** e.g. "1080 × 1080" */
  dimensions: string;
  /** width / height — undefined means free-form */
  aspect: number | undefined;
  /** Target export width in px (used by ImageEditor canvas) */
  width: number | undefined;
  /** Target export height in px */
  height: number | undefined;
};

export const CANVAS_SIZES: CanvasSize[] = [
  { id: "free",    label: "Free",         dimensions: "Original",    aspect: undefined,  width: undefined, height: undefined },
  { id: "feed",    label: "Feed Card",    dimensions: "1600 × 900",  aspect: 16 / 9,     width: 1600,      height: 900 },
  { id: "square",  label: "Square",       dimensions: "1080 × 1080", aspect: 1,           width: 1080,      height: 1080 },
  { id: "portrait",label: "Portrait",     dimensions: "1080 × 1350", aspect: 4 / 5,       width: 1080,      height: 1350 },
  { id: "story",   label: "Story",        dimensions: "1080 × 1920", aspect: 9 / 16,      width: 1080,      height: 1920 },
  { id: "banner",  label: "Wide Banner",  dimensions: "1200 × 600",  aspect: 2 / 1,       width: 1200,      height: 600 },
  { id: "classic", label: "Classic",      dimensions: "1200 × 900",  aspect: 4 / 3,       width: 1200,      height: 900 },
];

/** Small aspect-ratio thumbnail block */
function SizeThumb({ aspect }: { aspect: number | undefined }) {
  // Normalise so the longest edge is 32px
  const maxDim = 32;
  let w: number, h: number;
  if (!aspect) {
    w = maxDim;
    h = maxDim * 0.7; // generic "free" shape
  } else if (aspect >= 1) {
    w = maxDim;
    h = maxDim / aspect;
  } else {
    h = maxDim;
    w = maxDim * aspect;
  }

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 3,
        border: `1.5px solid ${MUTED}`,
        background: `${MUTED}20`,
        flexShrink: 0,
      }}
    />
  );
}

type Props = {
  selected: string;
  onChange: (size: CanvasSize) => void;
};

export default function CanvasSizePicker({ selected, onChange }: Props) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          color: MUTED,
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        Canvas Size
      </label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 8,
        }}
      >
        {CANVAS_SIZES.map((s) => {
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 6px",
                borderRadius: 10,
                border: `2px solid ${active ? ACCENT : BORDER}`,
                background: active ? ACCENT + "10" : SURFACE,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                minHeight: 80,
              }}
            >
              <SizeThumb aspect={s.aspect} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: active ? ACCENT : TEXT,
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: MUTED,
                  lineHeight: 1.2,
                }}
              >
                {s.dimensions}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
