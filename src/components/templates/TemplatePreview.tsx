"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { renderToPng, imageToDataUrl } from "@/lib/template-engine";
import {
  TEMPLATE_TYPES,
  LOGO_URL,
  type TemplateTypeId,
  type TemplateMatch,
  type TemplateMatchEvent,
  type TemplatePlayer,
  type TemplateStandingsRow,
  type TemplateTeam,
} from "./shared";
import MatchdayTemplate from "./MatchdayTemplate";
import ScoreResultTemplate from "./ScoreResultTemplate";
import PlayerSpotlightTemplate from "./PlayerSpotlightTemplate";
import LeaderboardTemplate from "./LeaderboardTemplate";
import TransferTemplate from "./TransferTemplate";

/* ── Style tokens ─────────────────────────────────────────────────────── */
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const SURFACE = "#1A2236";
const BG = "#111827";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Props = {
  templateType: TemplateTypeId;
  /** Called when user clicks "Use in Post" — passes the PNG blob + preview URL */
  onUseInPost: (blob: Blob, previewUrl: string) => void;
};

type DataState = {
  loading: boolean;
  error: string | null;
  logoDataUrl: string | null;
  // Matchday
  gameweeks: { id: number; name: string }[];
  selectedGw: number | null;
  matches: TemplateMatch[];
  rawMatches: Record<string, unknown>[]; // raw API response for event extraction
  // Score result
  selectedMatchId: string | null;
  matchEvents: { home: TemplateMatchEvent[]; away: TemplateMatchEvent[] };
  motm: string;
  // Player spotlight
  players: TemplatePlayer[];
  selectedPlayerId: string | null;
  spotlightHeadline: string;
  // Leaderboard
  standings: TemplateStandingsRow[];
  leaderboardTitle: string;
  // Transfer
  teams: TemplateTeam[];
  transferFromTeamIdx: number;
  transferToTeamIdx: number;
};

/* ── Component ─────────────────────────────────────────────────────────── */

