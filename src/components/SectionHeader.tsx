import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SERIF } from "@/theme/zonal";
import { useTheme, type Palette } from "@/theme/theme";

/** Gold-marked section title with optional subtitle + count pill. */
export function SectionHeader({
  title, subtitle, count,
}: { title: string; subtitle?: string; count?: string }) {
  const { c } = useTheme();
  const sh = useMemo(() => makeStyles(c), [c]);
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    left: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
    mark: { width: 4, height: 30, borderRadius: 3, backgroundColor: c.gold },
    title: { fontFamily: SERIF, fontSize: 16, fontWeight: "600", color: c.ink },
    sub: { fontSize: 10.5, color: c.slate, marginTop: 1 },
    pill: { backgroundColor: c.chip, borderWidth: 1, borderColor: c.line, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
    pillT: { fontSize: 10.5, color: c.isDark ? c.goldLite : c.navy, fontWeight: "700" },
  });
}
