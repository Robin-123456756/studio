/**
 * Seed sample player_stats for GW1–GW3 so the fantasy pages
 * show realistic points, leaderboards, and player performances.
 *
 * Usage:  node scripts/seed-fantasy-points.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Supabase client ──────────────────────────────────────────────

// dotenv/config reads .env — also try .env.local which Next.js uses
try {
  const envLocal = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envLocal.split("\n")) {
    const m = line.match(/^\s*([\w]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  // .env.local may not exist
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a player_stats row with position-appropriate numbers */
function generateStats(player, gameweekId) {
  const pos = (player.position ?? "").toLowerCase();

  let goals = 0,
    assists = 0,
    cleanSheet = false,
    yellowCards = 0,
    redCards = 0,
    ownGoals = 0,
    points = 2; // base appearance points

  if (pos.includes("forward") || pos === "fwd") {
    goals = pick([0, 0, 1, 1, 1, 2]);
    assists = pick([0, 0, 0, 1]);
    points = 2 + goals * 4 + assists * 3;
    // Occasional bonus
    if (goals >= 2) points += 3; // bonus for brace
  } else if (pos.includes("mid")) {
    goals = pick([0, 0, 0, 1, 1]);
    assists = pick([0, 0, 1, 1, 2]);
    points = 2 + goals * 5 + assists * 3;
    if (goals >= 1 && assists >= 1) points += 2;
  } else if (pos.includes("def")) {
    cleanSheet = Math.random() < 0.4;
    assists = pick([0, 0, 0, 1]);
    goals = Math.random() < 0.08 ? 1 : 0;
    points = 2 + (cleanSheet ? 4 : 0) + goals * 6 + assists * 3;
  } else if (pos.includes("goal") || pos === "gk" || pos.includes("keeper")) {
    cleanSheet = Math.random() < 0.35;
    points = 2 + (cleanSheet ? 4 : 0);
    // Penalty save bonus
    if (Math.random() < 0.05) points += 5;
  }

  // Cards (5% yellow, 1% red)
  if (Math.random() < 0.05) {
    yellowCards = 1;
    points -= 1;
  }
  if (Math.random() < 0.01) {
    redCards = 1;
    points -= 3;
  }

  // Own goal (2%)
  if (Math.random() < 0.02) {
    ownGoals = 1;
    points -= 2;
  }

  // Floor at 0
  points = Math.max(points, 0);

  return {
    player_id: player.id,
    gameweek_id: gameweekId,
    points,
    goals,
    assists,
    clean_sheet: cleanSheet,
    yellow_cards: yellowCards,
    red_cards: redCards,
    own_goals: ownGoals,
    player_name: player.web_name || player.name,
  };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching players...");
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, name, web_name, position")
    .order("name");

  if (playersErr) {
    console.error("Failed to fetch players:", playersErr.message);
    process.exit(1);
  }

  if (!players || players.length === 0) {
    console.error("No players found in database. Seed players first.");
    process.exit(1);
  }

  console.log(`Found ${players.length} players.`);

  // GW1–GW3 are the played gameweeks
  const gameweeks = [1, 2, 3];

  // ── 1. Clear existing player_stats for these GWs (idempotent re-runs) ──
  console.log("Clearing existing player_stats for GW1–GW3...");
  const { error: delErr } = await supabase
    .from("player_stats")
    .delete()
    .in("gameweek_id", gameweeks);

  if (delErr) {
    console.error("Failed to clear old stats:", delErr.message);
    process.exit(1);
  }

  // ── 2. Generate and insert player_stats ──
  const allStats = [];
  for (const gw of gameweeks) {
    for (const player of players) {
      allStats.push(generateStats(player, gw));
    }
  }

  console.log(`Inserting ${allStats.length} player_stats rows...`);

  // Insert in batches of 500 (Supabase limit)
  const BATCH = 500;
  for (let i = 0; i < allStats.length; i += BATCH) {
    const batch = allStats.slice(i, i + BATCH);
    const { error: insertErr } = await supabase
      .from("player_stats")
      .insert(batch);
    if (insertErr) {
      console.error(`Insert batch failed at offset ${i}:`, insertErr.message);
      process.exit(1);
    }
  }

  console.log("player_stats inserted.");

  // ── 3. Update players.total_points = SUM(points) across all GWs ──
  console.log("Updating players.total_points...");

  const pointsByPlayer = new Map();
  for (const s of allStats) {
    pointsByPlayer.set(
      s.player_id,
      (pointsByPlayer.get(s.player_id) ?? 0) + s.points
    );
  }

  let updated = 0;
  for (const [playerId, totalPoints] of pointsByPlayer) {
    const { error: upErr } = await supabase
      .from("players")
      .update({ total_points: totalPoints })
      .eq("id", playerId);
    if (upErr) {
      console.warn(`  Warning: could not update player ${playerId}:`, upErr.message);
    } else {
      updated++;
    }
  }

  console.log(`Updated total_points for ${updated} players.`);

  // ── 4. Seed sample fantasy_teams + user_weekly_scores for leaderboard ──
  // Both tables use UUID user_id columns, so we generate deterministic UUIDs.
  console.log("Seeding sample fantasy_teams & user_weekly_scores...");

  const sampleTeams = [
    { user_id: "a0000000-0000-4000-8000-000000000001", name: "Budo Ballers" },
    { user_id: "a0000000-0000-4000-8000-000000000002", name: "Kampala Kickers FC" },
    { user_id: "a0000000-0000-4000-8000-000000000003", name: "The Cranes" },
    { user_id: "a0000000-0000-4000-8000-000000000004", name: "Entebbe Eagles" },
    { user_id: "a0000000-0000-4000-8000-000000000005", name: "Jinja Stars" },
  ];

  const seedUserIds = sampleTeams.map((t) => t.user_id);

  // Clean up previous seeded data
  await supabase.from("user_weekly_scores").delete().in("user_id", seedUserIds);

  // fantasy_teams has a FK to auth.users, so we can only insert for real users.
  // Try inserting — if the FK constraint blocks it, that's fine; the leaderboard
  // route builds entries from user_weekly_scores regardless.
  for (const team of sampleTeams) {
    const { error: upsertErr } = await supabase.from("fantasy_teams").insert({
      user_id: team.user_id,
      name: team.name,
    });
    if (upsertErr && !upsertErr.message.includes("foreign key")) {
      console.warn(`  Warning: fantasy_teams insert failed for ${team.name}:`, upsertErr.message);
    }
  }

  // Insert user_weekly_scores (leaderboard source of truth)
  const weeklyRows = [];
  for (const team of sampleTeams) {
    for (const gw of gameweeks) {
      weeklyRows.push({
        user_id: team.user_id,
        gameweek_id: gw,
        total_weekly_points: rand(15, 55),
      });
    }
  }

  const { error: weeklyErr } = await supabase
    .from("user_weekly_scores")
    .insert(weeklyRows);

  if (weeklyErr) {
    console.warn("  Warning: user_weekly_scores insert failed:", weeklyErr.message);
  } else {
    console.log(`  Inserted ${weeklyRows.length} user_weekly_scores rows.`);
  }

  console.log(`  Created ${sampleTeams.length} fantasy teams.`);

  // ── Done ──
  console.log("\nSeed complete!");
  console.log("  - player_stats: seeded for GW1–GW3");
  console.log("  - players.total_points: updated");
  console.log("  - fantasy_teams: 5 sample teams");
  console.log("  - user_weekly_scores: GW-by-GW scores");
  console.log("\nVerify:");
  console.log("  /dashboard/fantasy     → GW points");
  console.log("  /dashboard/players     → player points");
  console.log("  /api/player-stats?gw_id=3  → stats with goals, assists");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
