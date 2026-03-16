/**
 * Auto-Generated Content Pipelines
 *
 * Queries the database and generates draft feed_media posts for:
 *   1. GW Preview       — 24h before deadline
 *   2. GW Recap         — after all GW matches are final
 *   3. Player Spotlight  — weekly on Mondays
 *   4. Deadline Countdown — 6h and 1h before deadline
 *   5. Match Report      — per-match when marked is_final
 *   6. Transfer Buzz     — trending transfer-in player
 *   7. Milestone Alerts  — player crosses stat threshold
 *
 * All posts are created as DRAFTS with layout "quick" (no image required).
 * Admin reviews and publishes manually.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/* ── Types ──────────────────────────────────────────────────────────────── */

type PipelineResult = {
  pipeline: string;
  created: boolean;
  postId?: number;
  postIds?: number[];
  reason?: string;
};

type FixtureRow = {
  id: number;
  gameweek_id: number;
  home_team: { name: string; short_name: string } | null;
  away_team: { name: string; short_name: string } | null;
  kickoff_time: string | null;
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("en-UG", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
    hour12: true,
  }) + " EAT";
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + "th";
  const s = ["th", "st", "nd", "rd"];
  return n + (s[v % 10] || s[0]);
}

function timeUntil(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} minutes`;
}

/** UTC date string for timezone-safe comparisons (YYYY-MM-DD) */
function utcDateStr(d: Date | string): string {
  return new Date(d).toISOString().split("T")[0];
}

/** Check if a draft/published post already exists for this GW + category combo */
async function postExists(
  supabase: SupabaseClient,
  gameweekId: number,
  category: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("feed_media")
    .select("id", { count: "exact", head: true })
    .eq("gameweek_id", gameweekId)
    .eq("category", category)
    .eq("is_active", true);
  return (count ?? 0) > 0;
}

/** Check if a post with a specific title prefix exists (for per-match dedup) */
async function postWithTitleExists(
  supabase: SupabaseClient,
  titlePrefix: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("feed_media")
    .select("id", { count: "exact", head: true })
    .ilike("title", `${titlePrefix}%`)
    .eq("is_active", true);
  return (count ?? 0) > 0;
}

/** Insert a draft feed_media row */
async function insertDraft(
  supabase: SupabaseClient,
  data: {
    title: string;
    body: string;
    category: string;
    gameweek_id: number;
  },
): Promise<number | null> {
  const { data: row, error } = await supabase
    .from("feed_media")
    .insert({
      title: data.title,
      body: data.body,
      category: data.category,
      layout: "quick",
      status: "draft",
      is_pinned: false,
      gameweek_id: data.gameweek_id,
      image_url: null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[auto-content] Insert failed for ${data.category}:`, error.message);
    return null;
  }
  return row.id;
}

/* ── Polish with AI (optional — degrades gracefully) ───────────────────── */

