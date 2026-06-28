import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Palette } from "@/theme/theme";

export function ChatBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const { c } = useTheme();
  const b = useMemo(() => makeStyles(c), [c]);
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
    wrap: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 7 },
    meWrap: { justifyContent: "flex-end" },
    aiWrap: { justifyContent: "flex-start" },
    botMark: { width: 24, height: 24, borderRadius: 8, backgroundColor: c.goldLite, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    botT: { color: "#16223a", fontSize: 12, fontWeight: "800" },
    bub: { maxWidth: "84%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
    me: { backgroundColor: c.gold, borderBottomRightRadius: 5 },
    ai: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 5,
      shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
    },
    t: { fontSize: 14, lineHeight: 21 },
    tMe: { color: "#16223a", fontWeight: "600" },
    tAi: { color: c.ink },
  });
}
