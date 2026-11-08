import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tracksQuery, type Track } from "@/lib/tracks";
import { Cover } from "@/components/player-ui";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Import history — Loop" },
      { name: "description", content: "Every TikTok sound you've imported." },
      { property: "og:title", content: "Import history — Loop" },
      { property: "og:description", content: "Every TikTok sound you've imported." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery(tracksQuery);
  const items = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const setRemoved = async (t: Track, removed: boolean) => {
    const { error } = await supabase.from("tracks").update({ removed }).eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tracks"] });
    toast.success(removed ? "Removed from Song" : "Restored to Song");
  };

  const purge = async (t: Track) => {
    await supabase.storage.from("audio").remove([t.audio_path, ...(t.cover_path ? [t.cover_path] : [])]);
    const { error } = await supabase.from("tracks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tracks"] });
    toast("Deleted permanently");
  };

  return (
    <div className="pt-6">
      <div className="type-caption">Library</div>
      <h1 className="type-large mt-1">Import history</h1>
      <div className="mt-5 divide-y divide-border">
        {items.length === 0 && <p className="type-meta py-10 text-center">Nothing imported yet.</p>}
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-3">
            <Cover track={t} className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="type-song truncate">{t.title}</div>
              <div className="type-meta truncate">@{t.creator ?? "unknown"} · {new Date(t.created_at).toLocaleDateString()}</div>
              <span className={t.removed ? "type-caption" : "type-caption text-primary"}>{t.removed ? "Removed" : "In Song"}</span>
            </div>
            {t.removed ? (
              <>
                <button aria-label="Re-import" onClick={() => setRemoved(t, false)} className="rounded-full bg-secondary p-2"><RotateCcw className="h-4 w-4" /></button>
                <button aria-label="Delete permanently" onClick={() => purge(t)} className="p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
              </>
            ) : (
              <button aria-label="Remove" onClick={() => setRemoved(t, true)} className="p-2 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
