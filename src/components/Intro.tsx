import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";

const WORDMARK = require("../../assets/images/zonalvalue-wordmark.png"); // full lockup (mark + "Zonal Value.ph")
const WORD_RATIO = 1793 / 488; // ≈ 3.67

// White, logo-forward entrance: the logo "draws in" left→right (wipe) while it fades + settles,
// then the whole thing fades out into the app. Tap to skip.
export function Intro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const wordW = Math.min(width * 0.84, 400);
  const wordH = wordW / WORD_RATIO;

  const grpO = useSharedValue(0);      // logo fade
  const grpS = useSharedValue(0.9);    // logo scale settle
  const reveal = useSharedValue(0);    // 0→1 left-to-right wipe (the "drawing")
  const byO = useSharedValue(0);       // "by Filipino Homes"
  const rootO = useSharedValue(1);     // whole-screen fade-out at the end

  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; onDone(); } };

  useEffect(() => {
    let cancelled = false;
    const run = (k: number) => {
      const E = Easing.out(Easing.cubic);
      grpO.value = withTiming(1, { duration: 380 * k });
      grpS.value = withTiming(1, { duration: 560 * k, easing: Easing.out(Easing.back(1.3)) });
      reveal.value = withDelay(140 * k, withTiming(1, { duration: 900 * k, easing: Easing.inOut(Easing.cubic) }));
      byO.value = withDelay(1000 * k, withTiming(1, { duration: 420 * k, easing: E }));
      rootO.value = withDelay((1500 + 700) * k, withTiming(0, { duration: 420 }, (fin) => { if (fin) runOnJS(finish)(); }));
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => { if (!cancelled) run(reduce ? 0.45 : 1); })
      .catch(() => run(1));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootO.value }));
  const grpStyle = useAnimatedStyle(() => ({ opacity: grpO.value, transform: [{ scale: grpS.value }] }));
  const clipStyle = useAnimatedStyle(() => ({ width: wordW * reveal.value }));
  const byStyle = useAnimatedStyle(() => ({ opacity: byO.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Animated.View style={grpStyle}>
        {/* left-aligned clip whose width grows → reveals the logo left→right ("drawing") */}
        <View style={{ width: wordW, height: wordH, overflow: "hidden", alignItems: "flex-start" }}>
          <Animated.View style={[{ height: wordH, overflow: "hidden" }, clipStyle]}>
            <Image source={WORDMARK} style={{ width: wordW, height: wordH }} contentFit="contain" />
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.Text style={[styles.by, byStyle]}>BY FILIPINO HOMES</Animated.Text>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  by: { marginTop: 20, color: "#64748B", fontSize: 11.5, letterSpacing: 3, fontWeight: "700" },
});
