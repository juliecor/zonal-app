import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { peso, SERIF, Z } from "@/theme/zonal";
import { ClassChip } from "./ClassChip";

/** A nearby/scan parcel row: value, classification, location, fly arrow. */
export function ParcelCard({
  value, code, line, meta, onPress,
}: { value: number; code?: string | null; line: string; meta?: string; onPress?: () => void }) {
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
        <View style={p.fly}><Ionicons name="arrow-forward" size={14} color={Z.navy} /></View>
      )}
    </Pressable>
  );
}

const p = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 13 },
  pressed: { borderColor: "#c3ccef", backgroundColor: "#fbfcff" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pr: { fontFamily: SERIF, fontSize: 16, fontWeight: "700", color: Z.ink },
  per: { fontFamily: "System", fontSize: 9, color: Z.slate, fontWeight: "600" },
  line: { fontSize: 11.5, color: Z.inkSoft, marginTop: 4, fontWeight: "500" },
  meta: { fontSize: 10, color: Z.slate, marginTop: 2 },
  fly: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#eef1fa" },
});
