import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";

/** Shown when biometric app-lock is on — Face ID / fingerprint to enter, password fallback. */
export function LockScreen() {
  const { unlock, signOut, user } = useAuth();
  const { c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const tried = useRef(false);

  async function attempt() {
    setBusy(true); setFailed(false);
    const ok = await unlock();
    setBusy(false);
    if (!ok) setFailed(true);
  }

  // Prompt automatically the first time the lock screen appears.
  useEffect(() => {
    if (!tried.current) { tried.current = true; attempt(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = user?.first_name || (user?.name ? user.name.split(" ")[0] : "");

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={s.fill} edges={["top", "bottom"]}>
        <View style={s.center}>
          <Logo size={62} />
          <Text style={s.brand}>zonalvalue<Text style={{ color: c.gold }}>.</Text>ph</Text>
          <Text style={s.sub}>{name ? `Welcome back, ${name}` : "Locked"}</Text>

          <View style={s.ring}>
            <Ionicons name="finger-print" size={42} color={c.isDark ? c.goldLite : c.navy} />
          </View>

          {failed && <Text style={s.failed}>Authentication failed or cancelled. Try again.</Text>}

          <Pressable onPress={attempt} disabled={busy} style={({ pressed }) => [s.unlock, (busy || pressed) && { opacity: 0.85 }]}>
            {busy ? <ActivityIndicator color={isDark ? "#16223a" : "#fff"} /> : (
              <>
                <Ionicons name="lock-open-outline" size={17} color={isDark ? "#16223a" : "#fff"} />
                <Text style={s.unlockT}>Unlock</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable onPress={signOut} style={s.fallback} hitSlop={10}>
          <Text style={s.fallbackT}>Use password instead</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(c: Palette) {
  const primaryBg = c.isDark ? c.gold : c.navy;
  const primaryText = c.isDark ? "#16223a" : "#ffffff";
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    fill: { flex: 1, justifyContent: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
    brand: { color: c.ink, fontSize: 21, fontWeight: "800", letterSpacing: -0.4, marginTop: 14 },
    sub: { color: c.slate, fontSize: 13.5, marginTop: 6 },
    ring: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginTop: 34, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, shadowColor: c.shadow, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
    failed: { color: c.red, fontSize: 12.5, fontWeight: "600", marginTop: 22, textAlign: "center" },
    unlock: { marginTop: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: primaryBg, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 44, shadowColor: c.shadow, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
    unlockT: { color: primaryText, fontWeight: "800", fontSize: 15 },
    fallback: { alignSelf: "center", paddingVertical: 18 },
    fallbackT: { color: c.slate, fontWeight: "700", fontSize: 13.5 },
  });
}
