import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

// Theme palette — same token names as the static `Z` (so screens convert 1:1 by
// swapping `Z.x` → `c.x`), plus a few surface helpers for theme-aware cards/chips.
export interface Palette {
  navy: string; navy2: string; navyDeep: string;
  gold: string; goldLite: string; goldDeep: string;
  paper: string; paper2: string;
  ink: string; inkSoft: string; slate: string;
  line: string; white: string;
  safe: string; amber: string; orange: string; red: string;
  // surface helpers (theme-aware stand-ins for common hardcoded hexes)
  card: string;     // elevated card surface (was #fff / Z.white)
  cardAlt: string;  // gold-tinted card (was #fffdf7)
  chip: string;     // soft navy chip (was #eef1fa)
  field: string;    // input background
  header: string;   // top app-bar / nav band
  shadow: string;
  isDark: boolean;
}

// NOTE: the `gold*` token NAMES are kept (they're referenced app-wide) but now hold the
// brand BLUE — matching the new ZV logo / AI mascot. Neutrals carry a slight cool bias.
export const LIGHT: Palette = {
  navy: "#16276a", navy2: "#1e3a8a", navyDeep: "#0c1430",
  gold: "#155eef", goldLite: "#5b8cff", goldDeep: "#0f49c4",   // brand blue (accent)
  paper: "#f3f6fc", paper2: "#e7edf7",
  ink: "#101a30", inkSoft: "#33405e", slate: "#67718a",
  line: "#dbe4f1", white: "#ffffff",
  safe: "#16a34a", amber: "#d99a1c", orange: "#ea580c", red: "#e53935",
  card: "#ffffff", cardAlt: "#eff4ff", chip: "#eaf0fb", field: "#eef2fb",
  header: "#16276a", shadow: "#0c1430", isDark: false,
};

// Night mode — deep navy ground, lifted card surfaces, blue pops. The "wow".
export const DARK: Palette = {
  navy: "#1b2c5e", navy2: "#2a47a0", navyDeep: "#060a16",
  gold: "#3f82ff", goldLite: "#8fb4ff", goldDeep: "#2f6bff",   // brand blue (accent)
  paper: "#0a1022", paper2: "#0f1830",
  ink: "#eef1fa", inkSoft: "#bfc9e2", slate: "#8492b1",
  line: "#243049", white: "#141f3c",
  safe: "#22c55e", amber: "#e6b13a", orange: "#fb7a3c", red: "#f0524a",
  card: "#141f3c", cardAlt: "#19223f", chip: "#1b2645", field: "#0f1830",
  header: "#101a3a", shadow: "#000000", isDark: true,
};

export type Mode = "light" | "dark";
interface Ctx { c: Palette; isDark: boolean; mode: Mode; toggle: () => void; setMode: (m: Mode) => void; }
const ThemeCtx = createContext<Ctx>({ c: LIGHT, isDark: false, mode: "light", toggle: () => {}, setMode: () => {} });
const KEY = "zv_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => { if (v === "dark" || v === "light") setModeState(v); }).catch(() => {});
  }, []);

  const setMode = (m: Mode) => { setModeState(m); SecureStore.setItemAsync(KEY, m).catch(() => {}); };
  const toggle = () => setMode(mode === "dark" ? "light" : "dark");

  const value = useMemo<Ctx>(() => ({
    c: mode === "dark" ? DARK : LIGHT, isDark: mode === "dark", mode, toggle, setMode,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [mode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() { return useContext(ThemeCtx); }
