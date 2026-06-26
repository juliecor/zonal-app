// Six-point geohazard read for a lat/lon, mirroring the website.
//   flood / landslide / storm-surge / fault  → REST endpoints (fast, public)
//   liquefaction / tsunami                    → GeoJSON vector layers (point-in-polygon)
// Overall risk = average of the available levels (0–3), shown on a /3.0 gauge.

import { Z } from "@/theme/zonal";

const WEB = "https://zonalvalue.ph";

export interface Hazard { key: string; name: string; level: number; text: string; color: string }
export interface HazardProfile {
  hazards: Hazard[];
  score: number;        // 0–3 average of assessed hazards
  checked: number;      // how many were assessable
  highCount: number;    // how many are elevated (level ≥ 2)
  riskLabel: string;    // Minimal / Low / Moderate / High
  riskColor: string;
}

function levelColor(level: number): string {
  if (level < 0) return Z.slate;
  if (level === 0) return Z.safe;
  if (level === 1) return Z.amber;
  if (level === 2) return Z.orange;
  return Z.red;
}
function levelWord(level: number): string {
  return (["None", "Low", "Moderate", "High"][Math.max(0, Math.min(3, level))]) ?? "—";
}

async function getAt(path: string, lat: number, lon: number, ms = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${WEB}/api/${path}?lat=${lat}&lon=${lon}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function restLevel(j: any): number {
  if (!j || j.found === false || j.inCoverage === false) return -1;
  const lv = Number(j.level);
  return isFinite(lv) ? lv : -1;
}

/* ── liquefaction + tsunami vector layers (cached per session) ── */
const geoCache: Record<string, any> = {};
async function loadGeo(name: string): Promise<any> {
  if (name in geoCache) return geoCache[name];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`${WEB}/hazard/${name}_vec.geojson`, { signal: ctrl.signal });
    const j = await r.json();
    geoCache[name] = j;
    return j;
  } catch {
    geoCache[name] = null;
    return null;
  } finally {
    clearTimeout(t);
  }
}

function rayIn(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const hit = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}
function polyHit(lat: number, lon: number, rings: number[][][]): boolean {
  if (!rings?.length || !rayIn(lon, lat, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (rayIn(lon, lat, rings[k])) return false; // holes
  return true;
}
function inGeo(lat: number, lon: number, fc: any): boolean {
  if (!fc?.features) return false;
  for (const f of fc.features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "Polygon" && polyHit(lat, lon, g.coordinates)) return true;
    if (g.type === "MultiPolygon") for (const poly of g.coordinates) if (polyHit(lat, lon, poly)) return true;
  }
  return false;
}
async function vecLevel(name: "liquefaction" | "tsunami", lat: number, lon: number, hitLevel: number): Promise<number> {
  const fc = await loadGeo(name);
  if (fc === null) return -1;
  return inGeo(lat, lon, fc) ? hitLevel : 0;
}

/** Full six-point hazard profile + overall risk for a point. */
export async function hazardsAt(lat: number, lon: number): Promise<HazardProfile> {
  const [flood, slide, surge, fault, liq, tsu] = await Promise.all([
    getAt("flood-at", lat, lon),
    getAt("landslide-at", lat, lon),
    getAt("stormsurge-at", lat, lon),
    getAt("fault-at", lat, lon),
    vecLevel("liquefaction", lat, lon, 3),
    vecLevel("tsunami", lat, lon, 2),
  ]);

  const hazards: Hazard[] = [];
  const add = (key: string, name: string, level: number, text?: string) =>
    hazards.push({ key, name, level, text: text ?? (level < 0 ? "—" : levelWord(level)), color: levelColor(level) });

  add("flood", "Flood", restLevel(flood));
  add("landslide", "Slide", restLevel(slide));
  add("surge", "Surge", restLevel(surge));

  // Fault shows distance, coloured by its level band.
  const fLevel = restLevel(fault);
  let faultText = "—";
  if (fault && fault.distance_m != null) {
    const d = Number(fault.distance_m);
    faultText = d >= 1000 ? (d / 1000).toFixed(1) + "km" : Math.round(d) + "m";
  } else if (fLevel >= 0) {
    faultText = levelWord(fLevel);
  }
  add("fault", "Fault", fLevel, faultText);

  add("liquefaction", "Liquef.", liq, liq < 0 ? "—" : liq >= 3 ? "High" : "None");
  add("tsunami", "Tsunami", tsu, tsu < 0 ? "—" : tsu >= 2 ? "Prone" : "None");

  const levels = hazards.map((h) => h.level).filter((l) => l >= 0);
  const score = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  const highCount = hazards.filter((h) => h.level >= 2).length;
  const riskLabel = score >= 2.3 ? "High" : score >= 1.3 ? "Moderate" : score >= 0.4 ? "Low" : "Minimal";
  const riskColor = score >= 2.3 ? Z.red : score >= 1.3 ? Z.orange : score >= 0.8 ? Z.amber : Z.safe;

  return { hazards, score, checked: levels.length, highCount, riskLabel, riskColor };
}
