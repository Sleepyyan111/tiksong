import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ListMusic } from "lucide-react";
import { toast } from "sonner";
import { playlistsQuery, createPlaylist } from "@/lib/library";
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
                <div className="type-song truncate">{p.name}</div>
                <div className="type-meta">{p.track_ids.length} tracks</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
