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
import { nearestValue, placeDetails, placesAutocomplete, type Suggestion, type ZPoint } from "@/lib/api";
import { SERIF, titleCase, Z } from "@/theme/zonal";

export default function ScanScreen() {
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [results, setResults] = useState<ZPoint[]>([]);
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
    center.current = { lat, lon };
    try {
      const v = await nearestValue(lat, lon, 3000);
      const pts = (v.nearby || [])
        .filter((p) => Number(p.value_per_sqm) > 0)
        .sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9));
      const seen = new Set<string>();
      const list: ZPoint[] = [];
      for (const p of pts) {
        const k = `${p.street}|${p.value_per_sqm}|${p.classification_code}`;
        if (seen.has(k)) continue;
        seen.add(k);
        list.push(p);
      }
      setResults(list);
    } catch {
      setResults([]);
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
    if (d) runScan(d.lat, d.lon, s.main);
  }

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.paper }}>
        <View style={s.head}>
          <View style={s.icon}><Ionicons name="scan-outline" size={17} color="#fff" /></View>
          <View>
            <Text style={s.title}>Area Scan</Text>
            <Text style={s.sub}>Values found near a location</Text>
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
        <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title={`${results.length} zonal value${results.length === 1 ? "" : "s"}`}
            subtitle="Tap a parcel to fly there"
            count={`near ${place}`}
          />
          {results.length === 0 ? (
            <View style={s.center}><Ionicons name="search-outline" size={26} color={Z.slate} /><Text style={s.dim}>No cached values near here yet. Try a busier area or open the Map tab.</Text></View>
          ) : (
            <View style={{ gap: 8, marginTop: 12 }}>
              {results.map((p, i) => (
                <ParcelCard
                  key={i}
                  value={Number(p.value_per_sqm)}
                  code={p.classification_code}
                  line={titleCase(p.street || p.barangay || "Parcel")}
                  meta={[titleCase(p.barangay || ""), p.distance_m != null ? `${Math.round(p.distance_m)}m` : ""].filter(Boolean).join(" · ")}
                  onPress={() => router.push({ pathname: "/property", params: { lat: String(p.lat), lon: String(p.lon) } } as any)}
                />
              ))}
            </View>
          )}
        </ScrollView>
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
  dim: { color: Z.slate, fontSize: 12.5, textAlign: "center", lineHeight: 18 },
});