async function polishWithAI(
  openai: OpenAI | null,
  rawTitle: string,
  rawBody: string,
): Promise<{ title: string; body: string }> {
  if (!openai) return { title: rawTitle, body: rawBody };

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a sports content editor for "The Budo League", a fantasy football league in Kampala, Uganda. Given a draft title and body, polish them to be engaging and punchy for mobile readers. Keep the facts exactly as provided — do NOT invent stats or names. Return JSON: { "title": "...", "body": "..." }. The body can use simple HTML (<b>, <br>, <ul>, <li>) for formatting.`,
        },
        {
          role: "user",
          content: `Title: ${rawTitle}\n\nBody: ${rawBody}`,
        },
      ],
    });

    const content = res.choices?.[0]?.message?.content;
    if (!content) return { title: rawTitle, body: rawBody };

    const parsed = JSON.parse(content);
    return {
      title: parsed.title || rawTitle,
      body: parsed.body || rawBody,
    };
  } catch (err) {
    console.error("[auto-content] AI polish failed, using raw text:", err);
    return { title: rawTitle, body: rawBody };
  }
}

/* ── Pipeline 1: GW Preview ────────────────────────────────────────────── */

export async function generateGWPreview(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "gw_preview";

  // Find the earliest non-finalized GW with a deadline within 24 hours
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: gw } = await supabase
    .from("gameweeks")
    .select("id, deadline_time")
    .eq("finalized", false)
    .gte("deadline_time", now.toISOString())
    .lte("deadline_time", in24h.toISOString())
    .order("deadline_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!gw) {
    return { pipeline, created: false, reason: "No upcoming GW within 24h" };
  }

  // Dedup check
  if (await postExists(supabase, gw.id, "deadline")) {
    return { pipeline, created: false, reason: `GW${gw.id} deadline post already exists` };
  }

  // Get fixtures for this GW
  const { data: fixtures } = await supabase
    .from("matches")
    .select("id, gameweek_id, kickoff_time, home_team:teams!matches_home_team_uuid_fkey(name, short_name), away_team:teams!matches_away_team_uuid_fkey(name, short_name)")
    .eq("gameweek_id", gw.id)
    .order("kickoff_time", { ascending: true }) as { data: FixtureRow[] | null };

  const matchCount = fixtures?.length ?? 0;

  // Find highest-owned player (most picked in rosters for this GW)
  const { data: topPick } = await supabase
    .from("user_rosters")
    .select("player_id, players:player_id(web_name)")
    .eq("gameweek_id", gw.id)
    .limit(500);

  let topPlayerName = "TBD";
  if (topPick && topPick.length > 0) {
    const counts: Record<string, { count: number; name: string }> = {};
    for (const r of topPick) {
      const pid = r.player_id;
      const p = r.players as any;
      const name = p?.web_name || pid;
      if (!counts[pid]) counts[pid] = { count: 0, name };
      counts[pid].count++;
    }
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    if (sorted[0]) topPlayerName = sorted[0].name;
  }

  // Build fixture list
  const fixtureLines = (fixtures ?? []).map((f) => {
    const home = f.home_team?.short_name || "???";
    const away = f.away_team?.short_name || "???";
    return `${home} vs ${away}`;
  });

  const deadlineStr = formatDeadline(gw.deadline_time);

  const rawTitle = `GW${gw.id} Preview: ${matchCount} match${matchCount !== 1 ? "es" : ""} this weekend`;
  const rawBody = [
    `<b>${matchCount} fixture${matchCount !== 1 ? "s" : ""} lined up for Gameweek ${gw.id}:</b>`,
    `<ul>${fixtureLines.map((l) => `<li>${l}</li>`).join("")}</ul>`,
    `<b>Top pick:</b> ${topPlayerName} (most selected this GW)`,
    `<br><b>Deadline:</b> ${deadlineStr}`,
    `<br>Get your transfers in before it's too late!`,
  ].join("\n");

  const polished = await polishWithAI(openai, rawTitle, rawBody);

  const postId = await insertDraft(supabase, {
    title: polished.title,
    body: polished.body,
    category: "deadline",
    gameweek_id: gw.id,
  });

  return postId
    ? { pipeline, created: true, postId }
    : { pipeline, created: false, reason: "Insert failed" };
}

/* ── Pipeline 2: GW Recap ──────────────────────────────────────────────── */

