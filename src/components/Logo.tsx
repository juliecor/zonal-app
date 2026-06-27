import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Z } from "@/theme/zonal";

/**
 * The zonalvalue.ph "Bolt Pin" mark — a gold location pin with a Z and a lightning
 * slash, in the brand navy + gold. Pass `tile` to sit it on a navy rounded square
 * (for light backgrounds); otherwise it renders transparent (for navy backgrounds).
 */
export function Logo({ size = 48, tile = false }: { size?: number; tile?: boolean }) {
  const raw = useId().replace(/[:]/g, "");
  const gg = `lg${raw}`;
  const gb = `lb${raw}`;
  const markSize = tile ? Math.round(size * 0.74) : size;

  const mark = (
    <Svg width={markSize} height={markSize} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id={gg} x1="28" y1="18" x2="94" y2="104" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#f3e2a6" />
          <Stop offset="0.5" stopColor="#e6c976" />
          <Stop offset="1" stopColor="#b8902f" />
        </LinearGradient>
        <LinearGradient id={gb} x1="40" y1="38" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#fff7e2" />
          <Stop offset="1" stopColor="#e6c976" />
        </LinearGradient>
      </Defs>
      <Path d="M60 12 C38 12 22 29 22 50 C22 77 50 98 60 110 C70 98 98 77 98 50 C98 29 82 12 60 12 Z" fill="none" stroke={`url(#${gg})`} strokeWidth={10} strokeLinejoin="round" />
      <Path d="M43 32 H77 V42 H43 Z" fill={`url(#${gg})`} />
      <Path d="M66 42 H77 L54 58 H43 Z" fill={`url(#${gg})`} />
      <Path d="M43 58 H77 V68 H43 Z" fill={`url(#${gg})`} />
      <Path d="M81 38 L57 55 L66 55 L40 78" fill="none" stroke={`url(#${gb})`} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );

  if (!tile) return mark;
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), backgroundColor: Z.navyDeep, alignItems: "center", justifyContent: "center" }}>
      {mark}
    </View>
  );
}
