import { View } from "react-native";
import { Image } from "expo-image";

const MARK = require("../../assets/images/zv-mark.png");

/**
 * The ZonalValue.ph mark (blue ZV hexagon + red pin) on a soft white rounded chip,
 * so it stays crisp on navy headers and light backgrounds alike.
 * (`tile` kept for API compatibility — the chip is always shown now.)
 */
export function Logo({ size = 48, tile = false }: { size?: number; tile?: boolean }) {
  const inner = Math.round(size * 0.74);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.26),
        backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
    >
      <Image source={MARK} style={{ width: inner, height: inner }} contentFit="contain" />
    </View>
  );
}
