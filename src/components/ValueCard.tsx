import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { useTheme, type Palette } from "@/theme/theme";
import { peso, SERIF } from "@/theme/zonal";

/** The gold hero card showing the zonal value of the land, with a slow shimmer. */
export function ValueCard({
  label = "Zonal value of this land", value, appliesTo,
}: { label?: string; value: number | null; appliesTo?: string }) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 2800, delay: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => { loop.stop(); x.setValue(0); };
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-280, 360] });
  const num = value != null ? peso(value).replace("₱", "") : "—";

  return (
    <View style={s.card}>
      <View style={s.rail} />
      <Animated.View pointerEvents="none" style={[s.shine, { transform: [{ translateX }, { rotate: "18deg" }] }]} />
      <View style={s.in}>
        <View style={s.lblRow}>
          <View style={s.dot} />
          <Text style={s.lbl}>{label.toUpperCase()}</Text>
        </View>
        <View style={s.vRow}>
          <Text style={s.cur}>₱</Text>
          <Text style={s.num}>{num}</Text>
          <Text style={s.per}>/sqm</Text>
        </View>
        {!!appliesTo && <Text style={s.applies}>{appliesTo}</Text>}
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: { borderRadius: 16, overflow: "hidden", backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.isDark ? c.line : "#ece3cf" },
    rail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: c.gold },
    shine: { position: "absolute", top: -40, bottom: -40, width: 60, backgroundColor: "rgba(216,189,99,0.28)" },
    in: { paddingVertical: 14, paddingRight: 16, paddingLeft: 19 },
    lblRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.gold },
    lbl: { fontSize: 8.5, letterSpacing: 1.4, color: c.isDark ? c.goldLite : c.navy, fontWeight: "800" },
    vRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 7 },
    cur: { fontFamily: SERIF, fontSize: 20, fontWeight: "600", color: c.isDark ? c.goldLite : c.navy, marginBottom: 4 },
    num: { fontFamily: SERIF, fontSize: 36, fontWeight: "700", color: c.ink, letterSpacing: -0.5, lineHeight: 38 },
    per: { fontSize: 11, color: c.slate, fontWeight: "600", marginBottom: 5 },
    applies: { fontSize: 10.5, color: c.slate, marginTop: 6 },
  });
}