export async function generateGWRecap(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "gw_recap";

  // Find the most recent finalized GW
  const { data: gw } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("finalized", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gw) {
    return { pipeline, created: false, reason: "No finalized GW found" };
  }

  // Dedup check
  if (await postExists(supabase, gw.id, "match_report")) {
    return { pipeline, created: false, reason: `GW${gw.id} recap already exists` };
  }

  // Check ALL matches for this GW are final
  const { count: totalMatches } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("gameweek_id", gw.id);

  const { count: finalMatches } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("gameweek_id", gw.id)
    .eq("is_final", true);

  if ((totalMatches ?? 0) === 0 || totalMatches !== finalMatches) {
    return { pipeline, created: false, reason: `Not all GW${gw.id} matches are final (${finalMatches}/${totalMatches})` };
  }

  // Top scorer (from user_weekly_scores) — join fantasy_teams for team names
  const { data: scores } = await supabase
    .from("user_weekly_scores")
    .select("user_id, total_weekly_points")
    .eq("gameweek_id", gw.id)
    .order("total_weekly_points", { ascending: false });

  // Fetch fantasy team names for the top scorers
  const topUserIds = (scores ?? []).slice(0, 3).map((s) => s.user_id);
  const { data: teamRows } = topUserIds.length > 0
    ? await supabase.from("fantasy_teams").select("user_id, name").in("user_id", topUserIds)
    : { data: [] };

  const teamNameMap: Record<string, string> = {};
  for (const t of teamRows ?? []) {
    teamNameMap[t.user_id] = t.name;
  }

  const topScorer = scores?.[0];
  const topName = topScorer ? (teamNameMap[topScorer.user_id] || "Unknown") : "Unknown";
  const topPts = topScorer?.total_weekly_points ?? 0;

  // Average score
  const allPoints = (scores ?? []).map((s) => s.total_weekly_points ?? 0);
  const avgScore = allPoints.length > 0
    ? Math.round(allPoints.reduce((a, b) => a + b, 0) / allPoints.length)
    : 0;

  // Transfer count for this GW
  const { count: transferCount } = await supabase
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .eq("gameweek_id", gw.id);

  // Top 3 managers
  const top3Lines = (scores ?? []).slice(0, 3).map((s, i) => {
    const name = teamNameMap[s.user_id] || "Unknown";
    return `${ordinal(i + 1)}: ${name} (${s.total_weekly_points ?? 0} pts)`;
  });

  const rawTitle = `GW${gw.id} Wrap: ${topName} leads with ${topPts}pts`;
  const rawBody = [
    `<b>Gameweek ${gw.id} is in the books!</b>`,
    `<br><b>Top managers:</b>`,
    `<ul>${top3Lines.map((l) => `<li>${l}</li>`).join("")}</ul>`,
    `<b>Average score:</b> ${avgScore} pts`,
    `<br><b>Transfers made:</b> ${transferCount ?? 0}`,
    `<br><b>Total managers:</b> ${allPoints.length}`,
  ].join("\n");

  const polished = await polishWithAI(openai, rawTitle, rawBody);

  const postId = await insertDraft(supabase, {
    title: polished.title,
    body: polished.body,
    category: "match_report",
    gameweek_id: gw.id,
  });

  return postId
    ? { pipeline, created: true, postId }
    : { pipeline, created: false, reason: "Insert failed" };
}

/* ── Pipeline 3: Player Spotlight ──────────────────────────────────────── */

export async function generatePlayerSpotlight(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "player_spotlight";

  // Find the most recent finalized GW
  const { data: gw } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("finalized", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gw) {
    return { pipeline, created: false, reason: "No finalized GW found" };
  }

  // Only run on Mondays (day 1)
  const today = new Date();
  if (today.getUTCDay() !== 1) {
    return { pipeline, created: false, reason: "Not Monday — spotlight runs weekly on Mondays" };
  }

  // Dedup check
  if (await postExists(supabase, gw.id, "player_spotlight")) {
    return { pipeline, created: false, reason: `GW${gw.id} spotlight already exists` };
  }

  // Find top performer for the most recent finalized GW
  const { data: topStats } = await supabase
    .from("player_stats")
    .select(`
      player_id, points, goals, assists, clean_sheet,
      players:player_id(web_name, position, is_lady, teams:teams!players_team_id_fkey(name, short_name))
    `)
    .eq("gameweek_id", gw.id)
    .order("points", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!topStats) {
    return { pipeline, created: false, reason: "No player stats for this GW" };
  }

  const player = topStats.players as any;
  const playerName = player?.web_name || "Unknown";
  const teamName = player?.teams?.name || "Unknown";
  const position = player?.position || "???";
  const isLady = player?.is_lady ? " (Lady)" : "";

  // Build stat line from available columns (use > 0, not truthy, to handle 0 correctly)
  const statParts: string[] = [];
  if ((topStats.goals ?? 0) > 0) statParts.push(`${topStats.goals} goal${topStats.goals! > 1 ? "s" : ""}`);
  if ((topStats.assists ?? 0) > 0) statParts.push(`${topStats.assists} assist${topStats.assists! > 1 ? "s" : ""}`);
  if (topStats.clean_sheet) statParts.push("clean sheet");
  const statLine = statParts.length > 0 ? statParts.join(", ") : "solid performance";

  const rawTitle = `GW${gw.id} Star: ${playerName} — ${topStats.points} pts`;
  const rawBody = [
    `<b>${playerName}</b>${isLady} takes the GW${gw.id} crown!`,
    `<br><b>Team:</b> ${teamName}`,
    `<br><b>Position:</b> ${position}`,
    `<br><b>Points:</b> ${topStats.points}`,
    `<br><b>Performance:</b> ${statLine}`,
    `<br><br>Did you have ${playerName} in your squad? ${(topStats.points ?? 0) >= 10 ? "What a haul!" : "Every point counts!"}`,
  ].join("\n");

  const polished = await polishWithAI(openai, rawTitle, rawBody);

  const postId = await insertDraft(supabase, {
    title: polished.title,
    body: polished.body,
    category: "player_spotlight",
    gameweek_id: gw.id,
  });

  return postId
    ? { pipeline, created: true, postId }
    : { pipeline, created: false, reason: "Insert failed" };
}

