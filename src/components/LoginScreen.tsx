import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { authResendOtp } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { SERIF, Z } from "@/theme/zonal";

type Mode = "signin" | "register" | "otpEmail" | "otpCode" | "verify";

const FIELD = "#16223f";
const FIELD_BORDER = "rgba(255,255,255,0.10)";
const MUTED = "rgba(255,255,255,0.6)";

/** A precise cartographic backdrop — grid + contour lines, no blobs. */
function Backdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const step = 40;
  const v: number[] = [];
  const hz: number[] = [];
  for (let x = step; x < w; x += step) v.push(x);
  for (let y = step; y < h; y += step) hz.push(y);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor="#101d3f" />
          <Stop offset="0.55" stopColor="#0b142b" />
          <Stop offset="1" stopColor="#070c1a" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#bg)" />
      {v.map((x) => <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke="rgba(255,255,255,0.028)" strokeWidth={1} />)}
      {hz.map((y) => <Line key={`h${y}`} x1={0} y1={y} x2={w} y2={y} stroke="rgba(255,255,255,0.028)" strokeWidth={1} />)}
      {/* faint gold contour sweeps (lines, not blobs) */}
      <Path d={`M0 ${h * 0.30} Q ${w * 0.55} ${h * 0.20} ${w} ${h * 0.34}`} stroke="rgba(201,168,76,0.16)" strokeWidth={1.4} fill="none" />
      <Path d={`M0 ${h * 0.34} Q ${w * 0.5} ${h * 0.25} ${w} ${h * 0.38}`} stroke="rgba(201,168,76,0.07)" strokeWidth={1} fill="none" />
      <Path d={`M0 ${h * 0.78} Q ${w * 0.45} ${h * 0.70} ${w} ${h * 0.84}`} stroke="rgba(76,108,180,0.18)" strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap }) {
  const { icon, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={[st.field, focused && st.fieldFocus]}>
      <Ionicons name={icon} size={18} color={focused ? Z.goldLite : "rgba(255,255,255,0.4)"} />
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.38)"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
        style={st.fieldInput}
      />
    </View>
  );
}

