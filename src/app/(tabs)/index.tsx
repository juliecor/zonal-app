import { useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Keyboard, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { mapHtml } from "@/lib/mapHtml";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import {
  nearestValue, placeDetails, placesAutocomplete, resolveDomain, scanArea,
  type Suggestion, type ZPoint,
} from "@/lib/api";
import { buildLandUse, landUseFromClasses, type Group, type LandUse } from "@/lib/landuse";
import { useAuth } from "@/lib/auth";
import { ClassChip } from "@/components/ClassChip";
import { HazardChips } from "@/components/HazardChips";
import { LandUseToggle } from "@/components/LandUseToggle";
import { peso, pesoK, SERIF, titleCase, Z } from "@/theme/zonal";

const KEY = process.env.EXPO_PUBLIC_MAPS_KEY || "";

const HAZARD_LAYERS = [
  { key: "flood", label: "Flood", color: "#0ea5e9" },
  { key: "landslide", label: "Landslide", color: "#92400e" },
  { key: "stormsurge", label: "Storm surge", color: "#6d28d9" },
  { key: "faults", label: "Fault lines", color: "#b91c1c" },
  { key: "liquefaction", label: "Liquefaction", color: "#d97706" },
  { key: "tsunami", label: "Tsunami", color: "#0891b2" },
];

interface Sheet {
  lat: number; lon: number; name: string; address: string;
  value: number | null; code: string | null;
  options: LandUse[]; nearby: ZPoint[];
}

export default function MapScreen() {
  const { user } = useAuth();
  const initials = user
    ? ((user.first_name?.[0] || user.name?.[0] || "U") + (user.last_name?.[0] || "")).toUpperCase()
    : "FH";
  const web = useRef<WebView>(null);
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [layers, setLayers] = useState<Record<string, boolean>>({});
  const [layersOpen, setLayersOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [lu, setLu] = useState<Group>("residential");
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const center = useRef({ lat: 10.3157, lon: 123.8854 });
  const pinsRef = useRef<any[]>([]);
  const selRef = useRef<any | null>(null);
  const sheetY = useRef(new Animated.Value(460)).current;
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

  function showSheet(s: Sheet, defaultGroup: Group) {
    setSheet(s);
    setLu(defaultGroup);
    setHaz(null);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 66 }).start();
    hazardsAt(s.lat, s.lon).then(setHaz).catch(() => {});
  }
  function hideSheet() {
    Animated.timing(sheetY, { toValue: 460, duration: 200, useNativeDriver: true }).start(() => {
      setSheet(null);
      selRef.current = null;
      pinsRef.current = [];
      pushPins();
    });
  }

  // Precise value AT the clicked spot (like the website), WITHOUT moving the camera.
  async function inspect(lat: number, lon: number, presetName?: string) {
    setBusy(true);
    try {
      // 1) nearby cached points (with coords) → then the correct province subdomain
      const near = await nearestValue(lat, lon).catch(() => null);
      const domain = await resolveDomain(lat, lon, near?.city, near?.province).catch(() => "cebu.zonalvalue.com");
      // 2) scan-area at the exact spot → precise street value + land-use classes
      const d = 0.0032;
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "").catch(() => null);

      let options: LandUse[] = scan?.classes?.length ? landUseFromClasses(scan.classes) : [];
      let defaultGroup = (scan?.defaultGroup as Group) || options[0]?.group || "residential";
      if (!options.length && near) {
        const built = buildLandUse(
          [{ value_per_sqm: near.value_per_sqm ?? undefined, classification_code: near.classification_code ?? undefined }, ...near.nearby],
          near.classification_code,
        );
        options = built.options;
        defaultGroup = built.defaultGroup;
      }

      const scanPt = scan?.points?.[0];
      const defOpt = options.find((o) => o.group === defaultGroup);
      const value = scanPt?.value_per_sqm ?? defOpt?.value ?? near?.value_per_sqm ?? null;
      const code = scanPt?.classification_code ?? defOpt?.code ?? near?.classification_code ?? null;

      const name = presetName
        || (scanPt?.street ? titleCase(scanPt.street) : near?.street ? titleCase(near.street) : near?.label || "Selected location");
      const addr = [titleCase(scanPt?.barangay || near?.barangay || ""), titleCase(scanPt?.city || near?.city || "")]
        .filter(Boolean).join(" · ") || "Selected spot";

      const nearby = (near?.nearby || []).filter((p) => Number(p.value_per_sqm) > 0)
        .sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9));

      // pin stays at the CLICKED spot (no camera move)
      selRef.current = { lat, lon, label: pesoK(value), value_per_sqm: value, classification_code: code };
      pinsRef.current = nearby.slice(0, 8).map((p, i) => ({
        id: i, lat: p.lat, lon: p.lon, label: pesoK(p.value_per_sqm),
        value_per_sqm: p.value_per_sqm, classification_code: p.classification_code,
        street: p.street, barangay: p.barangay, city: p.city,
      }));
      pushPins();

      showSheet({ lat, lon, name, address: addr, value, code, options, nearby: nearby.slice(0, 3) }, defaultGroup);
    } finally {
      setBusy(false);
    }
  }

  async function onPoi(lat: number, lon: number, placeId: string) {
    setBusy(true);
    let name: string | undefined;
    try {
      const d = await placeDetails(placeId);
      if (d?.name) name = d.name;
    } catch { /* ignore */ }
    await inspect(lat, lon, name);
  }

  function onMessage(e: { nativeEvent: { data: string } }) {
    let m: any;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === "bounds") center.current = { lat: (m.minLat + m.maxLat) / 2, lon: (m.minLon + m.maxLon) / 2 };
    else if (m.type === "poi") onPoi(m.lat, m.lon, m.placeId);
    else if (m.type === "tap") inspect(m.lat, m.lon);
    else if (m.type === "pin") inspect(m.pin.lat, m.pin.lon, m.pin.street ? titleCase(m.pin.street) : undefined);
  }

  function onChangeQ(t: string) {
    setQ(t);
    if (debTimer.current) clearTimeout(debTimer.current);
    if (t.trim().length < 2) { setSugs([]); return; }
    debTimer.current = setTimeout(async () => {
      setSugs(await placesAutocomplete(t, center.current.lat, center.current.lon));
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
        inject(`window.ZV.center(${d.lat},${d.lon},17)`); // only searches recenter
        await inspect(d.lat, d.lon, d.name);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleType(t: "roadmap" | "hybrid") {
    setMapType(t);
    inject(`window.ZV.setType(${JSON.stringify(t)})`);
  }

  function toggleLayer(k: string) {
    const on = !layers[k];
    setLayers((s) => ({ ...s, [k]: on }));
    inject(`window.ZV.setLayer(${JSON.stringify(k)}, ${on})`);
  }
  const activeLayers = Object.values(layers).filter(Boolean).length;

  function openReport() {
    if (!sheet) return;
    router.push({ pathname: "/property", params: { lat: String(sheet.lat), lon: String(sheet.lon), name: sheet.name } } as any);
  }

  const selOpt = sheet?.options.find((o) => o.group === lu);
  const shownValue = selOpt ? selOpt.value : sheet?.value ?? null;
  const shownCode = selOpt ? selOpt.code : sheet?.code ?? null;

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
          <Pressable style={st.ava} onPress={() => router.push("/profile" as any)}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={st.avaImg} contentFit="cover" />
            ) : (
              <Text style={st.avaT}>{initials}</Text>
            )}
          </Pressable>
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

        <View style={st.controls} pointerEvents="box-none">
          <View style={st.seg}>
            {(["roadmap", "hybrid"] as const).map((t) => (
              <Pressable key={t} onPress={() => toggleType(t)} style={[st.segB, mapType === t && st.segOn]}>
                <Text style={[st.segT, mapType === t && st.segTOn]}>{t === "roadmap" ? "Map" : "Satellite"}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setLayersOpen((o) => !o)} style={[st.hazBtn, activeLayers > 0 && st.hazBtnOn]}>
            <Ionicons name="layers-outline" size={14} color={activeLayers ? "#fff" : Z.navy} />
            <Text style={[st.hazBtnT, activeLayers > 0 && { color: "#fff" }]}>Hazards{activeLayers ? ` ${activeLayers}` : ""}</Text>
            <Ionicons name={layersOpen ? "chevron-up" : "chevron-down"} size={12} color={activeLayers ? "#fff" : Z.slate} />
          </Pressable>
        </View>
        {layersOpen && (
            <View style={st.hazPanel}>
              <Text style={st.hazPanelH}>SHOW HAZARD OVERLAYS</Text>
              {HAZARD_LAYERS.map((h) => {
                const on = !!layers[h.key];
                return (
                  <Pressable key={h.key} style={st.hazRow} onPress={() => toggleLayer(h.key)}>
                    <View style={[st.hazSw, on && { backgroundColor: h.color, borderColor: h.color }]}>
                      {on && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                    <View style={[st.hazDot, { backgroundColor: h.color }]} />
                    <Text style={st.hazRowT}>{h.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        {!sheet && !layersOpen && (
          <View style={st.hint}>
            <Ionicons name="hand-left-outline" size={12} color="#fff" />
            <Text style={st.hintT}>Tap any establishment to see its value</Text>
          </View>
        )}
      </SafeAreaView>

      {busy && (
        <View style={st.loadWrap} pointerEvents="none">
          <View style={st.loadPill}>
            <ActivityIndicator color={Z.goldLite} size="small" />
            <Text style={st.loadT}>Reading zonal value…</Text>
          </View>
        </View>
      )}

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
            <Text style={st.vnum}>{shownValue != null ? peso(shownValue).replace("₱", "") : "—"}</Text>
            <Text style={st.per}>/sqm</Text>
            <View style={{ marginLeft: "auto" }}>{!!shownCode && <ClassChip code={shownCode} />}</View>
          </View>

          {sheet.options.length >= 2 && (
            <View style={{ marginTop: 12 }}>
              <LandUseToggle options={sheet.options} selected={lu} onSelect={(g) => setLu(g as Group)} />
            </View>
          )}

          <View style={st.hzWrap}>
            {haz ? <HazardChips hazards={haz.hazards} /> : <Text style={st.hloading}>Reading 6 geohazards…</Text>}
          </View>

          {sheet.nearby.length > 0 && (
            <View style={st.nearWrap}>
              <Text style={st.nearH}>NEARBY ZONAL VALUES</Text>
              {sheet.nearby.map((p, i) => (
                <Pressable key={i} style={st.nearRow} onPress={() => router.push({ pathname: "/property", params: { lat: String(p.lat), lon: String(p.lon) } } as any)}>
                  <Text style={st.nearVal}>{peso(p.value_per_sqm)}<Text style={st.nearPer}> /sqm</Text></Text>
                  <Text style={st.nearLine} numberOfLines={1}>{titleCase(p.street || p.barangay || "Nearby")}</Text>
                  <ClassChip code={p.classification_code} size="sm" />
                </Pressable>
              ))}
            </View>
          )}

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
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: Z.goldLite, borderWidth: 2, borderColor: "#fff",
    shadowColor: "#0c1430", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  avaT: { color: "#16223a", fontWeight: "800", fontSize: 12 },
  avaImg: { width: "100%", height: "100%" },

  sugs: {
    marginHorizontal: 12, marginTop: 8, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: Z.line,
    shadowColor: "#0c1430", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  sug: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Z.line },
  sugMain: { fontSize: 13.5, fontWeight: "600", color: Z.ink },
  sugSec: { fontSize: 11, color: Z.slate, marginTop: 1 },

  controls: { alignSelf: "center", marginTop: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  seg: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 100, padding: 3,
    shadowColor: "#0c1430", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  segB: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 100 },
  segOn: { backgroundColor: Z.navy },
  segT: { fontSize: 11.5, fontWeight: "700", color: Z.slate },
  segTOn: { color: "#fff" },

  hint: { alignSelf: "center", marginTop: 9, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(16,26,48,0.82)", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  hintT: { color: "#fff", fontSize: 10.5, fontWeight: "600" },

  hazBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7, shadowColor: "#0c1430", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  hazBtnOn: { backgroundColor: "#0f766e" },
  hazBtnT: { fontSize: 11.5, fontWeight: "700", color: Z.navy },
  hazPanel: { alignSelf: "center", marginTop: 8, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, width: 212, borderWidth: 1, borderColor: Z.line, shadowColor: "#0c1430", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  hazPanelH: { fontSize: 8.5, letterSpacing: 1.2, color: Z.slate, fontWeight: "800", marginBottom: 4, paddingHorizontal: 4 },
  hazRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7, paddingHorizontal: 4 },
  hazSw: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: Z.line, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  hazDot: { width: 8, height: 8, borderRadius: 4 },
  hazRowT: { fontSize: 12.5, color: Z.inkSoft, fontWeight: "600" },

  loadWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  loadPill: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(16,26,48,0.95)", borderRadius: 100, paddingHorizontal: 18, paddingVertical: 12, shadowColor: "#0c1430", shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  loadT: { color: "#fff", fontSize: 13, fontWeight: "700" },

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

  hzWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eef1f5" },
  hloading: { fontSize: 11, color: Z.slate, fontStyle: "italic" },

  nearWrap: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eef1f5", gap: 7 },
  nearH: { fontSize: 8.5, letterSpacing: 1.3, color: Z.slate, fontWeight: "800" },
  nearRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  nearVal: { fontFamily: SERIF, fontSize: 14, fontWeight: "700", color: Z.ink, width: 104 },
  nearPer: { fontFamily: "System", fontSize: 9, color: Z.slate, fontWeight: "600" },
  nearLine: { flex: 1, fontSize: 11.5, color: Z.inkSoft, fontWeight: "500" },

  cta: {
    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: Z.gold, borderRadius: 13, paddingVertical: 13,
    shadowColor: Z.goldDeep, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  ctaT: { fontSize: 13, fontWeight: "800", color: "#16223a" },
});
