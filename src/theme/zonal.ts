// zonalvalue.ph brand tokens — kept in sync with the website (navy · gold · cream).
export const Z = {
  navy: "#16276a",
  navy2: "#1e3a8a",
  navyDeep: "#0c1430",
  gold: "#c9a84c",
  goldLite: "#e6c976",
  goldDeep: "#9d7a2e",
  paper: "#f7f4ec",
  paper2: "#efe9dc",
  ink: "#101a30",
  inkSoft: "#33405e",
  slate: "#67718a",
  line: "#e4ddcc",
  white: "#ffffff",
  safe: "#16a34a",
  red: "#dc2626",
};

// Pretty-print a DB label ("CEBU CITY" → "Cebu City").
export function titleCase(s: string): string {
  return String(s || "").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}
