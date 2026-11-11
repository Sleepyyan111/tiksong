import { useQuery } from "@tanstack/react-query";
import { avatarSrc } from "@/lib/library";
import { cn } from "@/lib/utils";

export function AvatarImg({ path, name, className }: { path?: string | null; name: string; className?: string }) {
  const { data: src } = useQuery({ queryKey: ["avatar", path], queryFn: () => avatarSrc(path), enabled: !!path, staleTime: 1000 * 60 * 60 });
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-primary-foreground", className)}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : (name[0] ?? "?").toUpperCase()}
    </div>
  );
}