export function LoginScreen() {
  const { signIn, register, verifyOtp, requestLoginOtp, verifyLoginOtp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [otpCtx, setOtpCtx] = useState<{ userId: number; email: string } | null>(null);

  function go(m: Mode) { setErr(null); setCode(""); setMode(m); }
  async function run(fn: () => Promise<void>) {
    setErr(null); setBusy(true);
    try { await fn(); } catch (e: any) { setErr(e?.message || "Something went wrong."); } finally { setBusy(false); }
  }

  const doSignIn = () => {
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    run(() => signIn(email.trim(), password));
  };
  const doRegister = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) { setErr("Fill in name, email and password."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    run(async () => {
      const r = await register({
        first_name: firstName.trim(), last_name: lastName.trim(),
        phone: phone.trim() || undefined, email: email.trim(),
        password, password_confirmation: confirm,
      });
      if (r && "pending_verification" in r) { setOtpCtx({ userId: r.user_id, email: r.email }); go("verify"); }
    });
  };
  const doRequestOtp = () => {
    if (!email.trim()) { setErr("Enter your email."); return; }
    run(async () => {
      const r = await requestLoginOtp(email.trim());
      setOtpCtx({ userId: r.user_id, email: email.trim() });
      go("otpCode");
    });
  };
  const doVerify = () => {
    if (!otpCtx || code.trim().length < 4) { setErr("Enter the emailed code."); return; }
    run(() => (mode === "verify" ? verifyOtp(otpCtx.userId, code.trim()) : verifyLoginOtp(otpCtx.userId, code.trim())));
  };
  const doResend = () => {
    if (!otpCtx) return;
    run(async () => {
      if (mode === "verify") await authResendOtp(otpCtx.userId);
      else await requestLoginOtp(otpCtx.email);
      setErr("A new code has been sent.");
    });
  };

  const titles: Record<Mode, { t: string; s: string }> = {
    signin: { t: "Welcome back", s: "Sign in to your Zonal Value account to continue." },
    register: { t: "Create account", s: "Join zonalvalue.ph by Filipino Homes." },
    otpEmail: { t: "Email sign-in", s: "We'll email you a 6-digit sign-in code." },
    otpCode: { t: "Check your inbox", s: `Enter the code we sent to ${otpCtx?.email || "your email"}.` },
    verify: { t: "Verify your email", s: `Enter the code we sent to ${otpCtx?.email || "your email"} to finish.` },
  };
  const isCode = mode === "otpCode" || mode === "verify";

  return (
    <View style={st.root}>
      <StatusBar style="light" />
      <Backdrop />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

            {/* hero */}
            <View style={st.hero}>
              <Logo size={58} />
              <Text style={st.brandWord}>zonalvalue<Text style={{ color: Z.goldLite }}>.</Text>ph</Text>
              <Text style={st.tagline}>Property due-diligence, <Text style={{ color: Z.goldLite, fontStyle: "italic" }}>precisely mapped.</Text></Text>
            </View>

            <View style={st.card}>
              <View style={st.accent} />

              <View style={st.badge}>
                <View style={st.badgeDot} />
                <Text style={st.badgeT}>SECURE ACCESS</Text>
              </View>

              <Text style={st.title}>{titles[mode].t}</Text>
              <View style={st.divider} />
              <Text style={st.subtitle}>{titles[mode].s}</Text>

              {!!err && (
                <View style={st.err}><View style={st.errDot} /><Text style={st.errT}>{err}</Text></View>
              )}

              {mode === "register" && (
                <View style={st.rowGap}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.lbl}>First name</Text>
                    <Field value={firstName} onChangeText={setFirstName} placeholder="Juan" icon="person-outline" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.lbl}>Last name</Text>
                    <Field value={lastName} onChangeText={setLastName} placeholder="Dela Cruz" icon="person-outline" />
                  </View>
                </View>
              )}
              {mode === "register" && (
                <>
                  <Text style={st.lbl}>Phone (optional)</Text>
                  <Field value={phone} onChangeText={setPhone} placeholder="+63 9XX XXX XXXX" icon="call-outline" keyboardType="phone-pad" />
                </>
              )}

              {isCode ? (
                <>
                  <Text style={st.lbl}>6-digit code</Text>
                  <TextInput
                    value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••" placeholderTextColor="rgba(255,255,255,0.22)"
                    style={st.codeInput} keyboardType="number-pad" maxLength={6} autoFocus
                  />
                </>
              ) : (
                <>
                  <Text style={st.lbl}>Email address</Text>
                  <Field value={email} onChangeText={setEmail} placeholder="you@email.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
                  {mode !== "otpEmail" && (
                    <>
                      <Text style={st.lbl}>Password</Text>
                      <Field value={password} onChangeText={setPassword} placeholder="Enter your password" icon="lock-closed-outline" secureTextEntry />
                    </>
                  )}
                  {mode === "register" && (
                    <>
                      <Text style={st.lbl}>Confirm password</Text>
                      <Field value={confirm} onChangeText={setConfirm} placeholder="Re-enter password" icon="lock-closed-outline" secureTextEntry />
                    </>
                  )}
                </>
              )}

              <Pressable
                onPress={mode === "signin" ? doSignIn : mode === "register" ? doRegister : mode === "otpEmail" ? doRequestOtp : doVerify}
                style={({ pressed }) => [st.primary, (busy || pressed) && { opacity: 0.85 }]} disabled={busy}
              >
                {busy ? <ActivityIndicator color="#16223a" /> : (
                  <>
                    <Text style={st.primaryT}>
                      {mode === "signin" ? "Sign in" : mode === "register" ? "Create account" : mode === "otpEmail" ? "Send code" : "Verify & continue"}
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color="#16223a" />
                  </>
                )}
              </Pressable>

              {mode === "signin" && (
                <Pressable onPress={() => go("otpEmail")} style={st.linkBtn}><Text style={st.link}>Login with email code</Text></Pressable>
              )}
              {isCode && (
                <View style={st.codeRow}>
                  <Pressable onPress={doResend} disabled={busy}><Text style={st.link}>Resend code</Text></Pressable>
                  <Pressable onPress={() => go(mode === "verify" ? "register" : "otpEmail")}><Text style={st.linkDim}>Change email</Text></Pressable>
                </View>
              )}

              {(mode === "signin" || mode === "register" || mode === "otpEmail") && (
                <Text style={st.foot}>
                  {mode === "register" ? "Already have an account? " : "Don't have an account? "}
                  <Text style={st.footLink} onPress={() => go(mode === "register" ? "signin" : "register")}>
                    {mode === "register" ? "Sign in" : "Create one"}
                  </Text>
                </Text>
              )}
            </View>

            <Text style={st.legal}>Built by Filipino Homes · Leuterio Realty</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#070c1a" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 22, paddingVertical: 34 },

  hero: { alignItems: "center", marginBottom: 22 },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite, shadowColor: Z.gold, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 24, fontFamily: SERIF },
  brandWord: { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginTop: 12 },
  tagline: { color: MUTED, fontSize: 13, marginTop: 6, fontFamily: SERIF },

  card: { borderRadius: 22, padding: 22, paddingTop: 24, backgroundColor: "rgba(17,28,52,0.86)", borderWidth: 1, borderColor: "rgba(201,168,76,0.18)", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 14 },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: Z.gold },

  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(201,168,76,0.1)", borderWidth: 1, borderColor: "rgba(201,168,76,0.3)", borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Z.goldLite },
  badgeT: { color: Z.goldLite, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.6 },

  title: { fontFamily: SERIF, fontSize: 29, fontWeight: "700", color: "#fff", lineHeight: 33 },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: Z.gold, marginTop: 10, marginBottom: 12 },
  subtitle: { fontSize: 13.5, color: MUTED, lineHeight: 20, marginBottom: 18 },

  err: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(220,38,38,0.12)", borderWidth: 1, borderColor: "rgba(220,38,38,0.3)", borderRadius: 12, padding: 11, marginBottom: 14 },
  errDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Z.red },
  errT: { color: "#fca5a5", fontSize: 12.5, fontWeight: "600", flex: 1 },

  rowGap: { flexDirection: "row", gap: 10 },
  lbl: { fontSize: 10.5, fontWeight: "700", color: "rgba(255,255,255,0.82)", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 12, marginBottom: 7 },
  field: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: FIELD, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 13, paddingHorizontal: 13, paddingVertical: Platform.OS === "ios" ? 13 : 9 },
  fieldFocus: { borderColor: Z.gold, backgroundColor: "#1a2950" },
  fieldInput: { flex: 1, color: "#fff", fontSize: 14.5, padding: 0 },
  codeInput: { backgroundColor: FIELD, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 14, color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 10, paddingVertical: 14, marginTop: 2 },

  primary: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Z.gold, borderRadius: 13, paddingVertical: 15, shadowColor: Z.goldDeep, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  primaryT: { color: "#16223a", fontWeight: "800", fontSize: 15 },

  linkBtn: { alignSelf: "center", paddingVertical: 14 },
  link: { color: Z.goldLite, fontWeight: "700", fontSize: 13 },
  linkDim: { color: MUTED, fontWeight: "600", fontSize: 13 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },

  foot: { textAlign: "center", color: MUTED, fontSize: 13, marginTop: 16 },
  footLink: { color: Z.goldLite, fontWeight: "700" },

  legal: { textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 10.5, marginTop: 22, letterSpacing: 0.4 },
});
