export const LS_SQUAD = "tbl_squad_player_ids";
export const LS_PICKS = "tbl_picked_player_ids";       // legacy (optional)
export const LS_STARTING = "tbl_starting_player_ids";  // if you still use it

export function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export function saveIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function loadSquadIds(): string[] {
  // ✅ single source of truth
  return loadIds(LS_SQUAD);
}

export function saveSquadIds(ids: string[]) {
  // ✅ write to squad key
  saveIds(LS_SQUAD, ids);

  // ✅ optional legacy mirror so older code still works
  saveIds(LS_PICKS, ids);

  // ✅ notify same-tab listeners (storage event doesn’t fire in same tab)
  window.dispatchEvent(new Event("tbl_squad_updated"));
}
