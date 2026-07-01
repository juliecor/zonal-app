import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LandUse } from "@/lib/landuse";
import { useTheme, type Palette } from "@/theme/theme";
import { pesoK, SERIF } from "@/theme/zonal";

/** AGRI / RESID / COMM segmented switch — tap to change the displayed value. */
export function LandUseToggle({
  options, selected, onSelect,
}: { options: LandUse[]; selected: string; onSelect: (group: string) => void }) {
  const { c } = useTheme();
  const l = useMemo(() => makeStyles(c), [c]);
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
    h: { fontSize: 8.5, letterSpacing: 1.4, color: c.slate, fontWeight: "800", marginBottom: 7 },
    row: { flexDirection: "row", gap: 6 },
    lu: { flex: 1, borderRadius: 11, borderWidth: 1.4, borderColor: c.line, backgroundColor: c.card, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center" },
    on: { borderColor: c.gold, backgroundColor: c.isDark ? "rgba(21,94,239,0.14)" : "#e8f0ff" },
    k: { fontSize: 9, fontWeight: "800", color: c.slate, letterSpacing: 0.3 },
    kOn: { color: c.isDark ? c.goldLite : c.navy },
    p: { fontFamily: SERIF, fontSize: 13, fontWeight: "700", color: c.ink, marginTop: 2 },
  });
}
