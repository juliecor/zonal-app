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
import { provinceToDomain } from "@/lib/landuse";
import { SERIF, Z } from "@/theme/zonal";

const SUGGESTIONS = [
  "Mandaue vs Cebu City for a commercial lot?",
  "Cheapest residential in Lahug, Cebu City?",
  "Is Banilad flood-prone?",
  "What's the zonal value in Poblacion, Davao City?",
];

export default function AssistantScreen() {
  const params = useLocalSearchParams<{ q?: string; ctx?: string }>();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const ctxRef = useRef<any>(null);

  // Parse an optional property context handed in from the Property screen.
  useEffect(() => {
    if (params.ctx) {
      try { ctxRef.current = JSON.parse(params.ctx); } catch { ctxRef.current = null; }
    }
    if (params.q) send(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.ctx]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setInput("");
    const history = messages.slice();
    setMessages((m) => [...m, { role: "user", content: q }]);
    setSending(true);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    try {
      const domain = ctxRef.current?.province ? provinceToDomain(ctxRef.current.province) : "cebu.zonalvalue.com";
      const { answer } = await askAssistant(q, { domain, history, context: ctxRef.current });
      setMessages((m) => [...m, { role: "assistant", content: answer || "Sorry, I couldn't reach the data just now." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't connect right now. Please try again." }]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }
  }

  const empty = messages.length === 0;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#0f1a3f" }}>
        <View style={s.head}>
          <View style={s.bot}><Text style={s.botT}>✦</Text></View>
          <View>
            <Text style={s.title}>AI Zonal Assistant</Text>
            <Text style={s.sub}>Grounded in BIR + PHIVOLCS</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
        <ScrollView ref={scroller} style={s.feed} contentContainerStyle={{ padding: 13, gap: 9, paddingBottom: 18 }}>
          {empty && (
            <View style={s.welcome}>
              <Text style={s.wTitle}>Ask about any Philippine address.</Text>
              <Text style={s.wSub}>Compare areas, weigh value against risk — grounded in official BIR zonal values and PHIVOLCS / Project NOAH hazards.</Text>
              <View style={s.chips}>
                {SUGGESTIONS.map((sug) => (
                  <Pressable key={sug} onPress={() => send(sug)} style={s.chip}>
                    <Text style={s.chipT}>{sug}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {messages.map((m, i) => <ChatBubble key={i} role={m.role} text={m.content} />)}
          {sending && (
            <View style={s.typing}><ActivityIndicator color={Z.goldLite} size="small" /><Text style={s.typingT}>Thinking…</Text></View>
          )}
        </ScrollView>

        <View style={s.inbar}>
          <TextInput
            value={input} onChangeText={setInput}
            placeholder="Ask about any address…" placeholderTextColor="#8fa0c8"
            style={s.input} multiline onSubmitEditing={() => send(input)} returnKeyType="send"
          />
          <Pressable onPress={() => send(input)} style={[s.send, (!input.trim() || sending) && { opacity: 0.5 }]} disabled={!input.trim() || sending}>
            <Text style={s.sendT}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1430" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  bot: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  botT: { color: "#16223a", fontWeight: "800", fontSize: 14 },
  title: { fontFamily: SERIF, fontSize: 15, fontWeight: "600", color: "#fff" },
  sub: { fontSize: 9.5, color: "#8fa0c8", fontWeight: "600", marginTop: 1 },

  feed: { flex: 1, backgroundColor: "#0b1430" },
  welcome: { paddingVertical: 10 },
  wTitle: { fontFamily: SERIF, fontSize: 19, color: "#fff", fontWeight: "600" },
  wSub: { fontSize: 12.5, color: "#a9b6da", lineHeight: 19, marginTop: 8 },
  chips: { marginTop: 16, gap: 9 },
  chip: { backgroundColor: "rgba(201,168,76,0.14)", borderWidth: 1, borderColor: "rgba(201,168,76,0.35)", borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11 },
  chipT: { color: "#ecd9a4", fontSize: 12.5, fontWeight: "600" },

  typing: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 4 },
  typingT: { color: "#8fa0c8", fontSize: 11.5, fontStyle: "italic" },

  inbar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 26, backgroundColor: "#0b1430", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  input: { flex: 1, maxHeight: 110, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 13.5 },
  send: { width: 38, height: 38, borderRadius: 11, backgroundColor: Z.gold, alignItems: "center", justifyContent: "center" },
  sendT: { color: "#16223a", fontWeight: "800", fontSize: 18 },
});
