import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Z } from "@/theme/zonal";

// The full live tool — search, establishment click → value, scan area, hazards,
// AI assistant, login. Loaded in a WebView so the app has 100% of the website's
// functionality. (The Google Maps key works because the real origin is zonalvalue.ph.)
const TOOL_URL = "https://zonalvalue.ph/";

export default function MapScreen() {
  const ref = useRef<WebView>(null);
  const [canBack, setCanBack] = useState(false);

  // Android hardware back → go back inside the web tool instead of leaving the tab.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canBack && ref.current) { ref.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canBack]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <WebView
          ref={ref}
          source={{ uri: TOOL_URL }}
          style={styles.web}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          onNavigationStateChange={(s: WebViewNavigation) => setCanBack(s.canGoBack)}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <View style={styles.logo}><Text style={styles.logoT}>Z</Text></View>
              <ActivityIndicator color={Z.gold} size="large" style={{ marginTop: 18 }} />
              <Text style={styles.loadingT}>Loading the zonal tool…</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.navy },
  safe: { flex: 1, backgroundColor: Z.navy },
  web: { flex: 1, backgroundColor: Z.paper },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: Z.paper },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 28 },
  loadingT: { color: Z.slate, fontSize: 13, marginTop: 12, fontWeight: "600" },
});
