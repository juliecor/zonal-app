import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { useTheme, type Palette } from "@/theme/theme";

const MASCOT = require("../../assets/images/mascot-sad.png");
const MARK = require("../../assets/images/zv-mark.png");
const MASCOT_RATIO = 497 / 325; // h/w

const BLUE = "#155EEF", BLUE_DK = "#0f49c4";

/**
 * Full-screen "No Tokens Left" state — shown on the map when a client's search
 * credits run out. "Get More Tokens" opens the credit-request section.
 */
export function NoTokensScreen({
  balance = 0, onGetTokens, onViewPlans,
}: { balance?: number; onGetTokens: () => void; onViewPlans?: () => void }) {
  const { c, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);

  const mascotW = Math.min(width * 0.5, 210);
  const mascotH = mascotW * MASCOT_RATIO;
  const heroSize = Math.min(width * 0.72, 300);

  // gentle idle float so the mascot feels alive
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withSequence(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -8 }] }));

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={[s.hero, { width: heroSize, height: heroSize, borderRadius: heroSize / 2 }]}>
            <View style={s.mark}><Image source={MARK} style={{ width: 42, height: 42 }} contentFit="contain" /></View>
            <Animated.View style={bobStyle}>
              <Image source={MASCOT} style={{ width: mascotW, height: mascotH }} contentFit="contain" />
            </Animated.View>
          </View>

          <Text style={s.title}>No Tokens Left</Text>
          <Text style={s.sub}>You've used all your search credits. Get more tokens to keep checking zonal values and reports.</Text>

          <View style={s.pill}>
            <View style={s.coin}><Image source={MARK} style={{ width: 20, height: 20 }} contentFit="contain" /></View>
            <Text style={s.pillNum}>{Math.max(0, balance)}</Text>
            <Text style={s.pillLbl}>TOKENS{"\n"}LEFT</Text>
          </View>

          <Pressable onPress={onGetTokens} style={({ pressed }) => [s.primary, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={s.primaryT}>Get More Tokens</Text>
          </Pressable>

          <Pressable onPress={onViewPlans || onGetTokens} hitSlop={8} style={s.linkWrap}>
            <Text style={s.link}>View Token Plans</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(c: Palette) {
  const heroBg = c.isDark ? "rgba(21,94,239,0.12)" : "#e8f0ff";
  return StyleSheet.create({
    root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.isDark ? c.paper : "#f4f8ff", zIndex: 20 },
    scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 32 },

    hero: { backgroundColor: heroBg, alignItems: "center", justifyContent: "flex-end", overflow: "hidden", marginBottom: 6 },
    mark: {
      position: "absolute", top: "12%", width: 60, height: 60, borderRadius: 18, backgroundColor: c.isDark ? c.card : "#fff",
      alignItems: "center", justifyContent: "center",
      shadowColor: BLUE_DK, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },

    title: { fontSize: 30, fontWeight: "800", color: c.ink, letterSpacing: -0.5, marginTop: 14, textAlign: "center" },
    sub: { fontSize: 14.5, lineHeight: 21, color: c.slate, textAlign: "center", marginTop: 10, maxWidth: 340 },

    pill: {
      flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22,
      borderWidth: 1.5, borderStyle: "dashed", borderColor: c.isDark ? "rgba(21,94,239,0.5)" : "rgba(21,94,239,0.4)",
      borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: c.isDark ? "rgba(21,94,239,0.08)" : "#fff",
    },
    coin: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.isDark ? c.card : "#eef3ff",
      borderWidth: 1.5, borderColor: "rgba(21,94,239,0.35)", alignItems: "center", justifyContent: "center",
    },
    pillNum: { fontSize: 30, fontWeight: "900", color: c.ink, letterSpacing: -1 },
    pillLbl: { fontSize: 10.5, fontWeight: "800", color: BLUE, letterSpacing: 1, lineHeight: 13 },

    primary: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
      backgroundColor: BLUE, borderRadius: 15, paddingVertical: 16, paddingHorizontal: 30, marginTop: 30, alignSelf: "stretch",
      shadowColor: BLUE_DK, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 8,
    },
    primaryT: { color: "#fff", fontSize: 16.5, fontWeight: "800" },

    linkWrap: { marginTop: 18, paddingVertical: 4 },
    link: { color: BLUE, fontSize: 14.5, fontWeight: "700" },
  });
}
