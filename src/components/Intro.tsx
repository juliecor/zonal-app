import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";

import { Logo } from "@/components/Logo";
import { PH_PATH, PH_RATIO, PH_TRANSFORM, PH_VIEWBOX } from "@/lib/phMap";
import { SERIF, Z } from "@/theme/zonal";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Total stroke length of PH_PATH in potrace units (measured; ~80,638). A hair over
// so the coastline draws fully. strokeDasharray lives in the path's own coords —
// i.e. BEFORE the <G scale(0.1)> — so it must be in potrace units, not viewBox px.
const INK_LEN = 84000;

// Value pins as fractions of the (tight) map box (fx → right, fy → down). Positions
// were derived from the real geometry so each sits on land, spread across the country.
const PINS = [
  { fx: 0.45, fy: 0.15, label: "₱15k" }, // Northern Luzon
  { fx: 0.52, fy: 0.28, label: "₱88k" }, // Metro Manila
  { fx: 0.67, fy: 0.40, label: "₱11k" }, // Bicol
  { fx: 0.28, fy: 0.54, label: "₱8k" },  // Palawan
  { fx: 0.60, fy: 0.62, label: "₱47k" }, // Cebu / Visayas
  { fx: 0.65, fy: 0.76, label: "₱14k" }, // Northern Mindanao
  { fx: 0.78, fy: 0.86, label: "₱22k" }, // Davao
];

