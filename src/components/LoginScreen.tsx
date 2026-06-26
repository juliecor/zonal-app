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
import { SERIF, Z } from "@/theme/zonal";

type Mode = "signin" | "register" | "otpEmail" | "otpCode" | "verify";

const D = {
  bg: "#0a1228",
  field: "#141e30",
  fieldBorder: "rgba(255,255,255,0.12)",
  cardBorder: "rgba(255,255,255,0.10)",
  textMuted: "rgba(255,255,255,0.62)",
};

/** Full-screen login, styled like the website's gate. Renders all auth flows. */
export function LoginScreen({ onSkip }: { onSkip?: () => void }) {
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
      <View style={st.glowGold} pointerEvents="none" />
      <View style={st.glowBlue} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
            <View style={st.card}>
              {/* brand */}
              <View style={st.brand}>
                <View style={st.logo}><Text style={st.logoT}>Z</Text></View>
                <Text style={st.brandWord}>zonalvalue<Text style={{ color: Z.goldLite }}>.</Text>ph</Text>
              </View>

              {/* eyebrow */}
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

              {/* fields */}
              {mode === "register" && (
                <View style={st.row}>
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
                    placeholder="••••••" placeholderTextColor="rgba(255,255,255,0.25)"
                    style={st.codeInput} keyboardType="number-pad" maxLength={6} autoFocus
                  />
                </>
              ) : (
                <>
                  <Text style={st.lbl}>Email address</Text>
                  <Field value={email} onChangeText={setEmail} placeholder="you@email.com" icon="mail-outline"
                    keyboardType="email-address" autoCapitalize="none" />
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

              {/* primary action */}
              <Pressable
                onPress={mode === "signin" ? doSignIn : mode === "register" ? doRegister : mode === "otpEmail" ? doRequestOtp : doVerify}
                style={[st.primary, busy && { opacity: 0.6 }]} disabled={busy}
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

              {/* secondary links */}
              {mode === "signin" && (
                <Pressable onPress={() => go("otpEmail")} style={st.linkBtn}><Text style={st.link}>Login with email code</Text></Pressable>
              )}
              {isCode && (
                <View style={st.codeRow}>
                  <Pressable onPress={doResend} disabled={busy}><Text style={st.link}>Resend code</Text></Pressable>
                  <Pressable onPress={() => go(mode === "verify" ? "register" : "otpEmail")}><Text style={st.linkDim}>Change email</Text></Pressable>
                </View>
              )}

              {/* toggle signin/register */}
              {(mode === "signin" || mode === "register" || mode === "otpEmail") && (
                <Text style={st.foot}>
                  {mode === "register" ? "Already have an account? " : "Don't have an account? "}
                  <Text style={st.footLink} onPress={() => go(mode === "register" ? "signin" : "register")}>
                    {mode === "register" ? "Sign in" : "Create one"}
                  </Text>
                </Text>
              )}

              {!!onSkip && (
                <Pressable onPress={onSkip} style={st.skip}>
                  <Text style={st.skipT}>Skip for now — explore the map</Text>
                  <Ionicons name="arrow-forward" size={13} color={D.textMuted} />
                </Pressable>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap }) {
  const { icon, style, ...rest } = props;
  return (
    <View style={st.field}>
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.45)" />
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.4)"
        autoCorrect={false}
        {...rest}
        style={st.fieldInput}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  glowGold: { position: "absolute", top: -120, right: -100, width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(201,168,76,0.14)" },
  glowBlue: { position: "absolute", bottom: -140, left: -120, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(30,58,138,0.4)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { borderRadius: 24, padding: 22, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: D.cardBorder },

  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 18 },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 17, fontFamily: SERIF },
  brandWord: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },

  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(201,168,76,0.1)", borderWidth: 1, borderColor: "rgba(201,168,76,0.3)", borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Z.goldLite },
  badgeT: { color: Z.goldLite, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.5 },

  title: { fontFamily: SERIF, fontSize: 30, fontWeight: "700", color: "#fff", lineHeight: 34 },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: Z.gold, marginTop: 10, marginBottom: 12 },
  subtitle: { fontSize: 13.5, color: D.textMuted, lineHeight: 20, marginBottom: 18 },

  err: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(220,38,38,0.12)", borderWidth: 1, borderColor: "rgba(220,38,38,0.3)", borderRadius: 12, padding: 11, marginBottom: 14 },
  errDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Z.red },
  errT: { color: "#fca5a5", fontSize: 12.5, fontWeight: "600", flex: 1 },

  row: { flexDirection: "row", gap: 10 },
  lbl: { fontSize: 10.5, fontWeight: "700", color: "rgba(255,255,255,0.85)", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 12, marginBottom: 7 },
  field: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: D.field, borderWidth: 1, borderColor: D.fieldBorder, borderRadius: 14, paddingHorizontal: 13, paddingVertical: Platform.OS === "ios" ? 13 : 9 },
  fieldInput: { flex: 1, color: "#fff", fontSize: 14.5, padding: 0 },
  codeInput: { backgroundColor: D.field, borderWidth: 1, borderColor: D.fieldBorder, borderRadius: 16, color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 10, paddingVertical: 14, marginTop: 2 },

  primary: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Z.gold, borderRadius: 14, paddingVertical: 15, shadowColor: Z.goldDeep, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  primaryT: { color: "#16223a", fontWeight: "800", fontSize: 15 },

  linkBtn: { alignSelf: "center", paddingVertical: 14 },
  link: { color: Z.goldLite, fontWeight: "700", fontSize: 13 },
  linkDim: { color: D.textMuted, fontWeight: "600", fontSize: 13 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },

  foot: { textAlign: "center", color: D.textMuted, fontSize: 13, marginTop: 16 },
  footLink: { color: Z.goldLite, fontWeight: "700" },

  skip: { marginTop: 18, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9 },
  skipT: { color: D.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
});
