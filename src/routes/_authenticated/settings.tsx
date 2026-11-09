import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ACCENTS, BACKGROUNDS, RADII, TEXT_SIZES, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Loop" },
      { name: "description", content: "Theme, playback and account settings." },
      { property: "og:title", content: "Settings — Loop" },
      { property: "og:description", content: "Theme, playback and account settings." },
    ],
  }),
  component: SettingsPage,
});

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="type-caption mb-2 px-1">{title}</div>
      <div className="overflow-hidden rounded-2xl bg-card divide-y divide-border border border-border">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
      <span className="type-body">{label}</span>
      {children}
    </div>
  );
}
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-secondary p-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-colors", value === o.v ? "bg-background shadow-sm" : "text-muted-foreground")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function SettingsPage() {
  const { settings, update } = useSettings();
  const nav = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="pt-6">
      <div className="type-caption">Preferences</div>
      <h1 className="type-large mt-1">Settings</h1>

      <Group title="Appearance">
        <Row label="Theme">
          <Segmented value={settings.theme} onChange={(theme) => update({ theme })} options={[{ v: "dark", l: "Dark" }, { v: "light", l: "Light" }, { v: "system", l: "System" }]} />
        </Row>
        <div className="px-4 py-3">
          <div className="type-body mb-3">Accent</div>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => (
              <button key={a.id} aria-label={a.label} onClick={() => update({ accent: a.id })} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: a.value }}>
                {settings.accent === a.id && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
              </button>
            ))}
            <button aria-label="Match song cover" onClick={() => update({ accent: "cover" })} className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold", settings.accent === "cover" ? "border-primary text-primary" : "border-border")}>
              {settings.accent === "cover" && <Check className="h-3.5 w-3.5" strokeWidth={3} />} Match cover
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="type-body mb-1">Player color</div>
          <div className="type-meta mb-3">Color behind the bottom player and full-screen player.</div>
          <div className="flex items-center gap-2">
            <button onClick={() => update({ playerColor: null })} className={cn("rounded-xl border px-3 py-2 text-sm font-semibold", !settings.playerColor ? "border-primary text-primary" : "border-border")}>
              From song cover
            </button>
            <label className={cn("relative flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold cursor-pointer", settings.playerColor ? "border-primary text-primary" : "border-border")}>
              <span className="h-4 w-4 rounded-full border border-border" style={{ background: settings.playerColor ?? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
              Pick color
              <input type="color" value={settings.playerColor ?? "#ff6b6b"} onChange={(e) => update({ playerColor: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="type-body mb-3">Background</div>
          <div className="grid grid-cols-2 gap-2">
            {BACKGROUNDS.map((b) => (
              <button key={b.id} onClick={() => update({ background: b.id })} className={cn("rounded-xl border px-3 py-2.5 text-left text-sm font-semibold", settings.background === b.id ? "border-primary text-primary" : "border-border")}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <Row label="Corners">
          <Segmented value={settings.radius} onChange={(radius) => update({ radius })} options={RADII.map((r) => ({ v: r.id as string, l: r.label }))} />
        </Row>
        <Row label="Text size">
          <Segmented value={settings.textSize} onChange={(textSize) => update({ textSize })} options={TEXT_SIZES.map((t) => ({ v: t.id as string, l: t.label }))} />
        </Row>
      </Group>

      <Group title="Playback">
        <Row label="Resume where I left off">
          <Switch checked={settings.resumePosition} onCheckedChange={(resumePosition) => update({ resumePosition })} />
        </Row>
        <Row label="Import quality">
          <Segmented value={settings.quality} onChange={(quality) => update({ quality })} options={[{ v: "high", l: "Highest" }, { v: "standard", l: "Standard" }]} />
        </Row>
      </Group>
      <p className="mt-2 px-1 type-meta">Audio is saved at the best quality TikTok provides. On iPhone, keep playback started from the app for lock-screen controls.</p>

      <Group title="Account">
        <Row label="Signed in as"><span className="type-meta truncate">{email}</span></Row>
        <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }} className="w-full px-4 py-3 text-left type-body text-destructive">
          Log out
        </button>
      </Group>
    </div>
  );
}