// One value pin that floats up over the map, staggered by its index.
function Pin({ label, left, top, delay }: { label: string; left: number; top: number; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: 460, easing: Easing.out(Easing.back(1.7)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 7 }, { scale: 0.55 + 0.45 * v.value }],
  }));
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
  const { width, height } = useWindowDimensions();
  const mapW = Math.min(width * 0.82, 360);
  const mapH = mapW * PH_RATIO;

  const mapOpacity = useSharedValue(0);
  const mapScale = useSharedValue(1.14);
  const mapTilt = useSharedValue(52);    // camera laid back, then levels
  const ink = useSharedValue(INK_LEN);   // strokeDashoffset → 0 draws the coastline
  const fill = useSharedValue(0);         // gold fill fades in behind the ink
  const brandO = useSharedValue(0), brandY = useSharedValue(16);
  const root = useSharedValue(1);
  const [k, setK] = useState<number | null>(null); // motion factor (reduce-motion → 0.5); gates the pins

  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; onDone(); } };

  useEffect(() => {
    let cancelled = false;
    const E = Easing.out(Easing.cubic);

    const run = (kk: number) => {
      mapOpacity.value = withTiming(1, { duration: 260 * kk });
      // the coastline inks itself in, north → south, island by island
      ink.value = withDelay(160 * kk, withTiming(0, { duration: 2300 * kk, easing: Easing.inOut(Easing.quad) }));
      // gold fills in behind the advancing ink
      fill.value = withDelay(820 * kk, withTiming(1, { duration: 1700 * kk, easing: Easing.out(Easing.quad) }));
      // camera lays back, then levels as the map draws
      mapScale.value = withTiming(1, { duration: 3000 * kk, easing: E });
      mapTilt.value = withDelay(220 * kk, withTiming(6, { duration: 2700 * kk, easing: E }));
      brandO.value = withDelay(2800 * kk, withTiming(1, { duration: 650 }));
      brandY.value = withDelay(2800 * kk, withTiming(0, { duration: 650, easing: E }));
      root.value = withDelay(4650 * kk, withTiming(0, { duration: 520 }, (fin) => { if (fin) runOnJS(finish)(); }));
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => { if (!cancelled) { const kk = reduce ? 0.5 : 1; setK(kk); run(kk); } })
      .catch(() => { setK(1); run(1); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const mapStyle = useAnimatedStyle(() => ({
    opacity: mapOpacity.value,
    transform: [{ perspective: 720 }, { rotateX: `${mapTilt.value}deg` }, { scale: mapScale.value }],
  }));
  const inkProps = useAnimatedProps(() => ({ strokeDashoffset: ink.value }));
  const fillProps = useAnimatedProps(() => ({ fillOpacity: fill.value }));
  const brandStyle = useAnimatedStyle(() => ({ opacity: brandO.value, transform: [{ translateY: brandY.value }] }));

  const step = 34;
  const vLines: number[] = []; const hLines: number[] = [];
  for (let x = step; x < width; x += step) vLines.push(x);
  for (let y = step; y < height; y += step) hLines.push(y);

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="introbg" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#1d3066" /><Stop offset="0.55" stopColor="#16264f" /><Stop offset="1" stopColor="#0f1c3c" />
          </LinearGradient>
          <RadialGradient id="introglow" cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor="#d9b85a" stopOpacity="0.34" /><Stop offset="0.6" stopColor="#c9a84c" stopOpacity="0.1" /><Stop offset="1" stopColor="#c9a84c" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#introbg)" />
        {vLines.map((x) => <Path key={`v${x}`} d={`M${x} 0 V${height}`} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />)}
        {hLines.map((y) => <Path key={`h${y}`} d={`M0 ${y} H${width}`} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />)}
        <Rect x="0" y="0" width={width} height={height} fill="url(#introglow)" />
      </Svg>

      <View style={styles.center}>
        <Animated.View style={[{ width: mapW, height: mapH }, mapStyle]}>
          <Svg width={mapW} height={mapH} viewBox={PH_VIEWBOX}>
            <Defs>
              <LinearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#f3e2a6" /><Stop offset="0.5" stopColor="#e6c976" /><Stop offset="1" stopColor="#b8902f" />
              </LinearGradient>
              <LinearGradient id="igink" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#fff7e2" /><Stop offset="1" stopColor="#e6c976" />
              </LinearGradient>
            </Defs>
            <G transform={PH_TRANSFORM}>
              {/* gold land, fading in behind the advancing coastline */}
              <AnimatedPath d={PH_PATH} fill="url(#ig)" animatedProps={fillProps} />
              {/* soft underglow that draws with the ink */}
              <AnimatedPath
                d={PH_PATH} fill="none" stroke="#e6c976" strokeOpacity={0.4} strokeWidth={120}
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={[INK_LEN, INK_LEN]} animatedProps={inkProps}
              />
              {/* the bright ink line tracing the archipelago */}
              <AnimatedPath
                d={PH_PATH} fill="none" stroke="url(#igink)" strokeWidth={42}
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={[INK_LEN, INK_LEN]} animatedProps={inkProps}
              />
            </G>
          </Svg>

          {k != null && PINS.map((p, i) => (
            <Pin key={i} label={p.label} left={p.fx * mapW - 42} top={p.fy * mapH - 44} delay={(2300 + i * 170) * k} />
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.brand, brandStyle]}>
        <Logo size={56} />
        <Text style={styles.word}>zonalvalue<Text style={{ color: Z.goldLite }}>.</Text>ph</Text>
        <Text style={styles.by}>BY FILIPINO HOMES</Text>
      </Animated.View>

      <Pressable style={StyleSheet.absoluteFill} onPress={finish} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0f1c3c", alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  pinWrap: { position: "absolute", width: 84, alignItems: "center" },
  pinCard: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fffdf7", borderRadius: 11,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.5)", paddingLeft: 8, paddingRight: 11, paddingVertical: 5,
    shadowColor: "#0a1024", shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 9,
  },
  pinDot: { width: 11, height: 11, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(201,168,76,0.28)" },
  pinDotCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: Z.goldDeep },
  pinT: { color: Z.navy, fontWeight: "800", fontSize: 14, fontFamily: SERIF },
  pinTail: { width: 12, height: 12, marginTop: -7, backgroundColor: "#fffdf7", borderRightWidth: 1, borderBottomWidth: 1, borderColor: "rgba(201,168,76,0.5)", transform: [{ rotate: "45deg" }] },
  brand: { position: "absolute", left: 0, right: 0, bottom: 76, alignItems: "center" },
  word: { color: "#fff", fontSize: 23, fontWeight: "700", letterSpacing: -0.4, marginTop: 14, fontFamily: SERIF },
  by: { color: "#9fb0d8", fontFamily: SERIF, fontSize: 11, letterSpacing: 2, marginTop: 5 },
});
