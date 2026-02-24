// Canonical admin dark theme tokens — import in all admin pages
export const BG_DARK = "#0A0F1C";
export const BG_CARD = "#111827";
export const BG_SURFACE = "#1A2236";
export const BORDER = "#1E293B";
export const ACCENT = "#00E676";
export const ACCENT_DIM = "#00C853";
export const TEXT_PRIMARY = "#F1F5F9";
export const TEXT_SECONDARY = "#CBD5E1";
export const TEXT_MUTED = "#64748B";
export const ERROR = "#EF4444";
export const WARNING = "#F59E0B";
export const SUCCESS = "#10B981";
export const INFO = "#3B82F6";

// Shared inline style fragments
export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: BG_SURFACE,
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontFamily: "'Outfit', system-ui, sans-serif",
  outline: "none",
};

export const btnGreen: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
  color: "#000",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

export const btnMuted: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: "transparent",
  color: TEXT_MUTED,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

export const btnDanger: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  backgroundColor: ERROR,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

export const btnSmall: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: "transparent",
  color: TEXT_MUTED,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Outfit', system-ui, sans-serif",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: TEXT_MUTED,
  fontWeight: 600,
  marginBottom: 4,
};

export const sectionHeaderStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 13,
  fontWeight: 600,
  color: TEXT_MUTED,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');`;

export const globalResetCSS = (bgDark: string) => `
  ${FONT_IMPORT}
  * { box-sizing: border-box; }
  body { margin: 0; background: ${bgDark}; }
`;