/* ── Pipeline 4: Deadline Countdown ────────────────────────────────────── */

export async function generateDeadlineCountdown(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "deadline_countdown";

  // Find non-finalized GW with deadline between now and 6h from now
  const now = new Date();
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const { data: gw } = await supabase
    .from("gameweeks")
    .select("id, deadline_time")
    .eq("finalized", false)
    .gte("deadline_time", now.toISOString())
    .lte("deadline_time", in6h.toISOString())
    .order("deadline_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!gw) {
    return { pipeline, created: false, reason: "No GW deadline within 6h" };
  }

  // Determine which alert window: "1h" or "6h"
  const deadlineMs = new Date(gw.deadline_time).getTime();
  const hoursLeft = (deadlineMs - now.getTime()) / (1000 * 60 * 60);
  const alertWindow = hoursLeft <= 1.5 ? "1h" : "6h";

  // Dedup: check if we already posted a countdown for this GW + window
  const dedupTitle = `DEADLINE ALERT (${alertWindow}): GW${gw.id}`;
  if (await postWithTitleExists(supabase, dedupTitle)) {
    return { pipeline, created: false, reason: `GW${gw.id} ${alertWindow} countdown already exists` };
  }

  // Count managers who haven't set their lineup
  const { count: totalManagers } = await supabase
    .from("fantasy_teams")
    .select("id", { count: "exact", head: true });

  const { data: submittedUsers } = await supabase
    .from("user_rosters")
    .select("user_id")
    .eq("gameweek_id", gw.id);

  const uniqueSubmitted = new Set((submittedUsers ?? []).map((r) => r.user_id));
  const notSubmitted = (totalManagers ?? 0) - uniqueSubmitted.size;

  const remaining = timeUntil(gw.deadline_time);
  const deadlineStr = formatDeadline(gw.deadline_time);

  const rawTitle = `DEADLINE ALERT (${alertWindow}): GW${gw.id} — ${remaining} left!`;
  const rawBody = [
    `<b>The GW${gw.id} deadline is ${deadlineStr}!</b>`,
    `<br>Only <b>${remaining}</b> remaining to lock in your squad.`,
    notSubmitted > 0
      ? `<br><b>${notSubmitted} manager${notSubmitted !== 1 ? "s" : ""}</b> haven't set their lineup yet.`
      : `<br>All managers have submitted their picks!`,
    `<br><br>Don't forget your captain pick and any last-minute transfers!`,
  ].join("\n");

  const polished = await polishWithAI(openai, rawTitle, rawBody);

  const postId = await insertDraft(supabase, {
    title: polished.title,
    body: polished.body,
    category: "deadline",
    gameweek_id: gw.id,
  });

  return postId
    ? { pipeline, created: true, postId }
    : { pipeline, created: false, reason: "Insert failed" };
}

