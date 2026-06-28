import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, type Palette } from "@/theme/theme";
import { peso, SERIF } from "@/theme/zonal";
import { ClassChip } from "./ClassChip";

/** A nearby/scan parcel row: value, classification, location, fly arrow. */
export function ParcelCard({
  value, code, line, meta, onPress,
}: { value: number; code?: string | null; line: string; meta?: string; onPress?: () => void }) {
  const { c } = useTheme();
  const p = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [p.card, pressed && p.pressed]}>
      <View style={{ flex: 1 }}>
        <View style={p.top}>
          <Text style={p.pr}>{peso(value)} <Text style={p.per}>/sqm</Text></Text>
          {!!code && <ClassChip code={code} size="sm" />}
        </View>
        <Text style={p.line} numberOfLines={1}>{line}</Text>
        {!!meta && <Text style={p.meta}>{meta}</Text>}
      </View>
      {!!onPress && (
        <View style={p.fly}><Ionicons name="arrow-forward" size={14} color={c.isDark ? c.goldLite : c.navy} /></View>
      )}
    </Pressable>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 13 },
    pressed: { borderColor: c.isDark ? c.navy2 : "#c3ccef", backgroundColor: c.isDark ? c.paper2 : "#fbfcff" },
    top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    pr: { fontFamily: SERIF, fontSize: 16, fontWeight: "700", color: c.ink },
    per: { fontFamily: "System", fontSize: 9, color: c.slate, fontWeight: "600" },
    line: { fontSize: 11.5, color: c.inkSoft, marginTop: 4, fontWeight: "500" },
    meta: { fontSize: 10, color: c.slate, marginTop: 2 },
    fly: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.chip },
  });
}
