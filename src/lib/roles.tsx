import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Crown } from "lucide-react";

export type Role = "owner" | "admin" | "user";

export const myStatusQuery = queryOptions({
  queryKey: ["my-status"],
  queryFn: async (): Promise<{ role: Role; banned: boolean }> => {
    const { data, error } = await supabase.rpc("my_status");
    if (error) throw error;
    return data as { role: Role; banned: boolean };
  },
  staleTime: 60_000,
});

export const userRoleQuery = (id: string) => queryOptions({
  queryKey: ["user-role", id],
  queryFn: async (): Promise<Role> => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", id);
    const roles = (data ?? []).map((r) => r.role);
    return roles.includes("owner") ? "owner" : roles.includes("admin") ? "admin" : "user";
  },
  staleTime: 60_000,
});

export function RoleBadge({ role }: { role: Role | undefined | null }) {
  if (!role || role === "user") return null;
  const Icon = role === "owner" ? Crown : ShieldCheck;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-primary">
      <Icon className="h-3 w-3" /> {role}
    </span>
  );
}

export function UserRoleBadge({ id }: { id: string }) {
  const { data } = useQuery(userRoleQuery(id));
  return <RoleBadge role={data} />;
}
