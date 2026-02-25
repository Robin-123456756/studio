import { NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_HEAVY } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/admin/players/import — bulk import players */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("players-import", userId, RATE_LIMIT_HEAVY);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { players } = body;

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: "No players to import." }, { status: 400 });
    }

    // Validate each player
    const errors: string[] = [];
    const valid: any[] = [];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const row = i + 1;

      if (!p.name?.trim()) { errors.push(`Row ${row}: Missing name`); continue; }
      if (!p.web_name?.trim()) { errors.push(`Row ${row}: Missing web_name`); continue; }
      if (!p.position || !["GK", "DEF", "MID", "FWD"].includes(p.position)) {
        errors.push(`Row ${row}: Invalid position "${p.position}"`); continue;
      }
      if (!p.team_id) { errors.push(`Row ${row}: Missing team_id`); continue; }

      valid.push({
        name: p.name.trim(),
        web_name: p.web_name.trim(),
        position: p.position,
        team_id: p.team_id,
        now_cost: Number(p.now_cost ?? 5.0),
        is_lady: !!p.is_lady,
        total_points: 0,
        status: "available",
      });
    }

    let inserted = 0;
    if (valid.length > 0) {
      const { data, error } = await supabase
        .from("players")
        .insert(valid)
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message, validationErrors: errors }, { status: 500 });
      }
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({
      imported: inserted,
      skipped: errors.length,
      validationErrors: errors,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 500 });
  }
}
