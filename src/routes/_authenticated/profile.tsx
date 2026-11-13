import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Settings, ChevronRight, Camera, Search } from "lucide-react";
import { AvatarImg } from "@/components/avatar-img";
import { toast } from "sonner";
import { useQuery as useRoleQuery } from "@tanstack/react-query";
import { myStatusQuery, RoleBadge } from "@/lib/roles";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, playlistsQuery, uploadAvatar } from "@/lib/library";
import { tracksQuery } from "@/lib/tracks";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Loop" },
      { name: "description", content: "Your Loop profile, username and stats." },
      { property: "og:title", content: "Profile — Loop" },
      { property: "og:description", content: "Your Loop profile, username and stats." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery);
  const { data: tracks = [] } = useQuery(tracksQuery);
  const { data: lists = [] } = useQuery(playlistsQuery);
  const [f, setF] = useState({ username: "", display_name: "", bio: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setF({ username: profile.username ?? "", display_name: profile.display_name ?? "", bio: profile.bio ?? "" });
  }, [profile]);

  const save = async () => {
    const username = f.username.trim().toLowerCase() || null;
    if (username && !/^[a-z0-9_.]{3,24}$/.test(username)) { toast.error("Username: 3–24 letters, numbers, _ or ."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: profile!.id, username, display_name: f.display_name.trim() || null, bio: f.bio.trim() || null });
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "That username is taken" : error.message); return; }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const [uploading, setUploading] = useState(false);
  const onPick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Pick an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    const { error } = await uploadAvatar(file);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile picture updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const { data: status } = useRoleQuery(myStatusQuery);
  const name = f.display_name || profile?.username || "You";
  const active = tracks.filter((t) => !t.removed);
  const mins = Math.round(active.reduce((s, t) => s + (t.duration ?? 0), 0) / 60);

  return (
    <div>
      <header className="flex flex-col items-center pt-8 text-center">
        <label className="relative cursor-pointer" aria-label="Change profile picture">
          <AvatarImg path={profile?.avatar_url} name={name} className={"h-24 w-24 text-4xl" + (uploading ? " opacity-50" : "")} />
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary"><Camera className="h-4 w-4" /></span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        <h1 className="type-large mt-3">{name}</h1>
        <RoleBadge role={status?.role} />
        {profile?.username && <p className="type-meta">@{profile.username}</p>}
        {f.bio && <p className="mt-2 max-w-xs text-sm text-muted-foreground">{f.bio}</p>}
      </header>
      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        {[[active.length, "Songs"], [lists.length, "Playlists"], [mins, "Minutes"]].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-secondary py-3"><div className="text-xl font-bold">{v}</div><div className="type-meta">{l}</div></div>
        ))}
      </div>
      <section className="mt-6 space-y-3">
        <h2 className="type-section">Edit profile</h2>
        <label className="block"><span className="type-meta">Display name</span>
          <input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} maxLength={50} className="mt-1 h-11 w-full rounded-xl bg-secondary px-3 text-sm outline-none" /></label>
        <label className="block"><span className="type-meta">Username</span>
          <div className="mt-1 flex h-11 items-center rounded-xl bg-secondary px-3 text-sm"><span className="text-muted-foreground">@</span>
            <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} maxLength={24} className="h-full flex-1 bg-transparent outline-none" /></div></label>
        <label className="block"><span className="type-meta">Bio</span>
          <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={160} rows={3} className="mt-1 w-full rounded-xl bg-secondary p-3 text-sm outline-none" /></label>
        <button onClick={save} disabled={saving || !profile} className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </section>
      <section className="mt-6 overflow-hidden rounded-xl bg-secondary">
        {(status?.role === "owner" || status?.role === "admin") && <Link to="/admin" className="flex items-center gap-3 border-b border-border px-4 py-3.5 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> {status.role === "owner" ? "Owner Dashboard" : "Admin Panel"}<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link>}
        <Link to="/users" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium"><Search className="h-4 w-4" /> Find people<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link>
        <Link to="/history" className="flex border-t border-border items-center gap-3 px-4 py-3.5 text-sm font-medium"><History className="h-4 w-4" /> History<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link>
        <Link to="/settings" className="flex items-center gap-3 border-t border-border px-4 py-3.5 text-sm font-medium"><Settings className="h-4 w-4" /> Settings<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link>
      </section>
    </div>
  );
}
