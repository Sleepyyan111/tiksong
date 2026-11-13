import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { userQuery, discoverQuery } from "@/lib/library";
import { SharedRow } from "./playlists.index";
import { AvatarImg } from "@/components/avatar-img";
import { UserRoleBadge } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/users/$id")({
  head: () => ({
    meta: [
      { title: "Listener — Loop" },
      { name: "description", content: "A Loop listener's profile." },
      { property: "og:title", content: "Listener — Loop" },
      { property: "og:description", content: "A Loop listener's profile." },
    ],
  }),
  component: UserPage,
});

function UserPage() {
  const { id } = Route.useParams();
  const { data: u, isLoading } = useQuery(userQuery(id));
  const { data: lists = [] } = useQuery(discoverQuery(id));
  const name = u?.display_name || u?.username || "Listener";
  return (
    <div>
      <Link to="/users" className="inline-flex items-center gap-1 pt-4 text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> People</Link>
      {isLoading ? null : !u ? <p className="type-meta py-10 text-center">User not found</p> : (
        <header className="flex flex-col items-center pt-6 text-center">
          <AvatarImg path={u.avatar_url} name={name} className="h-24 w-24 text-4xl" />
          <h1 className="type-large mt-3">{name}</h1>
          <UserRoleBadge id={id} />
          {u.username && <p className="type-meta">@{u.username}</p>}
          {u.bio && <p className="mt-2 max-w-xs text-sm text-muted-foreground">{u.bio}</p>}
        </header>
      )}
      {u && <section className="mt-8"><h2 className="type-section">Public playlists</h2>
        {lists.length === 0 ? <p className="type-meta mt-2">No public playlists yet.</p> : lists.map((p) => <SharedRow key={p.id} p={p} />)}</section>}
    </div>
  );
}
