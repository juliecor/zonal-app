import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";

import { Logo } from "@/components/Logo";
import { PH_PATH, PH_RATIO, PH_TRANSFORM, PH_VIEWBOX } from "@/lib/phMap";
import { SERIF, Z } from "@/theme/zonal";

// Value pins, placed as fractions of the map box (fx → right, fy → down).
const PINS = [
  { fx: 0.50, fy: 0.28, label: "₱72k" }, // Luzon / Metro Manila
  { fx: 0.58, fy: 0.60, label: "₱47k" }, // Visayas / Cebu
  { fx: 0.70, fy: 0.86, label: "₱20k" }, // Mindanao / Davao
];

export function Intro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const mapW = Math.min(width * 0.72, 300);
  const mapH = mapW * PH_RATIO;

  const mapOpacity = useSharedValue(0);
  const mapScale = useSharedValue(1.14);
  const mapTilt = useSharedValue(18);
  const mapY = useSharedValue(18);
  const p0 = useSharedValue(0), p1 = useSharedValue(0), p2 = useSharedValue(0);
  const brandO = useSharedValue(0), brandY = useSharedValue(16);
  const root = useSharedValue(1);

  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; onDone(); } };

  useEffect(() => {
    let cancelled = false;
    const E = Easing.out(Easing.cubic);
    const pinE = Easing.out(Easing.back(1.7));
    const pinSV = [p0, p1, p2];

    const run = () => {
      mapOpacity.value = withTiming(1, { duration: 650 });
      mapScale.value = withTiming(1, { duration: 2050, easing: E });
      mapTilt.value = withTiming(0, { duration: 2050, easing: E });
      mapY.value = withTiming(0, { duration: 1800, easing: E });
      pinSV.forEach((sv, i) => { sv.value = withDelay(950 + i * 260, withTiming(1, { duration: 430, easing: pinE })); });
      brandO.value = withDelay(1550, withTiming(1, { duration: 700 }));
      brandY.value = withDelay(1550, withTiming(0, { duration: 700, easing: E }));
      root.value = withDelay(3050, withTiming(0, { duration: 480 }, (fin) => { if (fin) runOnJS(finish)(); }));
    };

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        mapOpacity.value = 1; mapScale.value = 1; mapTilt.value = 0; mapY.value = 0;
        p0.value = 1; p1.value = 1; p2.value = 1; brandO.value = 1; brandY.value = 0;
        setTimeout(finish, 1200);
      } else {
        run();
      }
    }).catch(run);

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const mapStyle = useAnimatedStyle(() => ({
    opacity: mapOpacity.value,
    transform: [{ perspective: 800 }, { translateY: mapY.value }, { rotateX: `${mapTilt.value}deg` }, { scale: mapScale.value }],
  }));
  const brandStyle = useAnimatedStyle(() => ({ opacity: brandO.value, transform: [{ translateY: brandY.value }] }));
  const pinStyle0 = useAnimatedStyle(() => ({ opacity: p0.value, transform: [{ scale: 0.5 + 0.5 * p0.value }] }));
  const pinStyle1 = useAnimatedStyle(() => ({ opacity: p1.value, transform: [{ scale: 0.5 + 0.5 * p1.value }] }));
  const pinStyle2 = useAnimatedStyle(() => ({ opacity: p2.value, transform: [{ scale: 0.5 + 0.5 * p2.value }] }));
  const pinStyles = [pinStyle0, pinStyle1, pinStyle2];

  // faint cartographic grid lines
  const step = 34;
  const vLines = []; const hLines = [];
  for (let x = step; x < width; x += step) vLines.push(x);
  for (let y = step; y < height; y += step) hLines.push(y);

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="introbg" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#101d3f" /><Stop offset="0.55" stopColor="#0b142b" /><Stop offset="1" stopColor="#070c1a" />
          </LinearGradient>
          <RadialGradient id="introglow" cx="50%" cy="44%" r="46%">
            <Stop offset="0" stopColor="#c9a84c" stopOpacity="0.22" /><Stop offset="1" stopColor="#c9a84c" stopOpacity="0" />
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
            </Defs>
            <G transform={PH_TRANSFORM} fill="url(#ig)">
              <Path d={PH_PATH} />
            </G>
          </Svg>

          {PINS.map((p, i) => (
            <Animated.View key={i} style={[styles.pin, { left: p.fx * mapW - 24, top: p.fy * mapH - 16 }, pinStyles[i]]}>
              <Text style={styles.pinT}>{p.label}</Text>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.brand, brandStyle]}>
          <Logo size={56} />
          <Text style={styles.word}>zonalvalue<Text style={{ color: Z.goldLite }}>.</Text>ph</Text>
          <Text style={styles.by}>BY FILIPINO HOMES</Text>
        </Animated.View>
      </View>

      <Pressable style={StyleSheet.absoluteFill} onPress={finish} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#070c1a", alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center" },
  pin: {
    position: "absolute", backgroundColor: "#fff", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4,
    shadowColor: "#0c1430", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pinT: { color: Z.navy, fontWeight: "800", fontSize: 12 },
  brand: { alignItems: "center", marginTop: 30 },
  word: { color: "#fff", fontSize: 23, fontWeight: "700", letterSpacing: -0.4, marginTop: 14, fontFamily: SERIF },
  by: { color: "#9fb0d8", fontFamily: SERIF, fontSize: 11, letterSpacing: 2, marginTop: 5 },
});
