// zonalvalue.ph brand tokens — blue accent + red pop (matches the new ZV logo / mascot).
// `gold*` names kept for compatibility but now hold the brand blue.
export const Z = {
  navy: "#16276a",
  navy2: "#1e3a8a",
  navyDeep: "#0c1430",
  gold: "#155eef",
  goldLite: "#5b8cff",
  goldDeep: "#0f49c4",
  paper: "#f3f6fc",
  paper2: "#e7edf7",
  ink: "#101a30",
  inkSoft: "#33405e",
  slate: "#67718a",
  line: "#dbe4f1",
  white: "#ffffff",
  // semantic / hazard severity
  safe: "#16a34a",
  amber: "#d99a1c",
  orange: "#ea580c",
  red: "#e53935",
};

// A serif for display numbers/titles (mirrors the website's Georgia headings).
export const SERIF = "Georgia";

// Pretty-print a DB label ("CEBU CITY" → "Cebu City").
export function titleCase(s?: string | null): string {
  return String(s || "").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

// Hermes has limited Intl, so group thousands by hand: 12000 → "12,000".
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ₱32,500 — full, grouped.
export function peso(n?: number | null): string {
  if (n == null || !isFinite(Number(n))) return "—";
  return "₱" + group(Math.round(Number(n)));
}

// ₱32.5k — compact, for tight chips / toggles.
export function pesoK(n?: number | null): string {
  if (n == null || !isFinite(Number(n))) return "—";
  const v = Math.round(Number(n));
  if (v >= 1000) {
    const k = v / 1000;
    const s = k >= 100 ? String(Math.round(k)) : String(Math.round(k * 10) / 10);
    return "₱" + s + "k";
  }
  return "₱" + v;
}
