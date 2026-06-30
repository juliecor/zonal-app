// Saved lots ("Market Comps") — agents star properties to revisit & compare.
import { makeListStore } from "./store";

export interface SavedLot {
  lat: number; lon: number;
  name: string; address: string;
  value: number | null; code: string | null;
  ts: number;
}

const sameSpot = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5;

export const savedStore = makeListStore<SavedLot>("zv_saved_lots", sameSpot, 60);
export const isSavedSpot = (lat: number, lon: number) => savedStore.has({ lat, lon } as SavedLot);
