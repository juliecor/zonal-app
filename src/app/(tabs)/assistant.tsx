import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";

import { ChatBubble } from "@/components/ChatBubble";
import { askAssistant, type ChatMsg } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { provinceToDomain } from "@/lib/landuse";
import { SERIF, Z } from "@/theme/zonal";

const SUGGESTIONS = [
  "What's the commercial zonal value in Lahug, Cebu City?",
  "Compare Mandaue City vs Cebu City for a commercial lot",
  "Is Banilad, Cebu City flood-prone?",
  "Cheapest residential area in Cebu City?",
];

export default function AssistantScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ q?: string; ctx?: string }>();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // awaiting the reply
  const [typing, setTyping] = useState(false);    // letter-by-letter animation running
  const scroller = useRef<ScrollView>(null);
  const ctxRef = useRef<any>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.ctx) {
      try { ctxRef.current = JSON.parse(params.ctx); } catch { ctxRef.current = null; }
    }
    if (params.q) send(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.ctx]);

  // clean up the typewriter timer on unmount
  useEffect(() => () => { if (typeTimer.current) clearTimeout(typeTimer.current); }, []);

  const scrollEnd = (animated = true) => requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated }));

  // Reveal the reply letter-by-letter into the last (assistant) bubble.
  function typeOut(full: string): Promise<void> {
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
        if (i < full.length) typeTimer.current = setTimeout(tick, 14);
        else resolve();
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
      const { answer } = await askAssistant(q, { domain, history, context: ctxRef.current, token });
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
    <View style={s.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.navy }}>
          <View style={s.head}>
            <View style={s.bot}><Text style={s.botT}>✦</Text></View>
            <View>
              <Text style={s.title}>AI Zonal Assistant</Text>
              <Text style={s.sub}>Grounded in BIR + PHIVOLCS</Text>
            </View>
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
              <View style={s.typingBubble}><ActivityIndicator color={Z.goldDeep} size="small" /><Text style={s.typingT}>Analyzing…</Text></View>
            </View>
          )}
        </ScrollView>

        <View style={s.inbar}>
          <TextInput
            value={input} onChangeText={setInput}
            placeholder="Ask about any address…" placeholderTextColor={Z.slate}
            style={s.input} multiline onSubmitEditing={() => send(input)} returnKeyType="send"
            onFocus={() => scrollEnd()}
          />
          <Pressable onPress={() => send(input)} style={[s.send, (!input.trim() || busy) && { opacity: 0.4 }]} disabled={!input.trim() || busy}>
            <Text style={s.sendT}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 11 },
  bot: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  botT: { color: "#16223a", fontWeight: "800", fontSize: 14 },
  title: { fontFamily: SERIF, fontSize: 15, fontWeight: "600", color: "#fff" },
  sub: { fontSize: 9.5, color: "#9fb0d8", fontWeight: "600", marginTop: 1 },

  feed: { flex: 1, backgroundColor: Z.paper },
  welcome: { paddingVertical: 8 },
  wBadge: { alignSelf: "flex-start", backgroundColor: "#fbf2d8", borderWidth: 1, borderColor: "rgba(201,168,76,0.4)", borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
  wBadgeT: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, color: Z.goldDeep },
  wTitle: { fontFamily: SERIF, fontSize: 22, color: Z.ink, fontWeight: "700", lineHeight: 27 },
  wSub: { fontSize: 13, color: Z.slate, lineHeight: 20, marginTop: 9 },
  chips: { marginTop: 18, gap: 9 },
  chip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: Z.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, shadowColor: "#0c1430", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  chipT: { color: Z.inkSoft, fontSize: 13, fontWeight: "600", flex: 1 },
  chipArrow: { color: Z.gold, fontSize: 15, fontWeight: "800" },
  tip: { fontSize: 11.5, color: Z.slate, marginTop: 16, fontStyle: "italic", textAlign: "center" },

  typing: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  botMark: { width: 24, height: 24, borderRadius: 8, backgroundColor: Z.goldLite, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  botMarkT: { color: "#16223a", fontSize: 12, fontWeight: "800" },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: Z.line, borderRadius: 16, borderBottomLeftRadius: 5, paddingHorizontal: 13, paddingVertical: 11 },
  typingT: { color: Z.slate, fontSize: 12.5, fontStyle: "italic" },

  inbar: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 26 : 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: Z.line },
  input: { flex: 1, maxHeight: 110, backgroundColor: Z.paper, borderWidth: 1, borderColor: Z.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 9, color: Z.ink, fontSize: 14 },
  send: { width: 42, height: 42, borderRadius: 12, backgroundColor: Z.gold, alignItems: "center", justifyContent: "center", shadowColor: Z.goldDeep, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  sendT: { color: "#16223a", fontWeight: "800", fontSize: 19 },
});
