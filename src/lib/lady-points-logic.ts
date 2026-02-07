/**
 * LADY POINTS LOGIC — saved for future use
 *
 * Lady points: +1 per match if a team fields a lady player (detected via player_stats).
 * Formula with LP: Pts = W*3 + D + LP
 *
 * ──── standings/route.ts (inside GET handler, after fetching matches) ────
 *
 * // Add LP to the Row type:
 * // LP: number;
 *
 * // Fetch player_stats (flat) for lady detection
 * const { data: playerStats } = await supabase
 *   .from("player_stats")
 *   .select("gameweek_id, player_id");
 *
 * const statPlayerIds = [...new Set((playerStats ?? []).map((s: any) => s.player_id))];
 * const playerLadyLookup = new Map<string, { isLady: boolean; teamUuid: string | null }>();
 *
 * if (statPlayerIds.length > 0) {
 *   const { data: playersData } = await supabase
 *     .from("players")
 *     .select("id, is_lady, team_id")
 *     .in("id", statPlayerIds);
 *
 *   const teamIds = [...new Set((playersData ?? []).map((p: any) => p.team_id).filter(Boolean))];
 *   const teamIdToUuid = new Map<number, string>();
 *
 *   if (teamIds.length > 0) {
 *     const { data: teamsData } = await supabase
 *       .from("teams")
 *       .select("id, team_uuid")
 *       .in("id", teamIds);
 *
 *     for (const t of teamsData ?? []) {
 *       teamIdToUuid.set(t.id, t.team_uuid);
 *     }
 *   }
 *
 *   for (const p of playersData ?? []) {
 *     playerLadyLookup.set(p.id, {
 *       isLady: p.is_lady ?? false,
 *       teamUuid: teamIdToUuid.get(p.team_id) ?? null,
 *     });
 *   }
 * }
 *
 * const ladyPlayedSet = new Set<string>();
 * for (const s of playerStats ?? []) {
 *   const p = playerLadyLookup.get(s.player_id);
 *   if (p?.isLady && p.teamUuid) {
 *     ladyPlayedSet.add(`${s.gameweek_id}:${p.teamUuid}`);
 *   }
 * }
 *
 * // Inside match loop:
 * if (ladyPlayedSet.has(`${m.gameweek_id}:${homeId}`)) home.LP += 1;
 * if (ladyPlayedSet.has(`${m.gameweek_id}:${awayId}`)) away.LP += 1;
 *
 * // Points formula:
 * r.Pts = r.W * 3 + r.D + r.LP;
 *
 * ──── dashboard/page.tsx ────
 *
 * // Row type includes: LP: number;
 * // Table header: <TableHead>LP</TableHead>
 * // Table cell:   <TableCell>{r.LP}</TableCell>
 * // League rules: "Lady forward is optional; +1 LP if fielded."
 */
