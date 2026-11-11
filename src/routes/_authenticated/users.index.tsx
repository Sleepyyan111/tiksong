import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { userSearchQuery } from "@/lib/library";
import { AvatarImg } from "@/components/avatar-img";

export const Route = createFileRoute("/_authenticated/users/")({
  head: () => ({
    meta: [
      { title: "Find people — Loop" },
      { name: "description", content: "Search Loop listeners by username or name." },
      { property: "og:title", content: "Find people — Loop" },
      { property: "og:description", content: "Search Loop listeners by username or name." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const { data = [], isFetching } = useQuery(userSearchQuery(dq));
  return (
    <div>
      <h1 className="type-large pt-4">Find people</h1>
      <div className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username or name" className="h-full flex-1 bg-transparent text-sm outline-none" />
      </div>
      <ul className="mt-4 space-y-1">
        {data.map((u) => {
          const name = u.display_name || u.username || "Listener";
          return (
            <li key={u.id}>
              <Link to="/users/$id" params={{ id: u.id }} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-secondary">
                <AvatarImg path={u.avatar_url} name={name} className="h-11 w-11 text-lg" />
                <div className="min-w-0"><div className="truncate text-sm font-semibold">{name}</div>
                  {u.username && <div className="type-meta truncate">@{u.username}</div>}</div>
              </Link>
            </li>
          );
        })}
        {!isFetching && data.length === 0 && <p className="type-meta py-8 text-center">No people found</p>}
      </ul>
    </div>
  );
}
