import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerOrThrow() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL. Must be http(s)://...");
  }
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
