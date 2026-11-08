import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const ACCENTS = [
  { id: "coral", label: "Coral", value: "oklch(0.68 0.2 25)" },
  { id: "rose", label: "Rose", value: "oklch(0.66 0.21 5)" },
  { id: "amber", label: "Amber", value: "oklch(0.78 0.16 70)" },
  { id: "lime", label: "Lime", value: "oklch(0.8 0.18 130)" },
  { id: "teal", label: "Teal", value: "oklch(0.72 0.12 185)" },
  { id: "sky", label: "Sky", value: "oklch(0.7 0.14 235)" },
] as const;

export const BACKGROUNDS = [
  { id: "default", label: "Graphite", dark: null, light: null },
  { id: "black", label: "Pure black", dark: "oklch(0 0 0)", light: "oklch(1 0 0)" },
  { id: "warm", label: "Warm", dark: "oklch(0.15 0.012 60)", light: "oklch(0.975 0.01 80)" },
  { id: "navy", label: "Deep sea", dark: "oklch(0.15 0.03 250)", light: "oklch(0.975 0.01 240)" },
] as const;

export type Settings = {
  theme: "dark" | "light" | "system";
  accent: string;
  background: string;
  crossfade: boolean;
  resumePosition: boolean;
  quality: "high" | "standard";
};

const DEFAULTS: Settings = {
  theme: "dark",
  accent: "coral",
  background: "default",
  crossfade: false,
  resumePosition: true,
  quality: "high",
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
      const accent = ACCENTS.find((a) => a.id === settings.accent) ?? ACCENTS[0];
      root.style.setProperty("--primary", accent.value);
      const bg = BACKGROUNDS.find((b) => b.id === settings.background);
      const v = bg ? (dark ? bg.dark : bg.light) : null;
      if (v) root.style.setProperty("--background", v);
      else root.style.removeProperty("--background");
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
