import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const ACCENTS = [
  { id: "coral", label: "Coral", value: "oklch(0.68 0.2 25)" },
  { id: "rose", label: "Rose", value: "oklch(0.66 0.21 5)" },
  { id: "amber", label: "Amber", value: "oklch(0.78 0.16 70)" },
  { id: "lime", label: "Lime", value: "oklch(0.8 0.18 130)" },
  { id: "teal", label: "Teal", value: "oklch(0.72 0.12 185)" },
  { id: "sky", label: "Sky", value: "oklch(0.7 0.14 235)" },
  { id: "violet", label: "Violet", value: "oklch(0.68 0.17 300)" },
  { id: "mint", label: "Mint", value: "oklch(0.82 0.13 160)" },
  { id: "gold", label: "Gold", value: "oklch(0.84 0.14 90)" },
  { id: "mono", label: "Mono", value: "oklch(0.9 0 0)" },
] as const;

export const RADII = [
  { id: "sharp", label: "Sharp", value: "0.25rem" },
  { id: "soft", label: "Soft", value: "0.875rem" },
  { id: "round", label: "Round", value: "1.4rem" },
] as const;

export const TEXT_SIZES = [
  { id: "s", label: "S", value: "15px" },
  { id: "m", label: "M", value: "16px" },
  { id: "l", label: "L", value: "18px" },
] as const;

export const BACKGROUNDS = [
  { id: "default", label: "Graphite", dark: null, light: null },
  { id: "black", label: "Pure black", dark: "oklch(0 0 0)", light: "oklch(1 0 0)" },
  { id: "warm", label: "Warm", dark: "oklch(0.15 0.012 60)", light: "oklch(0.975 0.01 80)" },
  { id: "navy", label: "Deep sea", dark: "oklch(0.15 0.03 250)", light: "oklch(0.975 0.01 240)" },
  { id: "forest", label: "Forest", dark: "oklch(0.16 0.025 150)", light: "oklch(0.975 0.012 140)" },
  { id: "plum", label: "Plum", dark: "oklch(0.15 0.03 320)", light: "oklch(0.975 0.012 320)" },
] as const;

export type Settings = {
  theme: "dark" | "light" | "system";
  accent: string;
  background: string;
  crossfade: boolean;
  resumePosition: boolean;
  quality: "high" | "standard";
  radius: string;
  textSize: string;
  playerColor: string | null;
};

const DEFAULTS: Settings = {
  theme: "dark",
  accent: "cover",
  background: "default",
  crossfade: false,
  resumePosition: true,
  quality: "high",
  radius: "soft",
  textSize: "m",
  playerColor: null,
};

const KEY = "tm-settings";
const Ctx = createContext<{ settings: Settings; update: (p: Partial<Settings>) => void }>({
  settings: DEFAULTS,
  update: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        settings.theme === "dark" ||
        (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      // "cover" accent is applied by the player from the current song's artwork.
      if (settings.accent !== "cover")
        root.style.setProperty("--primary", (ACCENTS.find((a) => a.id === settings.accent) ?? ACCENTS[0]).value);
      const bg = BACKGROUNDS.find((b) => b.id === settings.background);
      const v = bg ? (dark ? bg.dark : bg.light) : null;
      if (v) root.style.setProperty("--background", v);
      else root.style.removeProperty("--background");
      root.style.setProperty("--radius", (RADII.find((r) => r.id === settings.radius) ?? RADII[1]).value);
      root.style.fontSize = (TEXT_SIZES.find((t) => t.id === settings.textSize) ?? TEXT_SIZES[1]).value;
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings]);

  const update = (p: Partial<Settings>) =>
    setSettings((s) => {
      const n = { ...s, ...p };
      localStorage.setItem(KEY, JSON.stringify(n));
      return n;
    });

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
