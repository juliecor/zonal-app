import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import Animated, {
  Easing, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { ChatBubble } from "@/components/ChatBubble";
import { askAssistant, askAssistantStream, type ChatMsg } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { provinceToDomain } from "@/lib/landuse";
import { computeCosts, estimatedValue } from "@/lib/phComputations";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";
import * as SecureStore from "expo-secure-store";

const AI_HEAD = require("../../../assets/images/ai-head.png");
const AI_MASCOT = require("../../../assets/images/ai-mascot.png");
const MASCOT_RATIO = 1151 / 723; // h/w

// The thinking mascot greets you on an empty chat, with a gentle idle float.
function HeroMascot() {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withSequence(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -7 }] }));
  const h = 196, w = h / MASCOT_RATIO;
  return (
    <View style={{ alignItems: "center", marginBottom: 8 }}>
      <Animated.View style={st}>
        <Image source={AI_MASCOT} style={{ width: w, height: h }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

// Quick-ask chips. With a property in view we offer lot-specific questions; otherwise general ones.
const GENERAL_ASKS = [
  "Taxes & fees to transfer a ₱3,000,000 lot?",
  "Monthly amortization on a ₱2.5M lot, 20% down, 20 years?",
  "What's the commercial zonal value in Lahug, Cebu City?",
  "Cheapest residential area in Mandaue?",
  "Is Banilad, Cebu City flood-prone?",
];
const CONTEXT_ASKS = [
  "Is this good value for the risk?",
  "Total cost to buy this — taxes & fees",
  "Monthly amortization — 20% down, 20 years",
  "What business fits this location?",
  "Explain the geohazards in simple terms",
];

// Reply language. English is the default; the others append a directive the model follows.
const LANG_KEY = "zv_ai_lang";
const LANGS: { key: string; label: string; directive?: string }[] = [
  { key: "English", label: "EN" },
  { key: "Tagalog", label: "Tagalog", directive: "Reply in conversational Tagalog (Filipino). Keep legal/tax terms (e.g. Capital Gains Tax) and ₱ amounts as-is." },
  { key: "Bisaya", label: "Bisaya", directive: "Reply in Cebuano (Bisaya). Keep legal/tax terms (e.g. Capital Gains Tax) and ₱ amounts as-is." },
];
function langDirective(lang: string): string {
  const d = LANGS.find((l) => l.key === lang)?.directive;
  return d ? `\n\n[${d}]` : "";
}

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
    `• Broker's professional fee (${Math.round(c.brokerRate * 100)}%, seller, customary/negotiable): ${p(c.brokerFee)}\n` +
    `• Total transaction costs (incl. broker's fee): ${p(c.totalFees)}\n` +
    `• Monthly amortization (80% loan, 6.5% p.a., 20 yrs): ${p(c.monthlyAmortization)}/mo\n` +
    `Scale value/taxes linearly with area; recompute for any down-payment/rate/term the user gives.]`
  );
}

