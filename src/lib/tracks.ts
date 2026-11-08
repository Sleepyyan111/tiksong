import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Track = {
  id: string;
  tiktok_id: string;
  source_url: string;
  title: string;
  artist: string | null;
  creator: string | null;
  duration: number | null;
  audio_path: string;
  cover_path: string | null;
  position: number;
  removed: boolean;
  created_at: string;
  audioUrl?: string;
  coverUrl?: string;
};

async function fetchTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Track[];
  const paths = rows.flatMap((r) => [r.audio_path, r.cover_path].filter(Boolean) as string[]);
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("audio").createSignedUrls(paths, 60 * 60 * 12);
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const r of rows) {
      r.audioUrl = map.get(r.audio_path) ?? undefined;
      r.coverUrl = r.cover_path ? map.get(r.cover_path) ?? undefined : undefined;
    }
  }
  return rows;
}

export const tracksQuery = queryOptions({
  queryKey: ["tracks"],
  queryFn: fetchTracks,
  staleTime: 1000 * 60 * 10,
});
