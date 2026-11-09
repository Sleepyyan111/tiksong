import type { Track } from "./tracks";

const DB_NAME = "tiksong-offline";
const STORE_NAME = "tracks";
const DB_VERSION = 1;

type StoredTrack = {
  track: Omit<Track, "audioUrl" | "coverUrl">;
  audio: Blob;
  savedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "track.id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Offline storage transaction failed.")); };
  });
}

export async function getOfflineTracks(): Promise<Track[]> {
  const stored = await withStore<StoredTrack[]>("readonly", (store) => store.getAll());
  return stored.map(({ track }) => ({ ...track, audioUrl: undefined, coverUrl: undefined, offline: true } as Track));
}

export async function getOfflineTrack(id: string): Promise<StoredTrack | undefined> {
  return withStore<StoredTrack | undefined>("readonly", (store) => store.get(id));
}

export async function saveOfflineTrack(track: Track): Promise<void> {
  if (!track.audioUrl) throw new Error("This track is not available to download right now.");
  const response = await fetch(track.audioUrl);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const audio = await response.blob();
  if (!audio.size) throw new Error("The downloaded audio file was empty.");
  const { audioUrl: _audioUrl, coverUrl: _coverUrl, ...metadata } = track;
  const stored: StoredTrack = { track: metadata, audio, savedAt: Date.now() };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(stored));
}

export async function removeOfflineTrack(id: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(id));
}
