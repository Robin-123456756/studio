"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

let realtimeClient: SupabaseClient | null = null;

function getRealtimeClient() {
  if (realtimeClient) return realtimeClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  realtimeClient = createBrowserClient(url, anonKey);
  return realtimeClient;
}

/**
 * Hook to subscribe to Supabase Realtime changes on a table.
 * Returns the latest event and a list of recent changes.
 */
export function useRealtimeTable<T = any>(
  table: string,
  options?: {
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    filter?: string;
    maxEvents?: number;
    enabled?: boolean;
  }
) {
  const { event = "*", filter, maxEvents = 50, enabled = true } = options || {};
  const [events, setEvents] = useState<{ type: string; new: T; old: T | null; timestamp: string }[]>([]);
  const [latestEvent, setLatestEvent] = useState<{ type: string; new: T; old: T | null } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let supabase: SupabaseClient;
    try {
      supabase = getRealtimeClient();
    } catch (err) {
      console.error("Realtime client setup failed:", err);
      setIsConnected(false);
      return;
    }

    const channelConfig: any = {
      event,
      schema: "public",
      table,
    };
    if (filter) channelConfig.filter = filter;

    const channel = supabase
      .channel(`realtime-${table}-${filter || "all"}`)
      .on("postgres_changes", channelConfig, (payload: any) => {
        const newEvent = {
          type: payload.eventType,
          new: payload.new as T,
          old: payload.old as T | null,
          timestamp: new Date().toISOString(),
        };
        setLatestEvent(newEvent);
        setEvents((prev) => [newEvent, ...prev].slice(0, maxEvents));
      })
      .subscribe((status: string) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, maxEvents, enabled]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, latestEvent, isConnected, clearEvents };
}

/**
 * Hook for connection state with auto-reconnect awareness.
 */
export function useConnectionState() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Brief delay then clear the "back online" banner
        setTimeout(() => setWasOffline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}
