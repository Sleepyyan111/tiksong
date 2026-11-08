import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical, Plus, RefreshCw, Search, Trash2, Play, Shuffle } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { tracksQuery, type Track } from "@/lib/tracks";
import { usePlayer } from "@/lib/player";
import { Cover, Equalizer } from "@/components/player-ui";
import { formatTime } from "@/lib/tiktok-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Song — Loop" },
      { name: "description", content: "Your Song playlist of saved TikTok sounds." },
      { property: "og:title", content: "Song — Loop" },
      { property: "og:description", content: "Your Song playlist of saved TikTok sounds." },
    ],
  }),
  component: PlaylistPage,
});

function PlaylistPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, refetch, isFetching } = useQuery(tracksQuery);
  const player = usePlayer();
  const [q, setQ] = useState("");
  const tracks = useMemo(() => data.filter((t) => !t.removed), [data]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tracks.filter((t) => `${t.title} ${t.artist ?? ""} ${t.creator ?? ""}`.toLowerCase().includes(s)) : tracks;
  }, [tracks, q]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = tracks.findIndex((t) => t.id === e.active.id);
    const to = tracks.findIndex((t) => t.id === e.over!.id);
    const moved = arrayMove(tracks, from, to);
    const before = moved[to - 1]?.position ?? moved[to + 1].position - 2;
    const after = moved[to + 1]?.position ?? before + 2;
    const pos = (before + after) / 2;
    qc.setQueryData<Track[]>(["tracks"], (old) =>
      (old ?? []).map((t) => (t.id === e.active.id ? { ...t, position: pos } : t)).sort((a, b) => a.position - b.position),
    );
    const { error } = await supabase.from("tracks").update({ position: pos }).eq("id", String(e.active.id));
    if (error) toast.error("Couldn't save the new order");
  };

  const remove = async (t: Track) => {
    qc.setQueryData<Track[]>(["tracks"], (old) => (old ?? []).map((x) => (x.id === t.id ? { ...x, removed: true } : x)));
    const { error } = await supabase.from("tracks").update({ removed: true }).eq("id", t.id);
    if (error) toast.error(error.message);
    else toast("Removed from Song", { action: { label: "Undo", onClick: () => restore(t) } });
  };
  const restore = async (t: Track) => {
    await supabase.from("tracks").update({ removed: false }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["tracks"] });
  };

  const refresh = async () => {
    const r = await refetch();
    if (r.error) toast.error("Refresh failed");
    else toast.success(`Up to date · ${r.data?.filter((t) => !t.removed).length ?? 0} tracks`);
  };

  const totalSec = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);

  return (
    <div>
      <header className="flex items-end justify-between pt-6">
        <div>
          <div className="type-caption">Playlist</div>
          <h1 className="type-large mt-1">Song</h1>
          <p className="type-meta mt-1">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"} · {Math.round(totalSec / 60)} min
          </p>
        </div>
        <button aria-label="Refresh" onClick={refresh} className="rounded-full bg-secondary p-2.5">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </button>
      </header>

      {tracks.length > 0 && (
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => (player.current ? player.toggle() : player.playTrack(tracks[0].id))}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            <Play className="h-4 w-4 fill-current" /> {player.playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => {
              if (!player.shuffle) player.toggleShuffle();
              player.playTrack(tracks[Math.floor(Math.random() * tracks.length)].id);
            }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-semibold text-primary"
          >
            <Shuffle className="h-4 w-4" /> Shuffle
          </button>
        </div>
      )}

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Song"
          className="h-10 w-full rounded-xl bg-secondary pl-9 pr-3 text-sm font-medium outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3">
        {isLoading ? (
          <p className="type-meta py-10 text-center">Loading…</p>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="type-section">Your Song playlist is empty</p>
            <p className="type-meta mt-1">Paste a TikTok link to add the first sound.</p>
            <Link to="/import" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Import audio
            </Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shown.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {shown.map((t) => (
                <Row key={t.id} track={t} disabled={!!q} onRemove={() => remove(t)} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function Row({ track, disabled, onRemove }: { track: Track; disabled: boolean; onRemove: () => void }) {
  const p = usePlayer();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id, disabled });
  const active = p.current?.id === track.id;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex items-center gap-3 rounded-xl py-2 pl-1", isDragging && "relative z-10 bg-card shadow-xl")}
    >
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (active ? p.setNowPlayingOpen(true) : p.playTrack(track.id))}>
        <div className="relative">
          <Cover track={track} className="h-12 w-12 shrink-0 rounded-lg" />
          {active && p.playing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50"><Equalizer /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("type-song truncate", active && "text-primary")}>{track.title}</div>
          <div className="type-meta truncate">
            {track.artist ?? track.creator}
            {track.duration ? ` · ${formatTime(track.duration)}` : ""}
          </div>
        </div>
      </button>
      <button aria-label="Remove" onClick={onRemove} className="p-2 text-muted-foreground opacity-60 hover:opacity-100">
        <Trash2 className="h-4 w-4" />
      </button>
      {!disabled && (
        <button aria-label="Reorder" {...attributes} {...listeners} className="touch-none p-2 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
