import { NextRequest, NextResponse } from "next/server";
import { processVoiceInput } from "@/lib/voice-admin";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const matchId = formData.get("matchId") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("id", parseInt(matchId))
      .single();

    if (!match) {
      return NextResponse.json({ error: `Match ${matchId} not found` }, { status: 404 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processVoiceInput(buffer, audioFile.type || "audio/webm", parseInt(matchId));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Voice] Audio processing error:", error);
    return NextResponse.json({ error: "Voice processing failed", message: error.message }, { status: 500 });
  }
}