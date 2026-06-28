import { useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { Logo } from "@/components/Logo";
import { Intro } from "@/components/Intro";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";

// Hard gate: a cinematic intro on launch, then sign-in (like the website), then the app.
function Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { c } = useTheme();
  const [introDone, setIntroDone] = useState(false);

  if (!introDone) return <Intro onDone={() => setIntroDone(true)} />;

  if (loading) {
    return (
      <View style={[g.splash, { backgroundColor: c.isDark ? c.paper : "#0f1c3c" }]}>
        <StatusBar style="light" />
        <Logo size={70} />
        <Text style={g.brand}>zonalvalue.ph</Text>
        <ActivityIndicator color={c.gold} style={{ marginTop: 18 }} />
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
        <ThemeProvider>
          <AuthProvider>
            <Gate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="property" options={{ presentation: "card", animation: "slide_from_right" }} />
                <Stack.Screen name="report" options={{ presentation: "card", animation: "slide_from_bottom" }} />
              </Stack>
            </Gate>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const g = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 60, height: 60, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 30, fontFamily: SERIF },
  brand: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 14, letterSpacing: -0.3 },
});
