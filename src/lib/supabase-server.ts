// src/lib/supabase-server.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function isValidHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/**
 * Server-only Supabase client.
 * - Safe: does NOT throw at import time
 * - Creates client lazily (on first call)
 * - Uses service role key (keep it server-only)
 */
export function getSupabaseServer() {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !isValidHttpUrl(supabaseUrl)) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. It must be a valid http(s) URL in Vercel env vars."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel env vars."
    );
  }

  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cached;
}
