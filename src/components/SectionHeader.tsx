import { StyleSheet, Text, View } from "react-native";

import { SERIF, Z } from "@/theme/zonal";

/** Gold-marked section title with optional subtitle + count pill. */
export function SectionHeader({
  title, subtitle, count,
}: { title: string; subtitle?: string; count?: string }) {
  return (
    <View style={sh.row}>
      <View style={sh.left}>
        <View style={sh.mark} />
        <View style={{ flex: 1 }}>
          <Text style={sh.title}>{title}</Text>
          {!!subtitle && <Text style={sh.sub}>{subtitle}</Text>}
        </View>
      </View>
      {!!count && <View style={sh.pill}><Text style={sh.pillT}>{count}</Text></View>}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  left: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  mark: { width: 4, height: 30, borderRadius: 3, backgroundColor: Z.gold },
  title: { fontFamily: SERIF, fontSize: 16, fontWeight: "600", color: Z.ink },
  sub: { fontSize: 10.5, color: Z.slate, marginTop: 1 },
  pill: { backgroundColor: "#eef1fa", borderWidth: 1, borderColor: "#dde3f7", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  pillT: { fontSize: 10.5, color: Z.navy, fontWeight: "700" },
});
