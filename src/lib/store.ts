// Tiny persistent list store over AsyncStorage with live subscriptions, plus a React hook.
// Used for Saved lots (Market Comps) and Recent searches — no backend, instant, offline.
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ListStore<T> {
  get: () => T[];
  has: (x: T) => boolean;
  add: (x: T) => void;       // newest-first, de-duped, capped
  toggle: (x: T) => void;    // add if absent, remove if present
  remove: (x: T) => void;
  clear: () => void;
  subscribe: (fn: () => void) => () => void;
}

export function makeListStore<T>(key: string, eq: (a: T, b: T) => boolean, cap = 50): ListStore<T> {
  let items: T[] = [];
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());
  const persist = () => { AsyncStorage.setItem(key, JSON.stringify(items)).catch(() => {}); };

  AsyncStorage.getItem(key)
    .then((raw) => { if (raw) { try { items = JSON.parse(raw); notify(); } catch { /* ignore */ } } })
    .catch(() => {});

  return {
    get: () => items,
    has: (x) => items.some((i) => eq(i, x)),
    add: (x) => { items = [x, ...items.filter((i) => !eq(i, x))].slice(0, cap); persist(); notify(); },
    toggle: (x) => {
      const i = items.findIndex((it) => eq(it, x));
      if (i >= 0) items = items.filter((_, j) => j !== i);
      else items = [x, ...items].slice(0, cap);
      persist(); notify();
    },
    remove: (x) => { items = items.filter((i) => !eq(i, x)); persist(); notify(); },
    clear: () => { items = []; persist(); notify(); },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}

/** Subscribe a component to a list store; re-renders on any change. */
export function useStore<T>(store: ListStore<T>): T[] {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);
  return store.get();
}
