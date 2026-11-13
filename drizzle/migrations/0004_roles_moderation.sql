CREATE TYPE public.app_role AS ENUM ('owner','admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_bans (
  user_id uuid PRIMARY KEY,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid NOT NULL
);
GRANT SELECT ON public.user_bans TO authenticated;
GRANT ALL ON public.user_bans TO service_role;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.moderation_log TO authenticated;
GRANT ALL ON public.moderation_log TO service_role;
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'))
$$;
CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = _user_id)
$$;

CREATE POLICY "own ban read" ON public.user_bans FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "owner log read" ON public.moderation_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'owner'));

-- Staff can view every song (including private) and its audio
CREATE POLICY "staff read tracks" ON public.tracks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read audio" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'audio' AND public.is_staff(auth.uid()));
CREATE POLICY "staff read playlists" ON public.playlists FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Banned users cannot add or change content
CREATE POLICY "not banned tracks insert" ON public.tracks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_banned(auth.uid()));
CREATE POLICY "not banned playlists insert" ON public.playlists AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_banned(auth.uid()));
CREATE POLICY "not banned playlists update" ON public.playlists AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_banned(auth.uid()));
CREATE POLICY "not banned profile update" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_banned(auth.uid()));

-- Permanent owner: verified spookly6@gmail.com
CREATE OR REPLACE FUNCTION public.grant_owner_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'spookly6@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_owner AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_owner_role();
CREATE TRIGGER on_auth_user_confirmed_owner AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION public.grant_owner_role();
INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'owner' FROM auth.users WHERE lower(email) = 'spookly6@gmail.com' AND email_confirmed_at IS NOT NULL
  ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.my_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'role', CASE WHEN public.has_role(auth.uid(),'owner') THEN 'owner' WHEN public.has_role(auth.uid(),'admin') THEN 'admin' ELSE 'user' END,
    'banned', public.is_banned(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.set_user_admin(_target uuid, _admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Only the owner can change roles'; END IF;
  IF public.has_role(_target,'owner') THEN RAISE EXCEPTION 'The owner role cannot be changed'; END IF;
  IF _admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target,'admin') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
  END IF;
  INSERT INTO public.moderation_log (actor_id, target_id, action) VALUES (auth.uid(), _target, CASE WHEN _admin THEN 'promote_admin' ELSE 'demote_admin' END);
END $$;

CREATE OR REPLACE FUNCTION public.set_user_ban(_target uuid, _banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Only the owner can ban users'; END IF;
  IF public.has_role(_target,'owner') THEN RAISE EXCEPTION 'The owner cannot be banned'; END IF;
  IF _banned THEN
    INSERT INTO public.user_bans (user_id, banned_by) VALUES (_target, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_bans WHERE user_id = _target;
  END IF;
  INSERT INTO public.moderation_log (actor_id, target_id, action) VALUES (auth.uid(), _target, CASE WHEN _banned THEN 'ban' ELSE 'unban' END);
END $$;

CREATE OR REPLACE FUNCTION public.moderate_profile(_target uuid, _username text, _remove_avatar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF public.has_role(_target,'owner') AND _target <> auth.uid() THEN RAISE EXCEPTION 'The owner account cannot be changed'; END IF;
  IF _username IS NOT NULL THEN
    IF _username !~ '^[a-z0-9_.]{3,24}$' THEN RAISE EXCEPTION 'Username must be 3-24 lowercase letters, numbers, _ or .'; END IF;
    UPDATE public.profiles SET username = _username WHERE id = _target;
  END IF;
  IF _remove_avatar THEN UPDATE public.profiles SET avatar_url = NULL WHERE id = _target; END IF;
  INSERT INTO public.moderation_log (actor_id, target_id, action, details)
    VALUES (auth.uid(), _target, 'edit_profile', jsonb_build_object('username', _username, 'remove_avatar', _remove_avatar));
END $$;

CREATE OR REPLACE FUNCTION public.staff_list_users(_q text)
RETURNS TABLE (id uuid, email text, username text, display_name text, avatar_url text, role text, banned boolean, track_count bigint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE is_owner boolean := public.has_role(auth.uid(),'owner');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
  SELECT u.id, CASE WHEN is_owner THEN u.email::text ELSE NULL END, p.username, p.display_name, p.avatar_url,
    CASE WHEN public.has_role(u.id,'owner') THEN 'owner' WHEN public.has_role(u.id,'admin') THEN 'admin' ELSE 'user' END,
    public.is_banned(u.id),
    (SELECT count(*) FROM public.tracks t WHERE t.user_id = u.id AND NOT t.removed),
    u.created_at
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE coalesce(_q,'') = ''
     OR p.username ILIKE '%' || _q || '%' OR p.display_name ILIKE '%' || _q || '%'
     OR (is_owner AND u.email ILIKE '%' || _q || '%')
  ORDER BY u.created_at DESC LIMIT 100;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_user_admin(uuid,boolean), public.set_user_ban(uuid,boolean), public.moderate_profile(uuid,text,boolean), public.staff_list_users(text), public.my_status() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_user_admin(uuid,boolean), public.set_user_ban(uuid,boolean), public.moderate_profile(uuid,text,boolean), public.staff_list_users(text), public.my_status() TO authenticated;