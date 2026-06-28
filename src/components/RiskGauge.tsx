import { useMemo } from "react";
import Svg, { Circle } from "react-native-svg";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Palette } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";

/** Circular risk gauge — score out of `max`, arc coloured by severity. */
export function RiskGauge({
  score, max = 3, color, size = 56,
}: { score: number; max?: number; color: string; size?: number }) {
  const { c } = useTheme();
  const g = useMemo(() => makeStyles(c), [c]);
  const stroke = 6;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? score / max : 0));
  const dash = circ * pct;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          originX={cx} originY={cy} rotation={-90}
        />
      </Svg>
      <View style={g.center}>
        <Text style={g.num}>{score.toFixed(1)}</Text>
        <Text style={g.den}>/{max.toFixed(1)}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    num: { fontFamily: SERIF, fontSize: 16, color: c.ink, lineHeight: 17 },
    den: { fontSize: 7.5, color: c.slate, fontWeight: "600", marginTop: 1 },
  });
}
