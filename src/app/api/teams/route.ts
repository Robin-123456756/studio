import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
  .from("teams")
  .select("id,team_uuid,name,short_name,team_code,logo_url")
  .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { teams: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
