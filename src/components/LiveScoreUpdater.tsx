"use client";

import { useState, useEffect } from "react";
import { useRealtimeTable } from "@/hooks/use-realtime";

interface ScoreUpdate {
  player_id: string;
  action: string;
  points_awarded: number;
  match_id: number;
}

/**
 * Shows a toast notification when match events are recorded.
 * Place this in your main layout to get live updates on any page.
 */
export default function LiveScoreUpdater() {
  const [toasts, setToasts] = useState<{ id: number; message: string; points: number; timestamp: number }[]>([]);

  const { latestEvent } = useRealtimeTable<ScoreUpdate>("player_match_events", {
    event: "INSERT",
    enabled: true,
  });

  useEffect(() => {
    if (!latestEvent?.new) return;
    const event = latestEvent.new;

    // Skip appearances (too noisy)
    if (event.action === "appearance") return;

    const actionLabels: Record<string, string> = {
      goal: "⚽ Goal!",
      assist: "🅰️ Assist!",
      clean_sheet: "🧤 Clean sheet!",
      yellow: "🟨 Yellow card",
      red: "🟥 Red card",
      own_goal: "😬 Own goal",
      pen_save: "🦸 Penalty saved!",
      pen_miss: "❌ Penalty missed",
    };

    const label = actionLabels[event.action] || event.action;
    const toast = {
      id: Date.now(),
      message: label,
      points: event.points_awarded,
      timestamp: Date.now(),
    };

    setToasts((prev) => [toast, ...prev].slice(0, 5));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, [latestEvent]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; }
          to { opacity: 0; transform: translateX(100px); }
        }
      `}</style>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: "12px 18px",
            backgroundColor: "#111827",
            border: `1px solid ${toast.points > 0 ? "#00E676" : "#EF4444"}40`,
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "toastIn 0.3s ease-out",
            minWidth: 200,
          }}
        >
          <span style={{ fontSize: 14, color: "#F1F5F9", fontWeight: 600 }}>
            {toast.message}
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              backgroundColor: `${toast.points > 0 ? "#00E676" : "#EF4444"}15`,
              color: toast.points > 0 ? "#00E676" : "#EF4444",
              marginLeft: "auto",
            }}
          >
            {toast.points > 0 ? "+" : ""}{toast.points}pts
          </span>
        </div>
      ))}
    </div>
  );
}