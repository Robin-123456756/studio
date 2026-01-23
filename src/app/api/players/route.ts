// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseOrError() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      supabase: null as any,
      error:
        "Invalid NEXT_PUBLIC_SUPABASE_URL. It must start with http:// or https://",
    };
  }
  if (!key) {
    return {
      supabase: null as any,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.",
    };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  return { supabase, error: null as string | null };
}

export async function GET() {
  const { supabase, error: envError } = getSupabaseOrError();
  if (envError) {
    return NextResponse.json({ error: envError }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, web_name, position, team_id, avatar_url, now_cost");

  // ✅ Handle Supabase error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players =
    (data || []).map((p: any) => ({
      id: p.id,
      name: p.web_name, // map web_name → name for the UI
      position: p.position,
      team_id: p.team_id,
      avatar_url: p.avatar_url,
      price: Number(p.now_cost ?? 0),
      points: 0, // or compute later from player_stats
    })) ?? [];

  return NextResponse.json({ players });
}
