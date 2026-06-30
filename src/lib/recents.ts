// Recent searches — the last few spots the agent looked up, for one-tap re-lookup.
import { makeListStore } from "./store";

export interface Recent {
  lat: number; lon: number;
  name: string; value: number | null; code: string | null;
  ts: number;
}

const sameSpot = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;

export const recentsStore = makeListStore<Recent>("zv_recents", sameSpot, 8);
