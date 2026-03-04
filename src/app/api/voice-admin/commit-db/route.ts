import { NextRequest, NextResponse } from "next/server";
import { commitToDB } from "@/lib/voice-admin";
import { requireAdminSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const { session, error: authErr } = await requireAdminSession();
    if (authErr) return authErr;

    const body = await request.json();
    const { matchId, entries, transcript, aiInterpretation } = body;

    if (!matchId || !entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: "matchId and entries array required" }, { status: 400 });
    }

    // Use authenticated session user instead of client-sent adminId
    const adminId = (session!.user as any).id;

    const result = await commitToDB({
      matchId: parseInt(matchId),
      entries,
      adminId: typeof adminId === "string" ? parseInt(adminId) : adminId,
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