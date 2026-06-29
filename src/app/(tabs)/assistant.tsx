import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { ChatBubble } from "@/components/ChatBubble";
import { askAssistant, type ChatMsg } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { provinceToDomain } from "@/lib/landuse";
import { computeCosts, estimatedValue } from "@/lib/phComputations";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";

const SUGGESTIONS = [
  "What's the commercial zonal value in Lahug, Cebu City?",
  "Taxes & fees to transfer a ₱3,000,000 lot?",
  "Monthly amortization on a ₱2.5M lot, 20% down, 20 years?",
  "Is Banilad, Cebu City flood-prone?",
];

// Cost/tax/financing intent → attach app-computed reference figures to the question.
const COST_INTENT = /\b(cost|costs|tax|taxes|cgt|capital\s*gains|dst|stamp|transfer|registration|amortizat|amortis|monthly|mortgage|loan|financ|down\s*payment|amilyar|rpt|real\s*property\s*tax|fee|fees|closing|how\s*much|magkano|budget|afford|down)\b/i;

// Exact figures the AI should present verbatim (avoids 4o-mini arithmetic slips).
function ctxCostReference(ctx: any): string {
  const v = Number(ctx?.zonalValue);
  if (!isFinite(v) || v <= 0) return "";
  const area = 250;
  const c = computeCosts({ price: estimatedValue(v, area) });
  const p = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
  return (
    `\n\n[REFERENCE FIGURES computed by the app — use these exact numbers if the question is about costs, taxes, or financing. ` +
    `Illustrative for a ${area} sqm lot at ₱${v.toLocaleString("en-PH")}/sqm (apply the "higher of price or zonal value" rule; rates vary by LGU; estimates only):\n` +
    `• Estimated value (${area} sqm): ${p(c.price)}\n` +
    `• Capital Gains Tax (6%, seller): ${p(c.cgt)}\n` +
    `• Documentary Stamp Tax (1.5%, buyer): ${p(c.dst)}\n` +
    `• Transfer Tax (0.75%, buyer): ${p(c.transferTax)}\n` +
    `• Registration fee (~0.25%, buyer): ${p(c.registrationFee)}\n` +
    `• Total taxes & fees: ${p(c.totalFees)}\n` +
    `• Monthly amortization (80% loan, 6.5% p.a., 20 yrs): ${p(c.monthlyAmortization)}/mo\n` +
    `Scale value/taxes linearly with area; recompute for any down-payment/rate/term the user gives.]`
  );
}

