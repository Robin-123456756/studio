import { NextRequest, NextResponse } from "next/server";
import { commitToDB } from "@/lib/voice-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, entries, adminId, transcript, aiInterpretation } = body;

    if (!matchId || !entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: "matchId and entries array required" }, { status: 400 });
    }

    if (!adminId) {
      return NextResponse.json({ error: "adminId is required" }, { status: 400 });
    }

    const result = await commitToDB({
      matchId: parseInt(matchId),
      entries,
      adminId: parseInt(adminId),
      transcript: transcript || "",
      aiInterpretation: aiInterpretation || {},
    });

    return NextResponse.json({
      ...result,
      success: true,
      message: `Saved ${result.eventCount} events for ${result.playerCount} players`,
    });
  } catch (error: any) {
    console.error("[DB] Write error:", error);
    return NextResponse.json({ error: "Database write failed", message: error.message }, { status: 500 });
  }
}