import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function getSupabaseServerOrThrow() {
  console.log("DEBUG_ENV_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!supabaseUrl || !/^https?:\/\//i.test(supabaseUrl)) {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL. Must be http(s)://...");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  
}

// ✅ this is what your route expects
export const supabaseServer = getSupabaseServerOrThrow();
