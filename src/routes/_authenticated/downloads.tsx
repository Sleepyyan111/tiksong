import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardDriveDownload, RotateCw, Save, Trash2, X } from "lucide-react";
import { formatBytes, useDownloads } from "@/lib/downloads";
import { usePlayer } from "@/lib/player";
import { Cover } from "@/components/player-ui";
import { formatTime } from "@/lib/tiktok-url";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — Loop" },
      { name: "description", content: "Songs saved on this device for offline listening." },
      { property: "og:title", content: "Downloads — Loop" },
      { property: "og:description", content: "Songs saved on this device for offline listening." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const dl = useDownloads();
  const p = usePlayer();
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setQuota({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
  }, [dl.bytes]);
  const active = Object.values(dl.jobs).filter((j) => j.status !== "done");

  return (
    <div className="pt-6">
      <div className="type-caption">On this device</div>
      <h1 className="type-large mt-1">Downloads</h1>
      <p className="type-meta mt-1">
        {dl.offline.length} {dl.offline.length === 1 ? "track" : "tracks"} · {formatBytes(dl.bytes)}
        {quota?.quota ? ` · ${formatBytes(Math.max(0, quota.quota - quota.usage))} free` : ""}
      </p>
      {quota?.quota ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${Math.max(1, (quota.usage / quota.quota) * 100)}%` }} />
        </div>
      ) : null}

      {active.length > 0 && (
        <section className="mt-6">
          <div className="type-caption mb-2">In progress</div>
          {active.map((j) => (
            <div key={j.track.id} className="flex items-center gap-3 py-2">
              <Cover track={j.track} className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="type-song truncate">{j.track.title}</div>
                {j.status === "error" ? (
                  <div className="type-meta truncate text-destructive">{j.error}</div>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${j.progress * 100}%` }} />
                  </div>
                )}
              </div>
              {j.status === "error" && (
                <button aria-label="Retry" onClick={() => dl.retry(j.track.id)} className="p-2 text-primary"><RotateCw className="h-4 w-4" /></button>
              )}
              <button aria-label="Cancel" onClick={() => dl.cancel(j.track.id)} className="p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6">
        <div className="type-caption mb-2">Available offline</div>
        {dl.offline.length === 0 ? (
          <div className="py-14 text-center">
            <HardDriveDownload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="type-section mt-3">No downloads yet</p>
            <p className="type-meta mt-1">Tap the download icon next to a song to keep it on this device.</p>
          </div>
        ) : (
          dl.offline.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => p.playTrack(t.id)}>
                <Cover track={t} className="h-11 w-11 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <div className="type-song truncate">{t.title}</div>
                  <div className="type-meta truncate">{t.artist ?? t.creator}{t.duration ? ` · ${formatTime(t.duration)}` : ""}</div>
                </div>
              </button>
              <button aria-label="Save file to device" onClick={() => dl.saveToDevice(t.id)} className="p-2 text-muted-foreground"><Save className="h-4 w-4" /></button>
              <button aria-label="Remove download" onClick={() => dl.remove(t.id)} className="p-2 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))
        )}
      </section>
      <p className="mt-6 type-meta">Files are saved in the format TikTok provides (usually MP3). "Save file" copies a song to your phone's files.</p>
    </div>
  );
}
