import { StyleSheet, Text, View } from "react-native";

import type { HazardProfile } from "@/lib/hazards";
import { SERIF, Z } from "@/theme/zonal";
import { RiskGauge } from "./RiskGauge";

/** The hazard card: overall risk gauge + 6-cell severity grid. */
export function HazardPanel({ profile }: { profile: HazardProfile }) {
  return (
    <View style={h.card}>
      <View style={h.top}>
        <RiskGauge score={profile.score} max={3} color={profile.riskColor} />
        <View style={{ flex: 1 }}>
          <Text style={h.eyebrow}>OVERALL RISK</Text>
          <Text style={[h.lvl, { color: profile.riskColor }]}>{profile.riskLabel}</Text>
          <Text style={h.meta}>{profile.checked} checked · {profile.highCount} high</Text>
        </View>
      </View>
      <View style={h.grid}>
        {profile.hazards.map((hz) => (
          <View key={hz.key} style={h.cell}>
            <Text style={h.k}>{hz.name}</Text>
            <Text style={[h.v, { color: hz.color }]}>{hz.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  card: { borderRadius: 16, backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, padding: 13 },
  top: { flexDirection: "row", alignItems: "center", gap: 13 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.3, color: Z.slate, fontWeight: "800" },
  lvl: { fontFamily: SERIF, fontSize: 18, fontWeight: "600", lineHeight: 21 },
  meta: { fontSize: 9.5, color: Z.slate, marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 12 },
  cell: { width: "31.6%", borderRadius: 9, backgroundColor: Z.paper2, paddingVertical: 7, alignItems: "center" },
  k: { fontSize: 8.5, fontWeight: "700", color: Z.inkSoft },
  v: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3, marginTop: 2, textTransform: "uppercase" },
});
