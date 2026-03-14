import { NextRequest, NextResponse } from "next/server";
import { commitToDB } from "@/lib/voice-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

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

    const matchIdNum = Number(matchId);
    if (!Number.isFinite(matchIdNum)) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const result = await commitToDB({
      matchId: matchIdNum,
      entries,
      adminId: typeof adminId === "string" ? Number(adminId) : adminId,
      transcript: transcript || "",
      aiInterpretation: aiInterpretation || {},
    });

    return NextResponse.json({
      ...result,
      success: true,
      message: `Saved ${result.eventCount} events for ${result.playerCount} players`,
    });
  } catch (error: unknown) {
    return apiError("Database write failed", "DB_WRITE_FAILED", 500, error);
  }
}