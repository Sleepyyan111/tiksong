import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Settings, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, playlistsQuery } from "@/lib/library";
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
  const name = f.display_name || profile?.username || "You";
  const active = tracks.filter((t) => !t.removed);
  const mins = Math.round(active.reduce((s, t) => s + (t.duration ?? 0), 0) / 60);

  return (
    <div>
      <header className="flex flex-col items-center pt-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-4xl font-bold text-primary-foreground">{name[0]?.toUpperCase()}</div>
        <h1 className="type-large mt-3">{name}</h1>
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
        <Link to="/history" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium"><History className="h-4 w-4" /> History<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link>
        <Link to="/settings" className="flex items-center gap-3 border-t border-border px-4 py-3.5 text-sm font-medium"><Settings className="h-4 w-4" /> Settings<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link>
      </section>
    </div>
  );
}
