import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { useTheme, type Palette } from "@/theme/theme";

const AI_MARK = require("../../assets/images/ai-head.png");

// ── Lightweight markdown for the assistant: **bold**, bullet/numbered lists, headings,
//    paragraph spacing, and highlighted ₱ amounts. No deps; safe with the typewriter
//    (incomplete **pairs while typing stay literal until the closing ** arrives).
const MONEY = /₱\s?\d[\d,]*(?:\.\d+)?/g;

type Span = { t: string; bold?: boolean; money?: boolean };

function moneySpans(text: string, bold: boolean): Span[] {
  const out: Span[] = [];
  let last = 0; let m: RegExpExecArray | null;
  MONEY.lastIndex = 0;
  while ((m = MONEY.exec(text)) !== null) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), bold });
    out.push({ t: m[0], bold: true, money: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), bold });
  return out;
}

function inlineSpans(str: string): Span[] {
  const out: Span[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(...moneySpans(str.slice(last, m.index), false));
    out.push(...moneySpans(m[1], true));
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(...moneySpans(str.slice(last), false));
  return out;
}

type Block =
  | { type: "head"; content: string }
  | { type: "num"; marker: string; content: string }
  | { type: "bul"; content: string }
  | { type: "para"; content: string };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue; // blank line → spacing comes from block margins
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) { blocks.push({ type: "num", marker: m[1] + ".", content: m[2] }); continue; }
    if ((m = line.match(/^[-•*]\s+(.*)$/))) { blocks.push({ type: "bul", content: m[1] }); continue; }
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { blocks.push({ type: "head", content: m[1] }); continue; }
    if ((m = line.match(/^\*\*(.+?)\*\*:?$/))) { blocks.push({ type: "head", content: m[1] }); continue; }
    blocks.push({ type: "para", content: line });
  }
  return blocks;
}

function Rich({ text, b }: { text: string; b: ReturnType<typeof makeStyles> }) {
  const blocks = toBlocks(text);
  const spanEls = (str: string, headingTone = false) =>
    inlineSpans(str).map((sp, j) => (
      <Text key={j} style={[sp.bold && !headingTone && b.bold, sp.money && b.money]}>{sp.t}</Text>
    ));
  return (
    <View>
      {blocks.map((bl, i) => {
        const first = i === 0;
        if (bl.type === "head")
          return <Text key={i} style={[b.head, first && b.firstBlock]}>{spanEls(bl.content, true)}</Text>;
        if (bl.type === "num" || bl.type === "bul")
          return (
            <View key={i} style={[b.li, first && b.firstBlock]}>
              <Text style={b.marker}>{bl.type === "num" ? bl.marker : "•"}</Text>
              <Text style={[b.t, b.liText]}>{spanEls(bl.content)}</Text>
            </View>
          );
        return <Text key={i} style={[b.t, b.para, first && b.firstBlock]}>{spanEls(bl.content)}</Text>;
      })}
    </View>
  );
}

export function ChatBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const { c } = useTheme();
  const b = useMemo(() => makeStyles(c), [c]);
  const me = role === "user";
  return (
    <View style={[b.wrap, me ? b.meWrap : b.aiWrap]}>
      {!me && <Image source={AI_MARK} style={b.botMark} contentFit="contain" />}
      <View style={[b.bub, me ? b.me : b.ai]}>
        {me ? <Text style={[b.t, b.tMe]}>{text}</Text> : <Rich text={text} b={b} />}
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  const brandBlue = "#155EEF";                    // matches the AI mascot / logo
  const accent = c.isDark ? "#8fb4ff" : brandBlue; // ₱ amounts, headings, list markers
  return StyleSheet.create({
    wrap: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 7 },
    meWrap: { justifyContent: "flex-end" },
    aiWrap: { justifyContent: "flex-start" },
    botMark: { width: 28, height: 28, marginBottom: 2 },
    bub: { maxWidth: "84%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
    me: { backgroundColor: brandBlue, borderBottomRightRadius: 5 },
    ai: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 5,
      shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
    },
    t: { fontSize: 14, lineHeight: 21, color: c.ink },
    tMe: { color: "#ffffff", fontWeight: "600" },

    // rich blocks
    firstBlock: { marginTop: 0 },
    para: { marginTop: 9 },
    bold: { fontWeight: "700", color: c.isDark ? "#fff" : c.ink },
    money: { fontWeight: "800", color: accent },
    head: { fontSize: 14.5, fontWeight: "800", color: accent, marginTop: 13, marginBottom: 1, letterSpacing: 0.1 },
    li: { flexDirection: "row", marginTop: 6, alignItems: "flex-start" },
    marker: { width: 22, fontSize: 14, lineHeight: 21, fontWeight: "800", color: accent },
    liText: { flex: 1 },
  });
}
