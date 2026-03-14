import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/scoring-rules
 *
 * Returns all scoring rules as a map of "action:POSITION" → points.
 * Cached at CDN level for 60s since rules rarely change.
 */
export async function GET() {
  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const supabase = getSupabaseServerOrThrow();
    const { data, error } = await supabase
      .from("scoring_rules")
      .select("action, position, points");

    if (error) throw error;

    // Build map: "goal:FWD" → 4, "goal:ALL" → 5, etc.
    const rules: Record<string, number> = {};
    for (const row of data ?? []) {
      rules[`${row.action}:${row.position || "ALL"}`] = row.points;
    }

    const res = NextResponse.json({ rules });
    res.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res;
  } catch (e: unknown) {
    return apiError("Failed to load scoring rules", "SCORING_RULES_FAILED", 500, e);
  }
}
