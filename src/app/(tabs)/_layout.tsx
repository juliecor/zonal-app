import { type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme/theme";

// AI tab icon = the Zonal AI logo image.
function AiTabIcon({ size, focused }: { size: number; focused: boolean }) {
  return (
    <Image
      source={require("../../../assets/images/zonal-ai.png")}
      style={{ width: size + 6, height: size + 6, opacity: focused ? 1 : 0.6 }}
      contentFit="contain"
    />
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
        options={{ title: "AI", tabBarIcon: ({ size, focused }) => <AiTabIcon size={size} focused={focused} /> }}
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
