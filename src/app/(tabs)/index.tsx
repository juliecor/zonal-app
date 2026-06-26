import { useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Keyboard, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { mapHtml } from "@/lib/mapHtml";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import {
  nearestValue, pinsInBounds, placeDetails, placesAutocomplete, type Suggestion,
} from "@/lib/api";
import { ClassChip } from "@/components/ClassChip";
import { peso, pesoK, SERIF, titleCase, Z } from "@/theme/zonal";

const KEY = process.env.EXPO_PUBLIC_MAPS_KEY || "";

interface Sheet { lat: number; lon: number; name: string; address: string; value: number | null; code: string | null }

export default function MapScreen() {
  const web = useRef<WebView>(null);
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const center = useRef({ lat: 10.3157, lon: 123.8854 });
  const pinsRef = useRef<any[]>([]);
  const selRef = useRef<any | null>(null);
  const sheetY = useRef(new Animated.Value(360)).current;
  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inject = (js: string) => web.current?.injectJavaScript(js + "; true;");

  function pushPins() {
    const base = pinsRef.current.map((p) => ({ ...p, sel: false }));
    const sel = selRef.current;
    let arr = base;
    if (sel) {
      arr = base.filter((p) => Math.abs(p.lat - sel.lat) > 1e-6 || Math.abs(p.lon - sel.lon) > 1e-6);
      arr = arr.concat([{ ...sel, sel: true }]);
    }
    inject(`window.ZV.setPins(${JSON.stringify(arr)})`);
  }

  function showSheet(s: Sheet) {
    setSheet(s);
    setHaz(null);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }).start();
    hazardsAt(s.lat, s.lon).then(setHaz).catch(() => {});
  }
  function hideSheet() {
    Animated.timing(sheetY, { toValue: 360, duration: 200, useNativeDriver: true }).start(() => {
      setSheet(null);
      selRef.current = null;
      pushPins();
    });
  }

  async function onBounds(b: any) {
    center.current = { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 };
    try {
      const pts = await pinsInBounds(b, 140);
      pinsRef.current = pts
        .filter((p) => Number(p.value_per_sqm) > 0)
        .slice(0, 90)
        .map((p, i) => ({
          id: i, lat: p.lat, lon: p.lon, label: pesoK(p.value_per_sqm),
          value_per_sqm: p.value_per_sqm, classification_code: p.classification_code,
          street: p.street, barangay: p.barangay, city: p.city,
        }));
      pushPins();
    } catch {
      /* keep prior pins */
    }
  }

  async function onTap(lat: number, lon: number) {
    setBusy(true);
    try {
      const v = await nearestValue(lat, lon);
      const name = v.street ? titleCase(v.street) : v.label || "Selected location";
      const addr = [titleCase(v.barangay || ""), titleCase(v.city || "")].filter(Boolean).join(" · ") || "Tap a pin to inspect";
      selRef.current = {
        lat: v.lat, lon: v.lon, label: pesoK(v.value_per_sqm), value_per_sqm: v.value_per_sqm,
        classification_code: v.classification_code, street: v.street, barangay: v.barangay, city: v.city,
      };
      inject(`window.ZV.center(${v.lat},${v.lon})`);
      pushPins();
      showSheet({ lat: v.lat, lon: v.lon, name, address: addr, value: v.value_per_sqm, code: v.classification_code });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  function onPin(pin: any) {
    selRef.current = pin;
    pushPins();
    const name = pin.street ? titleCase(pin.street) : "Selected location";
    const addr = [titleCase(pin.barangay || ""), titleCase(pin.city || "")].filter(Boolean).join(" · ") || "Zonal value";
    showSheet({ lat: pin.lat, lon: pin.lon, name, address: addr, value: pin.value_per_sqm, code: pin.classification_code });
  }

  function onMessage(e: { nativeEvent: { data: string } }) {
    let m: any;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === "bounds") onBounds(m);
    else if (m.type === "tap") onTap(m.lat, m.lon);
    else if (m.type === "pin") onPin(m.pin);
  }

  function onChangeQ(t: string) {
    setQ(t);
    if (debTimer.current) clearTimeout(debTimer.current);
    if (t.trim().length < 2) { setSugs([]); return; }
    debTimer.current = setTimeout(async () => {
      const s = await placesAutocomplete(t, center.current.lat, center.current.lon);
      setSugs(s);
    }, 240);
  }
  async function pick(s: Suggestion) {
    setQ(s.main);
    setSugs([]);
    Keyboard.dismiss();
    setBusy(true);
    try {
      const d = await placeDetails(s.placeId);
      if (d) {
        inject(`window.ZV.center(${d.lat},${d.lon},16)`);
        await onTap(d.lat, d.lon);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleType(t: "roadmap" | "hybrid") {
    setMapType(t);
    inject(`window.ZV.setType(${JSON.stringify(t)})`);
  }

  function openReport() {
    if (!sheet) return;
    router.push({ pathname: "/property", params: { lat: String(sheet.lat), lon: String(sheet.lon), name: sheet.name } } as any);
  }

  const hz = (k: string) => haz?.hazards.find((h) => h.key === k);

  return (
    <View style={st.root}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        style={st.web}
        originWhitelist={["*"]}
        source={{ html: mapHtml(KEY), baseUrl: "https://zonalvalue.ph" }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
      />

      {/* top: search + avatar + segmented */}
      <SafeAreaView edges={["top"]} style={st.topWrap} pointerEvents="box-none">
        <View style={st.searchRow} pointerEvents="box-none">
          <View style={st.search}>
            <Ionicons name="search" size={15} color={Z.navy} />
            <TextInput
              value={q} onChangeText={onChangeQ}
              placeholder="Search any address…" placeholderTextColor={Z.slate}
              style={st.searchInput} returnKeyType="search" autoCorrect={false}
            />
            {q.length > 0 && (
              <Pressable onPress={() => { setQ(""); setSugs([]); }} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Z.slate} />
              </Pressable>
            )}
          </View>
          <View style={st.ava}><Text style={st.avaT}>FH</Text></View>
        </View>

        {sugs.length > 0 && (
          <View style={st.sugs}>
            {sugs.map((s) => (
              <Pressable key={s.placeId} style={st.sug} onPress={() => pick(s)}>
                <Ionicons name="location-outline" size={15} color={Z.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={st.sugMain} numberOfLines={1}>{s.main}</Text>
                  <Text style={st.sugSec} numberOfLines={1}>{s.secondary}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={st.seg}>
          {(["roadmap", "hybrid"] as const).map((t) => (
            <Pressable key={t} onPress={() => toggleType(t)} style={[st.segB, mapType === t && st.segOn]}>
              <Text style={[st.segT, mapType === t && st.segTOn]}>{t === "roadmap" ? "Map" : "Satellite"}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {busy && <View style={st.busy} pointerEvents="none"><ActivityIndicator color={Z.gold} /></View>}

      {/* bottom sheet */}
      {sheet && (
        <Animated.View style={[st.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={st.grip} />
          <Pressable onPress={hideSheet} style={st.sheetClose} hitSlop={10}>
            <Ionicons name="close" size={18} color={Z.slate} />
          </Pressable>
          <Text style={st.nm} numberOfLines={1}>{sheet.name}</Text>
          <Text style={st.ad} numberOfLines={1}>{sheet.address}</Text>
          <View style={st.vrow}>
            <Text style={st.cur}>₱</Text>
            <Text style={st.vnum}>{sheet.value != null ? peso(sheet.value).replace("₱", "") : "—"}</Text>
            <Text style={st.per}>/sqm</Text>
            <View style={{ marginLeft: "auto" }}>{!!sheet.code && <ClassChip code={sheet.code} />}</View>
          </View>
          <View style={st.hzRow}>
            {haz ? (
              ["flood", "landslide", "liquefaction"].map((k) => {
                const h = hz(k);
                if (!h) return null;
                return (
                  <View key={k} style={st.hchip}>
                    <View style={[st.hdot, { backgroundColor: h.color }]} />
                    <Text style={st.htext}>{h.name} {h.text}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={st.hloading}>Reading hazards…</Text>
            )}
          </View>
          <Pressable onPress={openReport} style={st.cta}>
            <Text style={st.ctaT}>View full report</Text>
            <Ionicons name="arrow-forward" size={16} color="#16223a" />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e8edf0" },
  web: { flex: 1, backgroundColor: "#e8edf0" },

  topWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingTop: 6 },
  search: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 100, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.3)",
    shadowColor: "#0c1430", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: Z.ink, padding: 0 },
  ava: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: Z.goldLite, borderWidth: 2, borderColor: "#fff",
    shadowColor: "#0c1430", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  avaT: { color: "#16223a", fontWeight: "800", fontSize: 12 },

  sugs: {
    marginHorizontal: 12, marginTop: 8, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: Z.line,
    shadowColor: "#0c1430", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  sug: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Z.line },
  sugMain: { fontSize: 13.5, fontWeight: "600", color: Z.ink },
  sugSec: { fontSize: 11, color: Z.slate, marginTop: 1 },

  seg: {
    alignSelf: "center", marginTop: 9, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 100, padding: 3,
    shadowColor: "#0c1430", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  segB: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100 },
  segOn: { backgroundColor: Z.navy },
  segT: { fontSize: 11.5, fontWeight: "700", color: Z.slate },
  segTOn: { color: "#fff" },

  busy: { position: "absolute", top: "46%", left: 0, right: 0, alignItems: "center" },

  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30,
    shadowColor: "#0c1430", shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: -10 }, elevation: 20,
  },
  grip: { width: 36, height: 4, borderRadius: 4, backgroundColor: "#dde2ec", alignSelf: "center", marginBottom: 12 },
  sheetClose: { position: "absolute", right: 14, top: 14, padding: 2 },
  nm: { fontFamily: SERIF, fontSize: 18, fontWeight: "600", color: Z.ink, paddingRight: 28 },
  ad: { fontSize: 11, color: Z.slate, marginTop: 3 },
  vrow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 11 },
  cur: { fontFamily: SERIF, fontSize: 17, fontWeight: "600", color: Z.navy, marginBottom: 3 },
  vnum: { fontFamily: SERIF, fontSize: 29, fontWeight: "700", color: Z.ink, lineHeight: 30, letterSpacing: -0.5 },
  per: { fontSize: 10.5, color: Z.slate, fontWeight: "600", marginBottom: 3 },
  hzRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eef1f5" },
  hchip: { flexDirection: "row", alignItems: "center", gap: 5 },
  hdot: { width: 7, height: 7, borderRadius: 4 },
  htext: { fontSize: 10.5, fontWeight: "700", color: Z.inkSoft },
  hloading: { fontSize: 11, color: Z.slate, fontStyle: "italic" },
  cta: {
    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: Z.gold, borderRadius: 13, paddingVertical: 13,
    shadowColor: Z.goldDeep, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  ctaT: { fontSize: 13, fontWeight: "800", color: "#16223a" },
});
