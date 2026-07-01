import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from "react-native";
import Animated, {
  Easing, useAnimatedKeyboard, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { Image } from "expo-image";

import { useAuth } from "@/lib/auth";
import { authResendOtp } from "@/lib/api";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";

const MASCOT = require("../../assets/images/mascot-wave.png");
const MASCOT_RATIO = 1165 / 839; // h/w

type Mode = "signin" | "register" | "otpEmail" | "otpCode" | "verify";

function Field(props: React.ComponentProps<typeof TextInput> & {
  icon: keyof typeof Ionicons.glyphMap;
  onFocusScroll?: (ref: React.RefObject<TextInput | null>) => void;
}) {
  const { icon, onFocusScroll, ...rest } = props;
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.field, focused && s.fieldFocus]}>
      <Ionicons name={icon} size={18} color={focused ? c.gold : c.slate} />
      <TextInput
        ref={ref}
        placeholderTextColor={c.slate}
        autoCorrect={false}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); onFocusScroll?.(ref); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={s.fieldInput}
      />
    </View>
  );
}

export function LoginScreen() {
  const { signIn, register, verifyOtp, requestLoginOtp, verifyLoginOtp } = useAuth();
  const { c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  // Android-safe keyboard handling: a keyboard-sized spacer gives scroll room, and we
  // scroll the focused field into the upper third so the keyboard never covers it.
  const { height: screenH, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const codeRef = useRef<TextInput>(null);
  const keyboard = useAnimatedKeyboard();
  const spacerStyle = useAnimatedStyle(() => ({ height: keyboard.height.value }));
  const ensureVisible = (ref: React.RefObject<TextInput | null>) => {
    setTimeout(() => {
      ref.current?.measureInWindow((_x, y) => {
        const target = screenH * 0.24;
        if (y > target) scrollRef.current?.scrollTo({ y: scrollY.current + (y - target), animated: true });
      });
    }, 90);
  };

  // Waving mascot greeter — pops in and waves hello, then floats gently. It collapses
  // out of the way when the keyboard opens so it never crowds the form.
  const mascotW = Math.min(width * 0.3, 122);
  const mascotH = mascotW * MASCOT_RATIO;
  const entry = useSharedValue(0);
  const wave = useSharedValue(0);
  const bob = useSharedValue(0);
  useEffect(() => {
    const E = Easing.out(Easing.cubic);
    entry.value = withTiming(1, { duration: 520, easing: E });
    wave.value = withDelay(520, withRepeat(withSequence(
      withTiming(1, { duration: 190, easing: E }),
      withTiming(-1, { duration: 380, easing: E }),
      withTiming(0, { duration: 190, easing: E }),
    ), 3, false));
    bob.value = withRepeat(withSequence(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mascotBox = useAnimatedStyle(() => {
    const p = Math.min(1, keyboard.height.value / 140); // 0 closed → 1 keyboard open
    return { height: (mascotH + 16) * (1 - p), opacity: (1 - p) * entry.value };
  });
  const mascotInner = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * -6 }, { scale: 0.72 + 0.28 * entry.value }, { rotate: `${wave.value * 7}deg` }],
  }));

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
    signin: { t: "Welcome back", s: "Sign in to your account to continue." },
    register: { t: "Create account", s: "Join zonalvalue.ph." },
    otpEmail: { t: "Email sign-in", s: "We'll email you a 6-digit sign-in code." },
    otpCode: { t: "Check your inbox", s: `Enter the code we sent to ${otpCtx?.email || "your email"}.` },
    verify: { t: "Verify your email", s: `Enter the code we sent to ${otpCtx?.email || "your email"} to finish.` },
  };
  const isCode = mode === "otpCode" || mode === "verify";
  const cta = mode === "signin" ? "Sign in" : mode === "register" ? "Create account" : mode === "otpEmail" ? "Send code" : "Verify & continue";

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
        >
          {/* waving mascot greeter */}
          <Animated.View style={[s.mascotBox, mascotBox]}>
            <Animated.View style={mascotInner}>
              <Image source={MASCOT} style={{ width: mascotW, height: mascotH }} contentFit="contain" />
            </Animated.View>
          </Animated.View>

          {/* brand */}
          <View style={s.hero}>
            <Image source={require("../../assets/images/zonalvalue-wordmark.png")} style={s.wordmark} contentFit="contain" />
            <Text style={s.tagline}>Property due-diligence, precisely mapped.</Text>
          </View>

          {/* heading */}
          <Text style={s.title}>{titles[mode].t}</Text>
          <Text style={s.subtitle}>{titles[mode].s}</Text>

          {!!err && (
            <View style={s.err}><Ionicons name="alert-circle" size={15} color={c.red} /><Text style={s.errT}>{err}</Text></View>
          )}

          {mode === "register" && (
            <View style={s.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>First name</Text>
                <Field value={firstName} onChangeText={setFirstName} placeholder="Juan" icon="person-outline" onFocusScroll={ensureVisible} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>Last name</Text>
                <Field value={lastName} onChangeText={setLastName} placeholder="Dela Cruz" icon="person-outline" onFocusScroll={ensureVisible} />
              </View>
            </View>
          )}
          {mode === "register" && (
            <>
              <Text style={s.lbl}>Phone (optional)</Text>
              <Field value={phone} onChangeText={setPhone} placeholder="+63 9XX XXX XXXX" icon="call-outline" keyboardType="phone-pad" onFocusScroll={ensureVisible} />
            </>
          )}

          {isCode ? (
            <>
              <Text style={s.lbl}>6-digit code</Text>
              <TextInput
                ref={codeRef}
                value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••" placeholderTextColor={c.slate}
                style={s.codeInput} keyboardType="number-pad" maxLength={6} autoFocus
                onFocus={() => ensureVisible(codeRef)}
              />
            </>
          ) : (
            <>
              <Text style={s.lbl}>Email address</Text>
              <Field value={email} onChangeText={setEmail} placeholder="you@email.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" onFocusScroll={ensureVisible} />
              {mode !== "otpEmail" && (
                <>
                  <Text style={s.lbl}>Password</Text>
                  <Field value={password} onChangeText={setPassword} placeholder="Enter your password" icon="lock-closed-outline" secureTextEntry onFocusScroll={ensureVisible} />
                </>
              )}
              {mode === "register" && (
                <>
                  <Text style={s.lbl}>Confirm password</Text>
                  <Field value={confirm} onChangeText={setConfirm} placeholder="Re-enter password" icon="lock-closed-outline" secureTextEntry onFocusScroll={ensureVisible} />
                </>
              )}
            </>
          )}

          <Pressable
            onPress={mode === "signin" ? doSignIn : mode === "register" ? doRegister : mode === "otpEmail" ? doRequestOtp : doVerify}
            style={({ pressed }) => [s.primary, (busy || pressed) && { opacity: 0.9 }]} disabled={busy}
          >
            {busy ? <ActivityIndicator color={s.primaryT.color as string} /> : (
              <>
                <Text style={s.primaryT}>{cta}</Text>
                <Ionicons name="arrow-forward" size={17} color={s.primaryT.color as string} />
              </>
            )}
          </Pressable>

          {mode === "signin" && (
            <Pressable onPress={() => go("otpEmail")} style={s.linkBtn}><Text style={s.link}>Sign in with an email code</Text></Pressable>
          )}
          {isCode && (
            <View style={s.codeRow}>
              <Pressable onPress={doResend} disabled={busy}><Text style={s.link}>Resend code</Text></Pressable>
              <Pressable onPress={() => go(mode === "verify" ? "register" : "otpEmail")}><Text style={s.linkDim}>Change email</Text></Pressable>
            </View>
          )}

          {(mode === "signin" || mode === "register" || mode === "otpEmail") && (
            <Text style={s.foot}>
              {mode === "register" ? "Already have an account? " : "Don't have an account? "}
              <Text style={s.footLink} onPress={() => go(mode === "register" ? "signin" : "register")}>
                {mode === "register" ? "Sign in" : "Create one"}
              </Text>
            </Text>
          )}

          <Text style={s.legal}>© zonalvalue.ph</Text>
          <Pressable onPress={() => Linking.openURL("https://zonalvalue.ph/privacy")} hitSlop={8} style={s.privacyBtn}>
            <Text style={s.privacyLink}>Privacy Policy</Text>
          </Pressable>
          <Animated.View style={spacerStyle} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(c: Palette) {
  const primaryBg = c.gold;          // brand blue CTA in both modes, consistent with every other CTA
  const primaryText = "#ffffff";
  const link = c.isDark ? c.goldLite : c.navy;
  const fieldBg = c.isDark ? c.field : "#ffffff";
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingVertical: 36, maxWidth: 460, width: "100%", alignSelf: "center" },

    mascotBox: { alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
    hero: { alignItems: "center", marginBottom: 26 },
    wordmark: { width: 232, height: 64 },
    tagline: { color: c.slate, fontSize: 12.5, marginTop: 8 },

    title: { fontFamily: SERIF, fontSize: 28, fontWeight: "700", color: c.ink, letterSpacing: -0.3 },
    subtitle: { fontSize: 13.5, color: c.slate, lineHeight: 20, marginTop: 6, marginBottom: 8 },

    err: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.isDark ? "rgba(240,82,74,0.12)" : "#fdecec", borderWidth: 1, borderColor: c.isDark ? "rgba(240,82,74,0.32)" : "#f6c9c9", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
    errT: { color: c.red, fontSize: 12.5, fontWeight: "600", flex: 1 },

    rowGap: { flexDirection: "row", gap: 10 },
    lbl: { fontSize: 10.5, fontWeight: "800", color: c.slate, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 16, marginBottom: 7 },
    field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: fieldBg, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: Platform.OS === "ios" ? 14 : 10 },
    fieldFocus: { borderColor: c.gold, borderWidth: 1.5 },
    fieldInput: { flex: 1, color: c.ink, fontSize: 15, padding: 0 },
    codeInput: { backgroundColor: fieldBg, borderWidth: 1, borderColor: c.line, borderRadius: 12, color: c.ink, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 10, paddingVertical: 15, marginTop: 2 },

    primary: { marginTop: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: primaryBg, borderRadius: 12, paddingVertical: 16, shadowColor: c.shadow, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
    primaryT: { color: primaryText, fontWeight: "800", fontSize: 15 },

    linkBtn: { alignSelf: "center", paddingVertical: 16 },
    link: { color: link, fontWeight: "700", fontSize: 13.5 },
    linkDim: { color: c.slate, fontWeight: "600", fontSize: 13.5 },
    codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },

    foot: { textAlign: "center", color: c.slate, fontSize: 13, marginTop: 18 },
    footLink: { color: link, fontWeight: "800" },

    legal: { textAlign: "center", color: c.slate, opacity: 0.7, fontSize: 10.5, marginTop: 26, letterSpacing: 0.4 },
    privacyBtn: { alignSelf: "center", marginTop: 8, paddingVertical: 4 },
    privacyLink: { color: link, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  });
}
