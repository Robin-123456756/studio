import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: { teamId: string } }
) {
  const teamUuid = params.teamId;

  const { data, error } = await supabase
    .from("teams")
    .select("id,team_uuid,name,short_name,logo_url")
    .eq("team_uuid", teamUuid)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ team: data });
}
