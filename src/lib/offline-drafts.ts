/**
 * Offline-First Drafts
 *
 * Stores draft post text fields in IndexedDB when offline.
 * Syncs to the server API when back online.
 * No npm dependencies — uses raw IndexedDB API.
 */

const DB_NAME = "budo-drafts";
const STORE_NAME = "offline_drafts";
const DB_VERSION = 1;

type OfflineDraft = {
  id?: number; // auto-incremented by IndexedDB
  title: string;
  body: string;
  category: string;
  layout: string;
  status: string;
  gameweek_id: string;
  created_at: string;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(draft: Omit<OfflineDraft, "id" | "created_at">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({
      ...draft,
      created_at: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listDrafts(): Promise<OfflineDraft[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDraft(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncDrafts(
  postFn: (draft: Omit<OfflineDraft, "id" | "created_at">) => Promise<boolean>,
): Promise<number> {
  const drafts = await listDrafts();
  let synced = 0;

  for (const draft of drafts) {
    const { id, created_at, ...fields } = draft;
    const success = await postFn(fields);
    if (success && id) {
      await deleteDraft(id);
      synced++;
    }
  }

  return synced;
}

export async function draftCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
