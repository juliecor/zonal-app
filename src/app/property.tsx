import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { AppBar } from "@/components/AppBar";
import { ValueCard } from "@/components/ValueCard";
import { LandUseToggle } from "@/components/LandUseToggle";
import { HazardPanel } from "@/components/HazardPanel";
import { ParcelCard } from "@/components/ParcelCard";
import { SectionHeader } from "@/components/SectionHeader";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import { nearestValue, resolveDomain, scanArea, type ZPoint } from "@/lib/api";
import { buildLandUse, GROUP_LABEL, landUseFromClasses, type Group, type LandUse } from "@/lib/landuse";
import { titleCase, Z } from "@/theme/zonal";

export default function PropertyScreen() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; name?: string }>();
  const lat = Number(params.lat);
  const lon = Number(params.lon);

  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [options, setOptions] = useState<LandUse[]>([]);
  const [sel, setSel] = useState<Group>("residential");
  const [nearby, setNearby] = useState<ZPoint[]>([]);
  const [info, setInfo] = useState<{ value: number | null; code: string | null; name: string; addr: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isFinite(lat) || !isFinite(lon)) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const v = await nearestValue(lat, lon).catch(() => null);
      const domain = await resolveDomain(lat, lon, v?.city, v?.province).catch(() => "cebu.zonalvalue.com");
      const d = 0.0032;
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "").catch(() => null);
      if (!alive) return;

      let opts: LandUse[] = scan?.classes?.length ? landUseFromClasses(scan.classes) : [];
      let defGroup = (scan?.defaultGroup as Group) || opts[0]?.group || "residential";
      if (!opts.length && v) {
        const built = buildLandUse(
          [{ value_per_sqm: v.value_per_sqm ?? undefined, classification_code: v.classification_code ?? undefined }, ...v.nearby],
          v.classification_code,
        );
        opts = built.options;
        defGroup = built.defaultGroup;
      }
      const scanPt = scan?.points?.[0];
      const defOpt = opts.find((o) => o.group === defGroup);
      const value = scanPt?.value_per_sqm ?? defOpt?.value ?? v?.value_per_sqm ?? null;
      const code = scanPt?.classification_code ?? defOpt?.code ?? v?.classification_code ?? null;
      const name = params.name
        || (scanPt?.street ? titleCase(scanPt.street) : v?.street ? titleCase(v.street) : v?.label || "Property");
      const addr = [titleCase(scanPt?.barangay || v?.barangay || ""), titleCase(scanPt?.city || v?.city || "")].filter(Boolean).join(" · ");

      setOptions(opts);
      setSel(defGroup);
      setNearby((v?.nearby || []).filter((p) => Number(p.value_per_sqm) > 0).sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9)).slice(0, 8));
      setInfo({ value, code, name, addr });
      setLoading(false);
    })();
    hazardsAt(lat, lon).then((h) => alive && setHaz(h)).catch(() => {});
    return () => { alive = false; };
  }, [lat, lon, params.name]);

  const selOpt = options.find((o) => o.group === sel);
  const shownValue = selOpt ? selOpt.value : info?.value ?? null;
  const name = info?.name || params.name || "Property";
  const appliesTo = info ? [info.name, GROUP_LABEL[sel]].filter(Boolean).join(" · ") : undefined;

  function askAI() {
    const hz = (k: string) => haz?.hazards.find((h) => h.key === k)?.text;
    const [bgy, cty] = (info?.addr || "").split(" · ");
    router.push({
      pathname: "/assistant",
      params: {
        q: `Give a professional assessment of ${name}${cty ? `, ${cty}` : ""} — is it good value for the risk?`,
        ctx: JSON.stringify({
          street: name, barangay: bgy, city: cty,
          classification: info?.code, zonalValue: shownValue,
          landUse: options.map((o) => `${o.label} ₱${o.value}/sqm`).join(", "),
          flood: hz("flood"), landslide: hz("landslide"), stormSurge: hz("surge"),
          fault: hz("fault"), liquefaction: hz("liquefaction"), tsunami: hz("tsunami"),
          overallRisk: haz ? `${haz.riskLabel} (${haz.score.toFixed(1)} / 3.0)` : undefined,
        }),
      },
    } as any);
  }
  function openReport() {
    router.push({ pathname: "/report", params: { lat: String(lat), lon: String(lon), name } } as any);
  }

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.paper }}>
        <AppBar title={name} subtitle={info?.addr || "Establishment"} right={
          <Pressable onPress={openReport} hitSlop={8} style={s.shareBtn}><Ionicons name="document-text-outline" size={18} color={Z.navy} /></Pressable>
        } />
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Z.gold} /><Text style={s.dim}>Reading the land…</Text></View>
      ) : shownValue == null ? (
        <View style={s.center}><Ionicons name="map-outline" size={28} color={Z.slate} /><Text style={s.dim}>No zonal data found for this exact spot.</Text></View>
      ) : (
        <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <ValueCard value={shownValue} appliesTo={appliesTo} />

          <View style={{ marginTop: 14 }}>
            <LandUseToggle options={options} selected={sel} onSelect={(g) => setSel(g as Group)} />
          </View>

          <View style={{ marginTop: 14 }}>
            {haz ? (
              <HazardPanel profile={haz} />
            ) : (
              <View style={s.hazLoad}><ActivityIndicator color={Z.gold} size="small" /><Text style={s.dim}>Checking 6 geohazards…</Text></View>
            )}
          </View>

          {/* PRIMARY deliverable — a branded, downloadable property report */}
          <Pressable onPress={openReport} style={s.report}>
            <View style={s.reportIc}><Ionicons name="document-text" size={20} color={Z.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.reportT}>View Property Report</Text>
              <Text style={s.reportSub}>Branded PDF · preview, download & share</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#16223a" />
          </Pressable>

          <Pressable onPress={askAI} style={s.ai}>
            <Text style={s.aiSpark}>✦</Text>
            <Text style={s.aiT}>Ask the AI about this lot</Text>
          </Pressable>

          {nearby.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Nearby zonal values" subtitle="Tap a parcel to fly there" count={`${nearby.length} near`} />
              <View style={{ gap: 8, marginTop: 12 }}>
                {nearby.map((p, i) => (
                  <ParcelCard
                    key={i}
                    value={Number(p.value_per_sqm)}
                    code={p.classification_code}
                    line={titleCase(p.street || p.barangay || "Nearby parcel")}
                    meta={[titleCase(p.barangay || ""), p.distance_m != null ? `${Math.round(p.distance_m)}m` : ""].filter(Boolean).join(" · ")}
                    onPress={() => router.push({ pathname: "/property", params: { lat: String(p.lat), lon: String(p.lon) } } as any)}
                  />
                ))}
              </View>
            </View>
          )}

          <Text style={s.note}>Geohazard overlays from PHIVOLCS &amp; Project NOAH · BIR-indexed values. For due-diligence reference.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  shareBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef1fa" },
  body: { flex: 1, backgroundColor: Z.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
  dim: { color: Z.slate, fontSize: 12.5, textAlign: "center" },
  hazLoad: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 16, padding: 16 },
  report: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Z.gold, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, shadowColor: Z.goldDeep, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  reportIc: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  reportT: { color: "#16223a", fontSize: 15.5, fontWeight: "800" },
  reportSub: { color: "#3a3520", fontSize: 11, fontWeight: "600", marginTop: 2 },
  ai: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Z.navy, borderRadius: 13, paddingVertical: 13 },
  aiSpark: { color: Z.goldLite, fontSize: 14 },
  aiT: { color: "#fff", fontSize: 13, fontWeight: "700" },
  note: { marginTop: 18, fontSize: 10, color: Z.slate, lineHeight: 15, textAlign: "center" },
});
