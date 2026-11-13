import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Play, Search, Ban, ShieldCheck, ShieldOff, ImageOff, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myStatusQuery, RoleBadge, type Role } from "@/lib/roles";
import { signTracks, type Track } from "@/lib/tracks";
import { usePlayer } from "@/lib/player";
import { AvatarImg } from "@/components/avatar-img";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Moderation — Loop" },
      { name: "description", content: "Owner dashboard and admin panel for Loop." },
      { property: "og:title", content: "Moderation — Loop" },
      { property: "og:description", content: "Owner dashboard and admin panel for Loop." },
    ],
  }),
  component: AdminPage,
});

type StaffUser = { id: string; email: string | null; username: string | null; display_name: string | null; avatar_url: string | null; role: Role; banned: boolean; track_count: number; created_at: string };

function AdminPage() {
  const { data: me, isLoading } = useQuery(myStatusQuery);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const isStaff = me?.role === "owner" || me?.role === "admin";
  const users = useQuery({
    queryKey: ["staff-users", q],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("staff_list_users", { _q: q.trim() });
      if (error) throw error;
      return (data ?? []) as StaffUser[];
    },
  });
  if (isLoading) return null;
  if (!isStaff) return <p className="type-meta py-20 text-center">You don't have access to this page.</p>;
  const owner = me!.role === "owner";
  const selected = users.data?.find((u) => u.id === sel) ?? null;

  return (
    <div className="pt-6">
      <div className="type-caption">{owner ? "Owner" : "Admin"}</div>
      <h1 className="type-large mt-1">{owner ? "Owner Dashboard" : "Admin Panel"}</h1>
      <div className="mt-5 flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={owner ? "Search username or email" : "Search username"} className="h-full flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="mt-4 space-y-1">
        {users.error && <p className="type-meta text-destructive">{(users.error as Error).message}</p>}
        {(users.data ?? []).map((u) => (
          <button key={u.id} onClick={() => setSel(sel === u.id ? null : u.id)} className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left", sel === u.id ? "bg-accent" : "hover:bg-accent/60")}>
            <AvatarImg path={u.avatar_url} name={u.display_name || u.username || "?"} className="h-10 w-10 text-base" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="type-song truncate">{u.display_name || u.username || "No name"}</span><RoleBadge role={u.role} />{u.banned && <span className="text-[0.6875rem] font-bold uppercase text-destructive">Banned</span>}</div>
              <div className="type-meta truncate">{u.username ? `@${u.username}` : "no username"}{u.email ? ` · ${u.email}` : ""} · {u.track_count} songs</div>
            </div>
          </button>
        ))}
      </div>
      {selected && <UserDetail key={selected.id} u={selected} owner={owner} />}
    </div>
  );
}

type Pending = { title: string; body: string; run: () => Promise<{ error: { message: string } | null }>; ok: string } | null;

function UserDetail({ u, owner }: { u: StaffUser; owner: boolean }) {
  const qc = useQueryClient();
  const p = usePlayer();
  const [name, setName] = useState(u.username ?? "");
  const [pending, setPending] = useState<Pending>(null);
  const protectedOwner = u.role === "owner";
  const songs = useQuery({
    queryKey: ["staff-tracks", u.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tracks").select("*").eq("user_id", u.id).order("created_at", { ascending: false });
      if (error) throw error;
      return signTracks((data ?? []) as Track[]);
    },
  });
  const run = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await fn();
    if (error) toast.error(error.message); else { toast.success(ok); qc.invalidateQueries({ queryKey: ["staff-users"] }); qc.invalidateQueries({ queryKey: ["user-role", u.id] }); }
  };
  const btn = "flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold";

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="type-section">{u.display_name || u.username || "User"}</h2>
      <p className="type-meta">Joined {new Date(u.created_at).toLocaleDateString()}</p>
      {protectedOwner ? (
        <p className="type-meta mt-3">The owner account is protected and can't be changed.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <div className="flex h-11 flex-1 items-center rounded-xl bg-secondary px-3 text-sm"><span className="text-muted-foreground">@</span>
              <input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} maxLength={24} className="h-full flex-1 bg-transparent outline-none" /></div>
            <button className={btn} onClick={() => run(() => supabase.rpc("moderate_profile", { _target: u.id, _username: name, _remove_avatar: false }), "Username changed")}><Pencil className="h-4 w-4" /> Rename</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className={btn} disabled={!u.avatar_url} onClick={() => run(() => supabase.rpc("moderate_profile", { _target: u.id, _username: null as unknown as string, _remove_avatar: true }), "Profile picture removed")}><ImageOff className="h-4 w-4" /> Remove picture</button>
            {owner && (u.role === "admin" ? (
              <button className={btn} onClick={() => setPending({ title: "Demote to user?", body: "They will lose admin access.", ok: "Demoted to user", run: () => supabase.rpc("set_user_admin", { _target: u.id, _admin: false }) })}><ShieldOff className="h-4 w-4" /> Demote</button>
            ) : (
              <button className={btn} onClick={() => setPending({ title: "Promote to admin?", body: "They will be able to view all songs and edit usernames and pictures.", ok: "Promoted to admin", run: () => supabase.rpc("set_user_admin", { _target: u.id, _admin: true }) })}><ShieldCheck className="h-4 w-4" /> Make admin</button>
            ))}
            {owner && (
              <button className={cn(btn, !u.banned && "text-destructive")} onClick={() => setPending(u.banned
                ? { title: "Unban this user?", body: "They will be able to add songs and edit their profile again.", ok: "User unbanned", run: () => supabase.rpc("set_user_ban", { _target: u.id, _banned: false }) }
                : { title: "Ban this user?", body: "They will be locked out of the app.", ok: "User banned", run: () => supabase.rpc("set_user_ban", { _target: u.id, _banned: true }) })}>
                <Ban className="h-4 w-4" /> {u.banned ? "Unban" : "Ban"}
              </button>
            )}
          </div>
        </>
      )}
      <h3 className="type-caption mt-6 mb-2">Songs ({songs.data?.length ?? 0})</h3>
      {(songs.data ?? []).map((t) => (
        <button key={t.id} onClick={() => p.playTrack(t.id, songs.data)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent/60">
          <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1"><div className="type-song truncate">{t.title}</div><div className="type-meta truncate">{t.artist ?? t.creator}{t.removed ? " · removed" : ""}</div></div>
        </button>
      ))}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{pending?.title}</AlertDialogTitle><AlertDialogDescription>{pending?.body}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pending) run(pending.run, pending.ok); setPending(null); }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
