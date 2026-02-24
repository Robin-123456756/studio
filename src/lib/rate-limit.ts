import { NextResponse } from "next/server";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory sliding window store
const store = new Map<string, RateLimitEntry>();

// Presets
export const RATE_LIMIT_DESTRUCTIVE: RateLimitConfig = { maxRequests: 2, windowMs: 5 * 60 * 1000 }; // 2 per 5 min
export const RATE_LIMIT_HEAVY: RateLimitConfig = { maxRequests: 5, windowMs: 60 * 1000 };           // 5 per min
export const RATE_LIMIT_STANDARD: RateLimitConfig = { maxRequests: 30, windowMs: 60 * 1000 };       // 30 per min

/**
 * Check if a request is rate-limited using in-memory sliding window.
 * Key pattern: `{action}:{userId}`
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + config.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * Returns a 429 response if rate-limited, or null if allowed.
 */
export function rateLimitResponse(
  action: string,
  userId: string,
  config: RateLimitConfig
): NextResponse | null {
  const key = `${action}:${userId}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfterSeconds: retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  return null;
}
