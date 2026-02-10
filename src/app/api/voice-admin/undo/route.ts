import { NextRequest, NextResponse } from "next/server";
import { undoEntry } from "@/lib/voice-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auditLogId } = body;

    if (!auditLogId) {
      return NextResponse.json({ error: "auditLogId is required" }, { status: 400 });
    }

    const result = await undoEntry(parseInt(auditLogId));

    return NextResponse.json({
      ...result,
      success: true,
      message: `Undid entry: removed ${result.deletedCount} events`,
    });
  } catch (error: any) {
    console.error("[DB] Undo error:", error);
    return NextResponse.json({ error: "Undo failed", message: error.message }, { status: 500 });
  }
}