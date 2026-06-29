import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { useTheme, type Palette } from "@/theme/theme";

const AI_MARK = require("../../../assets/images/zonal-ai-mark.png");

const TAB_ICON: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: "map", off: "map-outline" },
  nearby: { on: "navigate", off: "navigate-outline" },
  browse: { on: "pricetags", off: "pricetags-outline" },
  profile: { on: "person", off: "person-circle-outline" },
};

function TabIcon({ name, focused, c, avatar }: { name: string; focused: boolean; c: Palette; avatar?: string | null }) {
  if (name === "assistant") {
    const sz = focused ? 42 : 26;
    return <Image source={AI_MARK} style={{ width: sz, height: sz }} contentFit="contain" />;
  }
  if (name === "profile" && avatar) {
    const sz = focused ? 34 : 25;
    return <Image source={{ uri: avatar }} style={{ width: sz, height: sz, borderRadius: sz / 2 }} contentFit="cover" />;
  }
  const ic = TAB_ICON[name] || { on: "ellipse", off: "ellipse-outline" };
  return <Ionicons name={focused ? ic.on : ic.off} size={focused ? 25 : 23} color={focused ? "#fff" : c.slate} />;
}

// Custom bottom bar: the active tab's icon lifts into a raised circle that overlaps the bar.
function TabBar({ state, descriptors, navigation }: any) {
  const { c } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(false);

  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKb(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  if (kb) return null; // hide on keyboard (like tabBarHideOnKeyboard)

  return (
    <View style={[tb.bar, { backgroundColor: c.card, borderTopColor: c.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route: any, i: number) => {
        const focused = state.index === i;
        const label = (descriptors[route.key].options.title ?? route.name) as string;
        const onPress = () => {
          const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} style={tb.item} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: focused }}>
            {focused && (
              <View style={tb.floatWrap} pointerEvents="none">
                <View style={[tb.circle, { backgroundColor: c.navy, borderColor: c.card }]}>
                  <TabIcon name={route.name} focused c={c} avatar={user?.avatar_url} />
                </View>
              </View>
            )}
            <View style={tb.slot} pointerEvents="none">
              {!focused && <TabIcon name={route.name} focused={false} c={c} avatar={user?.avatar_url} />}
            </View>
            <Text numberOfLines={1} style={[tb.label, { color: focused ? (c.isDark ? c.goldLite : c.navy) : c.slate }, focused && tb.labelOn]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Map" }} />
      <Tabs.Screen name="nearby" options={{ title: "Near Me" }} />
      <Tabs.Screen name="assistant" options={{ title: "AI" }} />
      <Tabs.Screen name="browse" options={{ title: "Zonals" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const tb = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 9 },
  item: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  slot: { height: 27, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  floatWrap: { position: "absolute", top: -24, left: 0, right: 0, alignItems: "center" },
  circle: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 4, alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: "#0c1430", shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 10,
  },
  label: { fontSize: 10.5, fontWeight: "700" },
  labelOn: { fontWeight: "800" },
});
