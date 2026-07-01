import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";

import { PH_PATH, PH_RATIO, PH_TRANSFORM, PH_VIEWBOX } from "@/lib/phMap";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const WORDMARK = require("../../assets/images/zonalvalue-wordmark.png");
const MASCOT = require("../../assets/images/mascot-wave.png");
const WORD_RATIO = 1793 / 488;  // ≈ 3.67
const MASCOT_RATIO = 1165 / 839; // ≈ 1.39 (h/w)
const INK_LEN = 84000;          // total stroke length of PH_PATH (potrace units)

const BLUE = "#155EEF", BLUE_SOFT = "#bcd2fb", RED = "#E53935", NAVY = "#0f172a";

const PINS = [
  { fx: 0.45, fy: 0.15, label: "₱15k" },
  { fx: 0.52, fy: 0.28, label: "₱88k" },
  { fx: 0.67, fy: 0.40, label: "₱11k" },
  { fx: 0.28, fy: 0.54, label: "₱8k" },
  { fx: 0.60, fy: 0.62, label: "₱47k" },
  { fx: 0.65, fy: 0.76, label: "₱14k" },
  { fx: 0.78, fy: 0.86, label: "₱22k" },
];

function Pin({ label, left, top, delay }: { label: string; left: number; top: number; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: 440, easing: Easing.out(Easing.back(1.7)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 7 }, { scale: 0.6 + 0.4 * v.value }] }));
  return (
    <Animated.View style={[styles.pinWrap, { left, top }, style]}>
      <View style={styles.pinCard}>
        <View style={styles.pinDot}><View style={styles.pinDotCore} /></View>
        <Text style={styles.pinT}>{label}</Text>
      </View>
      <View style={styles.pinTail} />
    </Animated.View>
  );
}

