import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signTracks, type Track } from "./tracks";

export type Playlist = { id: string; name: string; description: string | null; created_at: string; is_public: boolean; track_ids: string[] };
export type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url?: string | null };

export const playlistsQuery = queryOptions({
  queryKey: ["playlists"],
  queryFn: async (): Promise<Playlist[]> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return [];
    const { data, error } = await supabase
      .from("playlists")
      .select("id,name,description,created_at,is_public,playlist_tracks(track_id,position)")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      id: p.id, name: p.name, description: p.description, created_at: p.created_at, is_public: p.is_public,
      track_ids: [...(p.playlist_tracks ?? [])].sort((a: any, b: any) => a.position - b.position).map((x: any) => x.track_id),
    }));
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", u.user.id).maybeSingle();
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

export type PublicProfile = Profile & { avatar_url: string | null };

/** avatar_url stores a storage path in the private "avatars" bucket; resolve to a signed URL. */
export async function avatarSrc(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

export async function uploadAvatar(file: File) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user!.id;
  const path = `${uid}/${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
  const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (up.error) return { error: up.error };
  return supabase.from("profiles").update({ avatar_url: path }).eq("id", uid);
}

export const userSearchQuery = (q: string) => queryOptions({
  queryKey: ["user-search", q],
  queryFn: async (): Promise<PublicProfile[]> => {
    const term = q.trim().replace(/[%_,()]/g, "");
    let req = supabase.from("profiles").select("id,username,display_name,bio,avatar_url").limit(30);
    if (term) req = req.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
    const { data, error } = await req.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const userQuery = (id: string) => queryOptions({
  queryKey: ["user", id],
  queryFn: async (): Promise<PublicProfile | null> => {
    const { data } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", id).maybeSingle();
    return data;
  },
});

export type SharedPlaylist = { id: string; name: string; user_id: string; is_public: boolean; owner: PublicProfile | null; tracks: Track[] };

async function withOwners(rows: any[]): Promise<SharedPlaylist[]> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: owners } = ids.length ? await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").in("id", ids) : { data: [] };
  const all: Track[] = [];
  const out = rows.map((r) => {
    const tracks = [...(r.playlist_tracks ?? [])].sort((a: any, b: any) => a.position - b.position).map((x: any) => x.tracks).filter((t: any) => t && !t.removed) as Track[];
    all.push(...tracks);
    return { id: r.id, name: r.name, user_id: r.user_id, is_public: r.is_public, owner: (owners ?? []).find((o) => o.id === r.user_id) ?? null, tracks };
  });
  await signTracks(all);
  return out;
}
const SHARED_SELECT = "id,name,user_id,is_public,created_at,playlist_tracks(position,tracks(*))";

export const sharedPlaylistQuery = (id: string) => queryOptions({
  queryKey: ["shared-playlist", id],
  queryFn: async () => {
    const { data } = await supabase.from("playlists").select(SHARED_SELECT).eq("id", id).maybeSingle();
    return data ? (await withOwners([data]))[0]! : null;
  },
});

/** Public playlists from other people, optionally limited to one owner. */
export const discoverQuery = (ownerId?: string) => queryOptions({
  queryKey: ["discover", ownerId ?? "all"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    let q = supabase.from("playlists").select(SHARED_SELECT).eq("is_public", true).order("created_at", { ascending: false }).limit(30);
    q = ownerId ? q.eq("user_id", ownerId) : q.neq("user_id", u.user?.id ?? "");
    const { data, error } = await q;
    if (error) throw error;
    return withOwners(data ?? []);
  },
});

export const savedPlaylistsQuery = queryOptions({
  queryKey: ["saved-playlists"],
  queryFn: async () => {
    const { data, error } = await supabase.from("saved_playlists").select(`playlist_id, playlists(${SHARED_SELECT})`).order("created_at", { ascending: false });
    if (error) throw error;
    return withOwners((data ?? []).map((r: any) => r.playlists).filter(Boolean));
  },
});

export async function setSaved(playlistId: string, saved: boolean) {
  const { data: u } = await supabase.auth.getUser();
  return saved
    ? supabase.from("saved_playlists").upsert({ user_id: u.user!.id, playlist_id: playlistId })
    : supabase.from("saved_playlists").delete().eq("playlist_id", playlistId).eq("user_id", u.user!.id);
}
export async function setPublic(playlistId: string, isPublic: boolean) {
  return supabase.from("playlists").update({ is_public: isPublic }).eq("id", playlistId);
}
