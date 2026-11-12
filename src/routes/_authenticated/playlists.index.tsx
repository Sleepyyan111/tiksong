import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ListMusic, Library, Globe } from "lucide-react";
import { toast } from "sonner";
import { playlistsQuery, createPlaylist, savedPlaylistsQuery, discoverQuery, type SharedPlaylist } from "@/lib/library";
import { tracksQuery } from "@/lib/tracks";
import { Cover } from "@/components/player-ui";

export const Route = createFileRoute("/_authenticated/playlists/")({
  head: () => ({
    meta: [
      { title: "Playlists — Loop" },
      { name: "description", content: "Your custom playlists of saved TikTok sounds." },
      { property: "og:title", content: "Playlists — Loop" },
      { property: "og:description", content: "Your custom playlists of saved TikTok sounds." },
    ],
  }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery(playlistsQuery);
  const { data: tracks = [] } = useQuery(tracksQuery);
  const [name, setName] = useState("");
  const create = async () => {
    if (!name.trim()) return undefined;
    const { error } = await createPlaylist(name.trim());
    if (error) { toast.error(error.message); return; }
    setName("");
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };
  return (
    <div>
      <header className="pt-6">
        <div className="type-caption">Library</div>
        <h1 className="type-large mt-1">Playlists</h1>
      </header>
      <div className="mt-5 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New playlist name" className="h-11 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-sm font-medium outline-none placeholder:text-muted-foreground" />
        <button onClick={create} className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Create</button>
      </div>
      <div className="mt-4">
        <Link to="/playlists/$id" params={{ id: "all" }} className="flex items-center gap-3 rounded-xl py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Library className="h-6 w-6" /></div>
          <div className="min-w-0"><div className="type-song truncate">All songs</div><div className="type-meta">{tracks.filter((t) => !t.removed).length} tracks · Default</div></div>
        </Link>
        {isLoading ? <p className="type-meta py-10 text-center">Loading…</p> : data.length === 0 ? (
          <div className="py-16 text-center">
            <ListMusic className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="type-section mt-3">No playlists yet</p>
            <p className="type-meta mt-1">Create one, then add songs with the + list button on any track.</p>
          </div>
        ) : data.map((p) => {
          const first = tracks.find((t) => t.id === p.track_ids[0]);
          return (
            <Link key={p.id} to="/playlists/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-xl py-2">
              {first ? <Cover track={first} className="h-14 w-14 rounded-lg" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary"><ListMusic className="h-5 w-5 text-muted-foreground" /></div>}
              <div className="min-w-0">
                <div className="type-song flex items-center gap-1.5 truncate">{p.name}{p.is_public && <Globe className="h-3.5 w-3.5 text-primary" />}</div>
                <div className="type-meta">{p.track_ids.length} tracks</div>
              </div>
            </Link>
          );
        })}
      </div>
      <SharedSection title="Saved" q={savedPlaylistsQuery} empty="Playlists you save from others show up here." />
      <SharedSection title="Discover" q={discoverQuery()} empty="No public playlists from others yet." />
    </div>
  );
}

function SharedSection({ title, q, empty }: { title: string; q: { queryKey: readonly unknown[]; queryFn?: any }; empty: string }) {
  const { data = [] } = useQuery(q as any) as { data?: SharedPlaylist[] };
  return (
    <section className="mt-8">
      <h2 className="type-section">{title}</h2>
      {data.length === 0 ? <p className="type-meta mt-2">{empty}</p> : data.map((p) => <SharedRow key={p.id} p={p} />)}
    </section>
  );
}

export function SharedRow({ p }: { p: SharedPlaylist }) {
  const first = p.tracks[0];
  return (
    <Link to="/playlists/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-xl py-2">
      {first ? <Cover track={first} className="h-14 w-14 rounded-lg" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary"><ListMusic className="h-5 w-5 text-muted-foreground" /></div>}
      <div className="min-w-0">
        <div className="type-song truncate">{p.name}</div>
        <div className="type-meta truncate">by {p.owner?.display_name || p.owner?.username || "Listener"} · {p.tracks.length} tracks</div>
      </div>
    </Link>
  );
}
