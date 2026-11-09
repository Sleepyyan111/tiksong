export type Resolved = {
  tiktokId: string;
  title: string;
  artist: string | null;
  creator: string | null;
  duration: number | null;
  audioUrl: string;
  coverUrl: string | null;
  sourceUrl: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Runs in the browser so the extraction service rate-limits per user, not per shared server IP.
export async function resolveTikTok(url: string): Promise<Resolved> {
  let lastMsg = "Could not read this TikTok link";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(1200 * attempt);
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
    if (!res.ok) { lastMsg = `Extraction service returned ${res.status}`; continue; }
    const json = (await res.json()) as { code: number; msg: string; data?: any };
    if (json.code !== 0 || !json.data) {
      lastMsg = json.msg || lastMsg;
      if (/limit/i.test(lastMsg)) continue;
      throw new Error(lastMsg);
    }
    const d = json.data;
    const m = d.music_info ?? {};
    const audioUrl = m.play || d.music;
    if (!audioUrl) throw new Error("This video has no downloadable audio");
    return {
      tiktokId: String(m.id || d.id),
      title: m.title || d.title || "Untitled",
      artist: m.author || null,
      creator: d.author?.nickname || d.author?.unique_id || null,
      duration: m.duration || d.duration || null,
      audioUrl,
      coverUrl: m.cover || d.cover || null,
      sourceUrl: url,
    };
  }
  throw new Error(/limit/i.test(lastMsg) ? "The audio service is busy — wait a few seconds and try again." : lastMsg);
}
