// Recognises common TikTok link formats (full video URLs, vm./vt. short links, m. links).
const PATTERNS = [
  /^https?:\/\/(www\.|m\.)?tiktok\.com\/@[\w.-]+\/(video|photo)\/\d+/i,
  /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w-]+\/?/i,
  /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w-]+\/?/i,
  /^https?:\/\/m\.tiktok\.com\/v\/\d+/i,
];

export function extractTikTokUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s]+/);
  if (!match) return null;
  const url = match[0].replace(/[),.]+$/, "");
  return PATTERNS.some((p) => p.test(url)) ? url : null;
}

export function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
