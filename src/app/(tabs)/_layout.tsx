import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Z } from "@/theme/zonal";

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
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
