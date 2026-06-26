import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Z } from "@/theme/zonal";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Z.navy,
        tabBarInactiveTintColor: Z.slate,
        tabBarStyle: { backgroundColor: Z.white, borderTopColor: Z.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      {/* keep the template's explore route file, but hide it from the tab bar */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
