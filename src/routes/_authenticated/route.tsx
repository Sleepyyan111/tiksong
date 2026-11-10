import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PlayerProvider } from "@/lib/player";
import { DownloadsProvider } from "@/lib/downloads";
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
