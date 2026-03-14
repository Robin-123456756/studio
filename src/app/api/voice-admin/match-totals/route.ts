import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "matchId query parameter required" }, { status: 400 });
    }

    const matchIdNum = Number(matchId);
    if (!Number.isFinite(matchIdNum)) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();
    const { data, error } = await supabase
      .from("player_match_totals")
      .select("*")
      .eq("match_id", matchIdNum)
      .order("total_points", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ totals: data || [] });
  } catch (error: unknown) {
    return apiError("Failed to fetch match totals", "MATCH_TOTALS_FETCH_FAILED", 500, error);
  }
}


