// Talks to the live zonalvalue.ph backend (the same DB the website uses).
// The facets endpoints are public, so the app can browse coverage with no login.
// Peso values / hazards are login-gated — we'll add auth (Bearer token) next.

export const API_BASE = "https://apizonal.leuteriorealty.com/api";

async function getJSON(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** Cities / municipalities that have BIR zonal data in a province. */
export async function getCities(province: string): Promise<string[]> {
  const j = await getJSON(`/facets/cities?province=${encodeURIComponent(province)}`);
  return Array.isArray(j?.cities) ? j.cities : [];
}

/** Barangays with data in a given city. */
export async function getBarangays(province: string, city: string): Promise<string[]> {
  const j = await getJSON(`/facets/barangays?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`);
  return Array.isArray(j?.barangays) ? j.barangays : [];
}

// Provinces shown as quick chips on the home screen (the high-traffic ones first).
export const PROVINCES = [
  "CEBU", "BOHOL", "ILOILO", "NEGROS OCCIDENTAL", "NEGROS ORIENTAL",
  "DAVAO DEL SUR", "DAVAO CITY", "NCR", "CAVITE", "LAGUNA",
  "BATANGAS", "RIZAL", "PAMPANGA", "PANGASINAN", "PALAWAN",
];
