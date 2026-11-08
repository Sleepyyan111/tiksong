import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractTikTokUrl } from "./tiktok-url";

type Resolved = {
  tiktokId: string;
  title: string;
  artist: string | null;
  creator: string | null;
  duration: number | null;
  audioUrl: string;
  coverUrl: string | null;
  sourceUrl: string;
};

// Resolves a TikTok link to its audio stream through the public tikwm extraction service.
async function resolve(url: string): Promise<Resolved> {
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Extraction service returned ${res.status}`);
  const json = (await res.json()) as { code: number; msg: string; data?: any };
  if (json.code !== 0 || !json.data) throw new Error(json.msg || "Could not read this TikTok link");
  const d = json.data;
  const m = d.music_info ?? {};
  const audioUrl = m.play || d.music;
  if (!audioUrl) throw new Error("This video has no downloadable audio");
  const rawTitle: string = m.title || d.title || "Untitled";
  return {
    tiktokId: String(m.id || d.id),
    title: rawTitle,
    artist: m.author || null,
    creator: d.author?.nickname || d.author?.unique_id || null,
    duration: m.duration || d.duration || null,
    audioUrl,
    coverUrl: m.cover || d.cover || null,
    sourceUrl: url,
  };
}

const input = z.object({ url: z.string().min(8).max(2000) });

function clean(url: string) {
  const u = extractTikTokUrl(url);
  if (!u) throw new Error("That doesn't look like a TikTok link");
  return u;
}

export const previewTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const r = await resolve(clean(data.url));
    const { data: existing } = await context.supabase
      .from("tracks")
      .select("id, removed")
      .eq("tiktok_id", r.tiktokId)
      .maybeSingle();
    return { ...r, alreadyImported: !!existing && !existing.removed };
  });

export const importTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const r = await resolve(clean(data.url));

    const { data: existing } = await supabase
      .from("tracks")
      .select("id, removed")
      .eq("tiktok_id", r.tiktokId)
      .maybeSingle();
    if (existing && !existing.removed) return { id: existing.id, duplicate: true };

    const audioRes = await fetch(r.audioUrl, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!audioRes.ok) throw new Error(`Audio download failed (${audioRes.status})`);
    const audio = await audioRes.arrayBuffer();
    const audioPath = `${userId}/${r.tiktokId}.mp3`;
    const up = await supabase.storage
      .from("audio")
      .upload(audioPath, audio, { contentType: "audio/mpeg", upsert: true });
    if (up.error) throw new Error(`Saving audio failed: ${up.error.message}`);

    let coverPath: string | null = null;
    if (r.coverUrl) {
      try {
        const c = await fetch(r.coverUrl);
        if (c.ok) {
          const p = `${userId}/${r.tiktokId}.jpg`;
          const cu = await supabase.storage
            .from("audio")
            .upload(p, await c.arrayBuffer(), { contentType: "image/jpeg", upsert: true });
          if (!cu.error) coverPath = p;
        }
      } catch {}
    }

    const { data: last } = await supabase
      .from("tracks")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? 0) + 1;

    const row = {
      user_id: userId,
      tiktok_id: r.tiktokId,
      source_url: r.sourceUrl,
      title: r.title,
      artist: r.artist,
      creator: r.creator,
      duration: r.duration,
      audio_path: audioPath,
      cover_path: coverPath,
      position,
      removed: false,
    };
    const { data: saved, error } = await supabase
      .from("tracks")
      .upsert(row, { onConflict: "user_id,tiktok_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id, duplicate: false };
  });
