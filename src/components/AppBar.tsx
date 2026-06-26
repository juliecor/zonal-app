import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { SERIF, Z } from "@/theme/zonal";

export function AppBar({
  title, subtitle, onBack, right,
}: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={s.bar}>
      <Pressable onPress={onBack ?? (() => router.back())} style={s.ic} hitSlop={10}>
        <Ionicons name="chevron-back" size={18} color={Z.white} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.sub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 9 },
  ic: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Z.navy },
  title: { fontFamily: SERIF, fontSize: 16, fontWeight: "600", color: Z.ink },
  sub: { fontSize: 10.5, color: Z.slate, marginTop: 1, fontWeight: "600" },
});
