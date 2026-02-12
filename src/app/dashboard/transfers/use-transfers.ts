"use client";

import * as React from "react";

export type TransferLogItem = {
  gwId: number;
  ts: string;
  outId: string;
  inId: string;
  outName?: string;
  inName?: string;
  outTeamShort?: string | null;
  inTeamShort?: string | null;
  outPos?: string | null;
  inPos?: string | null;
  outPrice?: number | null;
  inPrice?: number | null;
};

export type ApiPlayer = {
  id: string;
  name: string;
  position: string;
  price: number | null;
  points: number | null;
  avatarUrl: string | null;
  isLady: boolean | null;
  teamId: string;
  teamName: string;
  teamShort: string;
};

const DEV_MODE = process.env.NODE_ENV === "development";

const LS_TRANSFERS_LOG = "tbl_transfers_log";
const LS_FT_BY_GW = (gwId: number) => `tbl_free_transfers_gw_${gwId}`;
const LS_USED_BY_GW = (gwId: number) => `tbl_transfers_used_gw_${gwId}`;

// OPTIONAL: if you store user/team identifiers locally
const LS_USER_ID = "tbl_user_id"; // change if yours is different
const LS_FANTASY_TEAM_ID = "tbl_fantasy_team_id"; // change if yours is different

function loadTransfersLog(): TransferLogItem[] {
  try {
    const raw = window.localStorage.getItem(LS_TRANSFERS_LOG);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as TransferLogItem[]) : [];
  } catch {
    return [];
  }
}

function saveTransfersLog(items: TransferLogItem[]) {
  window.localStorage.setItem(LS_TRANSFERS_LOG, JSON.stringify(items));
}

type UseTransfersResult = {
  // existing
  transfersThisGW: TransferLogItem[];
  freeTransfers: number;
  usedTransfers: number;
  cost: number;
  setFreeTransfers: (value: number) => void;
  recordTransfer: (item: TransferLogItem) => void;
  incrementUsedTransfers: () => void;

  // NEW: squad from DB
  loadingSquad: boolean;
  squadIds: string[];
  squadPlayers: ApiPlayer[];
  squadError: string | null;
  refreshSquad: () => Promise<void>;
};

export function useTransfers(gwId: number | null): UseTransfersResult {
  const [transfersLogVersion, setTransfersLogVersion] = React.useState(0);

  // ✅ NEW squad states
  const [loadingSquad, setLoadingSquad] = React.useState(true);
  const [squadIds, setSquadIds] = React.useState<string[]>([]);
  const [squadPlayers, setSquadPlayers] = React.useState<ApiPlayer[]>([]);
  const [squadError, setSquadError] = React.useState<string | null>(null);

  const transfersThisGW = React.useMemo(() => {
    if (!gwId) return [];
    void transfersLogVersion;
    return loadTransfersLog().filter((t) => t.gwId === gwId);
  }, [gwId, transfersLogVersion]);

  const freeTransfers = React.useMemo(() => {
    if (DEV_MODE) return 999;
    if (!gwId) return 1;
    const raw = window.localStorage.getItem(LS_FT_BY_GW(gwId));
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n)) return Math.max(1, Math.min(2, n));
    return 1;
  }, [gwId]);

  const usedTransfers = React.useMemo(() => {
    if (!gwId) return 0;
    const raw = window.localStorage.getItem(LS_USED_BY_GW(gwId));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [gwId]);

  const cost = React.useMemo(() => {
    if (DEV_MODE) return 0;
    const paid = Math.max(0, usedTransfers - freeTransfers);
    return paid * 4;
  }, [usedTransfers, freeTransfers]);

  const setFreeTransfers = React.useCallback(
    (value: number) => {
      if (!gwId) return;
      const v = DEV_MODE ? value : Math.max(1, Math.min(2, value));
      window.localStorage.setItem(LS_FT_BY_GW(gwId), String(v));
    },
    [gwId]
  );

  const recordTransfer = React.useCallback((item: TransferLogItem) => {
    const prev = loadTransfersLog();
    saveTransfersLog([item, ...prev]);
    setTransfersLogVersion((v) => v + 1);
  }, []);

  const incrementUsedTransfers = React.useCallback(() => {
    if (!gwId) return;
    const raw = window.localStorage.getItem(LS_USED_BY_GW(gwId));
    const n = raw ? Number(raw) : 0;
    const next = Math.max(0, n) + 1;
    window.localStorage.setItem(LS_USED_BY_GW(gwId), String(next));
  }, [gwId]);

  // ✅ NEW: loads roster for CURRENT gw then loads players by IDs
  const refreshSquad = React.useCallback(async () => {
    try {
      setSquadError(null);
      setLoadingSquad(true);

      if (!gwId) {
        setSquadIds([]);
        setSquadPlayers([]);
        return;
      }

      // If you have a user id / fantasy team id somewhere, grab it here.
      // Pick ONE that matches your DB schema.
      const userId = window.localStorage.getItem(LS_USER_ID);
      const fantasyTeamId = window.localStorage.getItem(LS_FANTASY_TEAM_ID);

      // If your /api/rosters/current expects user_id OR fantasy_team_id, send it.
      // (If your route doesn’t need these, it can ignore them.)
      const qs = new URLSearchParams();
      qs.set("gw_id", String(gwId));
      if (userId) qs.set("user_id", userId);
      if (fantasyTeamId) qs.set("fantasy_team_id", fantasyTeamId);

      const r = await fetch(`/api/rosters/current?${qs.toString()}`, { cache: "no-store" });
      const rosterJson = await r.json();
      if (!r.ok) throw new Error(rosterJson?.error || "Failed to load roster");

      // Expecting: { roster: { squad_ids: string[] } }
      const ids: string[] = rosterJson?.roster?.squad_ids ?? rosterJson?.roster?.squadIds ?? [];
      setSquadIds(ids);

      if (!ids.length) {
        setSquadPlayers([]);
        return;
      }

      // Now load actual player objects by ids
      const p = await fetch(`/api/players?ids=${encodeURIComponent(ids.join(","))}`, {
        cache: "no-store",
      });
      const playersJson = await p.json();
      if (!p.ok) throw new Error(playersJson?.error || "Failed to load squad players");

      setSquadPlayers((playersJson.players ?? []) as ApiPlayer[]);
    } catch (e: any) {
      console.log("refreshSquad error:", e);
      setSquadIds([]);
      setSquadPlayers([]);
      setSquadError(e?.message ?? "Failed to load squad");
    } finally {
      setLoadingSquad(false);
    }
  }, [gwId]);

  React.useEffect(() => {
    refreshSquad();
  }, [refreshSquad]);

  return {
    transfersThisGW,
    freeTransfers,
    usedTransfers,
    cost,
    setFreeTransfers,
    recordTransfer,
    incrementUsedTransfers,

    loadingSquad,
    squadIds,
    squadPlayers,
    squadError,
    refreshSquad,
  };
}
