import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("SUPABASE URL:", url);
console.log("SUPABASE ANON:", anon ? "SET" : "MISSING");

export const supabase = createClient(url, anon);
