"use client";

import { useState, useEffect } from "react";
import { useRealtimeTable } from "@/hooks/use-realtime";

interface FeedItem {
  id: number;
  action_type: string;
  message: string;
  player_name: string | null;
  team_name: string | null;
  points: number | null;
  gameweek_id: number | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  goal: "#00E676",
  assist: "#3B82F6",
  clean_sheet: "#A855F7",
  yellow: "#F59E0B",
  red: "#EF4444",
  own_goal: "#EF4444",
  pen_save: "#00E676",
  pen_miss: "#F59E0B",
};

export default function LiveActivityFeed({ gameweekId }: { gameweekId?: number }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);

  // Subscribe to real-time activity feed
  const { latestEvent, isConnected } = useRealtimeTable<FeedItem>("activity_feed", {
    event: "INSERT",
    enabled: isLive,
  });

  // Load initial feed
  useEffect(() => {
    async function loadFeed() {
      try {
        const url = gameweekId
          ? `/api/activity-feed?gw=${gameweekId}&limit=50`
          : "/api/activity-feed?limit=50";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setFeed(data.feed || []);
        }
      } catch {}
      setLoading(false);
    }
    loadFeed();
  }, [gameweekId]);

  // Add new real-time events
  useEffect(() => {
    if (latestEvent?.new) {
      const incoming = latestEvent.new;
      if (gameweekId && incoming.gameweek_id !== gameweekId) return;

      setFeed((prev) => [incoming, ...prev.filter((item) => item.id !== incoming.id)].slice(0, 100));
    }
  }, [latestEvent, gameweekId]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 10) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: "1px solid #1E293B",
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #1E293B",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>
            Live Activity
          </span>
          {isConnected && isLive && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#00E676",
                display: "inline-block",
                animation: "blink 2s ease-in-out infinite",
              }}
            />
          )}
        </div>
        <button
          onClick={() => setIsLive(!isLive)}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${isLive ? "#00E676" + "40" : "#1E293B"}`,
            backgroundColor: isLive ? "#00E676" + "15" : "transparent",
            color: isLive ? "#00E676" : "#64748B",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {isLive ? "● LIVE" : "○ PAUSED"}
        </button>
      </div>

      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Feed */}
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748B" }}>
            Loading...
          </div>
        ) : feed.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748B" }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📡</p>
            <p style={{ fontSize: 13 }}>No activity yet. Events will appear here live!</p>
          </div>
        ) : (
          feed.map((item, i) => {
            const color = ACTION_COLORS[item.action_type] || "#64748B";
            const isNew = i === 0 && latestEvent?.new?.id === item.id;

            return (
              <div
                key={item.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #1E293B",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  animation: isNew ? "slideIn 0.3s ease-out" : "none",
                  backgroundColor: isNew ? `${color}08` : "transparent",
                }}
              >
                {/* Color indicator */}
                <div
                  style={{
                    width: 4,
                    height: 32,
                    borderRadius: 2,
                    backgroundColor: color,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#F1F5F9", fontWeight: 500 }}>
                      {item.message}
                    </span>
                    {item.points != null && item.points !== 0 && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: "'JetBrains Mono', monospace",
                          backgroundColor: `${item.points > 0 ? "#00E676" : "#EF4444"}15`,
                          color: item.points > 0 ? "#00E676" : "#EF4444",
                          whiteSpace: "nowrap",
                          marginLeft: 8,
                        }}
                      >
                        {item.points > 0 ? "+" : ""}{item.points}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: "#64748B" }}>
                    {item.team_name && <span>{item.team_name}</span>}
                    {item.gameweek_id && <span>· GW{item.gameweek_id}</span>}
                    <span>· {timeAgo(item.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
