import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { calcTotalPoints } from "@/lib/voice-admin";
import type { AIAction } from "@/lib/voice-admin/types";

interface ManualEvent {
  playerId: string;
  actions: AIAction[];
}

interface ManualPayload {
  matchId: number;
  events: ManualEvent[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ManualPayload = await request.json();
    const { matchId, events } = body;

    if (!matchId || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "matchId and non-empty events array required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerOrThrow();

    // Look up the admin user to satisfy FK constraints
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("role", "superadmin")
      .limit(1)
      .single();
    const adminId = adminRow?.id ?? null;

    // 1. Fetch player metadata for all players in the payload
    const playerIds = events.map((e) => e.playerId);
    const { data: players, error: playerErr } = await supabase
      .from("players")
      .select("id, name, web_name, position, is_lady")
      .in("id", playerIds);

    if (playerErr) throw new Error(`Failed to fetch players: ${playerErr.message}`);

    const playerMap = new Map<string, { position: string; is_lady: boolean; name: string }>();
    for (const p of players || []) {
      playerMap.set(p.id, {
        position: p.position,
        is_lady: p.is_lady ?? false,
        name: p.web_name || p.name,
      });
    }

    // 2. Get gameweek_id from the match
    const { data: matchRow, error: matchErr } = await supabase
      .from("matches")
      .select("gameweek_id")
      .eq("id", matchId)
      .single();

    if (matchErr) throw new Error(`Failed to fetch match: ${matchErr.message}`);
    const gwId = matchRow?.gameweek_id;

    // 3. Process each player's events
    const eventIds: number[] = [];
    let totalPlayersUpdated = 0;

    for (const event of events) {
      const player = playerMap.get(event.playerId);
      if (!player) {
        console.warn(`[Manual] Player ${event.playerId} not found, skipping`);
        continue;
      }

      // Calculate points for this player's actions
      const { total, breakdown } = await calcTotalPoints(
        event.actions,
        player.position,
        player.is_lady
      );

      // 4. Upsert each action into player_match_events
      for (const item of breakdown) {
        const { data, error } = await supabase
          .from("player_match_events")
          .upsert(
            {
              match_id: matchId,
              player_id: event.playerId,
              action: item.action,
              quantity: item.quantity,
              points_awarded: item.points_per_unit,
              input_method: "manual",
              entered_by: adminId,
              voice_transcript: null,
            },
            { onConflict: "player_id,match_id,action" }
          )
          .select("id")
          .single();

        if (error) throw new Error(`Failed to upsert event: ${error.message}`);
        eventIds.push(data.id);
      }

      // 5. Increment player points
      await supabase.rpc("increment_player_points", {
        p_player_id: event.playerId,
        p_points: total,
      });

      // 6. Mark player as having played
      if (gwId) {
        await supabase
          .from("player_stats")
          .upsert(
            {
              player_id: event.playerId,
              gameweek_id: gwId,
              did_play: true,
            },
            { onConflict: "player_id,gameweek_id" }
          );
      }

      totalPlayersUpdated++;
    }

    // 7. Create audit log entry
    const { data: auditRow } = await supabase
      .from("voice_audit_log")
      .insert({
        admin_id: adminId,
        transcript: `Manual entry: ${totalPlayersUpdated} players`,
        ai_interpretation: { input_method: "manual", matchId },
        was_confirmed: true,
        match_id: matchId,
        events_created: eventIds,
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      playersUpdated: totalPlayersUpdated,
      eventsCreated: eventIds.length,
      auditLogId: auditRow?.id ?? null,
    });
  } catch (error: any) {
    console.error("[Manual] Commit error:", error);
    return NextResponse.json(
      { error: "Manual commit failed", message: error.message },
      { status: 500 }
    );
  }
}
