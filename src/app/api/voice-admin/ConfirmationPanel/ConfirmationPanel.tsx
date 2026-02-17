import React, { useState, useCallback, useMemo } from "react";

const ACCENT = "#00E676";
const BG_DARK = "#0A0F1C";
const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#94A3B8";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";
const INFO = "#818CF8";

// ── Action config ───────────────────────────────────────────
const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  appearance:  { icon: "👤", label: "APP", color: TEXT_SECONDARY },
  goal:        { icon: "⚽", label: "GLS", color: ACCENT },
  assist:      { icon: "🅰️", label: "AST", color: "#60A5FA" },
  clean_sheet: { icon: "🛡️", label: "CS",  color: "#34D399" },
  own_goal:    { icon: "🔴", label: "OG",  color: ERROR },
  pen_miss:    { icon: "❌", label: "PM",  color: ERROR },
  pen_save:    { icon: "🧤", label: "PS",  color: SUCCESS },
  save_3:      { icon: "🧤", label: "S3",  color: "#818CF8" },
  yellow:      { icon: "🟨", label: "YC",  color: WARNING },
  red:         { icon: "🟥", label: "RC",  color: ERROR },
};

const ACTION_LIMITS: Record<string, number> = {
  appearance: 1, goal: 10, assist: 10, clean_sheet: 1,
  own_goal: 5, pen_miss: 5, pen_save: 5, save_3: 10,
  yellow: 1, red: 1,
};

const POS_WARNINGS: Record<string, string[]> = {
  GKP: ["goal", "assist"],
  FWD: ["clean_sheet", "pen_save", "save_3"],
  MID: ["pen_save", "save_3"],
};

// ── Validation logic (inline, mirrors rules-engine.ts) ──────
function validate(entries: any[], matchId: number | null) {
  const warnings = [];
  const errors = [];

  if (!matchId) {
    errors.push({ type: "match", message: "No match selected." });
  }
  if (entries.length === 0) {
    errors.push({ type: "empty", message: "No entries to commit." });
  }

  for (const entry of entries) {
    const name = entry.player?.web_name || entry.spoken_name;
    const pos = entry.player?.position || "MID";

    for (const a of entry.actions) {
      const max = ACTION_LIMITS[a.action];
      if (max && a.quantity > max) {
        errors.push({ type: "range", player: name, message: `${name}: ${a.action} ×${a.quantity} exceeds max (${max})` });
      }
      const posWarn = POS_WARNINGS[pos] || [];
      if (posWarn.includes(a.action)) {
        warnings.push({ type: "position", player: name, message: `${name} (${pos}) with "${a.action}" — unusual` });
      }
    }

    const hasY = entry.actions.some((a: any) => a.action === "yellow");
    const hasR = entry.actions.some((a: any) => a.action === "red");
    if (hasY && hasR) warnings.push({ type: "conflict", player: name, message: `${name}: both yellow and red — second yellow?` });

    const hasCS = entry.actions.some((a: any) => a.action === "clean_sheet");
    const hasOG = entry.actions.some((a: any) => a.action === "own_goal");
    if (hasCS && hasOG) errors.push({ type: "conflict", player: name, message: `${name}: clean sheet + own goal is impossible` });
  }

  const ids = entries.map((e: any) => e.player?.id).filter(Boolean);
  const dupes = ids.filter((id: any, i: number) => ids.indexOf(id) !== i);
  if (dupes.length) {
    const name = entries.find((e: any) => e.player?.id === dupes[0])?.player?.web_name || "Unknown";
    warnings.push({ type: "dedup", player: name, message: `${name} appears multiple times in this batch` });
  }

  return { valid: errors.length === 0, warnings, errors };
}

