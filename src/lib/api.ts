// Live data layer for the zonalvalue.ph app.
// Two origins:
//   API_BASE  — Laravel backend (direct): facets + nearest-value lookup. Public, free.
//   WEB_BASE  — Next.js endpoints: scan-area, map pins, search, AI assistant. Public.
// Everything used here is callable WITHOUT login (peso values via geocode-nearest are free).

import { provinceToDomain } from "./landuse";

export const API_BASE = "https://apizonal.leuteriorealty.com/api";
export const WEB_BASE = "https://zonalvalue.ph/api";
const MAPS_KEY = process.env.EXPO_PUBLIC_MAPS_KEY || "";

async function getJSON(base: string, path: string, ms = 9000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function postJSON(base: string, path: string, body: any, ms = 20000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* ───────────────────────── Facets (browse coverage) ───────────────────────── */

export async function getCities(province: string): Promise<string[]> {
  const j = await getJSON(API_BASE, `/facets/cities?province=${encodeURIComponent(province)}`);
  return Array.isArray(j?.cities) ? j.cities : [];
}

export async function getBarangays(province: string, city: string): Promise<string[]> {
  const j = await getJSON(API_BASE, `/facets/barangays?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`);
  return Array.isArray(j?.barangays) ? j.barangays : [];
}

/** Every province that has zonal data (from the DB's authoritative city/province index). */
export async function getProvinces(): Promise<string[]> {
  try {
    const j = await getJSON(API_BASE, `/facets/city-province-index`);
    const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
    const set = new Set<string>();
    for (const p of pairs) {
      const prov = Array.isArray(p) ? p[0] : p?.province;
      if (prov) set.add(String(prov).trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function getClassifications(province: string, city?: string, barangay?: string): Promise<string[]> {
  const p = new URLSearchParams({ province });
  if (city) p.set("city", city);
  if (barangay) p.set("barangay", barangay);
  try {
    const j = await getJSON(API_BASE, `/facets/classifications?${p.toString()}`);
    return Array.isArray(j?.classifications) ? j.classifications : [];
  } catch {
    return [];
  }
}

/* ───────────────────────── Zonal records search (auth) ───────────────────────── */

export interface ZonalRecord {
  id: number; street_location?: string; vicinity?: string;
  barangay?: string; city_municipality?: string; province?: string;
  classification_code?: string; value_per_sqm?: number;
}
export interface ZonalPage { data: ZonalRecord[]; total: number; current_page: number; last_page: number; per_page: number }

/** Street-by-street BIR records (requires a signed-in token; deducts 1 credit, admins unlimited). */
export async function getZonalValues(
  token: string,
  f: { province?: string; city?: string; barangay?: string; classification_code?: string; q?: string; page?: number; per_page?: number },
): Promise<ZonalPage> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const res = await fetch(`${API_BASE}/zonal-values?${p.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 402) throw new Error("OUT_OF_CREDITS");
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const j = await res.json();
  return {
    data: Array.isArray(j?.data) ? j.data : [],
    total: j?.total ?? 0,
    current_page: j?.current_page ?? 1,
    last_page: j?.last_page ?? 1,
    per_page: j?.per_page ?? 16,
  };
}

export const PROVINCES = [
  "CEBU", "BOHOL", "ILOILO", "NEGROS OCCIDENTAL", "NEGROS ORIENTAL",
  "DAVAO DEL SUR", "DAVAO CITY", "NCR", "CAVITE", "LAGUNA",
  "BATANGAS", "RIZAL", "PAMPANGA", "PANGASINAN", "PALAWAN",
];

/* ───────────────────────── Zonal points ───────────────────────── */

export interface ZPoint {
  lat: number; lon: number;
  value_per_sqm: number;
  classification_code: string;
  street?: string; barangay?: string; city?: string; province?: string;
  distance_m?: number;
}

export interface ValueLookup {
  found: boolean;
  lat: number; lon: number;
  value_per_sqm: number | null;
  classification_code: string | null;
  street?: string; barangay?: string; city?: string; province?: string;
  label?: string; distance_m?: number;
  nearby: ZPoint[];
}

/** Nearest zonal value to a lat/lon (Laravel, public, free). Also returns nearby points. */
export async function nearestValue(lat: number, lon: number, radius = 2500): Promise<ValueLookup> {
  const j = await getJSON(API_BASE, `/geocode-nearest?lat=${lat}&lon=${lon}&radius=${radius}`);
  const merged: ZPoint[] = [];
  const seen = new Set<string>();
  for (const arr of [j?.points, j?.others]) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      const k = `${p.lat},${p.lon},${p.value_per_sqm},${p.classification_code}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(p);
    }
  }
  return {
    found: !!j?.found,
    lat: Number(j?.lat ?? lat),
    lon: Number(j?.lon ?? lon),
    value_per_sqm: j?.value_per_sqm ?? null,
    classification_code: j?.classification_code ?? null,
    street: j?.street, barangay: j?.barangay, city: j?.city, province: j?.province,
    label: j?.label, distance_m: j?.distance_m,
    nearby: merged,
  };
}

export interface Bounds { minLat: number; maxLat: number; minLon: number; maxLon: number }

/** Cached zonal value pins inside a map viewport (for the price-tag markers). */
export async function pinsInBounds(b: Bounds, limit = 300): Promise<ZPoint[]> {
  const q = `?minLat=${b.minLat}&maxLat=${b.maxLat}&minLon=${b.minLon}&maxLon=${b.maxLon}&limit=${limit}`;
  const j = await getJSON(WEB_BASE, `/zonal-in-bounds${q}`);
  return Array.isArray(j?.points) ? j.points : [];
}

/* ───────────────────────── Area scan ───────────────────────── */

export interface ScanClass { group: string; label: string; value: number; code: string }
export interface ScanResult {
  ok: boolean;
  building?: boolean;
  noData?: boolean;
  cityTypical?: boolean;
  matchType?: string;
  classes?: ScanClass[];
  defaultGroup?: string;
  counts?: Record<string, number>;
  nearby?: { street?: string; barangay?: string; city?: string; province?: string; classification_code?: string; value_per_sqm?: number }[];
  points?: ZPoint[];
  scannedCity?: string;
  scannedBarangay?: string;
}

/** Scan a map box for zonal values (Next.js, public). domain like "cebu.zonalvalue.com". */
export async function scanArea(b: Bounds, domain: string, mode: "scan" | "" = "scan"): Promise<ScanResult> {
  return postJSON(WEB_BASE, `/scan-area`, { ...b, domain, mode });
}

/* ───────────────────────── Search ───────────────────────── */

export interface Suggestion { description: string; main: string; secondary: string; placeId: string }

export async function placesAutocomplete(q: string, lat?: number, lon?: number): Promise<Suggestion[]> {
  let url = `/places-autocomplete?q=${encodeURIComponent(q)}`;
  if (lat != null && lon != null) url += `&lat=${lat}&lon=${lon}`;
  try {
    const j = await getJSON(WEB_BASE, url, 7000);
    return Array.isArray(j?.suggestions) ? j.suggestions : [];
  } catch {
    return [];
  }
}

export async function placeDetails(placeId: string): Promise<{ name: string; address: string; lat: number; lon: number } | null> {
  try {
    const j = await getJSON(WEB_BASE, `/place-details?placeId=${encodeURIComponent(placeId)}`);
    if (!j?.ok) return null;
    return { name: j.name, address: j.address, lat: Number(j.lat), lon: Number(j.lon) };
  } catch {
    return null;
  }
}

export interface CityMatch { city: string; province: string; domain: string; type: string }
export async function citySearch(q: string): Promise<CityMatch[]> {
  try {
    const j = await getJSON(WEB_BASE, `/city-search?q=${encodeURIComponent(q)}`);
    return Array.isArray(j?.matches) ? j.matches : [];
  } catch {
    return [];
  }
}

/* ── Which province subdomain a point belongs to (so scan-area hits the right DB) ── */

const domainCache = new Map<string, string>();

export async function reverseGeocode(lat: number, lon: number): Promise<{ city?: string; province?: string }> {
  if (!MAPS_KEY) return {};
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&region=ph&key=${MAPS_KEY}`);
    const j = await r.json();
    const comps: any[] = j?.results?.[0]?.address_components || [];
    let city: string | undefined;
    let province: string | undefined;
    for (const c of comps) {
      const t: string[] = c.types || [];
      if (t.includes("locality")) city = c.long_name;
      else if (!city && t.includes("administrative_area_level_3")) city = c.long_name;
      if (t.includes("administrative_area_level_2")) province = c.long_name;
    }
    return { city, province };
  } catch {
    return {};
  }
}

/** Resolve the zonalvalue.com province subdomain for a lat/lon, cached per ~1km cell.
 *  Key-safe: prefers a hint city (from the nearest cached point) → city-search, so it
 *  works even when a referrer-restricted Maps key blocks the REST geocoder. */
export async function resolveDomain(lat: number, lon: number, hintCity?: string, hintProvince?: string): Promise<string> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = domainCache.get(key);
  if (cached) return cached;
  let domain = "";
  if (hintCity) {
    const matches = await citySearch(hintCity);
    if (matches.length) domain = matches[0].domain;
  }
  if (!domain && !hintCity && !hintProvince) {
    // no nearby data to hint with — try the (possibly key-limited) REST geocoder
    const { city, province } = await reverseGeocode(lat, lon);
    if (city) {
      const matches = await citySearch(city);
      if (matches.length) domain = matches[0].domain;
    }
    if (!domain && province) domain = provinceToDomain(province);
  }
  if (!domain && hintProvince) domain = provinceToDomain(hintProvince);
  if (!domain) domain = "cebu.zonalvalue.com";
  domainCache.set(key, domain);
  return domain;
}

/* ───────────────────────── Auth (login / register / me) ───────────────────────── */

export interface AuthUser {
  id: number; name: string; email: string; role?: string; token_balance?: number;
  first_name?: string; middle_name?: string; last_name?: string; phone?: string;
}
export interface AuthResponse { user: AuthUser; token: string }
export type RegisterPayload = {
  first_name: string; middle_name?: string; last_name: string;
  phone?: string; email: string; password: string; password_confirmation: string;
};
export type RegisterResult = AuthResponse | { pending_verification: true; user_id: number; email: string; resend_cooldown?: number };

async function authPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  let j: any = null;
  try { j = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const firstErr = j?.errors ? (Object.values(j.errors)[0] as any)?.[0] : undefined;
    throw new Error(j?.message || firstErr || `Request failed (${res.status})`);
  }
  return j;
}

export function authLogin(email: string, password: string): Promise<AuthResponse> {
  return authPost("/login", { email, password });
}
export function authRegister(payload: RegisterPayload): Promise<RegisterResult> {
  return authPost("/register", payload);
}
export function authVerifyOtp(user_id: number, code: string): Promise<AuthResponse> {
  return authPost("/otp/verify", { user_id, code });
}
export function authResendOtp(user_id: number): Promise<any> {
  return authPost("/otp/resend", { user_id });
}
// Passwordless login by email code.
export function authRequestLoginOtp(email: string): Promise<{ user_id: number; resend_cooldown?: number }> {
  return authPost("/login/otp/request", { email });
}
export function authVerifyLoginOtp(user_id: number, code: string): Promise<AuthResponse> {
  return authPost("/login/otp/verify", { user_id, code });
}
export async function authMe(token: string): Promise<AuthUser | null> {
  try {
    const r = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
export async function authLogout(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch { /* ignore */ }
}

/* ───────────────────────── AI assistant ───────────────────────── */

export interface ChatMsg { role: "user" | "assistant"; content: string }
export interface AssistantReply { meta: any; answer: string }

/** Ask the AI assistant. The endpoint streams; we read the whole body, then split
 *  the first line (JSON metadata) from the answer text. */
export async function askAssistant(
  question: string,
  opts: { domain?: string; history?: ChatMsg[]; context?: any } = {},
): Promise<AssistantReply> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${WEB_BASE}/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/plain" },
      body: JSON.stringify({
        question,
        domain: opts.domain ?? "cebu.zonalvalue.com",
        history: (opts.history ?? []).slice(-12),
        context: opts.context ?? null,
      }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    const nl = text.indexOf("\n");
    if (nl >= 0) {
      const first = text.slice(0, nl);
      try {
        const meta = JSON.parse(first);
        return { meta, answer: text.slice(nl + 1).trim() || "" };
      } catch {
        /* not JSON metadata — fall through */
      }
    }
    return { meta: null, answer: text.trim() };
  } finally {
    clearTimeout(t);
  }
}
