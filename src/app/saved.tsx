import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { ClassChip } from "@/components/ClassChip";
import { savedStore, type SavedLot } from "@/lib/saved";
import { useStore } from "@/lib/store";
import { peso, SERIF, titleCase } from "@/theme/zonal";
import { useTheme, type Palette } from "@/theme/theme";

const keyOf = (l: { lat: number; lon: number }) => `${l.lat.toFixed(5)},${l.lon.toFixed(5)}`;

export default function SavedScreen() {
  const { c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const lots = useStore(savedStore);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);

  function toggleSel(l: SavedLot) {
    setSel((prev) => {
      const n = new Set(prev); const k = keyOf(l);
      if (n.has(k)) n.delete(k);
      else if (n.size < 3) n.add(k); // compare up to 3
      return n;
    });
  }
  const chosen = lots.filter((l) => sel.has(keyOf(l)));

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.bar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.barIc}><Ionicons name="chevron-back" size={18} color="#fff" /></Pressable>
          <Text style={s.barTitle}>Saved lots{lots.length ? ` · ${lots.length}` : ""}</Text>
          <View style={s.barIc} />
        </View>
        <View style={s.accent} />
      </SafeAreaView>

      {lots.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bookmark-outline" size={34} color={c.slate} />
          <Text style={s.emptyT}>No saved lots yet</Text>
          <Text style={s.emptySub}>Tap the ♥ on any property or map result to save it here as a market comp.</Text>
        </View>
      ) : (
        <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <Text style={s.hint}>Tap a card to open it · tap the circle to select for comparison (up to 3).</Text>

          {comparing && chosen.length >= 2 && (
            <View style={s.cmpWrap}>
              <View style={s.cmpHead}>
                <Text style={s.cmpTitle}>Comparison</Text>
                <Pressable onPress={() => setComparing(false)} hitSlop={8}><Ionicons name="close" size={16} color={c.slate} /></Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {chosen.map((l) => (
                  <View key={keyOf(l)} style={s.col}>
                    <Text style={s.colName} numberOfLines={2}>{l.name}</Text>
                    <Text style={s.colVal}>{l.value != null ? peso(l.value) : "—"}<Text style={s.colPer}>/sqm</Text></Text>
                    <View style={{ marginTop: 6, alignSelf: "flex-start" }}>{!!l.code && <ClassChip code={l.code} size="sm" />}</View>
                    <Text style={s.colAddr} numberOfLines={2}>{l.address}</Text>
                    {l.value != null && <Text style={s.colEst}>≈ {peso(l.value * 250)} / 250 sqm</Text>}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ gap: 10, marginTop: 4 }}>
            {lots.map((l) => {
              const k = keyOf(l); const on = sel.has(k);
              return (
                <View key={k} style={s.card}>
                  <Pressable style={s.cardMain} onPress={() => router.push({ pathname: "/property", params: { lat: String(l.lat), lon: String(l.lon), name: l.name } } as any)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName} numberOfLines={1}>{l.name}</Text>
                      <Text style={s.cardAddr} numberOfLines={1}>{l.address}</Text>
                      <View style={s.cardValRow}>
                        <Text style={s.cardVal}>{l.value != null ? peso(l.value) : "—"}<Text style={s.cardPer}> /sqm</Text></Text>
                        {!!l.code && <ClassChip code={l.code} size="sm" />}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.slate} />
                  </Pressable>
                  <View style={s.cardActions}>
                    <Pressable onPress={() => toggleSel(l)} hitSlop={8} style={[s.checkbox, on && { backgroundColor: c.gold, borderColor: c.gold }]}>
                      {on && <Ionicons name="checkmark" size={13} color="#16223a" />}
                    </Pressable>
                    <Pressable onPress={() => savedStore.remove(l)} hitSlop={8} style={s.removeBtn}>
                      <Ionicons name="heart" size={18} color={c.gold} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {sel.size >= 2 && !comparing && (
        <Pressable style={s.cmpBtn} onPress={() => setComparing(true)}>
          <Ionicons name="git-compare-outline" size={17} color="#16223a" />
          <Text style={s.cmpBtnT}>Compare {sel.size} selected</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
    barIc: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
    barTitle: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
    accent: { height: 2, backgroundColor: c.gold },

    body: { flex: 1 },
    hint: { fontSize: 11.5, color: c.slate, marginBottom: 12, lineHeight: 16 },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 10 },
    emptyT: { fontFamily: SERIF, fontSize: 18, fontWeight: "700", color: c.ink },
    emptySub: { fontSize: 13, color: c.slate, textAlign: "center", lineHeight: 19 },

    cmpWrap: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 12, marginBottom: 14 },
    cmpHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    cmpTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, color: c.isDark ? c.goldLite : c.navy },
    col: { width: 150, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 11 },
    colName: { fontSize: 12.5, fontWeight: "700", color: c.ink, lineHeight: 16, minHeight: 32 },
    colVal: { fontFamily: SERIF, fontSize: 18, fontWeight: "700", color: c.ink, marginTop: 6 },
    colPer: { fontFamily: "System", fontSize: 10, color: c.slate, fontWeight: "600" },
    colAddr: { fontSize: 10.5, color: c.slate, marginTop: 7, lineHeight: 14, minHeight: 28 },
    colEst: { fontSize: 10.5, color: c.isDark ? c.goldLite : c.goldDeep, fontWeight: "700", marginTop: 6 },

    card: { flexDirection: "row", alignItems: "stretch", backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 15, overflow: "hidden" },
    cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 13 },
    cardName: { fontSize: 14.5, fontWeight: "700", color: c.ink },
    cardAddr: { fontSize: 11, color: c.slate, marginTop: 2 },
    cardValRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 },
    cardVal: { fontFamily: SERIF, fontSize: 15, fontWeight: "700", color: c.ink },
    cardPer: { fontFamily: "System", fontSize: 9.5, color: c.slate, fontWeight: "600" },
    cardActions: { width: 46, borderLeftWidth: 1, borderLeftColor: c.line, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 10 },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.line, alignItems: "center", justifyContent: "center" },
    removeBtn: { padding: 2 },

    cmpBtn: {
      position: "absolute", left: 16, right: 16, bottom: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.gold, borderRadius: 14, paddingVertical: 15,
      shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 8,
    },
    cmpBtnT: { color: "#16223a", fontWeight: "800", fontSize: 14.5 },
  });
}
