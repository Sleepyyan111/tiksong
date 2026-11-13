import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PlayerProvider } from "@/lib/player";
import { DownloadsProvider } from "@/lib/downloads";
import { useQuery } from "@tanstack/react-query";
import { myStatusQuery } from "@/lib/roles";
import { BottomNav, MiniPlayer, NowPlaying } from "@/components/player-ui";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { data: status } = useQuery(myStatusQuery);
  if (status?.banned) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="type-large">Account banned</h1>
      <p className="type-meta">This account has been banned from Loop.</p>
      <button onClick={() => supabase.auth.signOut()} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Log out</button>
    </div>
  );
  return (
    <DownloadsProvider>
    <PlayerProvider>
      <div className="mx-auto min-h-screen max-w-xl px-5 pb-44 pt-[max(env(safe-area-inset-top),20px)]">
        <Outlet />
      </div>
      <MiniPlayer />
      <BottomNav />
      <NowPlaying />
    </PlayerProvider>
    </DownloadsProvider>
  );
}
