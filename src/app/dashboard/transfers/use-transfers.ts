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

type UseTransfersResult = {
  transfersThisGW: TransferLogItem[];
  freeTransfers: number;
  usedTransfers: number;
  cost: number;
  setFreeTransfers: (value: number) => void;
  recordTransfer: (item: TransferLogItem) => void;
  incrementUsedTransfers: () => void;

  // Squad from DB
  loadingSquad: boolean;
  squadIds: string[];
  squadPlayers: ApiPlayer[];
  squadError: string | null;
  refreshSquad: () => Promise<void>;
};

export function useTransfers(gwId: number | null): UseTransfersResult {
  const [freeTransfers, setFreeTransfersState] = React.useState(1);
  const [usedTransfers, setUsedTransfersState] = React.useState(0);
  const [cost, setCost] = React.useState(0);
  const [transfersThisGW, setTransfersThisGW] = React.useState<TransferLogItem[]>([]);

  // Squad states
  const [loadingSquad, setLoadingSquad] = React.useState(true);
  const [squadIds, setSquadIds] = React.useState<string[]>([]);
  const [squadPlayers, setSquadPlayers] = React.useState<ApiPlayer[]>([]);
  const [squadError, setSquadError] = React.useState<string | null>(null);

  // Load transfer state from API
  const loadTransferState = React.useCallback(async () => {
    if (!gwId) return;
    try {
      const res = await fetch(`/api/transfers?gw_id=${gwId}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      setFreeTransfersState(json.freeTransfers ?? 1);
      setUsedTransfersState(json.usedTransfers ?? 0);
      setCost(json.cost ?? 0);

      // Map server transfers to TransferLogItem format
      const items: TransferLogItem[] = (json.transfers ?? []).map(
        (t: { player_out_id: string; player_in_id: string; created_at: string }) => ({
          gwId,
          ts: t.created_at,
          outId: t.player_out_id,
          inId: t.player_in_id,
        }),
      );
      setTransfersThisGW(items);
    } catch {
      // Silently fail — defaults are safe
    }
  }, [gwId]);

  React.useEffect(() => {
    loadTransferState();
  }, [loadTransferState]);

  const setFreeTransfers = React.useCallback((_value: number) => {
    // No-op: free transfers are now managed server-side
  }, []);

  const recordTransfer = React.useCallback(
    (item: TransferLogItem) => {
      if (!gwId) return;

      // Record on server
      fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          gameweekId: gwId,
          playerOutId: item.outId,
          playerInId: item.inId,
        }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.ok) {
            setUsedTransfersState(json.usedTransfers ?? 0);
            setCost(json.cost ?? 0);
            setFreeTransfersState(json.freeTransfers ?? 1);
          }
        })
        .catch(() => {
          // Silently fail
        });

      // Optimistic local update
      setTransfersThisGW((prev) => [item, ...prev]);
      setUsedTransfersState((prev) => prev + 1);
    },
    [gwId],
  );

  const incrementUsedTransfers = React.useCallback(() => {
    // No-op: incrementing is now done inside recordTransfer via the API
  }, []);

  // Load roster for current GW then load players by IDs
  const refreshSquad = React.useCallback(async () => {
    try {
      setSquadError(null);
      setLoadingSquad(true);

      if (!gwId) {
        setSquadIds([]);
        setSquadPlayers([]);
        return;
      }

      const r = await fetch(`/api/rosters?gw_id=${gwId}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const rosterJson = await r.json();
      if (!r.ok) throw new Error(rosterJson?.error || "Failed to load roster");

      const ids: string[] = rosterJson?.squadIds ?? [];
      setSquadIds(ids);

      if (!ids.length) {
        setSquadPlayers([]);
        return;
      }

      const p = await fetch(
        `/api/players?ids=${encodeURIComponent(ids.join(","))}`,
        { cache: "no-store" },
      );
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
