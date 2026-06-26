// Land-use classification helpers — mirrors the website's class grouping so the
// AGRI / RESID / COMM toggle reads the same way as zonalvalue.ph.

export type Group = "agricultural" | "residential" | "commercial" | "industrial" | "other";

export function classGroup(code?: string | null): Group {
  const c = String(code || "").toUpperCase().trim();
  if (!c) return "other";
  if (/^A\d*$/.test(c) || c === "AGRI") return "agricultural";
  if (c === "RR" || c === "R") return "residential";
  if (c === "CR" || c === "CC" || c === "RC" || c.startsWith("C")) return "commercial";
  if (c === "I" || c.startsWith("I")) return "industrial";
  return "other";
}

export const GROUP_LABEL: Record<Group, string> = {
  agricultural: "Agricultural", residential: "Residential",
  commercial: "Commercial", industrial: "Industrial", other: "Other",
};
export const GROUP_SHORT: Record<Group, string> = {
  agricultural: "Agri", residential: "Resid",
  commercial: "Comm", industrial: "Indus", other: "Other",
};

export interface LandUse { group: Group; label: string; short: string; value: number; code: string; }

interface PointLike { value_per_sqm?: number | null; classification_code?: string | null }

// Build the land-use options (AGRI/RESID/COMM…) from a set of nearby points.
export function buildLandUse(points: PointLike[], mainCode?: string | null): { options: LandUse[]; defaultGroup: Group } {
  const buckets: Partial<Record<Group, { vals: number[]; code: string }>> = {};
  for (const p of points || []) {
    const g = classGroup(p.classification_code);
    if (g === "other") continue;
    const v = Number(p.value_per_sqm);
    if (!isFinite(v) || v <= 0) continue;
    const b = (buckets[g] ||= { vals: [], code: p.classification_code || "" });
    b.vals.push(v);
  }
  const order: Group[] = ["agricultural", "residential", "commercial", "industrial"];
  const options: LandUse[] = [];
  for (const g of order) {
    const b = buckets[g];
    if (!b || !b.vals.length) continue;
    b.vals.sort((a, c) => a - c);
    const median = b.vals[Math.floor(b.vals.length / 2)];
    options.push({ group: g, label: GROUP_LABEL[g], short: GROUP_SHORT[g], value: median, code: b.code });
  }
  const def = classGroup(mainCode);
  const defaultGroup = options.some((o) => o.group === def) ? def : (options[0]?.group ?? "residential");
  return { options, defaultGroup };
}

// Convert the scan-area `classes` array into the same LandUse shape.
export function landUseFromClasses(classes?: { group?: string; label?: string; value?: number; code?: string }[]): LandUse[] {
  const order = ["agricultural", "residential", "commercial", "industrial"];
  return (classes || [])
    .map((c) => {
      const g = (c.group as Group) || classGroup(c.code);
      return { group: g, label: c.label || GROUP_LABEL[g] || "Other", short: GROUP_SHORT[g] || "—", value: Number(c.value) || 0, code: c.code || "" };
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

// province → website domain (cebu.zonalvalue.com). Best-effort slug.
export function provinceToDomain(province?: string | null): string {
  const slug = String(province || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "").trim();
  return (slug || "cebu") + ".zonalvalue.com";
}
