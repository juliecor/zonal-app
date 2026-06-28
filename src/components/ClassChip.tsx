import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { classGroup } from "@/lib/landuse";
import { useTheme, type Palette } from "@/theme/theme";

export function ClassChip({ code, size = "md" }: { code?: string | null; size?: "sm" | "md" }) {
  const { c } = useTheme();
  const st = useMemo(() => makeStyles(c), [c]);
  const g = classGroup(code);
  const tone =
    g === "agricultural"
      ? { bg: c.isDark ? "rgba(34,197,94,0.14)" : "#eef7ee", fg: c.safe, bd: c.isDark ? "rgba(34,197,94,0.35)" : "#cfe6cf" }
      : { bg: c.card, fg: c.isDark ? c.goldLite : c.navy, bd: c.line };
  const label = String(code || "—").toUpperCase();
  return (
    <View style={[st.chip, { backgroundColor: tone.bg, borderColor: tone.bd }, size === "sm" && st.smChip]}>
      <Text style={[st.t, { color: tone.fg }, size === "sm" && st.smT]}>{label}</Text>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    chip: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
    smChip: { paddingHorizontal: 7, paddingVertical: 2 },
    t: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
    smT: { fontSize: 9 },
  });
}
