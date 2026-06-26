import { StyleSheet, Text, View } from "react-native";

import { Z } from "@/theme/zonal";

export function ChatBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const me = role === "user";
  return (
    <View style={[b.wrap, me ? b.meWrap : b.aiWrap]}>
      <View style={[b.bub, me ? b.me : b.ai]}>
        <Text style={[b.t, me ? b.tMe : b.tAi]}>{text}</Text>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  wrap: { width: "100%", flexDirection: "row" },
  meWrap: { justifyContent: "flex-end" },
  aiWrap: { justifyContent: "flex-start" },
  bub: { maxWidth: "88%", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10 },
  me: { backgroundColor: Z.gold, borderBottomRightRadius: 5 },
  ai: { backgroundColor: "rgba(255,255,255,0.09)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderBottomLeftRadius: 5 },
  t: { fontSize: 13, lineHeight: 19 },
  tMe: { color: "#16223a", fontWeight: "600" },
  tAi: { color: "#e7ebf7" },
});
