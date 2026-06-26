import { type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { SERIF, Z } from "@/theme/zonal";

// Hard gate: the app is only reachable after signing in (like the website).
function Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={g.splash}>
        <StatusBar style="light" />
        <View style={g.logo}><Text style={g.logoT}>Z</Text></View>
        <Text style={g.brand}>zonalvalue.ph</Text>
        <ActivityIndicator color={Z.gold} style={{ marginTop: 18 }} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Gate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="property" options={{ presentation: "card", animation: "slide_from_right" }} />
              <Stack.Screen name="report" options={{ presentation: "card", animation: "slide_from_bottom" }} />
            </Stack>
          </Gate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const g = StyleSheet.create({
  splash: { flex: 1, backgroundColor: Z.navyDeep, alignItems: "center", justifyContent: "center" },
  logo: { width: 60, height: 60, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 30, fontFamily: SERIF },
  brand: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 14, letterSpacing: -0.3 },
});
