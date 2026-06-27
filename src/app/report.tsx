import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { Logo } from "@/components/Logo";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import { nearestValue, resolveDomain, scanArea } from "@/lib/api";
import { peso, SERIF, titleCase, Z } from "@/theme/zonal";

function pesoBig(n: number): string {
  if (n >= 1e6) return "₱" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "₱" + Math.round(n / 1e3) + "k";
  return "₱" + Math.round(n);
}

export default function ReportScreen() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; name?: string }>();
  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const [info, setInfo] = useState<{ name: string; city: string; value: number | null; code: string } | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isFinite(lat) || !isFinite(lon)) { setLoading(false); return; }
    (async () => {
      const v = await nearestValue(lat, lon).catch(() => null);
      const domain = await resolveDomain(lat, lon, v?.city, v?.province).catch(() => "cebu.zonalvalue.com");
      const d = 0.0032;
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "").catch(() => null);
      if (!alive) return;
      const scanPt = scan?.points?.[0];
      const value = scanPt?.value_per_sqm
        ?? scan?.classes?.find((c) => c.group === scan.defaultGroup)?.value
        ?? v?.value_per_sqm ?? null;
      setInfo({
        name: params.name || (scanPt?.street ? titleCase(scanPt.street) : v?.street ? titleCase(v.street) : "Property"),
        city: [titleCase(scanPt?.barangay || v?.barangay || ""), titleCase(scanPt?.city || v?.city || "")].filter(Boolean).join(", ") || "Philippines",
        value,
        code: scanPt?.classification_code || v?.classification_code || "",
      });
      setLoading(false);
    })();
    hazardsAt(lat, lon).then((h) => alive && setHaz(h)).catch(() => {});
    return () => { alive = false; };
  }, [lat, lon, params.name]);

  const name = info?.name || params.name || "Property";
  const city = info?.city || "Philippines";
  const value = info?.value ?? null;
  const code = info?.code || "";
  const flood = haz?.hazards.find((h) => h.key === "flood");
  const fault = haz?.hazards.find((h) => h.key === "fault");

  async function shareReport() {
    const lines = [
      `📍 ${name}${city ? " — " + city : ""}`,
      value != null ? `Zonal value: ${peso(value)}/sqm${code ? " (" + code + ")" : ""}` : "",
      value != null ? `≈ ${pesoBig(value * 250)} for 250 sqm · BIR-indexed` : "",
      haz ? `Overall geohazard risk: ${haz.riskLabel} (${haz.score.toFixed(1)}/3.0)` : "",
      "",
      "via zonalvalue.ph · by Filipino Homes",
    ].filter((l) => l !== undefined);
    try { await Share.share({ message: lines.join("\n") }); } catch { /* cancelled */ }
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {/* navy report header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.navy }}>
        <View style={s.bar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.barIc}><Ionicons name="chevron-back" size={18} color="#fff" /></Pressable>
          <Text style={s.barTitle}>Property Report</Text>
          <Pressable onPress={shareReport} hitSlop={10} style={s.barIc}><Ionicons name="share-outline" size={18} color="#fff" /></Pressable>
        </View>
        <View style={s.rhead}>
          <Text style={s.eyebrow}>PROPERTY REPORT</Text>
          <Text style={s.rtitle} numberOfLines={2}>{name}</Text>
          <Text style={s.rsub}>{city} · Generated today</Text>
        </View>
        <View style={s.accent} />
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Z.gold} /></View>
      ) : (
        <ScrollView style={s.body} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <View style={s.big}>
            <Text style={s.cur}>₱</Text>
            <Text style={s.num}>{value != null ? peso(value).replace("₱", "") : "—"}</Text>
            <Text style={s.per}>/sqm</Text>
          </View>
          <Text style={s.meta}>
            {code ? code + " · " : ""}BIR-indexed{value != null ? ` · ≈ ${pesoBig(value * 250)} for 250 sqm` : ""}
          </Text>

          <View style={s.hzr}>
            <Cell k="Overall" v={haz ? `${haz.riskLabel}` : "—"} c={haz?.riskColor ?? Z.slate} sub={haz ? haz.score.toFixed(1) : ""} />
            <Cell k="Flood" v={flood?.text ?? "—"} c={flood?.color ?? Z.slate} />
            <Cell k="Fault" v={fault?.text ?? "—"} c={fault?.color ?? Z.slate} />
          </View>

          <View style={s.src}>
            <Logo size={40} tile />
            <View style={{ flex: 1 }}>
              <Text style={s.srcMain}><Text style={{ fontWeight: "800", color: Z.ink }}>zonalvalue.ph</Text> · by Filipino Homes</Text>
              <Text style={s.srcSub}>BIR · PHIVOLCS · Project NOAH</Text>
            </View>
            <Pressable onPress={() => Linking.openURL("https://zonalvalue.ph")} style={s.openLive}>
              <Text style={s.openLiveT}>Open live</Text>
              <Ionicons name="open-outline" size={13} color={Z.navy} />
            </Pressable>
          </View>

          <Text style={s.note}>Zonal values are BIR-assessed references, not market prices. Hazard overlays from PHIVOLCS &amp; Project NOAH. For due-diligence reference only.</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Cell({ k, v, c, sub }: { k: string; v: string; c: string; sub?: string }) {
  return (
    <View style={s.cell}>
      <Text style={s.cellK}>{k}</Text>
      <Text style={[s.cellV, { color: c }]} numberOfLines={1}>{v}</Text>
      {!!sub && <Text style={s.cellSub}>{sub}/3.0</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6 },
  barIc: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  barTitle: { color: "#fff", fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  rhead: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 16 },
  eyebrow: { fontSize: 8, letterSpacing: 1.6, color: "#cdd8f4", fontWeight: "800" },
  rtitle: { fontFamily: SERIF, fontSize: 22, fontWeight: "600", color: "#fff", marginTop: 6, lineHeight: 26 },
  rsub: { fontSize: 10.5, color: "#bcc8ee", marginTop: 5 },
  accent: { height: 2, backgroundColor: Z.gold },

  body: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  big: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  cur: { fontFamily: SERIF, fontSize: 19, fontWeight: "600", color: Z.navy, marginBottom: 4 },
  num: { fontFamily: SERIF, fontSize: 38, fontWeight: "700", color: Z.ink, lineHeight: 40, letterSpacing: -0.5 },
  per: { fontSize: 11, color: Z.slate, fontWeight: "600", marginBottom: 4 },
  meta: { fontSize: 11, color: Z.slate, marginTop: 6 },

  hzr: { flexDirection: "row", gap: 8, marginTop: 18 },
  cell: { flex: 1, borderWidth: 1, borderColor: Z.line, borderRadius: 11, paddingVertical: 11, alignItems: "center" },
  cellK: { fontSize: 9, color: Z.inkSoft, fontWeight: "700" },
  cellV: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  cellSub: { fontSize: 8.5, color: Z.slate, marginTop: 2 },

  src: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: Z.line, borderStyle: "dashed" },
  zTile: { width: 38, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  zT: { color: "#16223a", fontFamily: SERIF, fontWeight: "700", fontSize: 18 },
  srcMain: { fontSize: 11, color: Z.slate },
  srcSub: { fontSize: 10, color: Z.slate, marginTop: 2 },
  openLive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#eef1fa", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  openLiveT: { fontSize: 11.5, fontWeight: "700", color: Z.navy },

  note: { marginTop: 20, fontSize: 10, color: Z.slate, lineHeight: 15 },
});
