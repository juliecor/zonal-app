import { StyleSheet, Text, View } from "react-native";

import { classGroup } from "@/lib/landuse";
import { Z } from "@/theme/zonal";

export function ClassChip({ code, size = "md" }: { code?: string | null; size?: "sm" | "md" }) {
  const g = classGroup(code);
  const tone =
    g === "agricultural" ? { bg: "#eef7ee", fg: Z.safe, bd: "#cfe6cf" }
    : { bg: Z.white, fg: Z.navy, bd: Z.line };
  const label = String(code || "—").toUpperCase();
  return (
    <View style={[st.chip, { backgroundColor: tone.bg, borderColor: tone.bd }, size === "sm" && st.smChip]}>
      <Text style={[st.t, { color: tone.fg }, size === "sm" && st.smT]}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  smChip: { paddingHorizontal: 7, paddingVertical: 2 },
  t: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  smT: { fontSize: 9 },
});
