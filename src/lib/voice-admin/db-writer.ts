import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import type { ResolvedEntry, DBWriteResult } from "./types";

/**
 * Write validated voice entries directly to the database.
 * Creates audit trail and undo buffer.
 *
 * Writes to:
 *   player_match_events (match_id → matches.id, player_id → players.id)
 *   voice_audit_log
 *   undo_buffer
 *   players.total_points + players.points (updated)
 */
export async function writeToDatabase({
  matchId,
  entries,
  adminId,
  transcript,
  aiInterpretation,
  inputMethod = "voice",
}: {
  matchId: number;
  entries: ResolvedEntry[];
  adminId: number;
  transcript: string;
  aiInterpretation: object;
  inputMethod?: string;
}): Promise<DBWriteResult> {
  const supabase = getSupabaseServerOrThrow();
  const eventIds: number[] = [];

  // 1. Insert each stat event
  for (const entry of entries) {
    for (const action of entry.pointsBreakdown) {
      const { data, error } = await supabase
        .from("player_match_events")
        .upsert({
          match_id: matchId,
          player_id: entry.player.id,
          action: action.action,
          quantity: action.quantity,
          points_awarded: action.points_per_unit,
          input_method: inputMethod,
          entered_by: adminId,
          voice_transcript: transcript,
        }, {
          onConflict: 'player_id,match_id,action',
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to insert event: ${error.message}`);
      eventIds.push(data.id);
    }
  }

  // 2. Create audit log entry
  const { data: auditData, error: auditError } = await supabase
    .from("voice_audit_log")
    .insert({
      admin_id: adminId,
      transcript,
      ai_interpretation: aiInterpretation,
      was_confirmed: true,
      match_id: matchId,
      events_created: eventIds,
    })
    .select("id")
    .single();

  if (auditError) throw new Error(`Failed to create audit log: ${auditError.message}`);
  const auditLogId = auditData.id;

  // 3. Create undo buffer
  await supabase.from("undo_buffer").insert({
    audit_log_id: auditLogId,
    event_ids: eventIds,
  });

  // 4. Update player total_points and points in your existing players table
  for (const entry of entries) {
    // Use RPC to atomically increment
    await supabase.rpc("increment_player_points", {
      p_player_id: entry.player.id,
      p_points: entry.totalPoints,
    });
  }

  // 5. Materialized view is auto-refreshed by DB trigger on player_match_events

  return {
    success: true,
    eventIds,
    auditLogId,
    eventCount: eventIds.length,
    playerCount: entries.length,
  };
}

/**
 * Undo a voice entry by audit log ID.
 */
export async function undoEntry(
  auditLogId: number
): Promise<{ success: boolean; deletedCount: number }> {
  const supabase = getSupabaseServerOrThrow();

  // 1. Get the audit log entry
  const { data: audit, error: auditError } = await supabase
    .from("voice_audit_log")
    .select("id, was_undone, events_created")
    .eq("id", auditLogId)
    .single();

  if (auditError || !audit) throw new Error(`Audit log ${auditLogId} not found`);
  if (audit.was_undone) throw new Error("This entry has already been undone");

  // 2. Get events to reverse player points
  const { data: events } = await supabase
    .from("player_match_events")
    .select("player_id, points_awarded, quantity")
    .in("id", audit.events_created);

  // 3. Reverse player points
  for (const event of events || []) {
    const pointsToRemove = event.points_awarded * event.quantity;
    await supabase.rpc("increment_player_points", {
      p_player_id: event.player_id,
      p_points: -pointsToRemove,
    });
  }

  // 4. Delete events
  const { count } = await supabase
    .from("player_match_events")
    .delete({ count: "exact" })
    .in("id", audit.events_created);

  // 5. Mark audit as undone
  await supabase
    .from("voice_audit_log")
    .update({ was_undone: true })
    .eq("id", auditLogId);

  // 6. Materialized view is auto-refreshed by DB trigger on player_match_events

  return { success: true, deletedCount: count || 0 };
}

/**
 * Get recent voice entries for the admin dashboard.
 */
export async function getRecentEntries(limit: number = 20) {
  const supabase = getSupabaseServerOrThrow();

  const { data, error } = await supabase
    .from("voice_audit_log")
    .select(`
      id,
      transcript,
      was_confirmed,
      was_undone,
      created_at,
      events_created,
      admin_users (username)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch audit log: ${error.message}`);

  return (data || []).map((entry: any) => ({
    audit_id: entry.id,
    transcript: entry.transcript,
    was_confirmed: entry.was_confirmed,
    was_undone: entry.was_undone,
    created_at: entry.created_at,
    admin_name: entry.admin_users?.username || "unknown",
    event_count: entry.events_created?.length || 0,
  }));
}