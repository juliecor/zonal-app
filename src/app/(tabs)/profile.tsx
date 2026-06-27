import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { SERIF, titleCase, Z } from "@/theme/zonal";

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <View style={s.root}><View style={s.center}><ActivityIndicator color={Z.gold} /></View></View>;
  }

  // Signed out (e.g. entered as guest) → show the same dedicated login screen.
  if (!user) return <LoginScreen />;

  const initials = ((user.first_name?.[0] || user.name?.[0] || "U") + (user.last_name?.[0] || user.name?.split(" ")[1]?.[0] || "")).toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.navy }}>
        <View style={s.header}>
          <View style={s.logo}><Text style={s.logoT}>Z</Text></View>
          <View>
            <Text style={s.brand}>Account</Text>
            <Text style={s.brandSub}>zonalvalue.ph · by Filipino Homes</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
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

        <View style={s.balCard}>
          <View>
            <Text style={s.balLbl}>SEARCH CREDITS</Text>
            <Text style={s.balNum}>{user.token_balance ?? "—"}</Text>
          </View>
          <Ionicons name="server-outline" size={26} color={Z.gold} />
        </View>
        <Text style={s.note}>Credits unlock the full street-by-street record search. Map values, scans, hazards and the AI are free.</Text>

        <Pressable onPress={signOut} style={s.signout}>
          <Ionicons name="log-out-outline" size={17} color={Z.red} />
          <Text style={s.signoutT}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  logo: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 19 },
  brand: { color: Z.white, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  brandSub: { color: "#9fb0d8", fontSize: 10, marginTop: 2, fontWeight: "600" },

  profCard: { alignItems: "center", backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  avatarT: { color: "#16223a", fontWeight: "800", fontSize: 26, fontFamily: SERIF },
  name: { fontFamily: SERIF, fontSize: 20, fontWeight: "600", color: Z.ink, marginTop: 12 },
  email: { fontSize: 12.5, color: Z.slate, marginTop: 3 },
  roleChip: { marginTop: 10, backgroundColor: "#eef1fa", borderRadius: 100, paddingHorizontal: 11, paddingVertical: 4 },
  roleT: { fontSize: 9.5, fontWeight: "800", color: Z.navy, letterSpacing: 0.6 },
  balCard: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fffdf7", borderWidth: 1, borderColor: "#ece3cf", borderRadius: 16, padding: 16 },
  balLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: Z.goldDeep },
  balNum: { fontFamily: SERIF, fontSize: 30, fontWeight: "700", color: Z.ink, marginTop: 3 },
  note: { fontSize: 11.5, color: Z.slate, marginTop: 12, lineHeight: 17 },
  signout: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#f6c2c2", backgroundColor: "#fde7e7", borderRadius: 13, paddingVertical: 13 },
  signoutT: { color: Z.red, fontWeight: "800", fontSize: 13.5 },
});
