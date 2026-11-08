import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { tracksQuery, type Track } from "./tracks";
import { useSettings } from "./settings";

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
  playTrack: (id: string) => void;
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
  const queue = useMemo(() => (data ?? []).filter((t) => !t.removed && t.audioUrl), [data]);
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

  if (typeof window !== "undefined" && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

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
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const playTrack = useCallback((id: string) => {
    const a = audioRef.current;
    const t = queue.find((q) => q.id === id);
    if (!a || !t?.audioUrl) return;
    restoredTime.current = null;
    loadedId.current = t.id;
    a.src = t.audioUrl;
    setCurrentId(t.id);
    setError(null);
    a.play().catch((e) => setError(e.message));
  }, [queue]);

  const pickNext = useCallback(
    (dir: 1 | -1, auto = false) => {
      if (!queue.length) return null;
      if (auto && repeat === "one" && current) return current.id;
      if (shuffle && queue.length > 1) {
        let n: Track;
        do n = queue[Math.floor(Math.random() * queue.length)];
        while (n.id === current?.id);
        return n.id;
      }
      const i = queue.findIndex((t) => t.id === current?.id);
      let j = i + dir;
      if (j >= queue.length) {
        if (auto && repeat === "off") return null;
        j = 0;
      }
      if (j < 0) j = queue.length - 1;
      return queue[j].id;
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
    else a.pause();
  }, [current, queue, playTrack]);

  const seek = useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  // audio events
  const handlers = useRef({ onEnded: () => {} });
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
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onDur = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => handlers.current.onEnded();
    const onErr = () => setError("This track couldn't be played");
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
