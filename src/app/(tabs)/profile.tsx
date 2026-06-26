import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { authResendOtp } from "@/lib/api";
import { SERIF, titleCase, Z } from "@/theme/zonal";

type Mode = "signin" | "register";

export default function ProfileScreen() {
  const { user, loading, signIn, register, verifyOtp, signOut } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // register fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  // otp step
  const [otp, setOtp] = useState<{ userId: number; email: string } | null>(null);
  const [code, setCode] = useState("");

  function reset() {
    setErr(null); setPassword(""); setConfirm(""); setCode("");
  }

  async function onSignIn() {
    setErr(null);
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true);
    try { await signIn(email.trim(), password); }
    catch (e: any) { setErr(e?.message || "Sign in failed."); }
    finally { setBusy(false); }
  }

  async function onRegister() {
    setErr(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) { setErr("Please fill in name, email and password."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const r = await register({
        first_name: firstName.trim(), last_name: lastName.trim(),
        phone: phone.trim() || undefined, email: email.trim(),
        password, password_confirmation: confirm,
      });
      if (r && "pending_verification" in r) setOtp({ userId: r.user_id, email: r.email });
      // else: token returned → context logs in → screen switches automatically
    } catch (e: any) { setErr(e?.message || "Registration failed."); }
    finally { setBusy(false); }
  }

  async function onVerify() {
    if (!otp) return;
    setErr(null);
    if (code.trim().length < 4) { setErr("Enter the code we emailed you."); return; }
    setBusy(true);
    try { await verifyOtp(otp.userId, code.trim()); }
    catch (e: any) { setErr(e?.message || "Verification failed."); }
    finally { setBusy(false); }
  }

  async function onResend() {
    if (!otp) return;
    setBusy(true);
    try { await authResendOtp(otp.userId); setErr("A new code has been sent."); }
    catch { setErr("Couldn't resend the code."); }
    finally { setBusy(false); }
  }

  // ── loading ──
  if (loading) {
    return (
      <View style={s.root}><Header /><View style={s.center}><ActivityIndicator color={Z.gold} /></View></View>
    );
  }

  // ── logged in ──
  if (user) {
    const initials = (user.first_name?.[0] || user.name?.[0] || "U") + (user.last_name?.[0] || user.name?.split(" ")[1]?.[0] || "");
    return (
      <View style={s.root}>
        <Header />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.profCard}>
            <View style={s.avatar}><Text style={s.avatarT}>{initials.toUpperCase()}</Text></View>
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
          <Text style={s.note}>Credits let you pull full street-by-street records in the Browse / Tool search. Map values, scans, hazards and the AI are free.</Text>

          <Pressable onPress={signOut} style={s.signout}>
            <Ionicons name="log-out-outline" size={17} color={Z.red} />
            <Text style={s.signoutT}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── OTP verification ──
  if (otp) {
    return (
      <View style={s.root}>
        <Header />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={s.h1}>Verify your email</Text>
            <Text style={s.sub}>We sent a code to {otp.email}. Enter it below to finish creating your account.</Text>
            {!!err && <Text style={s.err}>{err}</Text>}
            <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor={Z.slate}
              style={[s.input, s.codeInput]} keyboardType="number-pad" maxLength={6} />
            <Pressable onPress={onVerify} style={[s.primary, busy && { opacity: 0.6 }]} disabled={busy}>
              {busy ? <ActivityIndicator color="#16223a" /> : <Text style={s.primaryT}>Verify &amp; continue</Text>}
            </Pressable>
            <Pressable onPress={onResend} disabled={busy} style={s.linkBtn}><Text style={s.link}>Resend code</Text></Pressable>
            <Pressable onPress={() => { setOtp(null); reset(); }} style={s.linkBtn}><Text style={s.linkDim}>← Back</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── signed out: sign in / register ──
  return (
    <View style={s.root}>
      <Header />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={s.segWrap}>
            {(["signin", "register"] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); reset(); }} style={[s.seg, mode === m && s.segOn]}>
                <Text style={[s.segT, mode === m && s.segTOn]}>{m === "signin" ? "Sign in" : "Register"}</Text>
              </Pressable>
            ))}
          </View>

          {!!err && <Text style={s.err}>{err}</Text>}

          {mode === "register" && (
            <View style={s.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>First name</Text>
                <TextInput value={firstName} onChangeText={setFirstName} style={s.input} placeholder="Juan" placeholderTextColor={Z.slate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>Last name</Text>
                <TextInput value={lastName} onChangeText={setLastName} style={s.input} placeholder="Dela Cruz" placeholderTextColor={Z.slate} />
              </View>
            </View>
          )}

          {mode === "register" && (
            <>
              <Text style={s.lbl}>Phone (optional)</Text>
              <TextInput value={phone} onChangeText={setPhone} style={s.input} placeholder="+63 9XX XXX XXXX" placeholderTextColor={Z.slate} keyboardType="phone-pad" />
            </>
          )}

          <Text style={s.lbl}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} style={s.input} placeholder="you@email.com" placeholderTextColor={Z.slate}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          <Text style={s.lbl}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} style={s.input} placeholder="••••••••" placeholderTextColor={Z.slate} secureTextEntry />

          {mode === "register" && (
            <>
              <Text style={s.lbl}>Confirm password</Text>
              <TextInput value={confirm} onChangeText={setConfirm} style={s.input} placeholder="••••••••" placeholderTextColor={Z.slate} secureTextEntry />
            </>
          )}

          <Pressable onPress={mode === "signin" ? onSignIn : onRegister} style={[s.primary, busy && { opacity: 0.6 }]} disabled={busy}>
            {busy ? <ActivityIndicator color="#16223a" /> : <Text style={s.primaryT}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}
          </Pressable>

          <Text style={s.legal}>
            {mode === "signin" ? "New here? Tap Register above." : "By registering you agree to zonalvalue.ph's terms. We'll email a code to verify your account."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Header() {
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.navy }}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View style={s.logo}><Text style={s.logoT}>Z</Text></View>
        <View>
          <Text style={s.brand}>Account</Text>
          <Text style={s.brandSub}>zonalvalue.ph · by Filipino Homes</Text>
        </View>
      </View>
    </SafeAreaView>
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

  // auth form
  segWrap: { flexDirection: "row", backgroundColor: Z.paper2, borderRadius: 12, padding: 4, marginBottom: 16 },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segOn: { backgroundColor: Z.navy },
  segT: { fontSize: 13, fontWeight: "700", color: Z.slate },
  segTOn: { color: "#fff" },
  rowGap: { flexDirection: "row", gap: 10 },
  lbl: { fontSize: 11, fontWeight: "700", color: Z.inkSoft, marginTop: 12, marginBottom: 5, letterSpacing: 0.2 },
  input: { backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Z.ink },
  codeInput: { textAlign: "center", fontSize: 22, letterSpacing: 6, fontWeight: "700", marginTop: 14 },
  primary: { marginTop: 18, backgroundColor: Z.gold, borderRadius: 13, paddingVertical: 14, alignItems: "center", justifyContent: "center", shadowColor: Z.goldDeep, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryT: { color: "#16223a", fontWeight: "800", fontSize: 14 },
  err: { color: Z.red, fontSize: 12.5, fontWeight: "600", marginTop: 10, backgroundColor: "#fde7e7", borderRadius: 9, padding: 10 },
  legal: { fontSize: 11, color: Z.slate, marginTop: 16, lineHeight: 16, textAlign: "center" },
  linkBtn: { alignSelf: "center", paddingVertical: 10 },
  link: { color: Z.navy, fontWeight: "700", fontSize: 13 },
  linkDim: { color: Z.slate, fontWeight: "600", fontSize: 13 },
  h1: { fontFamily: SERIF, fontSize: 22, fontWeight: "600", color: Z.ink },
  sub: { fontSize: 13, color: Z.slate, marginTop: 6, lineHeight: 19 },

  // logged-in
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
