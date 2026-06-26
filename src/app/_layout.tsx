import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="property" options={{ presentation: "card", animation: "slide_from_right" }} />
          <Stack.Screen name="report" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
