import { NextRequest, NextResponse } from "next/server";
import { getRecentEntries } from "@/lib/voice-admin";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const entries = await getRecentEntries(limit);
    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("[Audit] Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}