import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/audit-log — merged voice + activity log */
export async function GET(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const search = (searchParams.get("q") || "").toLowerCase();
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
  const offset = Number(searchParams.get("offset") || 0);

  try {
    const [voiceRes, activityRes] = await Promise.all([
      type === "all" || type === "voice"
        ? supabase
            .from("voice_audit_log")
            .select("id, admin_id, transcript, command_type, was_undone, created_at")
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
      type === "all" || type === "activity"
        ? supabase
            .from("activity_feed")
            .select("id, event_type, description, player_name, team_name, gameweek_id, created_at")
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
    ]);

    // Merge and normalize
    const entries: any[] = [];

    for (const v of (voiceRes as any).data ?? []) {
      entries.push({
        id: `voice-${v.id}`,
        source: "voice",
        type: v.command_type || "voice_command",
        description: v.transcript || "Voice command",
        wasUndone: !!v.was_undone,
        adminId: v.admin_id,
        createdAt: v.created_at,
      });
    }

    for (const a of (activityRes as any).data ?? []) {
      entries.push({
        id: `activity-${a.id}`,
        source: "activity",
        type: a.event_type || "event",
        description: a.description || `${a.event_type}: ${a.player_name || ""} (${a.team_name || ""})`,
        playerName: a.player_name,
        teamName: a.team_name,
        gameweekId: a.gameweek_id,
        createdAt: a.created_at,
      });
    }

    // Sort by date desc
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter by search
    const filtered = search
      ? entries.filter((e) =>
          e.description.toLowerCase().includes(search) ||
          e.type.toLowerCase().includes(search) ||
          (e.playerName || "").toLowerCase().includes(search) ||
          (e.teamName || "").toLowerCase().includes(search)
        )
      : entries;

    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      entries: paginated,
      total: filtered.length,
      offset,
      limit,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load audit log" }, { status: 500 });
  }
}
