"use client";

import { useConnectionState } from "@/hooks/use-realtime";

export default function ConnectionBanner() {
  const { isOnline, wasOffline } = useConnectionState();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: "10px 16px",
        textAlign: "center",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'Outfit', system-ui, sans-serif",
        backgroundColor: isOnline ? "#10B981" : "#EF4444",
        color: "#FFF",
        animation: "slideDown 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      {isOnline ? "✅ Back online — data is syncing" : "📡 No internet connection — waiting to reconnect..."}
    </div>
  );
}