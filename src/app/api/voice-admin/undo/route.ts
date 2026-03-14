import { NextRequest, NextResponse } from "next/server";
import { undoEntry } from "@/lib/voice-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const body = await request.json();
    const { auditLogId } = body;

    if (!auditLogId) {
      return NextResponse.json({ error: "auditLogId is required" }, { status: 400 });
    }

    const auditLogIdNum = Number(auditLogId);
    if (!Number.isFinite(auditLogIdNum)) {
      return NextResponse.json({ error: "Invalid auditLogId" }, { status: 400 });
    }

    const result = await undoEntry(auditLogIdNum);

    return NextResponse.json({
      ...result,
      success: true,
      message: `Undid entry: removed ${result.deletedCount} events`,
    });
  } catch (error: unknown) {
    return apiError("Undo failed", "UNDO_FAILED", 500, error);
  }
}