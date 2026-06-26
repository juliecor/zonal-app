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
import { nearestValue, type ValueLookup } from "@/lib/api";
import { buildLandUse, GROUP_LABEL, type Group, type LandUse } from "@/lib/landuse";
import { titleCase, Z } from "@/theme/zonal";

export default function PropertyScreen() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; name?: string }>();
  const lat = Number(params.lat);
  const lon = Number(params.lon);

  const [data, setData] = useState<ValueLookup | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [lu, setLu] = useState<{ options: LandUse[]; defaultGroup: Group }>({ options: [], defaultGroup: "residential" });
  const [sel, setSel] = useState<Group>("residential");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isFinite(lat) || !isFinite(lon)) { setLoading(false); return; }
    setLoading(true);
    nearestValue(lat, lon)
      .then((v) => {
        if (!alive) return;
        setData(v);
        const pts = [{ value_per_sqm: v.value_per_sqm ?? undefined, classification_code: v.classification_code ?? undefined }, ...v.nearby];
        const built = buildLandUse(pts, v.classification_code);
        setLu(built);
        setSel(built.defaultGroup);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    hazardsAt(lat, lon).then((h) => alive && setHaz(h)).catch(() => {});
    return () => { alive = false; };
  }, [lat, lon]);

  const selOpt = lu.options.find((o) => o.group === sel);
  const shownValue = selOpt ? selOpt.value : data?.value_per_sqm ?? null;
  const name = data?.street ? titleCase(data.street) : params.name || data?.label || "Property";
  const addr = [titleCase(data?.barangay || ""), titleCase(data?.city || "")].filter(Boolean).join(" · ");
  const appliesTo = data
    ? [titleCase(data.street || data.barangay || ""), GROUP_LABEL[sel]].filter(Boolean).join(" · ")
    : undefined;

  const nearby = (data?.nearby || [])
    .filter((p) => Number(p.value_per_sqm) > 0)
    .sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9))
    .slice(0, 8);

  function askAI() {
    router.push({
      pathname: "/assistant",
      params: {
        q: `Tell me about ${name}${addr ? ", " + addr : ""} — is it good value for the risk?`,
        ctx: JSON.stringify({
          street: data?.street, barangay: data?.barangay, city: data?.city, province: data?.province,
          classification: data?.classification_code, zonalValue: shownValue,
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
        <AppBar title={name} subtitle={addr || "Establishment"} right={
          <Pressable onPress={openReport} hitSlop={8} style={s.shareBtn}><Ionicons name="share-outline" size={18} color={Z.navy} /></Pressable>
        } />
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Z.gold} /><Text style={s.dim}>Reading the land…</Text></View>
      ) : !data?.found && shownValue == null ? (
        <View style={s.center}><Ionicons name="map-outline" size={28} color={Z.slate} /><Text style={s.dim}>No zonal data found for this exact spot.</Text></View>
      ) : (
        <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <ValueCard value={shownValue} appliesTo={appliesTo} />

          <View style={{ marginTop: 14 }}>
            <LandUseToggle options={lu.options} selected={sel} onSelect={(g) => setSel(g as Group)} />
          </View>

          <View style={{ marginTop: 14 }}>
            {haz ? (
              <HazardPanel profile={haz} />
            ) : (
              <View style={s.hazLoad}><ActivityIndicator color={Z.gold} size="small" /><Text style={s.dim}>Checking 6 geohazards…</Text></View>
            )}
          </View>

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
  ai: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Z.navy, borderRadius: 13, paddingVertical: 13 },
  aiSpark: { color: Z.goldLite, fontSize: 14 },
  aiT: { color: "#fff", fontSize: 13, fontWeight: "700" },
  note: { marginTop: 18, fontSize: 10, color: Z.slate, lineHeight: 15, textAlign: "center" },
});
