import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Playlist = { id: string; name: string; description: string | null; created_at: string; track_ids: string[] };
export type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null };

export const playlistsQuery = queryOptions({
  queryKey: ["playlists"],
  queryFn: async (): Promise<Playlist[]> => {
    const { data, error } = await supabase
      .from("playlists")
      .select("id,name,description,created_at,playlist_tracks(track_id,position)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      id: p.id, name: p.name, description: p.description, created_at: p.created_at,
      track_ids: [...(p.playlist_tracks ?? [])].sort((a: any, b: any) => a.position - b.position).map((x: any) => x.track_id),
    }));
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase.from("profiles").select("id,username,display_name,bio").eq("id", u.user.id).maybeSingle();
    return data ?? { id: u.user.id, username: null, display_name: u.user.email?.split("@")[0] ?? null, bio: null };
  },
});

export async function addToPlaylist(playlistId: string, trackId: string) {
  const { data: u } = await supabase.auth.getUser();
  return supabase.from("playlist_tracks").upsert({ playlist_id: playlistId, track_id: trackId, user_id: u.user!.id, position: Date.now() / 1000 });
}
export async function removeFromPlaylist(playlistId: string, trackId: string) {
  return supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId).eq("track_id", trackId);
}
export async function createPlaylist(name: string) {
  const { data: u } = await supabase.auth.getUser();
  return supabase.from("playlists").insert({ name, user_id: u.user!.id }).select("id").single();
}
