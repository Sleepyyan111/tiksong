import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Play, Trash2, X, Globe, Lock, Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playlistsQuery, removeFromPlaylist, setPublic, sharedPlaylistQuery, savedPlaylistsQuery, setSaved } from "@/lib/library";
import { tracksQuery } from "@/lib/tracks";
import { usePlayer } from "@/lib/player";
import { Cover, DownloadButton } from "@/components/player-ui";
import { formatTime } from "@/lib/tiktok-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/playlists/$id")({
  head: () => ({
    meta: [
      { title: "Playlist — Loop" },
      { name: "description", content: "A playlist of saved TikTok sounds." },
      { property: "og:title", content: "Playlist — Loop" },
      { property: "og:description", content: "A playlist of saved TikTok sounds." },
    ],
  }),
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const p = usePlayer();
  const { data: lists = [], isLoading } = useQuery(playlistsQuery);
  const { data: all = [] } = useQuery(tracksQuery);
  const isAll = id === "all";
  const list = isAll ? { id: "all", name: "All songs", is_public: false, track_ids: all.map((t) => t.id) } : lists.find((l) => l.id === id);
  const tracks = useMemo(() => (list?.track_ids ?? []).map((tid) => all.find((t) => t.id === tid)).filter((t) => t && !t.removed) as typeof all, [list, all]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (isLoading) return <p className="type-meta py-10 text-center">Loading…</p>;
  if (!list) return <SharedPlaylist id={id} />;
  if (!list) return <div className="py-16 text-center"><p className="type-section">Playlist not found</p><Link to="/playlists" className="type-meta mt-2 underline">Back</Link></div>;

  const rename = async () => {
    const { error } = await supabase.from("playlists").update({ name: name.trim() || list.name }).eq("id", id);
    if (error) toast.error(error.message);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };
  const del = async () => {
    if (!confirm(`Delete “${list.name}”? Songs stay in your library.`)) return;
    await supabase.from("playlists").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["playlists"] });
    nav({ to: "/playlists" });
  };
  const togglePublic = async () => {
    const { error } = await setPublic(id, !list.is_public);
    if (error) { toast.error(error.message); return; }
    toast.success(list.is_public ? "Playlist is now private" : "Playlist is now public — others can find and save it");
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };
  const remove = async (tid: string) => {
    await removeFromPlaylist(id, tid);
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  return (
    <div>
      <Link to="/playlists" className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Playlists</Link>
      <header className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input autoFocus defaultValue={list.name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Enter" && rename()} className="type-large w-full rounded-lg bg-secondary px-2 outline-none" />
          ) : <h1 className="type-large truncate">{list.name}</h1>}
          <p className="type-meta mt-1">{tracks.length} tracks{isAll ? " · every song you import" : list.is_public ? " · Public" : " · Private"}</p>
        </div>
        {!isAll && <>
        <button aria-label={list.is_public ? "Make private" : "Make public"} onClick={togglePublic} className="rounded-full bg-secondary p-2.5">{list.is_public ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}</button>
        <button aria-label="Rename" onClick={() => { setName(list.name); setEditing(true); }} className="rounded-full bg-secondary p-2.5"><Pencil className="h-4 w-4" /></button>
        <button aria-label="Delete playlist" onClick={del} className="rounded-full bg-secondary p-2.5 text-destructive"><Trash2 className="h-4 w-4" /></button>
        </>}
      </header>
      {tracks.length > 0 && (
        <button onClick={() => p.playTrack(tracks[0]!.id, tracks)} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4 fill-current" /> Play</button>
      )}
      <div className="mt-3">
        {tracks.length === 0 ? <p className="type-meta py-12 text-center">Empty — add songs from your Song list using the + list button.</p> : tracks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2">
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => p.playTrack(t.id, tracks)}>
              <Cover track={t} className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <div className={cn("type-song truncate", p.current?.id === t.id && "text-primary")}>{t.title}</div>
                <div className="type-meta truncate">{t.artist ?? t.creator}{t.duration ? ` · ${formatTime(t.duration)}` : ""}</div>
              </div>
            </button>
            <DownloadButton track={t} />
            {!isAll && <button aria-label="Remove from playlist" onClick={() => remove(t.id)} className="p-2 text-muted-foreground"><X className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SharedPlaylist({ id }: { id: string }) {
  const qc = useQueryClient();
  const p = usePlayer();
  const { data: list, isLoading } = useQuery(sharedPlaylistQuery(id));
  const { data: saved = [] } = useQuery(savedPlaylistsQuery);
  const isSaved = saved.some((s) => s.id === id);
  if (isLoading) return <p className="type-meta py-10 text-center">Loading…</p>;
  if (!list) return <div className="py-16 text-center"><p className="type-section">Playlist not found</p><Link to="/playlists" className="type-meta mt-2 underline">Back</Link></div>;
  const tracks = list.tracks;
  const owner = list.owner?.display_name || list.owner?.username || "Listener";
  const toggleSave = async () => {
    const { error } = await setSaved(id, !isSaved);
    if (error) { toast.error(error.message); return; }
    toast.success(isSaved ? "Removed from your library" : "Saved to your library");
    qc.invalidateQueries({ queryKey: ["saved-playlists"] });
  };
  return (
    <div>
      <Link to="/playlists" className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Playlists</Link>
      <header className="mt-3">
        <h1 className="type-large truncate">{list.name}</h1>
        <p className="type-meta mt-1">by <Link to="/users/$id" params={{ id: list.user_id }} className="underline">{owner}</Link> · {tracks.length} tracks</p>
      </header>
      <div className="mt-5 flex gap-2">
        {tracks.length > 0 && <button onClick={() => p.playTrack(tracks[0]!.id, tracks)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4 fill-current" /> Play</button>}
        <button onClick={toggleSave} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-semibold">{isSaved ? <><BookmarkCheck className="h-4 w-4 text-primary" /> Saved</> : <><Bookmark className="h-4 w-4" /> Save</>}</button>
      </div>
      <div className="mt-3">
        {tracks.map((t) => (
          <button key={t.id} className="flex w-full items-center gap-3 py-2 text-left" onClick={() => p.playTrack(t.id, tracks)}>
            <Cover track={t} className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <div className={cn("type-song truncate", p.current?.id === t.id && "text-primary")}>{t.title}</div>
              <div className="type-meta truncate">{t.artist ?? t.creator}{t.duration ? ` · ${formatTime(t.duration)}` : ""}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
