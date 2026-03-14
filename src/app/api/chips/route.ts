import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { rateLimitResponse, RATE_LIMIT_STANDARD } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** GET /api/chips — returns chips already used this season by the current user */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rl = rateLimitResponse("chips", auth.user.id, RATE_LIMIT_STANDARD);
  if (rl) return rl;

  const { data, error } = await supabase
    .from("user_chips")
    .select("chip, gameweek_id, activated_at")
    .eq("user_id", auth.user.id)
    .order("activated_at", { ascending: true });

  if (error) {
    return apiError("Failed to fetch chips", "CHIPS_FETCH_FAILED", 500, error);
  }

  // Return a simple array of chip names already used
  const usedChips = (data ?? []).map((r) => r.chip);

  return NextResponse.json({ usedChips, details: data ?? [] });
}