// ── Severity badge ──────────────────────────────────────────
function Badge({ type, children }: { type: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { error: ERROR, warning: WARNING, info: INFO, success: SUCCESS };
  const c = colors[type] || TEXT_MUTED;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
      backgroundColor: c + "18", color: c, border: `1px solid ${c}30`,
      fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

// ── Player entry card ───────────────────────────────────────
function PlayerCard({ entry, index, onUpdateAction, onRemoveEntry, onRemoveAction }: { entry: any; index: number; onUpdateAction: (ei: number, ai: number, qty: number) => void; onRemoveEntry: (idx: number) => void; onRemoveAction: (ei: number, ai: number) => void }) {
  const name = entry.player?.web_name || entry.spoken_name;
  const fullName = entry.player?.name || name;
  const position = entry.player?.position || "?";
  const team = entry.player?.team_name || "";
  const confidence = entry.matchConfidence || 0;

  const posColors: Record<string, string> = { GKP: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444" };

  return (
    <div style={{
      backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
      overflow: "hidden", transition: "border-color 0.2s",
    }}>
      {/* Player header */}
      <div style={{
        padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8,
            backgroundColor: (posColors[position] || TEXT_MUTED) + "20",
            color: posColors[position] || TEXT_MUTED,
            fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {position}
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>{name}</p>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED }}>
              {fullName !== name ? `${fullName} · ` : ""}{team}
              {confidence > 0 && (
                <span style={{ marginLeft: 6, color: confidence >= 0.8 ? SUCCESS : WARNING }}>
                  {Math.round(confidence * 100)}% match
                </span>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 18, fontWeight: 700, color: ACCENT,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {entry.totalPoints}pts
          </span>
          <button
            onClick={() => onRemoveEntry(index)}
            title="Remove player"
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`,
              backgroundColor: "transparent", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: TEXT_MUTED,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ERROR; e.currentTarget.style.color = ERROR; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 16px" }}>
        {entry.actions.map((action: any, ai: number) => {
          const meta = ACTION_META[action.action] || { icon: "?", label: action.action, color: TEXT_MUTED };
          const max = ACTION_LIMITS[action.action] || 10;

          return (
            <div key={ai} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: ai < entry.actions.length - 1 ? `1px solid ${BORDER}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                <span style={{ fontSize: 13, color: meta.color, fontWeight: 500 }}>
                  {meta.label}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Quantity controls */}
                <button
                  onClick={() => {
                    if (action.quantity > 1) onUpdateAction(index, ai, action.quantity - 1);
                  }}
                  disabled={action.quantity <= 1}
                  style={{
                    width: 24, height: 24, borderRadius: 4, border: `1px solid ${BORDER}`,
                    backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, cursor: action.quantity > 1 ? "pointer" : "not-allowed",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: action.quantity > 1 ? 1 : 0.3,
                  }}
                >
                  −
                </button>

                <span style={{
                  width: 28, textAlign: "center", fontSize: 14, fontWeight: 700,
                  color: TEXT_PRIMARY, fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {action.quantity}
                </span>

                <button
                  onClick={() => {
                    if (action.quantity < max) onUpdateAction(index, ai, action.quantity + 1);
                  }}
                  disabled={action.quantity >= max}
                  style={{
                    width: 24, height: 24, borderRadius: 4, border: `1px solid ${BORDER}`,
                    backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, cursor: action.quantity < max ? "pointer" : "not-allowed",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: action.quantity < max ? 1 : 0.3,
                  }}
                >
                  +
                </button>

                {/* Points for this action */}
                {entry.pointsBreakdown && (
                  <span style={{
                    marginLeft: 8, fontSize: 12, color: TEXT_MUTED,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {entry.pointsBreakdown.find((b: any) => b.action === action.action)?.points || 0}pts
                  </span>
                )}

                {/* Remove action */}
                <button
                  onClick={() => onRemoveAction(index, ai)}
                  style={{
                    marginLeft: 4, width: 20, height: 20, borderRadius: 4,
                    border: "none", backgroundColor: "transparent",
                    cursor: "pointer", color: TEXT_MUTED, fontSize: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = ERROR; }}
                  onMouseLeave={e => { e.currentTarget.style.color = TEXT_MUTED; }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Unresolved player card ──────────────────────────────────
function UnresolvedCard({ entry, onSelectCandidate, onDismiss, entryIndex }: { entry: any; onSelectCandidate: (idx: number, candidate: any) => void; onDismiss: (idx: number) => void; entryIndex: number }) {
  return (
    <div style={{
      backgroundColor: BG_CARD, border: `1px solid ${WARNING}40`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${BORDER}`, backgroundColor: `${WARNING}08`,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: WARNING }}>
            ⚠️ "{entry.spoken_name}" — not matched
          </p>
          <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            Actions: {entry.actions.map((a: any) => `${a.action}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ")}
          </p>
        </div>
        <button
          onClick={() => onDismiss(entryIndex)}
          style={{
            padding: "4px 10px", borderRadius: 6, border: `1px solid ${BORDER}`,
            backgroundColor: "transparent", color: TEXT_MUTED, cursor: "pointer",
            fontSize: 11, fontWeight: 600,
          }}
        >
          Skip
        </button>
      </div>

      {entry.candidates && entry.candidates.length > 0 && (
        <div style={{ padding: "8px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
            Did you mean:
          </p>
          {entry.candidates.slice(0, 5).map((c: any, ci: number) => (
            <button
              key={ci}
              onClick={() => onSelectCandidate(entryIndex, c)}
              style={{
                display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", marginBottom: 4, borderRadius: 8,
                border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                cursor: "pointer", color: TEXT_PRIMARY, fontSize: 13,
                fontFamily: "inherit", textAlign: "left",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT + "60"; e.currentTarget.style.backgroundColor = `${ACCENT}08`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.backgroundColor = BG_SURFACE; }}
            >
              <span>{c.web_name || c.name} <span style={{ color: TEXT_MUTED, fontSize: 11 }}>({c.position} · {c.team_name})</span></span>
              <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                {Math.round((c.confidence || 0) * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Confirm component ──────────────────────────────────
export default function ConfirmPanel({ pipelineResult, matchId, onConfirm, onCancel, onUndo }: { pipelineResult: any; matchId: number | null; onConfirm?: (result: any) => void; onCancel: () => void; onUndo?: () => void }) {
  const [entries, setEntries] = useState<any[]>(pipelineResult?.resolved || []);
  const [unresolved, setUnresolved] = useState<any[]>(pipelineResult?.unresolved || []);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  // Re-validate whenever entries change
  const validation = useMemo(
    () => validate(entries, matchId),
    [entries, matchId]
  );

  const totalPoints = useMemo(
    () => entries.reduce((sum, e) => sum + (e.totalPoints || 0), 0),
    [entries]
  );

  // ── Edit handlers ─────────────────────────────────────────
  const updateAction = useCallback((entryIdx: number, actionIdx: number, newQty: number) => {
    setEntries(prev => {
      const next = [...prev];
      const entry = { ...next[entryIdx] };
      const actions = [...entry.actions];
      actions[actionIdx] = { ...actions[actionIdx], quantity: newQty };
      entry.actions = actions;

      // Recalculate points (approximate — uses stored breakdown)
      if (entry.pointsBreakdown) {
        const bp = entry.pointsBreakdown.find((b: any) => b.action === actions[actionIdx].action);
        if (bp) {
          const oldQty = prev[entryIdx].actions[actionIdx].quantity;
          const pointsDiff = bp.pointsPerUnit * (newQty - oldQty);
          entry.totalPoints = (entry.totalPoints || 0) + pointsDiff;
        }
      }

      next[entryIdx] = entry;
      return next;
    });
  }, []);

  const removeEntry = useCallback((idx: number) => {
    setEntries(prev => prev.filter((_: any, i: number) => i !== idx));
  }, []);

  const removeAction = useCallback((entryIdx: number, actionIdx: number) => {
    setEntries(prev => {
      const next = [...prev];
      const entry = { ...next[entryIdx] };
      entry.actions = entry.actions.filter((_: any, i: number) => i !== actionIdx);

      // Remove player if no actions left
      if (entry.actions.length === 0) {
        return next.filter((_: any, i: number) => i !== entryIdx);
      }

      next[entryIdx] = entry;
      return next;
    });
  }, []);

  const selectCandidate = useCallback((unresolvedIdx: number, candidate: any) => {
    const unresEntry = unresolved[unresolvedIdx];
    // Move to resolved with selected candidate
    const resolved = {
      spoken_name: unresEntry.spoken_name,
      player: candidate,
      actions: unresEntry.actions,
      pointsBreakdown: [],
      totalPoints: 0, // Will need recalculation
      matchConfidence: candidate.confidence || 0.5,
      matchStrategy: "manual_selection",
    };
    setEntries(prev => [...prev, resolved]);
    setUnresolved(prev => prev.filter((_: any, i: number) => i !== unresolvedIdx));
  }, [unresolved]);

  const dismissUnresolved = useCallback((idx: number) => {
    setUnresolved(prev => prev.filter((_: any, i: number) => i !== idx));
  }, []);

  // ── Commit ────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!validation.valid || entries.length === 0) return;
    setCommitting(true);

    try {
      const res = await fetch("/api/voice-admin/commit-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          entries,
          adminId: 1, // TODO: from auth context
          transcript: pipelineResult?.transcript || "",
          aiInterpretation: pipelineResult?.interpretation || {},
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setCommitResult(result);
        setCommitted(true);
        setUndoAvailable(true);
        if (onConfirm) onConfirm(result);
      } else {
        setCommitResult({ error: result.error || "Commit failed" });
      }
    } catch (err) {
      setCommitResult({ error: "Network error — is the dev server running?" });
    }

    setCommitting(false);
  }, [entries, matchId, pipelineResult, validation, onConfirm]);

  // ── Undo ──────────────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    if (!commitResult?.auditLogId) return;

    try {
      const res = await fetch("/api/voice-admin/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogId: commitResult.auditLogId }),
      });

      if (res.ok) {
        setCommitted(false);
        setCommitResult(null);
        setUndoAvailable(false);
        if (onUndo) onUndo();
      }
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }, [commitResult, onUndo]);

  // ── Committed state ───────────────────────────────────────
  if (committed && commitResult && !commitResult.error) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto", fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');`}</style>

        <div style={{
          backgroundColor: BG_CARD, border: `1px solid ${SUCCESS}40`, borderRadius: 14,
          padding: 32, textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
            backgroundColor: `${SUCCESS}20`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
          }}>
            ✓
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY }}>
            Stats Committed
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: TEXT_SECONDARY }}>
            {commitResult.message || `Saved ${entries.length} player entries`}
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {undoAvailable && (
              <button
                onClick={handleUndo}
                style={{
                  padding: "10px 20px", borderRadius: 8,
                  border: `1px solid ${WARNING}40`, backgroundColor: `${WARNING}10`,
                  color: WARNING, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ↩ Undo
              </button>
            )}
            <button
              onClick={onCancel}
              style={{
                padding: "10px 20px", borderRadius: 8,
                border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                color: TEXT_PRIMARY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 24, maxWidth: 560, margin: "0 auto",
      fontFamily: "'Outfit', system-ui, sans-serif", color: TEXT_PRIMARY,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Confirm Stats</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: TEXT_MUTED }}>
            {pipelineResult?.transcript && `"${pipelineResult.transcript}"`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge type={validation.valid ? "success" : "error"}>
            {validation.valid ? "Valid" : `${validation.errors.length} error${validation.errors.length > 1 ? "s" : ""}`}
          </Badge>
        </div>
      </div>

      {/* ── Summary bar ───────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 20, padding: "12px 16px",
        backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
      }}>
        {[
          { label: "Players", value: entries.length, color: TEXT_PRIMARY },
          { label: "Total Pts", value: totalPoints, color: ACCENT },
          { label: "Warnings", value: validation.warnings.length, color: validation.warnings.length > 0 ? WARNING : TEXT_MUTED },
          { label: "Unresolved", value: unresolved.length, color: unresolved.length > 0 ? WARNING : TEXT_MUTED },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
              {value}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Errors ────────────────────────────────────────── */}
      {validation.errors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {validation.errors.map((err, i) => (
            <div key={i} style={{
              padding: "10px 14px", marginBottom: 6, borderRadius: 8,
              backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`,
              fontSize: 13, color: ERROR, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>🚫</span> {err.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Warnings ──────────────────────────────────────── */}
      {validation.warnings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {validation.warnings.map((w, i) => (
            <div key={i} style={{
              padding: "10px 14px", marginBottom: 6, borderRadius: 8,
              backgroundColor: `${WARNING}10`, border: `1px solid ${WARNING}30`,
              fontSize: 13, color: WARNING, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>⚠️</span> {w.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Resolved players ──────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {entries.map((entry, i) => (
          <PlayerCard
            key={`${entry.player?.id || i}-${i}`}
            entry={entry}
            index={i}
            onUpdateAction={updateAction}
            onRemoveEntry={removeEntry}
            onRemoveAction={removeAction}
          />
        ))}
      </div>

      {/* ── Unresolved players ────────────────────────────── */}
      {unresolved.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: WARNING, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Needs Resolution ({unresolved.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {unresolved.map((entry, i) => (
              <UnresolvedCard
                key={i}
                entry={entry}
                entryIndex={i}
                onSelectCandidate={selectCandidate}
                onDismiss={dismissUnresolved}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Commit error ──────────────────────────────────── */}
      {commitResult?.error && (
        <div style={{
          padding: "10px 14px", marginBottom: 16, borderRadius: 8,
          backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`,
          fontSize: 13, color: ERROR,
        }}>
          Commit failed: {commitResult.error}
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "14px 20px", borderRadius: 10,
            border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
            color: TEXT_SECONDARY, fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!validation.valid || entries.length === 0 || committing}
          style={{
            flex: 2, padding: "14px 20px", borderRadius: 10,
            border: "none",
            backgroundColor: validation.valid && entries.length > 0 ? ACCENT : TEXT_MUTED,
            color: BG_DARK, fontSize: 14, fontWeight: 700,
            cursor: validation.valid && entries.length > 0 && !committing ? "pointer" : "not-allowed",
            fontFamily: "inherit", opacity: committing ? 0.7 : 1,
            transition: "all 0.2s",
          }}
        >
          {committing ? "Committing..." : `Confirm ${entries.length} Player${entries.length !== 1 ? "s" : ""} → DB`}
        </button>
      </div>
    </div>
  );
}