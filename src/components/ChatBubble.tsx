import { StyleSheet, Text, View } from "react-native";

import { Z } from "@/theme/zonal";

export function ChatBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const me = role === "user";
  return (
    <View style={[b.wrap, me ? b.meWrap : b.aiWrap]}>
      {!me && <View style={b.botMark}><Text style={b.botT}>✦</Text></View>}
      <View style={[b.bub, me ? b.me : b.ai]}>
        <Text style={[b.t, me ? b.tMe : b.tAi]}>{text}</Text>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  wrap: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 7 },
  meWrap: { justifyContent: "flex-end" },
  aiWrap: { justifyContent: "flex-start" },
  botMark: { width: 24, height: 24, borderRadius: 8, backgroundColor: Z.goldLite, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  botT: { color: "#16223a", fontSize: 12, fontWeight: "800" },
  bub: { maxWidth: "84%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  me: { backgroundColor: Z.gold, borderBottomRightRadius: 5 },
  ai: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: Z.line, borderBottomLeftRadius: 5,
    shadowColor: "#0c1430", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  t: { fontSize: 14, lineHeight: 21 },
  tMe: { color: "#16223a", fontWeight: "600" },
  tAi: { color: Z.ink },
});
