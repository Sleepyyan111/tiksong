import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { tracksQuery, type Track } from "./tracks";
import { useSettings } from "./settings";
import { useDownloads } from "./downloads";

type Repeat = "off" | "all" | "one";
type PlayerCtx = {
  queue: Track[];
  current: Track | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: Repeat;
  error: string | null;
  nowPlayingOpen: boolean;
  setNowPlayingOpen: (v: boolean) => void;
  playTrack: (id: string, context?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

const Ctx = createContext<PlayerCtx | null>(null);
const KEY = "tm-player";

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery(tracksQuery);
  const { settings } = useSettings();
  const dl = useDownloads();
  const [contextQueue, setContextQueue] = useState<Track[] | null>(null);
  const libraryQueue = useMemo(() => {
    const online = (data ?? []).filter((t) => !t.removed);
    const ids = new Set(online.map((t) => t.id));
    const merged = [
      ...online.map((t) => {
        const local = dl.isOffline(t.id) ? dl.localUrl(t.id) : null;
        return local?.audio ? { ...t, audioUrl: local.audio, coverUrl: local.cover ?? t.coverUrl } : t;
      }),
      ...(data ? [] : dl.offline.filter((t) => !ids.has(t.id))),
    ];
    return merged.filter((t) => t.audioUrl);
  }, [data, dl.offline]);
  const queue = useMemo(() => {
    if (!contextQueue) return libraryQueue;
    const lib = new Map(libraryQueue.map((t) => [t.id, t]));
    return contextQueue.map((t) => lib.get(t.id) ?? t).filter((t) => t.audioUrl);
  }, [contextQueue, libraryQueue]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVol] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [error, setError] = useState<string | null>(null);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const restoredTime = useRef<number | null>(null);

  const current = queue.find((t) => t.id === currentId) ?? null;

  // restore
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (s.currentId) setCurrentId(s.currentId);
      if (typeof s.shuffle === "boolean") setShuffle(s.shuffle);
      if (s.repeat) setRepeat(s.repeat);
      if (typeof s.volume === "number") setVol(s.volume);
      if (typeof s.time === "number") restoredTime.current = s.time;
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ currentId, shuffle, repeat, volume, time: settings.resumePosition ? time : 0 }),
    );
  }, [currentId, shuffle, repeat, volume, Math.floor(time / 5), settings.resumePosition]);

  // Two audio elements so the next song can fade in while the current one fades out.
  const pair = useRef<HTMLAudioElement[]>([]);
  if (typeof window !== "undefined" && !pair.current.length) {
    pair.current = [new Audio(), new Audio()];
    pair.current.forEach((a) => (a.preload = "auto"));
    audioRef.current = pair.current[0]!;
  }
  const fade = useRef<{ timer: number; old: HTMLAudioElement } | null>(null);
  const volRef = useRef(volume);
  volRef.current = volume;
  const stopFade = () => {
    if (!fade.current) return;
    clearInterval(fade.current.timer);
    fade.current.old.pause();
    fade.current = null;
    if (audioRef.current) audioRef.current.volume = volRef.current;
  };

  // load source when track changes
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current?.audioUrl || loadedId.current === current.id) return;
    loadedId.current = current.id;
    a.src = current.audioUrl;
    setError(null);
    if (restoredTime.current != null) {
      const t = restoredTime.current;
      restoredTime.current = null;
      a.addEventListener("loadedmetadata", () => (a.currentTime = t), { once: true });
    }
  }, [current]);

  useEffect(() => {
    if (audioRef.current && !fade.current) audioRef.current.volume = volume;
  }, [volume]);

  const playTrack = useCallback((id: string, context?: Track[]) => {
    stopFade();
    const a = audioRef.current;
    if (context) setContextQueue(context);
    const t = (context ?? queue).find((q) => q.id === id) ?? libraryQueue.find((q) => q.id === id);
    if (!a || !t?.audioUrl) return;
    restoredTime.current = null;
    loadedId.current = t.id;
    a.src = t.audioUrl;
    setCurrentId(t.id);
    setError(null);
    a.play().catch((e) => setError(e.message));
  }, [queue, libraryQueue]);

  const pickNext = useCallback(
    (dir: 1 | -1, auto = false) => {
      if (!queue.length) return null;
      if (auto && repeat === "one" && current) return current.id;
      if (shuffle && queue.length > 1) {
        let n: Track | undefined;
        do n = queue[Math.floor(Math.random() * queue.length)];
        while (n?.id === current?.id);
        return n?.id ?? null;
      }
      const i = queue.findIndex((t) => t.id === current?.id);
      let j = i + dir;
      if (j >= queue.length) {
        if (auto && repeat === "off") return null;
        j = 0;
      }
      if (j < 0) j = queue.length - 1;
      return queue[j]?.id ?? null;
    },
    [queue, current, shuffle, repeat],
  );

  const next = useCallback(() => {
    const id = pickNext(1);
    if (id) playTrack(id);
  }, [pickNext, playTrack]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const id = pickNext(-1);
    if (id) playTrack(id);
  }, [pickNext, playTrack]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!current) {
      if (queue[0]) playTrack(queue[0].id);
      return;
    }
    if (a.paused) a.play().catch((e) => setError(e.message));
    else { stopFade(); a.pause(); }
  }, [current, queue, playTrack]);

  const seek = useCallback((t: number) => {
    stopFade();
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  // audio events
  const handlers = useRef({ onEnded: () => {}, onTime: () => {} });
  handlers.current.onTime = () => {
    const a = audioRef.current;
    const secs = settings.crossfadeSeconds;
    if (!a || !settings.crossfade || fade.current || a.paused || !a.duration || a.duration < secs * 2) return;
    if (a.duration - a.currentTime > secs) return;
    const id = pickNext(1, true);
    const t = queue.find((q) => q.id === id);
    if (!t?.audioUrl || t.id === current?.id) return;
    const old = a;
    const nxt = pair.current.find((x) => x !== old)!;
    nxt.src = t.audioUrl;
    nxt.volume = 0;
    audioRef.current = nxt;
    loadedId.current = t.id;
    setCurrentId(t.id);
    nxt.play().catch((e) => setError(e.message));
    const start = performance.now();
    const timer = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / (secs * 1000));
      old.volume = volRef.current * (1 - k);
      nxt.volume = volRef.current * k;
      if (k >= 1) stopFade();
    }, 50);
    fade.current = { timer, old };
  };
  handlers.current.onEnded = () => {
    const id = pickNext(1, true);
    if (id) {
      if (id === current?.id && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } else playTrack(id);
    } else setPlaying(false);
  };

  useEffect(() => {
    const cleanups = pair.current.map((a) => {
    const live = () => audioRef.current === a;
    const onTime = () => { if (live()) { setTime(a.currentTime); handlers.current.onTime(); } };
    const onDur = () => live() && setDuration(a.duration || 0);
    const onPlay = () => live() && setPlaying(true);
    const onPause = () => live() && setPlaying(false);
    const onEnded = () => live() && handlers.current.onEnded();
    const onErr = () => live() && setError("This track couldn't be played");
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onErr);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onErr);
    };
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  // Media Session (lock screen / headphones)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? current.creator ?? "",
      album: "Song",
      artwork: current.coverUrl ? [{ src: current.coverUrl, sizes: "512x512", type: "image/jpeg" }] : [],
    });
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.playbackState = playing ? "playing" : "paused";
    ms.setActionHandler("play", () => audioRef.current?.play());
    ms.setActionHandler("pause", () => audioRef.current?.pause());
    ms.setActionHandler("nexttrack", next);
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("seekto", (d) => d.seekTime != null && seek(d.seekTime));
  }, [playing, next, prev, seek]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({ duration, position: Math.min(time, duration), playbackRate: 1 });
    } catch {}
  }, [Math.floor(time), duration]);

  const value: PlayerCtx = {
    queue,
    current,
    playing,
    time,
    duration: duration || current?.duration || 0,
    volume,
    shuffle,
    repeat,
    error,
    nowPlayingOpen,
    setNowPlayingOpen,
    playTrack,
    toggle,
    next,
    prev,
    seek,
    setVolume: setVol,
    toggleShuffle: () => setShuffle((s) => !s),
    cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside provider");
  return c;
}
