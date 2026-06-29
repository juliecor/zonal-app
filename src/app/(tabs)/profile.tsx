import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { Logo } from "@/components/Logo";
import { RequestCreditsModal } from "@/components/RequestCreditsModal";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF, titleCase } from "@/theme/zonal";

// Animated night-mode switch — sun ↔ moon, sliding knob, colour-morphing track.
function NightToggle() {
  const { isDark, toggle } = useTheme();
  const p = useSharedValue(isDark ? 1 : 0);
  useEffect(() => { p.value = withTiming(isDark ? 1 : 0, { duration: 300 }); }, [isDark, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], ["#dfe6f5", "#0c1430"]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 2 + p.value * 30 }] }));
  return (
    <Pressable onPress={toggle} hitSlop={10}>
      <Animated.View style={[tg.track, track]}>
        <Animated.View style={[tg.knob, knob]}>
          <Ionicons name={isDark ? "moon" : "sunny"} size={15} color={isDark ? "#e9ce80" : "#d99a1c"} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();
  const { c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [creditsOpen, setCreditsOpen] = useState(false);

  if (loading) {
    return <View style={s.root}><View style={s.center}><ActivityIndicator color={c.gold} /></View></View>;
  }

  // Signed out (e.g. entered as guest) → show the same dedicated login screen.
  if (!user) return <LoginScreen />;

  const initials = ((user.first_name?.[0] || user.name?.[0] || "U") + (user.last_name?.[0] || user.name?.split(" ")[1]?.[0] || "")).toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.header}>
          <Logo size={40} />
          <View>
            <Text style={s.brand}>Account</Text>
            <Text style={s.brandSub}>zonalvalue.ph · by Filipino Homes</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={{ padding: 16 }}>
        <View style={s.profCard}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.avatar} contentFit="cover" transition={200} />
          ) : (
            <View style={s.avatar}><Text style={s.avatarT}>{initials}</Text></View>
          )}
          <Text style={s.name}>{titleCase(user.name || `${user.first_name} ${user.last_name}`)}</Text>
          <Text style={s.email}>{user.email}</Text>
          {!!user.role && <View style={s.roleChip}><Text style={s.roleT}>{user.role.toUpperCase()}</Text></View>}
        </View>

        {/* Appearance / night mode */}
        <View style={s.apprCard}>
          <View style={s.apprIc}><Ionicons name={isDark ? "moon" : "sunny"} size={18} color={isDark ? c.goldLite : c.goldDeep} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.apprT}>Night mode</Text>
            <Text style={s.apprSub}>Easy on the eyes — the map goes dark too.</Text>
          </View>
          <NightToggle />
        </View>

        <View style={s.balCard}>
          <View>
            <Text style={s.balLbl}>SEARCH CREDITS</Text>
            <Text style={s.balNum}>{user.token_balance ?? "—"}</Text>
          </View>
          <Ionicons name="server-outline" size={26} color={c.gold} />
        </View>
        <Text style={s.note}>Credits unlock the full street-by-street record search. Map values, scans, hazards and the AI are free.</Text>

        <Pressable onPress={() => setCreditsOpen(true)} style={s.reqBtn}>
          <Ionicons name="add-circle-outline" size={18} color={isDark ? c.goldLite : c.navy} />
          <Text style={s.reqBtnT}>Request more credits</Text>
        </Pressable>

        <Pressable onPress={signOut} style={s.signout}>
          <Ionicons name="log-out-outline" size={17} color={c.red} />
          <Text style={s.signoutT}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <RequestCreditsModal visible={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </View>
  );
}

const tg = StyleSheet.create({
  track: { width: 60, height: 32, borderRadius: 16, justifyContent: "center", paddingHorizontal: 0 },
  knob: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#0c1430", shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
    brand: { color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
    brandSub: { color: "#9fb0d8", fontSize: 10, marginTop: 2, fontWeight: "600" },

    profCard: { alignItems: "center", backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16 },
    avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: c.goldLite },
    avatarT: { color: "#16223a", fontWeight: "800", fontSize: 26, fontFamily: SERIF },
    name: { fontFamily: SERIF, fontSize: 20, fontWeight: "600", color: c.ink, marginTop: 12 },
    email: { fontSize: 12.5, color: c.slate, marginTop: 3 },
    roleChip: { marginTop: 10, backgroundColor: c.chip, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 4 },
    roleT: { fontSize: 9.5, fontWeight: "800", color: c.isDark ? c.goldLite : c.navy, letterSpacing: 0.6 },

    apprCard: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14 },
    apprIc: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.isDark ? "rgba(211,177,84,0.14)" : "#fbf2d8" },
    apprT: { fontSize: 14.5, fontWeight: "800", color: c.ink },
    apprSub: { fontSize: 11.5, color: c.slate, marginTop: 2 },

    balCard: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.isDark ? c.line : "#ece3cf", borderRadius: 16, padding: 16 },
    balLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: c.goldDeep },
    balNum: { fontFamily: SERIF, fontSize: 30, fontWeight: "700", color: c.ink, marginTop: 3 },
    note: { fontSize: 11.5, color: c.slate, marginTop: 12, lineHeight: 17 },
    reqBtn: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: c.isDark ? "rgba(201,168,76,0.4)" : c.navy, backgroundColor: c.card, borderRadius: 13, paddingVertical: 13 },
    reqBtnT: { color: c.isDark ? c.goldLite : c.navy, fontWeight: "800", fontSize: 13.5 },
    signout: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: c.isDark ? "rgba(240,82,74,0.4)" : "#f6c2c2", backgroundColor: c.isDark ? "rgba(240,82,74,0.12)" : "#fde7e7", borderRadius: 13, paddingVertical: 13 },
    signoutT: { color: c.red, fontWeight: "800", fontSize: 13.5 },
  });
}
