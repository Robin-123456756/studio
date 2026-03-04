import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();
    const { data, error } = await supabase
      .rpc("match_player_fuzzy", { search_name: q.toLowerCase() });

    if (error) throw error;

    return NextResponse.json({ players: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: "Player search failed" }, { status: 500 });
  }
}