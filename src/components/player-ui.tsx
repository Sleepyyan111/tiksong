import { Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings";
import {
  ChevronDown, Home, Link2, ListMusic, UserRound, Pause, Play, Repeat, Repeat1, Settings, Shuffle, SkipBack, SkipForward, Volume2, Music2, History, Download, CheckCircle2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/player";
import { formatTime } from "@/lib/tiktok-url";
import type { Track } from "@/lib/tracks";
import { useState } from "react";
import { useDownloads } from "@/lib/downloads";

export function Cover({ track, className }: { track: Track | null; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      {track?.coverUrl ? (
        <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Music2 className="h-1/3 w-1/3" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

export function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-label="Playing">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="eq-bar w-[3px] h-full rounded-full bg-primary" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

export function MiniPlayer() {
  const p = usePlayer();
  if (!p.current) return null;
  const { settings } = useSettings();
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;
  return (
    <div className="fixed inset-x-0 bottom-[68px] z-30 px-3">
      <div
        className="glass mx-auto max-w-xl overflow-hidden rounded-2xl shadow-2xl shadow-background/60 border border-border"
        style={settings.playerColor ? { backgroundColor: `color-mix(in oklch, ${settings.playerColor} 45%, var(--background))` } : undefined}
      >
        <div className="flex items-center gap-3 p-2 pr-3">
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => p.setNowPlayingOpen(true)}>
            <Cover track={p.current} className="h-11 w-11 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <div className="type-song truncate">{p.current.title}</div>
              <div className="type-meta truncate">{p.current.artist ?? p.current.creator}</div>
            </div>
          </button>
          <button aria-label={p.playing ? "Pause" : "Play"} onClick={p.toggle} className="p-2">
            {p.playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
          </button>
          <button aria-label="Next" onClick={p.next} className="p-2">
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
        </div>
        <div className="h-[2px] bg-border">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function BottomNav() {
  const items = [
    { to: "/", label: "Song", icon: Home },
    { to: "/import", label: "Import", icon: Link2 },
    { to: "/playlists", label: "Playlists", icon: ListMusic },
    { to: "/downloads", label: "Downloads", icon: Download },
    { to: "/profile", label: "Profile", icon: UserRound },
  ] as const;
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function DownloadButton({ track, className }: { track: Track; className?: string }) {
  const dl = useDownloads();
  const job = dl.jobs[track.id];
  if (dl.isOffline(track.id)) {
    return (
      <button aria-label="Downloaded" onClick={() => dl.saveToDevice(track.id)} title="Save file to device" className={cn("p-2 text-primary", className)}>
        <CheckCircle2 className="h-5 w-5" />
      </button>
    );
  }
  if (job && job.status !== "error") {
    return (
      <button aria-label="Cancel download" onClick={() => dl.cancel(track.id)} className={cn("p-2 text-primary", className)}>
        <span className="relative block h-5 w-5">
          <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={50.3} strokeDashoffset={50.3 * (1 - job.progress)} />
          </svg>
        </span>
      </button>
    );
  }
  return (
    <button aria-label="Download" onClick={() => dl.download([track])} className={cn("p-2 text-muted-foreground", className)}>
      <Download className="h-5 w-5" />
    </button>
  );
}

export function NowPlaying() {
  const p = usePlayer();
  const [showQueue, setShowQueue] = useState(false);
  const { settings } = useSettings();
  const t = p.current;
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]",
        p.nowPlayingOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
      )}
      aria-hidden={!p.nowPlayingOpen}
    >
      {settings.playerColor ? (
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `linear-gradient(to bottom, ${settings.playerColor}, transparent)` }} />
      ) : t?.coverUrl && (
        <img src={t.coverUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl" />
      )}
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-7 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="flex items-center justify-between py-2">
          <button aria-label="Close" onClick={() => p.setNowPlayingOpen(false)} className="-ml-2 p-2">
            <ChevronDown className="h-7 w-7" />
          </button>
          <span className="type-caption">Playing from Song</span>
          <button aria-label="Queue" onClick={() => setShowQueue((s) => !s)} className={cn("-mr-2 p-2", showQueue && "text-primary")}>
            <ListMusic className="h-6 w-6" />
          </button>
        </div>

        {showQueue ? (
          <div className="mt-4 flex-1 overflow-y-auto">
            <div className="type-section mb-3">Up next</div>
            {p.queue.map((q) => (
              <button key={q.id} onClick={() => p.playTrack(q.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent/60">
                <Cover track={q} className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className={cn("type-song truncate", q.id === t?.id && "text-primary")}>{q.title}</div>
                  <div className="type-meta truncate">{q.artist ?? q.creator}</div>
                </div>
                {q.id === t?.id && p.playing && <Equalizer />}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-6">
            <Cover
              track={t}
              className={cn(
                "aspect-square w-full rounded-3xl shadow-2xl shadow-background transition-transform duration-500",
                p.playing ? "scale-100" : "scale-[0.86]",
              )}
            />
          </div>
        )}

        <div className="mt-2">
          <div className="text-[1.375rem] font-bold leading-tight tracking-[-0.02em] line-clamp-2">{t?.title ?? "Nothing playing"}</div>
          <div className="type-body mt-1 text-muted-foreground truncate">{t?.artist ?? t?.creator ?? ""}</div>
        </div>
        {t && <div className="-mr-2 -mt-10 flex justify-end"><DownloadButton track={t} /></div>}

        <div className="mt-6">
          <Slider value={[p.time]} max={p.duration || 1} step={0.1} onValueChange={([v]) => p.seek(v ?? 0)} />
          <div className="mt-2 flex justify-between type-time">
            <span>{formatTime(p.time)}</span>
            <span>-{formatTime(Math.max(0, p.duration - p.time))}</span>
          </div>
        </div>
        {p.error && <p className="mt-2 text-center type-meta text-destructive">{p.error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <button aria-label="Shuffle" onClick={p.toggleShuffle} className={cn("p-2", p.shuffle ? "text-primary" : "text-muted-foreground")}>
            <Shuffle className="h-5 w-5" />
          </button>
          <button aria-label="Previous" onClick={p.prev} className="p-2">
            <SkipBack className="h-9 w-9 fill-current" />
          </button>
          <button
            aria-label={p.playing ? "Pause" : "Play"}
            onClick={p.toggle}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95"
          >
            {p.playing ? <Pause className="h-9 w-9 fill-current" /> : <Play className="ml-1 h-9 w-9 fill-current" />}
          </button>
          <button aria-label="Next" onClick={p.next} className="p-2">
            <SkipForward className="h-9 w-9 fill-current" />
          </button>
          <button aria-label="Repeat" onClick={p.cycleRepeat} className={cn("p-2", p.repeat !== "off" ? "text-primary" : "text-muted-foreground")}>
            {p.repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 text-muted-foreground">
          <Volume2 className="h-4 w-4 shrink-0" />
          <Slider value={[p.volume]} max={1} step={0.01} onValueChange={([v]) => p.setVolume(v ?? 1)} />
        </div>
      </div>
    </div>
  );
}
