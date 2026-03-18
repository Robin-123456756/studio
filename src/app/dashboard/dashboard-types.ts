"use client";

export type Row = {
  teamId: string;
  name: string;
  logoUrl: string;
  PL: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  LP: number;
  Pts: number;
};

export type MatchEvent = {
  playerName: string;
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  isLady: boolean;
};

export type ApiMatch = {
  id: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean | null;
  is_final: boolean | null;
  home_team_uuid: string;
  away_team_uuid: string;
  home_team: { team_uuid: string; name: string; short_name: string; logo_url: string | null } | null;
  away_team: { team_uuid: string; name: string; short_name: string; logo_url: string | null } | null;
  home_events?: MatchEvent[];
  away_events?: MatchEvent[];
};

export type ApiTeam = {
  team_uuid: string;
  name: string;
  short_name: string;
  logo_url: string | null;
};

export type GWInfo = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
};

export type FeedMediaItem = {
  id: number;
  title: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  category: string;
  layout: string;
  is_pinned: boolean;
  gameweek_id: number | null;
  media_urls: string[] | null;
  created_at: string;
  view_count: number;
  display_size?: string;
};

export type FantasyQuickStats = {
  rank: number | null;
  totalPoints: number;
  gwPoints: number | null;
  teamName: string;
} | null;

export type DashboardTopPerformer = {
  name: string;
  points: number;
  teamName: string;
  goals: number;
  assists: number;
  isLady: boolean;
  playerId: string;
} | null;

export type DashboardTopLady = {
  name: string;
  points: number;
  teamName: string;
  avatarUrl: string | null;
  position: string | null;
  goals: number;
  assists: number;
  playerId: string;
} | null;

export type TransferActivityItem = {
  id: number | string;
  managerTeam?: string;
  playerOut?: {
    name?: string;
    webName?: string;
    position?: string;
    teamShort?: string;
  };
  playerIn?: {
    name?: string;
    webName?: string;
    position?: string;
    teamShort?: string;
  };
  gameweekId?: number;
  createdAt?: string;
};

export type DeadlineCountdown = {
  label: string;
  msLeft: number | null;
  tone: "neutral" | "closed" | "critical" | "urgent" | "soon" | "normal";
};