/* ── Pipeline 5: Match Report ──────────────────────────────────────────── */

export async function generateMatchReports(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "match_reports";

  // Find final matches across all GWs
  const { data: allFinalMatches } = await supabase
    .from("matches")
    .select(`
      id, gameweek_id, home_goals, away_goals,
      home_team:teams!matches_home_team_uuid_fkey(name, short_name, team_uuid),
      away_team:teams!matches_away_team_uuid_fkey(name, short_name, team_uuid)
    `)
    .eq("is_final", true)
    .order("gameweek_id", { ascending: false });

  if (!allFinalMatches || allFinalMatches.length === 0) {
    return { pipeline, created: false, reason: "No final matches found" };
  }

  const createdIds: number[] = [];

  for (const match of allFinalMatches) {
    const home = match.home_team as any;
    const away = match.away_team as any;
    if (!home?.team_uuid || !away?.team_uuid) continue; // skip if team join failed

    const homeName = home.name || "Home";
    const awayName = away.name || "Away";
    const homeShort = home.short_name || "HOM";
    const awayShort = away.short_name || "AWY";
    const homeUuid = home.team_uuid;
    const awayUuid = away.team_uuid;
    const hg = match.home_goals ?? 0;
    const ag = match.away_goals ?? 0;

    // Dedup by exact score line + gameweek
    const dedupPrefix = `GW${match.gameweek_id} FT: ${homeShort} ${hg}-${ag} ${awayShort}`;
    if (await postWithTitleExists(supabase, dedupPrefix)) continue;

    // Get goal scorers for this GW
    const { data: goalStats, error: goalErr } = await supabase
      .from("player_stats")
      .select("player_id, goals, player_name, players:player_id(web_name, team_id)")
      .eq("gameweek_id", match.gameweek_id)
      .gt("goals", 0);

    if (goalErr) {
      console.error(`[auto-content] Goal stats query failed for match ${match.id}:`, goalErr.message);
    }

    const homeScorers: string[] = [];
    const awayScorers: string[] = [];

    for (const s of goalStats ?? []) {
      const p = s.players as any;
      const name = s.player_name || p?.web_name || "Unknown";
      const teamId = p?.team_id;
      const goalStr = (s.goals ?? 0) > 1 ? `${name} x${s.goals}` : name;

      if (teamId === homeUuid) homeScorers.push(goalStr);
      else if (teamId === awayUuid) awayScorers.push(goalStr);
    }

    // Get assist providers
    const { data: assistStats, error: assistErr } = await supabase
      .from("player_stats")
      .select("player_id, assists, player_name, players:player_id(web_name, team_id)")
      .eq("gameweek_id", match.gameweek_id)
      .gt("assists", 0);

    if (assistErr) {
      console.error(`[auto-content] Assist stats query failed for match ${match.id}:`, assistErr.message);
    }

    const homeAssists: string[] = [];
    const awayAssists: string[] = [];

    for (const s of assistStats ?? []) {
      const p = s.players as any;
      const name = s.player_name || p?.web_name || "Unknown";
      const teamId = p?.team_id;
      const assistStr = (s.assists ?? 0) > 1 ? `${name} x${s.assists}` : name;

      if (teamId === homeUuid) homeAssists.push(assistStr);
      else if (teamId === awayUuid) awayAssists.push(assistStr);
    }

    const result = hg > ag ? `${homeName} win` : hg < ag ? `${awayName} win` : "Draw";

    const rawTitle = `GW${match.gameweek_id} FT: ${homeShort} ${hg}-${ag} ${awayShort} — ${result}`;
    const bodyParts = [`<b>${homeName} ${hg} - ${ag} ${awayName}</b>`];

    if (homeScorers.length > 0) {
      bodyParts.push(`<br><b>${homeShort} goals:</b> ${homeScorers.join(", ")}`);
    }
    if (awayScorers.length > 0) {
      bodyParts.push(`<br><b>${awayShort} goals:</b> ${awayScorers.join(", ")}`);
    }
    if (homeAssists.length > 0 || awayAssists.length > 0) {
      const allAssists = [...homeAssists, ...awayAssists];
      bodyParts.push(`<br><b>Assists:</b> ${allAssists.join(", ")}`);
    }
    if (hg === 0 && ag === 0) {
      bodyParts.push(`<br>A goalless draw — clean sheets all round!`);
    }

    const rawBody = bodyParts.join("\n");
    const polished = await polishWithAI(openai, rawTitle, rawBody);

    const postId = await insertDraft(supabase, {
      title: polished.title,
      body: polished.body,
      category: "matchday",
      gameweek_id: match.gameweek_id,
    });

    if (postId) createdIds.push(postId);
  }

  return createdIds.length > 0
    ? { pipeline, created: true, postIds: createdIds, reason: `${createdIds.length} match report(s)` }
    : { pipeline, created: false, reason: "No new match reports needed" };
}

