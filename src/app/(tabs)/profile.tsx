import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as LocalAuthentication from "expo-local-authentication";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "@/lib/auth";
import { adminListTokenRequests } from "@/lib/api";
import { LoginScreen } from "@/components/LoginScreen";
import { Logo } from "@/components/Logo";
import { RequestCreditsModal } from "@/components/RequestCreditsModal";
import { AdminCreditRequestsModal } from "@/components/AdminCreditRequestsModal";
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
          <Ionicons name={isDark ? "moon" : "sunny"} size={15} color={isDark ? "#155eef" : "#d99a1c"} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, loading, signOut, deleteAccount, token, biometricEnabled, enableBiometric, disableBiometric } = useAuth();
  const { c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometric");
  const [deleting, setDeleting] = useState(false);

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, profile photo, saved lots, and search history. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(); // clears the session on success → returns to the login screen
            } catch (e: any) {
              setDeleting(false);
              Alert.alert("Couldn't delete account", e?.message || "Please try again.");
            }
          },
        },
      ],
    );
  }

  // Does this device have Face ID / fingerprint set up?
  useEffect(() => {
    (async () => {
      try {
        const [hw, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        setBioSupported(hw && enrolled);
        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        // Android exposes fingerprint as the secure app biometric (face unlock is usually
        // "weak" and unavailable to apps), so prefer "Fingerprint" there.
        if (Platform.OS === "ios") setBioLabel(hasFace ? "Face ID" : hasFinger ? "Touch ID" : "Biometric");
        else setBioLabel(hasFinger ? "Fingerprint" : hasFace ? "Face unlock" : "Biometric");
      } catch { /* ignore */ }
    })();
  }, []);

  async function onToggleBio(v: boolean) {
    try {
      if (v) await enableBiometric();
      else await disableBiometric();
    } catch (e: any) {
      Alert.alert("Biometric unlock", e?.message || "Couldn't change the setting.");
    }
  }

  // Admins: how many credit requests await review (refreshes when the modal closes).
  useEffect(() => {
    if (user?.role === "admin" && token) {
      adminListTokenRequests(token, "pending").then((r) => setPending(r.length)).catch(() => {});
    }
  }, [user?.role, token, adminOpen]);

  if (loading) {
    return <View style={s.root}><View style={s.center}><ActivityIndicator color={c.gold} /></View></View>;
  }

  // Signed out (e.g. entered as guest) → show the same dedicated login screen.
  if (!user) return <LoginScreen />;

  const initials = ((user.first_name?.[0] || user.name?.[0] || "U") + (user.last_name?.[0] || user.name?.split(" ")[1]?.[0] || "")).toUpperCase();
  const isAdmin = user.role === "admin"; // admins have unlimited searches (no credits, no requests)

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.header}>
          <Logo size={40} />
          <View>
            <Text style={s.brand}>Account</Text>
            <Text style={s.brandSub}>zonalvalue.ph</Text>
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
          <Pressable onPress={() => router.push("/edit-profile" as any)} style={s.editProfileBtn}>
            <Ionicons name="create-outline" size={15} color={isDark ? c.goldLite : c.navy} />
            <Text style={s.editProfileT}>Edit profile</Text>
          </Pressable>
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

        {/* Biometric app-lock */}
        {bioSupported && (
          <View style={s.apprCard}>
            <View style={s.apprIc}><Ionicons name="finger-print" size={18} color={isDark ? c.goldLite : c.goldDeep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.apprT}>{bioLabel} unlock</Text>
              <Text style={s.apprSub}>Require {bioLabel} to open the app.</Text>
            </View>
            <Switch
              value={biometricEnabled} onValueChange={onToggleBio}
              trackColor={{ false: c.line, true: c.gold }} thumbColor="#fff" ios_backgroundColor={c.line}
            />
          </View>
        )}

        <View style={s.balCard}>
          <View>
            <Text style={s.balLbl}>{isAdmin ? "SEARCH ACCESS" : "SEARCH CREDITS"}</Text>
            <Text style={s.balNum}>{isAdmin ? "Unlimited" : (user.token_balance ?? "—")}</Text>
          </View>
          <Ionicons name={isAdmin ? "infinite" : "server-outline"} size={26} color={c.gold} />
        </View>
        <Text style={s.note}>
          {isAdmin
            ? "As an admin, you have unlimited record searches — no credits needed."
            : "Credits unlock the full street-by-street record search. Map values, scans, hazards and the AI are free."}
        </Text>

        {!isAdmin && (
          <Pressable onPress={() => setCreditsOpen(true)} style={s.reqBtn}>
            <Ionicons name="add-circle-outline" size={18} color={isDark ? c.goldLite : c.navy} />
            <Text style={s.reqBtnT}>Request more credits</Text>
          </Pressable>
        )}

        {isAdmin && (
          <Pressable onPress={() => setAdminOpen(true)} style={s.adminBtn}>
            <View style={s.adminIc}><Ionicons name="clipboard-outline" size={18} color={isDark ? c.goldLite : c.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.adminT}>Credit requests</Text>
              <Text style={s.adminSub}>Review &amp; approve user requests</Text>
            </View>
            {pending > 0 && <View style={s.badge}><Text style={s.badgeT}>{pending}</Text></View>}
            <Ionicons name="chevron-forward" size={18} color={c.slate} />
          </Pressable>
        )}

        <Pressable onPress={signOut} style={s.signout}>
          <Ionicons name="log-out-outline" size={17} color={c.red} />
          <Text style={s.signoutT}>Sign out</Text>
        </Pressable>

        <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={s.deleteBtn}>
          {deleting
            ? <ActivityIndicator size="small" color={c.red} />
            : <Ionicons name="trash-outline" size={15} color={c.red} />}
          <Text style={s.deleteT}>{deleting ? "Deleting…" : "Delete account"}</Text>
        </Pressable>

        <View style={s.legalRow}>
          <Pressable onPress={() => Linking.openURL("https://zonalvalue.ph/privacy")} hitSlop={8}>
            <Text style={s.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={s.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL("https://zonalvalue.ph/account-deletion")} hitSlop={8}>
            <Text style={s.legalLink}>How to delete your data</Text>
          </Pressable>
        </View>
      </ScrollView>

      <RequestCreditsModal visible={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <AdminCreditRequestsModal visible={adminOpen} onClose={() => setAdminOpen(false)} />
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

    profCard: { position: "relative", alignItems: "center", backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16 },
    editProfileBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: c.chip, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9 },
    editProfileT: { fontSize: 12.5, fontWeight: "800", color: c.isDark ? c.goldLite : c.navy },
    avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: c.goldLite },
    avatarT: { color: "#ffffff", fontWeight: "800", fontSize: 26, fontFamily: SERIF },
    name: { fontFamily: SERIF, fontSize: 20, fontWeight: "600", color: c.ink, marginTop: 12 },
    email: { fontSize: 12.5, color: c.slate, marginTop: 3 },
    roleChip: { marginTop: 10, backgroundColor: c.chip, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 4 },
    roleT: { fontSize: 9.5, fontWeight: "800", color: c.isDark ? c.goldLite : c.navy, letterSpacing: 0.6 },

    apprCard: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14 },
    apprIc: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.isDark ? "rgba(21,94,239,0.14)" : "#e8f0ff" },
    apprT: { fontSize: 14.5, fontWeight: "800", color: c.ink },
    apprSub: { fontSize: 11.5, color: c.slate, marginTop: 2 },

    balCard: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.isDark ? c.line : "#ece3cf", borderRadius: 16, padding: 16 },
    balLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: c.goldDeep },
    balNum: { fontFamily: SERIF, fontSize: 30, fontWeight: "700", color: c.ink, marginTop: 3 },
    note: { fontSize: 11.5, color: c.slate, marginTop: 12, lineHeight: 17 },
    reqBtn: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: c.isDark ? "rgba(21,94,239,0.4)" : c.navy, backgroundColor: c.card, borderRadius: 13, paddingVertical: 13 },
    reqBtnT: { color: c.isDark ? c.goldLite : c.navy, fontWeight: "800", fontSize: 13.5 },
    adminBtn: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14 },
    adminIc: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.chip },
    adminT: { fontSize: 14.5, fontWeight: "800", color: c.ink },
    adminSub: { fontSize: 11.5, color: c.slate, marginTop: 2 },
    badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: c.red },
    badgeT: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
    signout: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: c.isDark ? "rgba(240,82,74,0.4)" : "#f6c2c2", backgroundColor: c.isDark ? "rgba(240,82,74,0.12)" : "#fde7e7", borderRadius: 13, paddingVertical: 13 },
    signoutT: { color: c.red, fontWeight: "800", fontSize: 13.5 },
    deleteBtn: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11 },
    deleteT: { color: c.red, fontWeight: "700", fontSize: 13 },
    legalRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
    legalLink: { color: c.slate, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
    legalDot: { color: c.slate, fontSize: 12 },
  });
}
