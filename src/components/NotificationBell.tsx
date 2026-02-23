"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRealtimeTable } from "@/hooks/use-realtime";

interface BellNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  goal: "⚽",
  score_update: "🧮",
  deadline: "⏰",
  transfer: "🔄",
  info: "ℹ️",
  warning: "⚠️",
  achievement: "🏆",
};

export default function NotificationBell({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<BellNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to new notifications in real-time
  const { latestEvent } = useRealtimeTable<BellNotification>("notifications", {
    event: "INSERT",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: true,
  });

  // Load initial notifications
  useEffect(() => {
    async function loadNotifications() {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (userId) params.set("userId", userId);
        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    }
    loadNotifications();
  }, [userId]);

  // Handle new real-time notification
  useEffect(() => {
    if (latestEvent?.new) {
      setNotifications((prev) => [latestEvent.new, ...prev].slice(0, 30));
      setUnreadCount((prev) => prev + 1);

      // Browser notification if permitted
      if (Notification.permission === "granted") {
        new Notification(latestEvent.new.title, {
          body: latestEvent.new.message,
          icon: "/favicon.ico",
        });
      }
    }
  }, [latestEvent]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_all_read",
          userId,
          ids: notifications.filter((n) => !n.is_read).map((n) => n.id),
        }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }, [notifications, userId]);

  const markOneRead = useCallback(async (id: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id, userId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }, [userId]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && Notification.permission === "default") {
            Notification.requestPermission();
          }
        }}
        style={{
          position: "relative",
          background: "none",
          border: "1px solid #1E293B",
          borderRadius: 8,
          padding: "8px 10px",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          color: "#CBD5E1",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "#EF4444",
              color: "#FFF",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid #0A0F1C",
              animation: "pulse-badge 2s ease-in-out infinite",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <style>{`
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 420,
            backgroundColor: "#111827",
            border: "1px solid #1E293B",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            zIndex: 1000,
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
            <span style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00E676",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748B" }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🔕</p>
                <p style={{ fontSize: 13 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markOneRead(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #1E293B",
                    backgroundColor: n.is_read ? "transparent" : "#1A223620",
                    cursor: n.link ? "pointer" : "default",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1.2 }}>
                    {TYPE_ICONS[n.type] || "📌"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: n.is_read ? 500 : 700,
                        color: n.is_read ? "#CBD5E1" : "#F1F5F9",
                      }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap", marginLeft: 8 }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12,
                      color: n.is_read ? "#64748B" : "#94A3B8",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {n.message}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      backgroundColor: "#00E676", flexShrink: 0, marginTop: 4,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