export function Intro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const mapW = Math.min(width * 0.7, 290);
  const mapH = mapW * PH_RATIO;
  const mascotW = Math.min(width * 0.46, 200);
  const mascotH = mascotW * MASCOT_RATIO;
  const wordW = Math.min(width * 0.72, 320);
  const wordH = wordW / WORD_RATIO;

  const mapO = useSharedValue(0);       // map fade-in
  const ink = useSharedValue(INK_LEN);  // coastline draws (dashoffset → 0)
  const fill = useSharedValue(0);       // pale-blue land fills in
  const mapOut = useSharedValue(1);     // map + pins fade out before the mascot

  const masO = useSharedValue(0);       // mascot fade-in
  const masY = useSharedValue(34);      // mascot rises up
  const masS = useSharedValue(0.6);     // mascot pops in
  const wave = useSharedValue(0);       // mascot waves hello (rock)

  const grpO = useSharedValue(0);       // wordmark fade-in
  const reveal = useSharedValue(0);     // wordmark draws in left→right
  const rootO = useSharedValue(1);      // whole-screen fade to app

  const [k, setK] = useState<number | null>(null); // motion factor; gates the pins
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; onDone(); } };

  useEffect(() => {
    let cancelled = false;
    const E = Easing.out(Easing.cubic);
    const run = (kk: number) => {
      // 1) map inks in + fills, price pins float up
      mapO.value = withTiming(1, { duration: 240 * kk });
      ink.value = withDelay(120 * kk, withTiming(0, { duration: 1550 * kk, easing: Easing.inOut(Easing.quad) }));
      fill.value = withDelay(540 * kk, withTiming(1, { duration: 1050 * kk, easing: Easing.out(Easing.quad) }));
      // 2) map fades, the mascot pops in and waves
      mapOut.value = withDelay(2250 * kk, withTiming(0, { duration: 480 * kk, easing: E }));
      masO.value = withDelay(2320 * kk, withTiming(1, { duration: 380 * kk }));
      masY.value = withDelay(2320 * kk, withTiming(0, { duration: 600 * kk, easing: Easing.out(Easing.back(1.2)) }));
      masS.value = withDelay(2320 * kk, withTiming(1, { duration: 620 * kk, easing: Easing.out(Easing.back(1.4)) }));
      wave.value = withDelay(2900 * kk, withRepeat(
        withSequence(
          withTiming(1, { duration: 190 * kk, easing: E }),
          withTiming(-1, { duration: 380 * kk, easing: E }),
          withTiming(0, { duration: 190 * kk, easing: E }),
        ), 3, false));
      // 3) wordmark draws in below the mascot
      grpO.value = withDelay(2980 * kk, withTiming(1, { duration: 400 * kk }));
      reveal.value = withDelay(3060 * kk, withTiming(1, { duration: 760 * kk, easing: Easing.inOut(Easing.cubic) }));
      // 4) hand off to the app
      rootO.value = withDelay(4300 * kk, withTiming(0, { duration: 440 }, (fin) => { if (fin) runOnJS(finish)(); }));
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => { if (!cancelled) { const kk = reduce ? 0.5 : 1; setK(kk); run(kk); } })
      .catch(() => { setK(1); run(1); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootO.value }));
  const mapStyle = useAnimatedStyle(() => ({ opacity: mapO.value * mapOut.value }));
  const inkProps = useAnimatedProps(() => ({ strokeDashoffset: ink.value }));
  const fillProps = useAnimatedProps(() => ({ fillOpacity: fill.value }));
  const mascotStyle = useAnimatedStyle(() => ({ opacity: masO.value, transform: [{ translateY: masY.value }, { scale: masS.value }] }));
  const waveStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.value * 7}deg` }] }));
  const grpStyle = useAnimatedStyle(() => ({ opacity: grpO.value }));
  const clipStyle = useAnimatedStyle(() => ({ width: wordW * reveal.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      {/* PH map (brand blue) inking in on white, with floating value pins */}
      <Animated.View style={[styles.center, StyleSheet.absoluteFill, mapStyle]} pointerEvents="none">
        <View style={{ width: mapW, height: mapH }}>
          <Svg width={mapW} height={mapH} viewBox={PH_VIEWBOX}>
            <Defs>
              <LinearGradient id="iginkb" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#4d8bff" /><Stop offset="1" stopColor={BLUE} />
              </LinearGradient>
            </Defs>
            <G transform={PH_TRANSFORM}>
              <AnimatedPath d={PH_PATH} fill={BLUE_SOFT} animatedProps={fillProps} />
              <AnimatedPath
                d={PH_PATH} fill="none" stroke="url(#iginkb)" strokeWidth={44}
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={[INK_LEN, INK_LEN]} animatedProps={inkProps}
              />
            </G>
          </Svg>
          {k != null && PINS.map((p, i) => (
            <Pin key={i} label={p.label} left={p.fx * mapW - 42} top={p.fy * mapH - 44} delay={(1150 + i * 125) * k} />
          ))}
        </View>
      </Animated.View>

      {/* the mascot waves hello, then the wordmark forms, then hands off to the app */}
      <View style={styles.stack} pointerEvents="none">
        <Animated.View style={mascotStyle}>
          <Animated.View style={waveStyle}>
            <Image source={MASCOT} style={{ width: mascotW, height: mascotH }} contentFit="contain" />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[grpStyle, { marginTop: 14 }]}>
          <View style={{ width: wordW, height: wordH, overflow: "hidden", alignItems: "flex-start" }}>
            <Animated.View style={[{ height: wordH, overflow: "hidden" }, clipStyle]}>
              <Image source={WORDMARK} style={{ width: wordW, height: wordH }} contentFit="contain" />
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      <Pressable style={StyleSheet.absoluteFill} onPress={finish} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  stack: { alignItems: "center", justifyContent: "center" },
  pinWrap: { position: "absolute", width: 84, alignItems: "center" },
  pinCard: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 11,
    borderWidth: 1, borderColor: "rgba(21,94,239,0.28)", paddingLeft: 8, paddingRight: 11, paddingVertical: 5,
    // iOS shadow only — it fades with the parent's opacity. Android `elevation` is a native
    // shadow that does NOT fade with an animated ancestor opacity, so it lingers as a dark
    // outline after the map fades; leaving it off keeps the hand-off to the mascot clean.
    shadowColor: "#0a1024", shadowOpacity: 0.16, shadowRadius: 11, shadowOffset: { width: 0, height: 5 },
  },
  pinDot: { width: 11, height: 11, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(229,57,53,0.22)" },
  pinDotCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: RED },
  pinT: { color: NAVY, fontWeight: "800", fontSize: 13.5 },
  pinTail: { width: 12, height: 12, marginTop: -7, backgroundColor: "#fff", borderRightWidth: 1, borderBottomWidth: 1, borderColor: "rgba(21,94,239,0.28)", transform: [{ rotate: "45deg" }] },
});