export default function TemplatePreview({ templateType, onUseInPost }: Props) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const [data, setData] = useState<DataState>({
    loading: false,
    error: null,
    logoDataUrl: null,
    gameweeks: [],
    selectedGw: null,
    matches: [],
    rawMatches: [],
    selectedMatchId: null,
    matchEvents: { home: [], away: [] },
    motm: "",
    players: [],
    selectedPlayerId: null,
    spotlightHeadline: "Player Spotlight",
    standings: [],
    leaderboardTitle: "League Standings",
    teams: [],
    transferFromTeamIdx: 0,
    transferToTeamIdx: 1,
  });

  const meta = TEMPLATE_TYPES.find((t) => t.id === templateType)!;

  /* ── Load logo as data URL for SVG export ────────────────────────── */
  useEffect(() => {
    imageToDataUrl(LOGO_URL)
      .then((url) => setData((d) => ({ ...d, logoDataUrl: url })))
      .catch(() => {}); // logo is optional
  }, []);

  /* ── Fetch initial data when template type changes ───────────────── */
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType]);

  const loadData = useCallback(async () => {
    setData((d) => ({ ...d, loading: true, error: null }));
    try {
      // Always load gameweeks (the /current endpoint returns { all: [...] })
      const gwRes = await fetch("/api/gameweeks/current", { credentials: "same-origin" });
      const gwJson = await gwRes.json();
      const gameweeks: { id: number; name: string }[] = (gwJson.all || []).map(
        (g: { id: number; name?: string }) => ({ id: g.id, name: g.name || `GW ${g.id}` })
      );

      // Always load teams
      const teamsRes = await fetch("/api/teams", { credentials: "same-origin" });
      const teamsJson = await teamsRes.json();
      const teams: TemplateTeam[] = (teamsJson.teams || teamsJson || []).map(
        (t: { name: string; short_name: string; logo_url: string }) => ({
          name: t.name,
          shortName: t.short_name,
          logoUrl: t.logo_url,
        })
      );

      // Load players for spotlight/transfer
      let players: TemplatePlayer[] = [];
      if (templateType === "player_spotlight" || templateType === "transfer") {
        const pRes = await fetch("/api/players", { credentials: "same-origin" });
        const pJson = await pRes.json();
        players = (pJson.players || pJson || []).map(
          (p: Record<string, unknown>) => ({
            id: String(p.id),
            name: String(p.name || ""),
            webName: p.webName as string | null,
            position: String(p.position || ""),
            avatarUrl: p.avatarUrl as string | null,
            isLady: Boolean(p.isLady),
            teamName: String(p.teamName || ""),
            teamShort: String(p.teamShort || ""),
            teamLogoUrl: String(p.teamLogoUrl || ""),
            totalPoints: Number(p.points || 0),
            totalGoals: Number(p.totalGoals || 0),
            totalAssists: Number(p.totalAssists || 0),
            appearances: Number(p.appearances || 0),
            price: p.price != null ? Number(p.price) : null,
            ownership: Number(p.ownership || 0),
          })
        );
      }

      // Load standings for leaderboard
      let standings: TemplateStandingsRow[] = [];
      if (templateType === "leaderboard") {
        const sRes = await fetch("/api/standings", { credentials: "same-origin" });
        const sJson = await sRes.json();
        standings = (sJson.standings || sJson || []).map(
          (s: Record<string, unknown>, i: number) => ({
            rank: i + 1,
            teamName: String(s.name || s.teamName || ""),
            logoUrl: String(s.logoUrl || s.logo_url || ""),
            played: Number(s.PL || s.played || 0),
            won: Number(s.W || s.won || 0),
            drawn: Number(s.D || s.drawn || 0),
            lost: Number(s.L || s.lost || 0),
            gf: Number(s.GF || s.gf || 0),
            ga: Number(s.GA || s.ga || 0),
            gd: Number(s.GD || s.gd || 0),
            points: Number(s.Pts || s.points || 0),
            movement: Number(s.movement || 0),
          })
        );
      }

      const latestGw = gameweeks.length > 0 ? gameweeks[gameweeks.length - 1].id : null;

      setData((d) => ({
        ...d,
        loading: false,
        gameweeks,
        teams,
        players,
        standings,
        selectedGw: latestGw,
        selectedPlayerId: players.length > 0 ? players[0].id : null,
      }));

      // Auto-load matches for latest GW
      if (latestGw && (templateType === "matchday" || templateType === "score_result")) {
        loadMatches(latestGw);
      }
    } catch (err) {
      setData((d) => ({ ...d, loading: false, error: String(err) }));
    }
  }, [templateType]);

  const loadMatches = async (gwId: number) => {
    try {
      const res = await fetch(`/api/matches?gw_id=${gwId}&enrich=1`, { credentials: "same-origin" });
      const json = await res.json();
      const matches: TemplateMatch[] = (json.matches || json || []).map(
        (m: Record<string, unknown>) => {
          const ht = m.home_team as Record<string, string> | undefined;
          const at = m.away_team as Record<string, string> | undefined;
          return {
            id: String(m.id),
            kickoffTime: String(m.kickoff_time || ""),
            homeTeam: {
              name: ht?.name || "",
              shortName: ht?.short_name || "",
              logoUrl: ht?.logo_url || "",
            },
            awayTeam: {
              name: at?.name || "",
              shortName: at?.short_name || "",
              logoUrl: at?.logo_url || "",
            },
            homeGoals: m.home_goals != null ? Number(m.home_goals) : null,
            awayGoals: m.away_goals != null ? Number(m.away_goals) : null,
            isPlayed: Boolean(m.is_played || m.is_final),
          };
        }
      );

      const rawMatches = json.matches || json || [];

      setData((d) => ({
        ...d,
        matches,
        rawMatches,
        selectedGw: gwId,
        selectedMatchId: matches.length > 0 ? matches[0].id : null,
      }));

      // Load events for first match
      if (matches.length > 0 && rawMatches.length > 0) {
        const firstMatch = rawMatches[0];
        setData((d) => ({
          ...d,
          matchEvents: {
            home: (firstMatch.home_events || []).map(mapEvent),
            away: (firstMatch.away_events || []).map(mapEvent),
          },
        }));
      }
    } catch {}
  };

  const selectMatch = (matchId: string) => {
    setData((d) => {
      const raw = d.rawMatches.find((m) => String(m.id) === matchId);
      return {
        ...d,
        selectedMatchId: matchId,
        matchEvents: raw
          ? {
              home: ((raw.home_events || []) as Record<string, unknown>[]).map(mapEvent),
              away: ((raw.away_events || []) as Record<string, unknown>[]).map(mapEvent),
            }
          : { home: [], away: [] },
      };
    });
  };

  /* ── Export handlers ──────────────────────────────────────────────── */

  async function handleExport(mode: "download" | "use") {
    if (!templateRef.current) return;
    setExporting(true);
    try {
      const blob = await renderToPng(templateRef.current, {
        width: meta.width,
        height: meta.height,
        scale: 2,
      });
      if (mode === "download") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `budo-${templateType}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(blob);
        onUseInPost(blob, url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  /* ── Selector controls per template type ─────────────────────────── */

  function renderControls() {
    const selectStyle: React.CSSProperties = {
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      color: TEXT,
      padding: "8px 12px",
      fontSize: 13,
      width: "100%",
    };
    const inputStyle: React.CSSProperties = { ...selectStyle };
    const labelStyle: React.CSSProperties = { fontSize: 12, color: MUTED, marginBottom: 4, display: "block" };

    switch (templateType) {
      case "matchday":
      case "score_result":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Gameweek</label>
              <select
                style={selectStyle}
                value={data.selectedGw ?? ""}
                onChange={(e) => {
                  const gw = Number(e.target.value);
                  setData((d) => ({ ...d, selectedGw: gw }));
                  loadMatches(gw);
                }}
              >
                {data.gameweeks.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            {templateType === "score_result" && data.matches.length > 0 && (
              <>
                <div>
                  <label style={labelStyle}>Match</label>
                  <select
                    style={selectStyle}
                    value={data.selectedMatchId ?? ""}
                    onChange={(e) => selectMatch(e.target.value)}
                  >
                    {data.matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.homeTeam.shortName} vs {m.awayTeam.shortName}
                        {m.isPlayed ? ` (${m.homeGoals}-${m.awayGoals})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Man of the Match</label>
                  <input
                    style={inputStyle}
                    value={data.motm}
                    onChange={(e) => setData((d) => ({ ...d, motm: e.target.value }))}
                    placeholder="Player name..."
                  />
                </div>
              </>
            )}
          </div>
        );

      case "player_spotlight":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Player</label>
              <select
                style={selectStyle}
                value={data.selectedPlayerId ?? ""}
                onChange={(e) => setData((d) => ({ ...d, selectedPlayerId: e.target.value }))}
              >
                {data.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.position} ({p.teamShort}) {p.totalPoints}pts
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Headline</label>
              <input
                style={inputStyle}
                value={data.spotlightHeadline}
                onChange={(e) => setData((d) => ({ ...d, spotlightHeadline: e.target.value }))}
                placeholder="Player Spotlight"
              />
            </div>
          </div>
        );

      case "leaderboard":
        return (
          <div>
            <label style={labelStyle}>Title</label>
            <input
              style={inputStyle}
              value={data.leaderboardTitle}
              onChange={(e) => setData((d) => ({ ...d, leaderboardTitle: e.target.value }))}
              placeholder="League Standings"
            />
          </div>
        );

      case "transfer":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Player</label>
              <select
                style={selectStyle}
                value={data.selectedPlayerId ?? ""}
                onChange={(e) => setData((d) => ({ ...d, selectedPlayerId: e.target.value }))}
              >
                {data.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.position} ({p.teamShort})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>From Team</label>
                <select
                  style={selectStyle}
                  value={data.transferFromTeamIdx}
                  onChange={(e) => setData((d) => ({ ...d, transferFromTeamIdx: Number(e.target.value) }))}
                >
                  {data.teams.map((t, i) => (
                    <option key={i} value={i}>{t.shortName}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>To Team</label>
                <select
                  style={selectStyle}
                  value={data.transferToTeamIdx}
                  onChange={(e) => setData((d) => ({ ...d, transferToTeamIdx: Number(e.target.value) }))}
                >
                  {data.teams.map((t, i) => (
                    <option key={i} value={i}>{t.shortName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  /* ── Render the actual template ──────────────────────────────────── */

  function renderTemplate() {
    const gwName = data.gameweeks.find((g) => g.id === data.selectedGw)?.name || "";
    const selectedPlayer = data.players.find((p) => p.id === data.selectedPlayerId) || null;
    const selectedMatch = data.matches.find((m) => m.id === data.selectedMatchId) || data.matches[0] || null;

    switch (templateType) {
      case "matchday":
        return (
          <MatchdayTemplate
            gameweekName={gwName}
            matches={data.matches}
            logoDataUrl={data.logoDataUrl ?? undefined}
          />
        );

      case "score_result":
        if (!selectedMatch) return <Placeholder text="Select a match" />;
        return (
          <ScoreResultTemplate
            match={selectedMatch}
            homeEvents={data.matchEvents.home}
            awayEvents={data.matchEvents.away}
            gameweekName={gwName}
            motm={data.motm || undefined}
            logoDataUrl={data.logoDataUrl ?? undefined}
          />
        );

      case "player_spotlight":
        if (!selectedPlayer) return <Placeholder text="Select a player" />;
        return (
          <PlayerSpotlightTemplate
            player={selectedPlayer}
            gameweekName={gwName}
            headline={data.spotlightHeadline}
            logoDataUrl={data.logoDataUrl ?? undefined}
          />
        );

      case "leaderboard":
        if (data.standings.length === 0) return <Placeholder text="No standings data" />;
        return (
          <LeaderboardTemplate
            rows={data.standings}
            title={data.leaderboardTitle}
            logoDataUrl={data.logoDataUrl ?? undefined}
          />
        );

      case "transfer":
        if (!selectedPlayer) return <Placeholder text="Select a player" />;
        return (
          <TransferTemplate
            player={selectedPlayer}
            fromTeam={data.teams[data.transferFromTeamIdx] || { name: "", shortName: "???", logoUrl: "" }}
            toTeam={data.teams[data.transferToTeamIdx] || { name: "", shortName: "???", logoUrl: "" }}
            logoDataUrl={data.logoDataUrl ?? undefined}
          />
        );

      default:
        return <Placeholder text="Select a template" />;
    }
  }

  /* ── Layout ──────────────────────────────────────────────────────── */

  const previewScale = Math.min(360 / meta.width, 450 / meta.height);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Data selectors */}
      <div
        style={{
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 12 }}>
          Template Data
        </div>
        {data.loading ? (
          <div style={{ fontSize: 13, color: MUTED, padding: 12 }}>Loading data...</div>
        ) : data.error ? (
          <div style={{ fontSize: 13, color: "#EF4444", padding: 12 }}>{data.error}</div>
        ) : (
          renderControls()
        )}
      </div>

      {/* Template preview (scaled down) */}
      <div
        style={{
          background: "#000",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            transform: `scale(${previewScale})`,
            transformOrigin: "top center",
            width: meta.width,
            height: meta.height,
          }}
        >
          <div ref={templateRef}>{renderTemplate()}</div>
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => handleExport("download")}
          disabled={exporting || data.loading}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            color: TEXT,
            cursor: exporting ? "not-allowed" : "pointer",
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? "Exporting..." : "Download PNG"}
        </button>
        <button
          type="button"
          onClick={() => handleExport("use")}
          disabled={exporting || data.loading}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background: ACCENT,
            color: "#000",
            cursor: exporting ? "not-allowed" : "pointer",
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? "Exporting..." : "Use in Post"}
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function Placeholder({ text }: { text: string }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111827",
        color: "#64748B",
        fontSize: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {text}
    </div>
  );
}

function mapEvent(e: Record<string, unknown>): TemplateMatchEvent {
  return {
    playerName: String(e.playerName || e.player_name || ""),
    goals: Number(e.goals || 0),
    assists: Number(e.assists || 0),
    isLady: Boolean(e.isLady || e.is_lady),
  };
}
