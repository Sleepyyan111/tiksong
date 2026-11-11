import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { playlistsQuery, addToPlaylist, removeFromPlaylist, createPlaylist } from "@/lib/library";
import { cn } from "@/lib/utils";

export function AddToPlaylist({ trackId, className }: { trackId: string; className?: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery(playlistsQuery);
  const [name, setName] = useState("");
  const toggle = async (id: string, has: boolean) => {
    const { error } = has ? await removeFromPlaylist(id, trackId) : await addToPlaylist(id, trackId);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };
  const create = async () => {
    if (!name.trim()) return undefined;
    const { data: p, error } = await createPlaylist(name.trim());
    if (error || !p) { toast.error(error?.message ?? "Failed"); return; }
    await addToPlaylist(p.id, trackId);
    setName("");
    qc.invalidateQueries({ queryKey: ["playlists"] });
    toast.success("Added to new playlist");
  };
  return (
    <Popover>
      <PopoverTrigger aria-label="Add to playlist" className={cn("p-2 text-muted-foreground hover:text-foreground", className)}>
        <ListPlus className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="type-caption px-2 py-1">Add to playlist</div>
        <div className="max-h-56 overflow-y-auto">
          {data.map((p) => {
            const has = p.track_ids.includes(trackId);
            return (
              <button key={p.id} onClick={() => toggle(p.id, has)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary">
                <span className="truncate">{p.name}</span>
                {has && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1 border-t border-border pt-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New playlist" className="h-8 min-w-0 flex-1 rounded-md bg-secondary px-2 text-sm outline-none" />
          <button aria-label="Create" onClick={create} className="rounded-md bg-primary px-2 text-primary-foreground"><Plus className="h-4 w-4" /></button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
