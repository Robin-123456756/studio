"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING,
  inputStyle, btnGreen, btnMuted, globalResetCSS, sectionHeaderStyle,
} from "@/lib/admin-theme";

const NOTIF_TYPES = [
  { value: "info", label: "Info", color: "#3B82F6" },
  { value: "warning", label: "Warning", color: WARNING },
  { value: "success", label: "Success", color: SUCCESS },
  { value: "match_update", label: "Match Update", color: ACCENT },
  { value: "deadline", label: "Deadline", color: ERROR },
] as const;

export default function SendNotificationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [link, setLink] = useState("");
  const [managerCount, setManagerCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/admin/notifications/send")
      .then((r) => r.json())
      .then((d) => setManagerCount(d.managerCount ?? 0))
      .catch(() => {});
  }, []);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), type, link: link.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, text: `Notification sent to ${data.sent} manager(s).` });
        setTitle("");
        setMessage("");
        setLink("");
        setShowConfirm(false);
      } else {
        setResult({ ok: false, text: data.error || "Failed to send." });
      }
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    } finally {
      setSending(false);
    }
  }

  const canSend = title.trim().length > 0 && message.trim().length > 0;

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>
            ← Back to Dashboard
          </button>

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Send Notification</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 24px" }}>
            Broadcast a notification to all fantasy managers.
            {managerCount !== null && (
              <span style={{ color: ACCENT, fontWeight: 600 }}> ({managerCount} managers)</span>
            )}
          </p>

          {/* Form */}
          <div style={{ padding: 20, borderRadius: 12, background: BG_CARD, border: `1px solid ${BORDER}` }}>
            {/* Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...sectionHeaderStyle, margin: "0 0 8px", fontSize: 11 }}>Type</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {NOTIF_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    style={{
                      padding: "6px 14px", borderRadius: 6,
                      border: `1px solid ${type === t.value ? t.color : BORDER}`,
                      backgroundColor: type === t.value ? `${t.color}15` : "transparent",
                      color: type === t.value ? t.color : TEXT_MUTED,
                      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Title *</label>
              <input
                type="text"
                placeholder="e.g. Gameweek 5 Deadline Reminder"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                style={inputStyle}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Message *</label>
              <textarea
                placeholder="Write your notification message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" as const }}
              />
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4, textAlign: "right" as const }}>
                {message.length}/500
              </div>
            </div>

            {/* Link */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginBottom: 4 }}>Link (optional)</label>
              <input
                type="text"
                placeholder="e.g. /picks or /dashboard"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Send / Confirm */}
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!canSend}
                style={{ ...btnGreen, opacity: canSend ? 1 : 0.4, width: "100%", padding: "12px 18px", fontSize: 14 }}
              >
                Send to {managerCount ?? "..."} Managers
              </button>
            ) : (
              <div style={{
                padding: 14, borderRadius: 8,
                background: `${WARNING}10`, border: `1px solid ${WARNING}30`,
              }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: WARNING, fontWeight: 600 }}>
                  Are you sure? This will send to {managerCount ?? "all"} managers immediately.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    style={{ ...btnGreen, flex: 1 }}
                  >
                    {sending ? "Sending..." : "Yes, Send Now"}
                  </button>
                  <button onClick={() => setShowConfirm(false)} style={btnMuted}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div style={{
                marginTop: 14, padding: 12, borderRadius: 8,
                background: result.ok ? `${SUCCESS}15` : `${ERROR}15`,
                border: `1px solid ${result.ok ? SUCCESS : ERROR}44`,
                color: result.ok ? SUCCESS : ERROR,
                fontSize: 13, fontWeight: 500,
              }}>
                {result.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
