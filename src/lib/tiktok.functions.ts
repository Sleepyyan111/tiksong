import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Only download media from TikTok / extraction-service hosts.
const ALLOWED = /(^|\.)(tikwm\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|tiktok\.com|ibytedtos\.com|byteoversea\.com|muscdn\.com|tiktokv\.com)$/i;
const safeUrl = z.string().url().max(4000).refine((u) => {
  try { const h = new URL(u); return h.protocol === "https:" && ALLOWED.test(h.hostname); } catch { return false; }
}, "Unsupported media host");

const input = z.object({
  tiktokId: z.string().min(1).max(64).regex(/^[\w-]+$/),
  title: z.string().max(500),
  artist: z.string().max(300).nullable(),
  creator: z.string().max(300).nullable(),
  duration: z.number().nonnegative().max(36000).nullable(),
  audioUrl: safeUrl,
  coverUrl: safeUrl.nullable(),
  sourceUrl: z.string().url().max(2000),
});

export const importTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data: r, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("tracks").select("id, removed").eq("tiktok_id", r.tiktokId).maybeSingle();
    if (existing && !existing.removed) return { id: existing.id, duplicate: true };

    const audioRes = await fetch(r.audioUrl, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!audioRes.ok) throw new Error(`Audio download failed (${audioRes.status})`);
    const audio = await audioRes.arrayBuffer();
    if (audio.byteLength > 50 * 1024 * 1024) throw new Error("Audio file is too large");
    const audioPath = `${userId}/${r.tiktokId}.mp3`;
    const up = await supabase.storage.from("audio").upload(audioPath, audio, { contentType: "audio/mpeg", upsert: true });
    if (up.error) throw new Error(`Saving audio failed: ${up.error.message}`);

    let coverPath: string | null = null;
    if (r.coverUrl) {
      try {
        const c = await fetch(r.coverUrl);
        if (c.ok) {
          const p = `${userId}/${r.tiktokId}.jpg`;
          const cu = await supabase.storage.from("audio").upload(p, await c.arrayBuffer(), { contentType: "image/jpeg", upsert: true });
          if (!cu.error) coverPath = p;
        }
      } catch {}
    }

    const { data: last } = await supabase
      .from("tracks").select("position").order("position", { ascending: false }).limit(1).maybeSingle();

    const { data: saved, error } = await supabase
      .from("tracks")
      .upsert({
        user_id: userId, tiktok_id: r.tiktokId, source_url: r.sourceUrl, title: r.title,
        artist: r.artist, creator: r.creator, duration: r.duration, audio_path: audioPath,
        cover_path: coverPath, position: (last?.position ?? 0) + 1, removed: false,
      }, { onConflict: "user_id,tiktok_id" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: saved.id, duplicate: false };
  });