/* ── Pipeline 6: Transfer Buzz ─────────────────────────────────────────── */

export async function generateTransferBuzz(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "transfer_buzz";

  // Find transfers in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentTransfers } = await supabase
    .from("transfers")
    .select("in_player_id, gameweek_id")
    .gte("created_at", since);

  if (!recentTransfers || recentTransfers.length < 3) {
    return { pipeline, created: false, reason: `Only ${recentTransfers?.length ?? 0} transfers in 24h (need 3+)` };
  }

  // Count transfers-in per player
  const counts: Record<string, { count: number; gwId: number }> = {};
  for (const t of recentTransfers) {
    const pid = t.in_player_id;
    if (!counts[pid]) counts[pid] = { count: 0, gwId: t.gameweek_id };
    counts[pid].count++;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  const [topPlayerId, topData] = sorted[0];

  // Must be picked by at least 2 managers to be "trending"
  if (topData.count < 2) {
    return { pipeline, created: false, reason: "No player trending (need 2+ transfers-in)" };
  }

  // Dedup: only one transfer buzz per day (timezone-safe via UTC date)
  const { data: existing } = await supabase
    .from("feed_media")
    .select("created_at")
    .ilike("title", "Transfer Watch:%")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && utcDateStr(existing.created_at) === utcDateStr(new Date())) {
    return { pipeline, created: false, reason: "Transfer buzz already posted today" };
  }

  // Get player details
  const { data: player } = await supabase
    .from("players")
    .select("web_name, position, now_cost, teams:teams!players_team_id_fkey(name, short_name)")
    .eq("id", topPlayerId)
    .maybeSingle();

  if (!player) {
    return { pipeline, created: false, reason: "Trending player not found in database" };
  }

  const pData = player as any;
  const playerName = pData?.web_name || "Unknown";
  const teamName = pData?.teams?.name || "Unknown";
  const position = pData?.position || "???";
  const cost = pData?.now_cost ? `${(pData.now_cost / 10).toFixed(1)}M` : "?";

  const rawTitle = `Transfer Watch: ${playerName} is trending — ${topData.count} managers brought him in!`;
  const rawBody = [
    `<b>${playerName}</b> (${teamName}) is the hottest transfer target right now!`,
    `<br><b>Position:</b> ${position}`,
    `<br><b>Price:</b> ${cost}`,
    `<br><b>Transfers in (24h):</b> ${topData.count}`,
    `<br><b>Total transfer activity (24h):</b> ${recentTransfers.length}`,
    `<br><br>Are you jumping on the bandwagon?`,
  ].join("\n");

  const polished = await polishWithAI(openai, rawTitle, rawBody);

  const postId = await insertDraft(supabase, {
    title: polished.title,
    body: polished.body,
    category: "announcement",
    gameweek_id: topData.gwId,
  });

  return postId
    ? { pipeline, created: true, postId }
    : { pipeline, created: false, reason: "Insert failed" };
}

/* ── Pipeline 7: Milestone Alerts ──────────────────────────────────────── */

const MILESTONES = [
  { stat: "goals", thresholds: [5, 10, 15, 20, 25, 50], label: "league goals" },
  { stat: "assists", thresholds: [5, 10, 15, 20, 25], label: "league assists" },
  { stat: "points", thresholds: [25, 50, 75, 100, 150, 200], label: "total fantasy points" },
] as const;

