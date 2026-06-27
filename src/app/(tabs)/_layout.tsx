import { type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useAuth } from "@/lib/auth";
import { Z } from "@/theme/zonal";

// Profile tab icon = the user's S3 photo when set, else the person icon.
function ProfileTabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
  const { user } = useAuth();
  if (user?.avatar_url) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: focused ? Z.navy : Z.line }}
        contentFit="cover"
      />
    );
  }
  return <Ionicons name="person-circle-outline" size={size} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Z.navy,
        tabBarInactiveTintColor: Z.slate,
        tabBarStyle: { backgroundColor: Z.white, borderTopColor: Z.line },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Map", tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: "Scan", tabBarIcon: ({ color, size }) => <Ionicons name="scan" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="assistant"
        options={{ title: "AI", tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} /> }}
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
