ALTER TABLE public.playlists ADD COLUMN is_public boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_playlist_public(_pid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.playlists WHERE id = _pid AND is_public)
$$;
CREATE OR REPLACE FUNCTION public.is_track_shared(_tid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.playlist_tracks pt JOIN public.playlists p ON p.id = pt.playlist_id WHERE pt.track_id = _tid AND p.is_public)
$$;
CREATE OR REPLACE FUNCTION public.is_audio_path_shared(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tracks t JOIN public.playlist_tracks pt ON pt.track_id = t.id JOIN public.playlists p ON p.id = pt.playlist_id
    WHERE p.is_public AND (t.audio_path = _path OR t.cover_path = _path))
$$;

CREATE POLICY "public playlists read" ON public.playlists FOR SELECT TO authenticated USING (is_public);
CREATE POLICY "public playlist tracks read" ON public.playlist_tracks FOR SELECT TO authenticated USING (public.is_playlist_public(playlist_id));
CREATE POLICY "shared tracks read" ON public.tracks FOR SELECT TO authenticated USING (public.is_track_shared(id));
CREATE POLICY "shared audio read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'audio' AND public.is_audio_path_shared(name));

CREATE TABLE public.saved_playlists (
  user_id uuid NOT NULL,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, playlist_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_playlists TO authenticated;
GRANT ALL ON public.saved_playlists TO service_role;
ALTER TABLE public.saved_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved" ON public.saved_playlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);