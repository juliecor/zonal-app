import { View, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme/theme";

// AI tab = a big raised center circle showing the Zonal AI logo (FAB style).
function AiTabIcon({ focused }: { focused: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        top: -20, width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff",
        borderWidth: 2.5, borderColor: c.gold, alignItems: "center", justifyContent: "center", overflow: "hidden",
        shadowColor: "#0c1430", shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 10,
        opacity: focused ? 1 : 0.92,
      }}
    >
      <Image source={require("../../../assets/images/zonal-ai-mark.png")} style={{ width: 56, height: 56 }} contentFit="cover" />
    </View>
  );
}

// Profile tab icon = the user's S3 photo when set, else the person icon.
function ProfileTabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
  const { user } = useAuth();
  const { c } = useTheme();
  if (user?.avatar_url) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: focused ? c.gold : c.line }}
        contentFit="cover"
      />
    );
  }
  return <Ionicons name="person-circle-outline" size={size} color={color} />;
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: c.isDark ? c.goldLite : c.navy,
        tabBarInactiveTintColor: c.slate,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Map", tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="nearby"
        options={{ title: "Near Me", tabBarIcon: ({ color, size }) => <Ionicons name="navigate" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="assistant"
        options={{ title: "AI", tabBarLabel: () => null, tabBarIcon: ({ focused }) => <AiTabIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="browse"
        options={{ title: "Zonals", tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size, focused }) => <ProfileTabIcon color={color} size={size} focused={focused} /> }}
      />
    </Tabs>
  );
}
