import { StyleSheet, Text, View } from "react-native";

import type { Hazard } from "@/lib/hazards";
import { useTheme } from "@/theme/theme";
import { Z } from "@/theme/zonal";

// Soft tinted background per severity colour. Keyed by the static `Z` hazard
// hexes because `h.color` always comes from the (static) hazard data layer.
const SOFT: Record<string, string> = {
  [Z.safe]: "#e7f6ee",
  [Z.amber]: "#fbf1d8",
  [Z.orange]: "#fdeadd",
  [Z.red]: "#fde7e7",
  [Z.slate]: "#eef1f5",
};

/** Compact, colour-coded hazard pills. Auto-darkens in night mode (or pass `dark`). */
export function HazardChips({ hazards, keys, dark }: { hazards: Hazard[]; keys?: string[]; dark?: boolean }) {
  const { c, isDark } = useTheme();
  const night = dark ?? isDark;
  const list = keys
    ? (keys.map((k) => hazards.find((h) => h.key === k)).filter(Boolean) as Hazard[])
    : hazards;
  return (
    <View style={s.row}>
      {list.map((h) => (
        <View key={h.key} style={[s.pill, { backgroundColor: night ? "rgba(255,255,255,0.07)" : SOFT[h.color] || "#eef1f5" }]}>
          <View style={[s.dot, { backgroundColor: h.color }]} />
          <Text style={[s.name, { color: night ? "#cdd8f4" : c.inkSoft }]}>
            {h.name} <Text style={{ color: h.color, fontWeight: "800" }}>{h.text}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  name: { fontSize: 10.5, fontWeight: "700" },
});
