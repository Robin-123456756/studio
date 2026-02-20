import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Check admin session
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { name, short_name, logo_url } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }
    if (!short_name?.trim()) {
      return NextResponse.json({ error: "Short name is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({
        name: name.trim(),
        short_name: short_name.trim(),
        logo_url: logo_url?.trim() || null,
      })
      .select("team_uuid, id, name, short_name, logo_url")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create team" }, { status: 500 });
  }
}