export async function generateMilestoneAlerts(
  supabase: SupabaseClient,
  openai: OpenAI | null,
): Promise<PipelineResult> {
  const pipeline = "milestone_alerts";

  // Use DB-side aggregation to avoid fetching all rows
  const { data: cumulative, error: aggErr } = await supabase.rpc("get_player_cumulative_stats").select();

  // Fallback: if RPC doesn't exist, aggregate client-side with limit
  const agg: Record<string, { goals: number; assists: number; points: number }> = {};

  if (aggErr || !cumulative) {
    // Fallback: fetch recent GWs only (last 15) to keep payload manageable
    const { data: rawStats } = await supabase
      .from("player_stats")
      .select("player_id, goals, assists, points")
      .gte("gameweek_id", 1);

    if (!rawStats || rawStats.length === 0) {
      return { pipeline, created: false, reason: "No player stats available" };
    }

    for (const row of rawStats) {
      if (!agg[row.player_id]) agg[row.player_id] = { goals: 0, assists: 0, points: 0 };
      agg[row.player_id].goals += row.goals ?? 0;
      agg[row.player_id].assists += row.assists ?? 0;
      agg[row.player_id].points += row.points ?? 0;
    }
  } else {
    // RPC returned pre-aggregated data
    for (const row of cumulative as any[]) {
      agg[row.player_id] = {
        goals: row.total_goals ?? 0,
        assists: row.total_assists ?? 0,
        points: row.total_points ?? 0,
      };
    }
  }

  // Find the most recent GW for the gameweek_id on the post
  const { data: latestGw } = await supabase
    .from("gameweeks")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const gwId = latestGw?.id ?? 1;

  // Batch-fetch ALL player names upfront (eliminates N+1 query problem)
  const playerIds = Object.keys(agg);
  const { data: allPlayers } = await supabase
    .from("players")
    .select("id, web_name, teams:teams!players_team_id_fkey(name)")
    .in("id", playerIds);

  const playerMap: Record<string, { name: string; team: string }> = {};
  for (const p of allPlayers ?? []) {
    playerMap[p.id] = {
      name: (p as any).web_name || "Unknown",
      team: (p as any).teams?.name || "",
    };
  }

  const createdIds: number[] = [];

  for (const [playerId, stats] of Object.entries(agg)) {
    const playerInfo = playerMap[playerId];
    if (!playerInfo) continue; // player deleted — skip

    for (const milestone of MILESTONES) {
      const value = stats[milestone.stat as keyof typeof stats];

      for (const threshold of milestone.thresholds) {
        if (value < threshold) break;

        // Only alert on the highest reached threshold
        const idx = (milestone.thresholds as readonly number[]).indexOf(threshold);
        const nextThreshold = (milestone.thresholds as readonly number[])[idx + 1];
        if (nextThreshold && value >= nextThreshold) continue;

        const fullDedup = `Milestone: ${playerInfo.name} hits ${threshold} ${milestone.label}`;
        if (await postWithTitleExists(supabase, fullDedup)) continue;

        const rawTitle = `Milestone: ${playerInfo.name} hits ${threshold} ${milestone.label}!`;
        const rawBody = [
          `<b>${playerInfo.name}</b> (${playerInfo.team}) has reached <b>${threshold} ${milestone.label}</b> this season!`,
          `<br><b>Current tally:</b> ${value} ${milestone.label}`,
          `<br><br>A landmark moment in the Budo League!`,
        ].join("\n");

        const polished = await polishWithAI(openai, rawTitle, rawBody);

        const postId = await insertDraft(supabase, {
          title: polished.title,
          body: polished.body,
          category: "player_spotlight",
          gameweek_id: gwId,
        });

        if (postId) createdIds.push(postId);
      }
    }
  }

  return createdIds.length > 0
    ? { pipeline, created: true, postIds: createdIds, reason: `${createdIds.length} milestone(s)` }
    : { pipeline, created: false, reason: "No new milestones reached" };
}
