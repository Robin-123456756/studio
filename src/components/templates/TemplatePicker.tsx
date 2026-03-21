"use client";

import { TEMPLATE_TYPES, type TemplateTypeId } from "./shared";

/* ── Style tokens (admin dark theme) ──────────────────────────────────── */
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const SURFACE = "#1A2236";

type Props = {
  selected: TemplateTypeId | null;
  onChange: (id: TemplateTypeId) => void;
};

export default function TemplatePicker({ selected, onChange }: Props) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: MUTED,
          marginBottom: 8,
        }}
      >
        Choose Template
      </label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 8,
        }}
      >
        {TEMPLATE_TYPES.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "14px 8px",
                borderRadius: 10,
                border: `2px solid ${active ? ACCENT : BORDER}`,
                background: active ? ACCENT + "10" : SURFACE,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                minHeight: 90,
              }}
            >
              <span style={{ fontSize: 26 }}>{t.icon}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: active ? ACCENT : TEXT,
                  lineHeight: 1.2,
                }}
              >
                {t.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: MUTED,
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                {t.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
