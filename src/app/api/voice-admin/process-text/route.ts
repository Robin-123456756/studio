import { NextResponse } from "next/server";
import { processTextInput } from "@/lib/voice-admin/pipeline";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, matchId } = body;
    if (!text || !matchId) {
      return NextResponse.json({ error: "text and matchId are required" }, { status: 400 });
    }
    const supabase = getSupabaseServerOrThrow();
    const { data: match } = await supabase.from("matches").select("id").eq("id", matchId).single();
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    const result = await processTextInput(text, parseInt(matchId));
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
