import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Track } from "./tracks";
import { extensionFor, getAllStored, removeOfflineTrack, saveOfflineTrack, type StoredTrack } from "./offline";

export type DlStatus = "queued" | "downloading" | "done" | "error";
export type DlJob = { track: Track; status: DlStatus; progress: number; error?: string | undefined };

type Ctx = {
  jobs: Record<string, DlJob>;
  offline: Track[];
  bytes: number;
  isOffline: (id: string) => boolean;
  localUrl: (id: string) => { audio?: string | undefined; cover?: string | undefined };
  download: (tracks: Track[]) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => Promise<void>;
  saveToDevice: (id: string) => void;
};

const C = createContext<Ctx | null>(null);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Record<string, StoredTrack>>({});
  const [jobs, setJobs] = useState<Record<string, DlJob>>({});
  const urls = useRef<Record<string, { audio?: string | undefined; cover?: string | undefined }>>({});
  const ctrls = useRef<Record<string, AbortController>>({});
  const queue = useRef<Track[]>([]);
  const running = useRef(false);

  useEffect(() => {
    getAllStored().then((all) => setStored(Object.fromEntries(all.map((s) => [s.track.id, s])))).catch(() => {});
  }, []);

  const localUrl = useCallback((id: string) => {
    const s = stored[id];
    if (!s) return {};
    if (!urls.current[id]) {
      urls.current[id] = { audio: URL.createObjectURL(s.audio), cover: s.cover ? URL.createObjectURL(s.cover) : undefined };
    }
    return urls.current[id]!;
  }, [stored]);

  const patch = (id: string, p: Partial<DlJob>) =>
    setJobs((j) => (j[id] ? { ...j, [id]: { ...j[id]!, ...p } } : j));

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const t = queue.current.shift()!;
      const ctrl = new AbortController();
      ctrls.current[t.id] = ctrl;
      patch(t.id, { status: "downloading", progress: 0, error: undefined });
      try {
        const s = await saveOfflineTrack(t, ctrl.signal, (progress) => patch(t.id, { progress }));
        setStored((m) => ({ ...m, [t.id]: s }));
        patch(t.id, { status: "done", progress: 1 });
      } catch (e) {
        if (ctrl.signal.aborted) setJobs((j) => { const { [t.id]: _, ...rest } = j; return rest; });
        else patch(t.id, { status: "error", error: e instanceof Error ? e.message : "Download failed" });
      } finally {
        delete ctrls.current[t.id];
      }
    }
    running.current = false;
  }, []);

  const download = useCallback((tracks: Track[]) => {
    const todo = tracks.filter((t) => !stored[t.id] && t.audioUrl && !queue.current.some((q) => q.id === t.id) && !ctrls.current[t.id]);
    if (!todo.length) { toast("Already downloaded"); return; }
    setJobs((j) => ({ ...j, ...Object.fromEntries(todo.map((t) => [t.id, { track: t, status: "queued" as const, progress: 0 }])) }));
    queue.current.push(...todo);
    toast(`Downloading ${todo.length} ${todo.length === 1 ? "track" : "tracks"}`);
    void pump();
  }, [stored, pump]);

  const cancel = useCallback((id: string) => {
    queue.current = queue.current.filter((q) => q.id !== id);
    ctrls.current[id]?.abort();
    setJobs((j) => { const { [id]: _, ...rest } = j; return rest; });
  }, []);

  const retry = useCallback((id: string) => {
    const job = jobs[id];
    if (!job) return;
    patch(id, { status: "queued", progress: 0, error: undefined });
    queue.current.push(job.track);
    void pump();
  }, [jobs, pump]);

  const remove = useCallback(async (id: string) => {
    await removeOfflineTrack(id);
    const u = urls.current[id];
    if (u?.audio) URL.revokeObjectURL(u.audio);
    if (u?.cover) URL.revokeObjectURL(u.cover);
    delete urls.current[id];
    setStored((m) => { const { [id]: _, ...rest } = m; return rest; });
    setJobs((j) => { const { [id]: _, ...rest } = j; return rest; });
  }, []);

  const saveToDevice = useCallback((id: string) => {
    const s = stored[id];
    if (!s) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(s.audio);
    const name = `${s.track.title}${s.track.artist ? ` - ${s.track.artist}` : ""}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
    a.download = `${name || "track"}.${extensionFor(s.audio.type)}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }, [stored]);

  const offline = Object.values(stored)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((s) => ({ ...s.track, audioUrl: localUrl(s.track.id).audio, coverUrl: localUrl(s.track.id).cover }) as Track);
  const bytes = Object.values(stored).reduce((n, s) => n + s.audio.size + (s.cover?.size ?? 0), 0);

  return (
    <C.Provider value={{ jobs, offline, bytes, isOffline: (id) => !!stored[id], localUrl, download, cancel, retry, remove, saveToDevice }}>
      {children}
    </C.Provider>
  );
}

export function useDownloads() {
  const c = useContext(C);
  if (!c) throw new Error("useDownloads outside provider");
  return c;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
