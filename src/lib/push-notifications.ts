import webpush from "web-push";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

// ── VAPID configuration (lazy — silently disabled if keys missing) ──
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@budoleague.com";

function isConfigured(): boolean {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE);
}

if (isConfigured()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to ALL subscribers.
 * Fire-and-forget — never throws, never crashes the caller.
 * Auto-cleans expired subscriptions (410 Gone).
 */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!isConfigured()) return;

  try {
    const supabase = getSupabaseServerOrThrow();

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (error || !subs || subs.length === 0) return;

    const jsonPayload = JSON.stringify(payload);
    const expiredIds: number[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            jsonPayload
          );
        } catch (err: any) {
          // 410 Gone or 404 = subscription expired, clean it up
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredIds.push(sub.id);
          }
          // Other errors silently ignored (don't crash caller)
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }
  } catch {
    // Entire push flow failed — silently ignore
  }
}
