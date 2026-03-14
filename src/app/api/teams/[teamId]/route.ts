import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = getSupabaseServerOrThrow();

  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const teamUuid = parts[parts.length - 1];

  if (!teamUuid) {
    return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id,team_uuid,name,short_name,logo_url")
    .eq("team_uuid", teamUuid)
    .maybeSingle();

  if (error) return apiError("Failed to fetch team", "TEAM_FETCH_FAILED", 500, error);
  if (!data) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json({ team: data });
}
