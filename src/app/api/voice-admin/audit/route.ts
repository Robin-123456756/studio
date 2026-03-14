import { NextRequest, NextResponse } from "next/server";
import { getRecentEntries } from "@/lib/voice-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || "20");
    if (!Number.isFinite(limit) || limit < 1) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }

    const entries = await getRecentEntries(limit);
    return NextResponse.json({ entries });
  } catch (error: unknown) {
    return apiError("Failed to fetch audit log", "AUDIT_FETCH_FAILED", 500, error);
  }
}