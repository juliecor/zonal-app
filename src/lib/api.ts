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

async function postJSON(base: string, path: string, body: any, ms = 20000, token?: string | null): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    // Forward the signed-in token as the authToken cookie so protected lookups work — the
    // website does this automatically via its login cookie. Without it, scan-area 401s and
    // the app silently falls back to the sparse coordinate cache (which only covers Cebu).
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers["Cookie"] = `authToken=${encodeURIComponent(token)}`;
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
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

/** Scan a map box for zonal values (Next.js). Pass the signed-in token so scan-area can read
 *  the FULL BIR database for ANY province — the same way the website's login cookie does. */
export async function scanArea(b: Bounds, domain: string, mode: "scan" | "" = "scan", token?: string | null): Promise<ScanResult> {
  return postJSON(WEB_BASE, `/scan-area`, { ...b, domain, mode }, 20000, token);
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

export async function reverseGeocode(lat: number, lon: number): Promise<{ city?: string; province?: string; barangay?: string }> {
  if (!MAPS_KEY) return {};
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&region=ph&key=${MAPS_KEY}`);
    const j = await r.json();
    // Scan all results' components — the barangay may only appear in a less-specific result.
    const results: any[] = Array.isArray(j?.results) ? j.results : [];
    let city: string | undefined;
    let province: string | undefined;
    let barangay: string | undefined;
    for (const res of results) {
      for (const c of (res.address_components || [])) {
        const t: string[] = c.types || [];
        if (!city && t.includes("locality")) city = c.long_name;
        if (!province && t.includes("administrative_area_level_2")) province = c.long_name;
        // PH barangays surface as these (varies by area).
        if (!barangay && (t.includes("sublocality_level_1") || t.includes("administrative_area_level_4") || t.includes("administrative_area_level_5") || t.includes("neighborhood") || t.includes("sublocality"))) barangay = c.long_name;
      }
      if (city && barangay && province) break;
    }
    if (!city) { // some municipalities only report admin_area_level_3
      for (const res of results) for (const c of (res.address_components || [])) {
        if ((c.types || []).includes("administrative_area_level_3")) { city = c.long_name; break; }
      }
    }
    return { city, province, barangay };
  } catch {
    return {};
  }
}

/** The real-world barangay + city of a tapped point (geographic), with the nearest BIR
 *  record's values as fallback. Fixes wrong labels near city/barangay boundaries. */
export async function preciseAddress(
  lat: number, lon: number, fb: { barangay?: string | null; city?: string | null } = {},
): Promise<{ barangay?: string; city?: string }> {
  const geo = await reverseGeocode(lat, lon).catch(() => ({} as { city?: string; barangay?: string }));
  return {
    barangay: geo.barangay || fb.barangay || undefined,
    city: geo.city || fb.city || undefined,
  };
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
  avatar_url?: string | null; avatar_path?: string | null;
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

/* ──────────────────── Profile (edit name/phone + avatar) ──────────────────── */

export async function updateProfile(
  token: string,
  payload: { first_name?: string; middle_name?: string; last_name?: string; phone?: string },
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.message || `Couldn't save your profile (${res.status}).`);
  return j as AuthUser;
}

/** Upload a profile photo (multipart). Don't set Content-Type — fetch adds the boundary. */
export async function uploadAvatar(token: string, uri: string): Promise<{ avatar_url: string; avatar_path?: string; user?: AuthUser }> {
  const name = uri.split("/").pop() || "avatar.jpg";
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const form = new FormData();
  form.append("avatar", { uri, name, type } as any);
  const res = await fetch(`${API_BASE}/profile/avatar`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    body: form,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.message || `Couldn't upload your photo (${res.status}).`);
  return j;
}

export async function deleteAvatar(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/profile/avatar`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.message || `Couldn't remove your photo (${res.status}).`);
  return (j?.user ?? j) as AuthUser;
}

/* ──────────────────── Search-credit (token) requests ──────────────────── */

export interface TokenRequest {
  id: number;
  quantity: number;
  message: string | null;
  status: "pending" | "approved" | "denied";
  created_at?: string;
}

/** Ask an admin for more search credits (creates a pending request). */
export async function requestTokens(token: string, quantity: number, message?: string): Promise<TokenRequest> {
  const res = await fetch(`${API_BASE}/token-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quantity, message: message?.trim() || undefined }),
  });
  let j: any = null;
  try { j = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const firstErr = j?.errors ? (Object.values(j.errors)[0] as any)?.[0] : undefined;
    throw new Error(j?.message || firstErr || `Request failed (${res.status})`);
  }
  return j?.request ?? j;
}

/** The signed-in user's own credit requests (newest first). */
export async function myTokenRequests(token: string): Promise<TokenRequest[]> {
  try {
    const res = await fetch(`${API_BASE}/token-requests/mine`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

/* ── Admin: review credit requests (admin role only) ── */
export interface AdminTokenRequest extends TokenRequest {
  user_id: number;
  user?: { id: number; name?: string; email?: string; first_name?: string; last_name?: string };
}

export async function adminListTokenRequests(
  token: string, status: "pending" | "approved" | "denied" | "" = "pending",
): Promise<AdminTokenRequest[]> {
  try {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`${API_BASE}/admin/token-requests${qs}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

async function adminTokenAction(token: string, id: number, action: "approve" | "deny"): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/token-requests/${id}/${action}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let j: any = null; try { j = await res.json(); } catch { /* non-JSON */ }
    throw new Error(j?.message || `Failed to ${action} (${res.status})`);
  }
}
export const adminApproveTokenRequest = (token: string, id: number) => adminTokenAction(token, id, "approve");
export const adminDenyTokenRequest = (token: string, id: number) => adminTokenAction(token, id, "deny");

/* ───────────────────────── AI assistant ───────────────────────── */

export interface ChatMsg { role: "user" | "assistant"; content: string }
export interface AssistantReply { meta: any; answer: string }

// Steer the assistant: professional tone + answer short/partial questions helpfully,
// and act as a Philippine property COST/TAX analyst that can compute transaction figures.
const PRIMING: ChatMsg[] = [
  {
    role: "user",
    content:
      "Act as a professional Philippine real-estate due-diligence AND cost analyst for Filipino Homes (zonalvalue.ph). " +
      "Answer in clear, confident, client-ready language — concise and well-structured. " +
      "You can compute and explain Philippine property costs from the BIR zonal value and a lot area: " +
      "Estimated value = zonal ₱/sqm × area; Capital Gains Tax = 6% (seller); Documentary Stamp Tax = 1.5% (buyer); " +
      "local Transfer Tax = 0.5% province / up to 0.75% city (buyer); Registry of Deeds registration ≈ 0.25% (buyer); " +
      "Real Property Tax (amilyar) per year = assessed value × (1% province or 2% city) + 1% SEF, where assessed value = FMV × assessment level " +
      "(residential 20%, commercial/industrial 50%, agricultural 40%); and monthly loan amortization via the standard PMT formula " +
      "M = P·i·(1+i)^n / ((1+i)^n − 1), with i = annual rate/12 and n = years×12 (assume 20% down, ~6.5% p.a., 20-year term unless told otherwise). " +
      "Always compute taxes on the HIGHER of the selling price or the BIR zonal value. " +
      "If the message includes 'REFERENCE FIGURES' computed by the app, use those exact numbers; otherwise compute from the data given. " +
      "If a question is short, vague, or incomplete, infer the most likely intent and give your best helpful answer; " +
      "do not refuse or just ask for info unless truly impossible, then ask only ONE short clarifier. " +
      "When relevant, weave in the BIR zonal value, land-use classification, geohazard profile, and the cost breakdown; " +
      "note that transfer tax and RPT vary by LGU and that figures are estimates (advise consulting a licensed professional); end with a brief professional verdict.",
  },
  { role: "assistant", content: "Understood — I'll give concise, client-ready assessments and compute Philippine property costs (taxes, transfer fees, amilyar, monthly amortization) using the BIR zonal value, flagging LGU variations and that figures are estimates." },
];

/** Ask the AI assistant. The endpoint streams; we read the whole body, then split
 *  the first line (JSON metadata) from the answer text. */
export async function askAssistant(
  question: string,
  opts: { domain?: string; history?: ChatMsg[]; context?: any; token?: string | null } = {},
): Promise<AssistantReply> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    // Forward the signed-in token so the assistant can read protected zonal data
    // (the website does this via the authToken cookie). Without it the lookups 401.
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/plain" };
    if (opts.token) headers["Cookie"] = `authToken=${encodeURIComponent(opts.token)}`;
    const res = await fetch(`${WEB_BASE}/assistant`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        question,
        domain: opts.domain ?? "cebu.zonalvalue.com",
        history: [...PRIMING, ...(opts.history ?? []).slice(-10)],
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

/** Streaming version: shows the answer as the AI writes it (the server streams token-by-token).
 *  Calls onText(fullSoFar) on every chunk. Uses Expo's streaming fetch; throws if streaming
 *  isn't available so the caller can fall back to askAssistant(). */
export async function askAssistantStream(
  question: string,
  opts: { domain?: string; history?: ChatMsg[]; context?: any; token?: string | null },
  onText: (fullSoFar: string) => void,
): Promise<AssistantReply> {
  const { fetch: expoFetch } = await import("expo/fetch");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/plain" };
  if (opts.token) headers["Cookie"] = `authToken=${encodeURIComponent(opts.token)}`;
  const res = await expoFetch(`${WEB_BASE}/assistant`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      question,
      domain: opts.domain ?? "cebu.zonalvalue.com",
      history: [...PRIMING, ...(opts.history ?? []).slice(-10)],
      context: opts.context ?? null,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`assistant stream failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", nl = -1, meta: any = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    if (nl < 0) {
      nl = buf.indexOf("\n");
      if (nl >= 0) { try { meta = JSON.parse(buf.slice(0, nl)); } catch { meta = null; } }
    }
    if (nl >= 0) onText(buf.slice(nl + 1));
  }
  const answer = nl >= 0 ? buf.slice(nl + 1).trim() : buf.trim();
  return { meta, answer };
}
