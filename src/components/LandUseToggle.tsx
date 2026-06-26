import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LandUse } from "@/lib/landuse";
import { pesoK, SERIF, Z } from "@/theme/zonal";

/** AGRI / RESID / COMM segmented switch — tap to change the displayed value. */
export function LandUseToggle({
  options, selected, onSelect,
}: { options: LandUse[]; selected: string; onSelect: (group: string) => void }) {
  if (options.length < 2) return null;
  return (
    <View>
      <Text style={l.h}>LAND USE · TAP TO SWITCH</Text>
      <View style={l.row}>
        {options.map((o) => {
          const on = o.group === selected;
          return (
            <Pressable key={o.group} onPress={() => onSelect(o.group)} style={[l.lu, on && l.on]}>
              <Text style={[l.k, on && l.kOn]}>{o.short.toUpperCase()}</Text>
              <Text style={l.p}>{pesoK(o.value)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const l = StyleSheet.create({
  h: { fontSize: 8.5, letterSpacing: 1.4, color: Z.slate, fontWeight: "800", marginBottom: 7 },
  row: { flexDirection: "row", gap: 6 },
  lu: { flex: 1, borderRadius: 11, borderWidth: 1.4, borderColor: Z.line, backgroundColor: Z.white, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center" },
  on: { borderColor: Z.gold, backgroundColor: "#fbf2d8" },
  k: { fontSize: 9, fontWeight: "800", color: Z.slate, letterSpacing: 0.3 },
  kOn: { color: Z.navy },
  p: { fontFamily: SERIF, fontSize: 13, fontWeight: "700", color: Z.ink, marginTop: 2 },
});
