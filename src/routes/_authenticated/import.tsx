import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ClipboardPaste, Loader2, Pause, Play, X } from "lucide-react";
import { importTikTok, previewTikTok } from "@/lib/tiktok.functions";
import { extractTikTokUrl, formatTime } from "@/lib/tiktok-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import audio — Loop" },
      { name: "description", content: "Paste a TikTok link and add its sound to your Song playlist." },
      { property: "og:title", content: "Import audio — Loop" },
      { property: "og:description", content: "Paste a TikTok link and add its sound to your playlist." },
    ],
  }),
  component: ImportPage,
});

type Preview = Awaited<ReturnType<typeof previewTikTok>>;

function ImportPage() {
  const qc = useQueryClient();
  const preview = useServerFn(previewTikTok);
  const doImport = useServerFn(importTikTok);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"idle" | "reading" | "preview" | "saving" | "done">("idle");
  const [data, setData] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = extractTikTokUrl(text);

  useEffect(() => () => audio.current?.pause(), []);

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      toast.error("Clipboard access was blocked — long-press the field to paste.");
    }
  };

  const fetchPreview = async () => {
    if (!url) return;
    setErr(null);
    setStage("reading");
    try {
      const d = await preview({ data: { url } });
      setData(d);
      setStage("preview");
    } catch (e) {
      setErr((e as Error).message);
      setStage("idle");
    }
  };

  const togglePreview = () => {
    if (!data) return;
    if (!audio.current) {
      audio.current = new Audio(data.audioUrl);
      audio.current.onended = () => setPreviewPlaying(false);
    }
    if (audio.current.paused) {
      audio.current.play().then(() => setPreviewPlaying(true)).catch(() => toast.error("Preview unavailable — you can still import."));
    } else {
      audio.current.pause();
      setPreviewPlaying(false);
    }
  };

  const confirm = async () => {
    if (!url) return;
    audio.current?.pause();
    setPreviewPlaying(false);
    setStage("saving");
    try {
      const r = await doImport({ data: { url } });
      await qc.invalidateQueries({ queryKey: ["tracks"] });
      toast.success(r.duplicate ? "Already in Song" : "Added to Song");
      setStage("done");
    } catch (e) {
      setErr((e as Error).message);
      setStage("preview");
    }
  };

  const reset = () => {
    audio.current?.pause();
    audio.current = null;
    setPreviewPlaying(false);
    setText("");
    setData(null);
    setErr(null);
    setStage("idle");
  };

  return (
    <div className="pt-6">
      <div className="type-caption">Import</div>
      <h1 className="type-large mt-1">Import audio</h1>
      <p className="type-meta mt-2">Paste a TikTok video link. The sound is saved as an MP3 to your Song playlist.</p>

      <div className="mt-6 rounded-2xl bg-card p-2 border border-border">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); setStage("idle"); setData(null); setErr(null); }}
            placeholder="https://www.tiktok.com/@…/video/…"
            inputMode="url"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {text ? (
            <button aria-label="Clear" onClick={reset} className="p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
          ) : (
            <button onClick={paste} className="flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-xs font-semibold">
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste
            </button>
          )}
        </div>
      </div>
      {text && !url && <p className="mt-2 px-1 type-meta text-destructive">That doesn't look like a TikTok link.</p>}

      {stage === "idle" || stage === "reading" ? (
        <button
          onClick={fetchPreview}
          disabled={!url || stage === "reading"}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-foreground disabled:opacity-40"
        >
          {stage === "reading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading link…</> : "Import"}
        </button>
      ) : null}

      {err && <p className="mt-4 rounded-xl bg-destructive/10 p-3 type-meta text-destructive">{err}</p>}

      {data && stage !== "idle" && stage !== "reading" && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-card border border-border animate-in fade-in slide-in-from-bottom-2">
          <div className="flex gap-4 p-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
              {data.coverUrl && <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />}
              <button aria-label="Preview" onClick={togglePreview} className="absolute inset-0 flex items-center justify-center bg-background/30">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
                  {previewPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                </span>
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="type-song line-clamp-2">{data.title}</div>
              <div className="type-meta mt-1 truncate">{data.artist}</div>
              <div className="type-meta truncate">from @{data.creator}</div>
              <div className="type-time mt-2">{data.duration ? formatTime(data.duration) : "—"} · MP3</div>
            </div>
          </div>
          <div className="border-t border-border p-3">
            {stage === "done" ? (
              <div className="flex gap-2">
                <div className="flex h-11 flex-1 items-center justify-center gap-2 text-sm font-semibold text-primary"><Check className="h-4 w-4" /> Added to Song</div>
                <button onClick={reset} className="h-11 flex-1 rounded-xl bg-secondary text-sm font-semibold">Import another</button>
              </div>
            ) : data.alreadyImported ? (
              <p className="py-2 text-center type-meta">This sound is already in your Song playlist.</p>
            ) : (
              <button
                onClick={confirm}
                disabled={stage === "saving"}
                className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground")}
              >
                {stage === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Downloading & saving…</> : "Add to Song"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-10 type-meta">
        <div className="type-caption mb-2">Works with</div>
        tiktok.com/@user/video/… · vm.tiktok.com/… · vt.tiktok.com/… · tiktok.com/t/…
      </div>
    </div>
  );
}