export default function AssistantScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ q?: string; ctx?: string }>();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // awaiting the reply
  const [typing, setTyping] = useState(false);    // letter-by-letter animation running
  const scroller = useRef<ScrollView>(null);
  const ctxRef = useRef<any>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullRef = useRef("");                      // the full reply currently being typed

  useEffect(() => {
    if (params.ctx) {
      try { ctxRef.current = JSON.parse(params.ctx); } catch { ctxRef.current = null; }
    }
    if (params.q) send(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.ctx]);

  useEffect(() => () => { if (typeTimer.current) clearTimeout(typeTimer.current); }, []);

  // Lift the input above the keyboard via reanimated (tracks the keyboard on the UI
  // thread — reliable on Android edge-to-edge, no container resize, no flicker).
  const keyboard = useAnimatedKeyboard();
  const kbStyle = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));

  // Stop the typewriter cleanly when leaving the screen (snap reply to full text).
  useFocusEffect(
    useCallback(() => () => {
      if (typeTimer.current) { clearTimeout(typeTimer.current); typeTimer.current = null; }
      if (fullRef.current) {
        const full = fullRef.current;
        fullRef.current = "";
        setMessages((m) => {
          if (!m.length) return m;
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: full };
          return copy;
        });
        setTyping(false);
      }
    }, []),
  );

  const scrollEnd = (animated = true) => requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated }));

  function typeOut(full: string): Promise<void> {
    fullRef.current = full;
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        i = Math.min(full.length, i + 2);
        setMessages((m) => {
          if (!m.length) return m;
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: full.slice(0, i) };
          return copy;
        });
        scrollEnd(false);
        if (i < full.length) { typeTimer.current = setTimeout(tick, 14); }
        else { fullRef.current = ""; resolve(); }
      };
      tick();
    });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading || typing) return;
    setInput("");
    const history = messages.slice();
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    scrollEnd();
    try {
      const domain = ctxRef.current?.province ? provinceToDomain(ctxRef.current.province) : "cebu.zonalvalue.com";
      // For cost/tax/financing questions about a selected property, hand the AI exact app-computed figures.
      const apiQuestion = COST_INTENT.test(q) ? q + ctxCostReference(ctxRef.current) : q;
      const { answer } = await askAssistant(apiQuestion, { domain, history, context: ctxRef.current, token });
      setLoading(false);
      const reply = answer || "Sorry, I couldn't reach the data just now. Please try again.";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      setTyping(true);
      await typeOut(reply);
      setTyping(false);
    } catch {
      setLoading(false);
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't connect right now. Please try again." }]);
    }
  }

  const empty = messages.length === 0;
  const busy = loading || typing;

  return (
    <Animated.View style={[s.root, kbStyle]}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.head}>
          <Image source={require("../../../assets/images/zonal-ai-mark.png")} style={s.headLogo} contentFit="contain" />
        </View>
      </SafeAreaView>

      <ScrollView ref={scroller} style={s.feed} contentContainerStyle={{ padding: 14, gap: 11, paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
        {empty && (
          <View style={s.welcome}>
            <View style={s.wBadge}><Text style={s.wBadgeT}>✦  YOUR ZONAL ANALYST</Text></View>
            <Text style={s.wTitle}>Ask about any Philippine address.</Text>
            <Text style={s.wSub}>Compare areas, weigh value against risk — answered in plain language and grounded in official BIR zonal values and PHIVOLCS / Project NOAH hazards.</Text>
            <View style={s.chips}>
              {SUGGESTIONS.map((sug) => (
                <Pressable key={sug} onPress={() => send(sug)} style={s.chip}>
                  <Text style={s.chipT}>{sug}</Text>
                  <Text style={s.chipArrow}>→</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.tip}>Tip: even a short phrase works — try "banilad" or "cheapest in mandaue".</Text>
          </View>
        )}
        {messages.map((m, i) => <ChatBubble key={i} role={m.role} text={m.content} />)}
        {loading && (
          <View style={s.typing}>
            <View style={s.botMark}><Text style={s.botMarkT}>✦</Text></View>
            <View style={s.typingBubble}><ActivityIndicator color={c.goldDeep} size="small" /><Text style={s.typingT}>Analyzing…</Text></View>
          </View>
        )}
      </ScrollView>

      <View style={s.inbar}>
        <TextInput
          value={input} onChangeText={setInput}
          placeholder="Ask about any address…" placeholderTextColor={c.slate}
          style={s.input} multiline onSubmitEditing={() => send(input)} returnKeyType="send"
          onFocus={() => scrollEnd()}
        />
        <Pressable onPress={() => send(input)} style={[s.send, (!input.trim() || busy) && { opacity: 0.4 }]} disabled={!input.trim() || busy}>
          <Text style={s.sendT}>↑</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    head: { alignItems: "center", justifyContent: "center", paddingHorizontal: 15, paddingVertical: 8 },
  headLogo: { width: 46, height: 46 },
    bot: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.goldLite },
    botT: { color: "#16223a", fontWeight: "800", fontSize: 14 },
    title: { fontFamily: SERIF, fontSize: 15, fontWeight: "600", color: "#fff" },
    sub: { fontSize: 9.5, color: "#9fb0d8", fontWeight: "600", marginTop: 1 },

    feed: { flex: 1, backgroundColor: c.paper },
    welcome: { paddingVertical: 8 },
    wBadge: { alignSelf: "flex-start", backgroundColor: c.isDark ? "rgba(201,168,76,0.14)" : "#fbf2d8", borderWidth: 1, borderColor: "rgba(201,168,76,0.4)", borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
    wBadgeT: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, color: c.goldDeep },
    wTitle: { fontFamily: SERIF, fontSize: 22, color: c.ink, fontWeight: "700", lineHeight: 27 },
    wSub: { fontSize: 13, color: c.slate, lineHeight: 20, marginTop: 9 },
    chips: { marginTop: 18, gap: 9 },
    chip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, shadowColor: c.shadow, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
    chipT: { color: c.inkSoft, fontSize: 13, fontWeight: "600", flex: 1 },
    chipArrow: { color: c.gold, fontSize: 15, fontWeight: "800" },
    tip: { fontSize: 11.5, color: c.slate, marginTop: 16, fontStyle: "italic", textAlign: "center" },

    typing: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
    botMark: { width: 24, height: 24, borderRadius: 8, backgroundColor: c.goldLite, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    botMarkT: { color: "#16223a", fontSize: 12, fontWeight: "800" },
    typingBubble: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, borderBottomLeftRadius: 5, paddingHorizontal: 13, paddingVertical: 11 },
    typingT: { color: c.slate, fontSize: 12.5, fontStyle: "italic" },

    inbar: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 26 : 12, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line },
    input: { flex: 1, maxHeight: 110, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 9, color: c.ink, fontSize: 14 },
    send: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.gold, alignItems: "center", justifyContent: "center", shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    sendT: { color: "#16223a", fontWeight: "800", fontSize: 19 },
  });
}
