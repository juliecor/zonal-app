import * as SecureStore from "expo-secure-store";

// The agent's chosen broker's professional-fee rate (a % of price). It's negotiable, so we
// remember the agent's last choice and reuse it across the Costs card, PDF report and AI.
const BROKER_KEY = "zv_broker_pct";
export const DEFAULT_BROKER_PCT = 5;

export async function loadBrokerPct(): Promise<number> {
  try {
    const v = await SecureStore.getItemAsync(BROKER_KEY);
    if (v == null) return DEFAULT_BROKER_PCT;
    const n = parseFloat(v);
    return isFinite(n) && n >= 0 ? n : DEFAULT_BROKER_PCT;
  } catch {
    return DEFAULT_BROKER_PCT;
  }
}

export function saveBrokerPct(pct: number) {
  SecureStore.setItemAsync(BROKER_KEY, String(pct)).catch(() => {});
}