// When a property is open (came from the map/property screen), ground EVERY answer in its
// real value, classification and geohazards — so the AI talks about THIS lot, not generic.
function ctxPropertyReference(ctx: any): string {
  if (!ctx) return "";
  const parts: string[] = [];
  const loc = [ctx.street, ctx.barangay, ctx.city].filter(Boolean).join(", ");
  if (loc) parts.push(`Location: ${loc}`);
  if (Number(ctx.zonalValue) > 0) parts.push(`BIR zonal value: ₱${Number(ctx.zonalValue).toLocaleString("en-PH")}/sqm${ctx.classification ? ` (${ctx.classification})` : ""}`);
  if (ctx.landUse) parts.push(`Land-use values: ${ctx.landUse}`);
  const hz = [
    ctx.flood && `flood ${ctx.flood}`, ctx.landslide && `landslide ${ctx.landslide}`,
    ctx.stormSurge && `storm surge ${ctx.stormSurge}`, ctx.fault && `fault ${ctx.fault}`,
    ctx.liquefaction && `liquefaction ${ctx.liquefaction}`, ctx.tsunami && `tsunami ${ctx.tsunami}`,
  ].filter(Boolean).join(", ");
  if (hz) parts.push(`Geohazards: ${hz}`);
  if (ctx.overallRisk) parts.push(`Overall risk: ${ctx.overallRisk}`);
  if (!parts.length) return "";
  return `\n\n[PROPERTY THE USER IS VIEWING — ground your answer in this exact lot:\n• ${parts.join("\n• ")}]`;
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
  const [ctx, setCtx] = useState<any>(null);       // same as ctxRef, but reactive for the chips
  const [lang, setLang] = useState("English");
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullRef = useRef("");                      // the full reply currently being typed
  const targetRef = useRef("");                    // streamed text received so far
  const shownLenRef = useRef(0);                   // how much of it is revealed
  const doneRef = useRef(false);                   // stream finished?

  // Remember the agent's preferred reply language.
  useEffect(() => { SecureStore.getItemAsync(LANG_KEY).then((v) => { if (v) setLang(v); }).catch(() => {}); }, []);
  function chooseLang(l: string) { setLang(l); SecureStore.setItemAsync(LANG_KEY, l).catch(() => {}); }

  useEffect(() => {
    if (params.ctx) {
      try { const parsed = JSON.parse(params.ctx); ctxRef.current = parsed; setCtx(parsed); }
      catch { ctxRef.current = null; setCtx(null); }
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

  // Smooth typewriter that FOLLOWS the incoming stream: reveals up to whatever has arrived
  // so far, catching up a little when it's behind — so it types nicely instead of dumping
  // each chunk, while still starting in ~1s.
  function startDrain() {
    if (typeTimer.current) return;
    const tick = () => {
      const target = targetRef.current;
      if (shownLenRef.current < target.length) {
        const backlog = target.length - shownLenRef.current;
        const step = Math.max(1, Math.min(3, Math.ceil(backlog / 22)));
        shownLenRef.current = Math.min(target.length, shownLenRef.current + step);
        const text = target.slice(0, shownLenRef.current);
        setMessages((m) => { if (!m.length) return m; const c = m.slice(); c[c.length - 1] = { role: "assistant", content: text }; return c; });
        scrollEnd(false);
      }
      if (shownLenRef.current < targetRef.current.length || !doneRef.current) {
        typeTimer.current = setTimeout(tick, 30);
      } else {
        typeTimer.current = null;
        fullRef.current = "";
        setTyping(false);
      }
    };
    typeTimer.current = setTimeout(tick, 30);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading || typing) return;
    setInput("");
    const history = messages.slice();
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    scrollEnd();

    const ctxObj = ctxRef.current;
    const domain = ctxObj?.province ? provinceToDomain(ctxObj.province) : "cebu.zonalvalue.com";
    // Ground the answer in the open property, attach exact app-computed cost figures for
    // money questions, and steer the reply language — then ask.
    let apiQuestion = q;
    if (ctxObj) apiQuestion += ctxPropertyReference(ctxObj);
    if (COST_INTENT.test(q)) apiQuestion += ctxCostReference(ctxObj);
    apiQuestion += langDirective(lang);

    // Stream the reply, but reveal it with a smooth typewriter that follows the tokens.
    targetRef.current = ""; shownLenRef.current = 0; doneRef.current = false;
    let added = false;
    const showChunk = (full: string) => {
      targetRef.current = full;
      fullRef.current = full;
      if (!added) {
        added = true;
        setLoading(false); setTyping(true);
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        startDrain();
      }
    };

    try {
      const { answer } = await askAssistantStream(apiQuestion, { domain, history, context: ctxObj, token }, showChunk);
      if (!added) {
        // nothing streamed — reveal the final answer with the typewriter
        setLoading(false);
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        setTyping(true);
        targetRef.current = answer || "Sorry, I couldn't reach the data just now. Please try again.";
        shownLenRef.current = 0; doneRef.current = true; startDrain();
      } else {
        if (answer) targetRef.current = answer;   // final (trimmed) text
        doneRef.current = true;                   // let the drain finish typing, then stop
      }
    } catch {
      if (added) { doneRef.current = true; return; } // keep the partial streamed text; drain ends it
      // Streaming unavailable → fall back to the non-streaming request + typewriter.
      try {
        const { answer } = await askAssistant(apiQuestion, { domain, history, context: ctxObj, token });
        setLoading(false);
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        setTyping(true);
        await typeOut(answer || "Sorry, I couldn't reach the data just now. Please try again.");
        setTyping(false);
      } catch {
        setLoading(false); setTyping(false);
        setMessages((m) => [...m, { role: "assistant", content: "I couldn't connect right now. Please try again." }]);
      }
    }
  }

  const empty = messages.length === 0;
  const busy = loading || typing;
  const asks = ctx ? CONTEXT_ASKS : GENERAL_ASKS;

  return (
    <Animated.View style={[s.root, kbStyle]}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.head}>
          <Image source={AI_HEAD} style={s.headLogo} contentFit="contain" />
          <View style={s.langRow}>
            {LANGS.map((l) => (
              <Pressable key={l.key} onPress={() => chooseLang(l.key)} style={[s.langPill, lang === l.key && s.langPillOn]} hitSlop={6}>
                <Text style={[s.langPillT, lang === l.key && s.langPillTOn]}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView ref={scroller} style={s.feed} contentContainerStyle={{ padding: 14, gap: 11, paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
        {empty && (
          <View style={s.welcome}>
            <HeroMascot />
            <View style={[s.wBadge, { alignSelf: "center" }]}><Text style={s.wBadgeT}>✦  YOUR ZONAL ANALYST</Text></View>
            <Text style={[s.wTitle, { textAlign: "center" }]}>Ask about any Philippine address.</Text>
            <Text style={[s.wSub, { textAlign: "center" }]}>Compare areas, weigh value against risk — answered in plain language and grounded in official BIR zonal values and PHIVOLCS / Project NOAH hazards.</Text>
            <View style={s.chips}>
              {asks.map((sug) => (
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
            <Image source={AI_HEAD} style={s.botMark} contentFit="contain" />
            <View style={s.typingBubble}><ActivityIndicator color="#155EEF" size="small" /><Text style={s.typingT}>Analyzing…</Text></View>
          </View>
        )}
      </ScrollView>

      {!empty && !busy && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickWrap} contentContainerStyle={s.quickRow} keyboardShouldPersistTaps="handled">
          {asks.map((a) => (
            <Pressable key={a} onPress={() => send(a)} style={s.quickChip}><Text style={s.quickChipT} numberOfLines={1}>{a}</Text></Pressable>
          ))}
        </ScrollView>
      )}

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
  const brandBlue = "#155EEF", blueDeep = "#0f49c4"; // matches the AI mascot / logo
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingVertical: 8 },
    headLogo: { width: 46, height: 46 },
    langRow: { flexDirection: "row", gap: 4, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 100, padding: 3 },
    langPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 100 },
    langPillOn: { backgroundColor: brandBlue },
    langPillT: { color: "#cdd6ee", fontSize: 11.5, fontWeight: "700" },
    langPillTOn: { color: "#ffffff" },
    quickWrap: { flexGrow: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.line },
    quickRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    quickChip: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 100, paddingHorizontal: 13, paddingVertical: 8 },
    quickChipT: { color: c.inkSoft, fontSize: 12.5, fontWeight: "600" },
    bot: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.goldLite },
    botT: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
    title: { fontFamily: SERIF, fontSize: 15, fontWeight: "600", color: "#fff" },
    sub: { fontSize: 9.5, color: "#9fb0d8", fontWeight: "600", marginTop: 1 },

    feed: { flex: 1, backgroundColor: c.paper },
    welcome: { paddingVertical: 8 },
    wBadge: { alignSelf: "flex-start", backgroundColor: c.isDark ? "rgba(21,94,239,0.16)" : "#e8f0ff", borderWidth: 1, borderColor: "rgba(21,94,239,0.35)", borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
    wBadgeT: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, color: brandBlue },
    wTitle: { fontFamily: SERIF, fontSize: 22, color: c.ink, fontWeight: "700", lineHeight: 27 },
    wSub: { fontSize: 13, color: c.slate, lineHeight: 20, marginTop: 9 },
    chips: { marginTop: 18, gap: 9 },
    chip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, shadowColor: c.shadow, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
    chipT: { color: c.inkSoft, fontSize: 13, fontWeight: "600", flex: 1 },
    chipArrow: { color: brandBlue, fontSize: 15, fontWeight: "800" },
    tip: { fontSize: 11.5, color: c.slate, marginTop: 16, fontStyle: "italic", textAlign: "center" },

    typing: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
    botMark: { width: 28, height: 28, marginBottom: 2 },
    typingBubble: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, borderBottomLeftRadius: 5, paddingHorizontal: 13, paddingVertical: 11 },
    typingT: { color: c.slate, fontSize: 12.5, fontStyle: "italic" },

    inbar: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 26 : 12, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line },
    input: { flex: 1, maxHeight: 110, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 9, color: c.ink, fontSize: 14 },
    send: { width: 42, height: 42, borderRadius: 12, backgroundColor: brandBlue, alignItems: "center", justifyContent: "center", shadowColor: blueDeep, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    sendT: { color: "#ffffff", fontWeight: "800", fontSize: 19 },
  });
}
