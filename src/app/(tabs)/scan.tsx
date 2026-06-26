import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { ParcelCard } from "@/components/ParcelCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ClassChip } from "@/components/ClassChip";
import { HazardChips } from "@/components/HazardChips";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import { nearestValue, placeDetails, placesAutocomplete, resolveDomain, scanArea, type Suggestion } from "@/lib/api";
import { peso, SERIF, titleCase, Z } from "@/theme/zonal";

interface Primary { lat: number; lon: number; value: number | null; code: string | null; name: string; addr: string }
interface ScanItem { value: number; code?: string | null; line: string; meta?: string; lat?: number; lon?: number }

export default function ScanScreen() {
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [results, setResults] = useState<ScanItem[]>([]);
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [place, setPlace] = useState("Cebu City");
  const [loading, setLoading] = useState(true);
  const center = useRef({ lat: 10.3157, lon: 123.8854 });
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    runScan(center.current.lat, center.current.lon, "Cebu City");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runScan(lat: number, lon: number, label: string) {
    setLoading(true);
    setPlace(label);
    setHaz(null);
    center.current = { lat, lon };
    try {
      const near = await nearestValue(lat, lon, 3000).catch(() => null);
      const domain = await resolveDomain(lat, lon, near?.city, near?.province).catch(() => "cebu.zonalvalue.com");
      const d = 0.0032;
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "scan").catch(() => null);

      const scanPt = scan?.points?.[0];
      const value = scanPt?.value_per_sqm
        ?? scan?.classes?.find((c) => c.group === scan.defaultGroup)?.value
        ?? near?.value_per_sqm ?? null;
      const code = scanPt?.classification_code ?? near?.classification_code ?? null;
      const name = scanPt?.street ? titleCase(scanPt.street) : near?.street ? titleCase(near.street) : label;
      const addr = [titleCase(scanPt?.barangay || near?.barangay || ""), titleCase(scanPt?.city || near?.city || "")]
        .filter(Boolean).join(" · ") || label;
      setPrimary({ lat, lon, value, code, name, addr });
      hazardsAt(lat, lon).then(setHaz).catch(() => {});

      // nearby list — prefer cached points (tappable, with coords); else scan-area streets
      let items: ScanItem[] = [];
      const coordPts = (near?.nearby || [])
        .filter((p) => Number(p.value_per_sqm) > 0)
        .sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9));
      const seen = new Set<string>();
      for (const p of coordPts) {
        const k = `${p.street}|${p.value_per_sqm}|${p.classification_code}`;
        if (seen.has(k)) continue;
        seen.add(k);
        items.push({
          value: Number(p.value_per_sqm), code: p.classification_code,
          line: titleCase(p.street || p.barangay || "Parcel"),
          meta: [titleCase(p.barangay || ""), p.distance_m != null ? `${Math.round(p.distance_m)}m` : ""].filter(Boolean).join(" · "),
          lat: p.lat, lon: p.lon,
        });
      }
      if (!items.length && scan?.nearby?.length) {
        items = scan.nearby
          .filter((n) => Number(n.value_per_sqm) > 0)
          .map((n) => ({
            value: Number(n.value_per_sqm), code: n.classification_code,
            line: titleCase(n.street || n.barangay || "Parcel"),
            meta: titleCase(n.barangay || n.city || ""),
          }));
      }
      setResults(items);
    } catch {
      setResults([]);
      setPrimary(null);
    } finally {
      setLoading(false);
    }
  }

  function onChangeQ(t: string) {
    setQ(t);
    if (deb.current) clearTimeout(deb.current);
    if (t.trim().length < 2) { setSugs([]); return; }
    deb.current = setTimeout(async () => {
      setSugs(await placesAutocomplete(t, center.current.lat, center.current.lon));
    }, 240);
  }
  async function pick(s: Suggestion) {
    setQ("");
    setSugs([]);
    Keyboard.dismiss();
    const d = await placeDetails(s.placeId);
    if (d) runScan(d.lat, d.lon, d.name || s.main);
  }

  function openPrimary() {
    if (!primary) return;
    router.push({ pathname: "/property", params: { lat: String(primary.lat), lon: String(primary.lon), name: primary.name } } as any);
  }

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.paper }}>
        <View style={s.head}>
          <View style={s.icon}><Ionicons name="scan-outline" size={17} color="#fff" /></View>
          <View>
            <Text style={s.title}>Area Scan</Text>
            <Text style={s.sub}>Tap a parcel to fly there</Text>
          </View>
        </View>
        <View style={s.searchWrap}>
          <View style={s.search}>
            <Ionicons name="search" size={15} color={Z.navy} />
            <TextInput
              value={q} onChangeText={onChangeQ}
              placeholder="Scan another address…" placeholderTextColor={Z.slate}
              style={s.searchInput} returnKeyType="search" autoCorrect={false}
            />
          </View>
          {sugs.length > 0 && (
            <View style={s.sugs}>
              {sugs.map((sg) => (
                <Pressable key={sg.placeId} style={s.sug} onPress={() => pick(sg)}>
                  <Ionicons name="location-outline" size={15} color={Z.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.sugMain} numberOfLines={1}>{sg.main}</Text>
                    <Text style={s.sugSec} numberOfLines={1}>{sg.secondary}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Z.gold} /><Text style={s.dim}>Scanning {place}…</Text></View>
      ) : (
        <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title={`${results.length} zonal value${results.length === 1 ? "" : "s"}`}
            subtitle="Nearby parcels — tap to open"
            count={`near ${place}`}
          />
          {results.length === 0 ? (
            <View style={s.center}><Ionicons name="search-outline" size={26} color={Z.slate} /><Text style={s.dim}>No zonal data near here. Try a busier area or the Map tab.</Text></View>
          ) : (
            <View style={{ gap: 8, marginTop: 12 }}>
              {results.map((p, i) => (
                <ParcelCard
                  key={i}
                  value={p.value}
                  code={p.code}
                  line={p.line}
                  meta={p.meta}
                  onPress={p.lat != null && p.lon != null
                    ? () => router.push({ pathname: "/property", params: { lat: String(p.lat), lon: String(p.lon) } } as any)
                    : undefined}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {!loading && primary && (
        <View style={s.panel}>
          <Pressable onPress={openPrimary}>
            <Text style={s.panelLbl}>THIS LOCATION</Text>
            <View style={s.panelRow}>
              <View style={s.panelVrow}>
                <Text style={s.cur}>₱</Text>
                <Text style={s.num}>{primary.value != null ? peso(primary.value).replace("₱", "") : "—"}</Text>
                <Text style={s.per}>/sqm</Text>
              </View>
              {!!primary.code && <ClassChip code={primary.code} />}
              <View style={s.panelGo}><Ionicons name="arrow-forward" size={15} color="#16223a" /></View>
            </View>
            <Text style={s.panelAddr} numberOfLines={1}>{primary.name} · {primary.addr}</Text>
          </Pressable>
          <View style={{ marginTop: 10 }}>
            {haz ? <HazardChips hazards={haz.hazards} /> : <Text style={s.dim}>Reading 6 geohazards…</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  head: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Z.navy },
  title: { fontFamily: SERIF, fontSize: 18, fontWeight: "600", color: Z.ink },
  sub: { fontSize: 10.5, color: Z.slate, marginTop: 1, fontWeight: "600" },
  searchWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Z.white, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: Z.line },
  searchInput: { flex: 1, fontSize: 13.5, color: Z.ink, padding: 0 },
  sugs: { marginTop: 8, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Z.line },
  sug: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Z.line },
  sugMain: { fontSize: 13, fontWeight: "600", color: Z.ink },
  sugSec: { fontSize: 10.5, color: Z.slate, marginTop: 1 },

  body: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 11, paddingVertical: 50, paddingHorizontal: 30 },
  dim: { color: Z.slate, fontSize: 12, textAlign: "center", lineHeight: 18 },

  panel: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: Z.line,
    shadowColor: "#0c1430", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -8 }, elevation: 16,
  },
  panelLbl: { fontSize: 8.5, letterSpacing: 1.3, color: Z.navy, fontWeight: "800" },
  panelRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 5 },
  panelVrow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  cur: { fontFamily: SERIF, fontSize: 17, fontWeight: "600", color: Z.navy, marginBottom: 3 },
  num: { fontFamily: SERIF, fontSize: 28, fontWeight: "700", color: Z.ink, lineHeight: 29, letterSpacing: -0.5 },
  per: { fontSize: 10, color: Z.slate, fontWeight: "600", marginBottom: 3 },
  panelGo: { marginLeft: "auto", width: 34, height: 34, borderRadius: 11, backgroundColor: Z.goldLite, alignItems: "center", justifyContent: "center" },
  panelAddr: { fontSize: 10.5, color: Z.slate, marginTop: 4 },
});
