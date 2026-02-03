import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Next.js 15 safe context type
type RouteContext = { params: { teamId: string } };

export async function GET(_req: Request, ctx: RouteContext) {
  const supabase = getSupabaseServerOrThrow();

  const teamUuid = ctx.params.teamId;

  const { data, error } = await supabase
    .from("teams")
    .select("id,team_uuid,name,short_name,logo_url")
    .eq("team_uuid", teamUuid)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json({ team: data });
}
