import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Cron: Auto-archive old, low-engagement posts.
 * Runs weekly (Sunday 3am UTC / 6am Kampala).
 * Reads thresholds from app_settings table.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerOrThrow();

    // Read config
    const { data: config } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "auto_archive")
      .maybeSingle();

    const settings = (config?.value as any) ?? { enabled: true, min_age_days: 30, max_view_count: 5 };
    if (!settings.enabled) {
      return NextResponse.json({ ok: true, message: "Auto-archive disabled", archived: 0 });
    }

    const cutoffDate = new Date(Date.now() - settings.min_age_days * 24 * 60 * 60 * 1000).toISOString();

    // Find candidates: old, low views, active, not pinned
    const { data: candidates } = await supabase
      .from("feed_media")
      .select("id")
      .eq("is_active", true)
      .eq("is_pinned", false)
      .lt("created_at", cutoffDate)
      .lte("view_count", settings.max_view_count);

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ ok: true, message: "No posts to archive", archived: 0 });
    }

    const ids = candidates.map((c) => c.id);

    const { error } = await supabase
      .from("feed_media")
      .update({ is_active: false })
      .in("id", ids);

    if (error) {
      console.error("[auto-archive] Update failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[auto-archive] Archived ${ids.length} post(s): ${ids.join(", ")}`);
    return NextResponse.json({ ok: true, archived: ids.length, ids });
  } catch (err: any) {
    console.error("[auto-archive] Cron error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
