import type { Track } from "./tracks";

const DB_NAME = "tiksong-offline";
const STORE_NAME = "tracks";
const DB_VERSION = 1;

export type StoredTrack = {
  track: Omit<Track, "audioUrl" | "coverUrl">;
  audio: Blob;
  cover?: Blob | undefined;
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

export function getAllStored(): Promise<StoredTrack[]> {
  return withStore<StoredTrack[]>("readonly", (store) => store.getAll());
}

export function getOfflineTrack(id: string): Promise<StoredTrack | undefined> {
  return withStore<StoredTrack | undefined>("readonly", (store) => store.get(id));
}

/** Fetch with byte progress and cancel support. */
async function fetchBlob(url: string, signal: AbortSignal, onProgress?: (p: number) => void): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total || !onProgress) return res.blob();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  return new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") ?? "audio/mpeg" });
}

export async function saveOfflineTrack(track: Track, signal: AbortSignal, onProgress?: (p: number) => void): Promise<StoredTrack> {
  if (!track.audioUrl) throw new Error("This track isn't available to download right now.");
  const audio = await fetchBlob(track.audioUrl, signal, onProgress);
  if (!audio.size) throw new Error("The downloaded audio file was empty.");
  let cover: Blob | undefined;
  if (track.coverUrl) cover = await fetchBlob(track.coverUrl, signal).catch(() => undefined);
  const { audioUrl: _a, coverUrl: _c, ...metadata } = track;
  const stored: StoredTrack = { track: metadata, audio, cover, savedAt: Date.now() };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(stored));
  return stored;
}

export async function removeOfflineTrack(id: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(id));
}

/** File extension matching the real audio type — never a fake rename. */
export function extensionFor(type: string): string {
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  if (type.includes("wav")) return "wav";
  return "mp3";
}
