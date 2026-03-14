import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
  .from("teams")
  .select("id,team_uuid,name,short_name,team_code,logo_url")
  .order("name", { ascending: true });

  if (error) {
    return apiError("Failed to fetch teams", "TEAMS_FETCH_FAILED", 500, error);
  }

  return NextResponse.json(
    { teams: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
