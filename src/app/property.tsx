import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { AppBar } from "@/components/AppBar";
import { ValueCard } from "@/components/ValueCard";
import { LandUseToggle } from "@/components/LandUseToggle";
import { HazardPanel } from "@/components/HazardPanel";
import { ParcelCard } from "@/components/ParcelCard";
import { CostsCard } from "@/components/CostsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import { nearestValue, preciseAddress, resolveDomain, scanArea, type ZPoint } from "@/lib/api";
import { buildLandUse, GROUP_LABEL, landUseFromClasses, type Group, type LandUse } from "@/lib/landuse";
import { titleCase } from "@/theme/zonal";
import { useTheme, type Palette } from "@/theme/theme";
import { useAuth } from "@/lib/auth";
import { savedStore } from "@/lib/saved";
import { useStore } from "@/lib/store";
import { ShareCard } from "@/components/ShareCard";
import { shareViewAsImage } from "@/lib/shareImage";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PropertyScreen() {
  const { c, isDark } = useTheme();
  const { user, token } = useAuth();
  const s = useMemo(() => makeStyles(c), [c]);
  const shotRef = useRef<View>(null);
  const saved = useStore(savedStore);
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
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "", token).catch(() => null);
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
      const pa = await preciseAddress(lat, lon, { barangay: scanPt?.barangay || v?.barangay, city: scanPt?.city || v?.city });
      const addr = [titleCase(pa.barangay || ""), titleCase(pa.city || "")].filter(Boolean).join(" · ");

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

  const isSaved = saved.some((l) => Math.abs(l.lat - lat) < 1e-5 && Math.abs(l.lon - lon) < 1e-5);
  function toggleSave() {
    savedStore.toggle({ lat, lon, name, address: info?.addr || "", value: shownValue, code: info?.code ?? null, ts: Date.now() });
  }
  const preparedBy = titleCase(user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ")) || undefined;
  const dateStr = useMemo(() => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }, []);
  async function shareImage() {
    const r = await shareViewAsImage(shotRef, name);
    if (!r.ok) Alert.alert("Share as image", "This works in the installed app (not available in Expo Go).");
  }

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
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.paper }}>
        <AppBar title={name} subtitle={info?.addr || "Establishment"} right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={toggleSave} hitSlop={8} style={s.shareBtn}><Ionicons name={isSaved ? "heart" : "heart-outline"} size={18} color={isSaved ? c.gold : (isDark ? c.goldLite : c.navy)} /></Pressable>
            <Pressable onPress={openReport} hitSlop={8} style={s.shareBtn}><Ionicons name="document-text-outline" size={18} color={isDark ? c.goldLite : c.navy} /></Pressable>
          </View>
        } />
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={c.gold} /><Text style={s.dim}>Reading the land…</Text></View>
      ) : shownValue == null ? (
        <View style={s.center}><Ionicons name="map-outline" size={28} color={c.slate} /><Text style={s.dim}>No zonal data found for this exact spot.</Text></View>
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
              <View style={s.hazLoad}><ActivityIndicator color={c.gold} size="small" /><Text style={s.dim}>Checking 6 geohazards…</Text></View>
            )}
          </View>

          {/* PRIMARY deliverable — a branded, downloadable property report */}
          <Pressable onPress={openReport} style={s.report}>
            <View style={s.reportIc}><Ionicons name="document-text" size={20} color={c.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.reportT}>View Property Report</Text>
              <Text style={s.reportSub}>Branded PDF · preview, download & share</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </Pressable>

          <Pressable onPress={askAI} style={s.ai}>
            <Text style={s.aiSpark}>✦</Text>
            <Text style={s.aiT}>Ask the AI about this lot</Text>
          </Pressable>

          <Pressable onPress={shareImage} style={s.shareImg}>
            <Ionicons name="share-social-outline" size={17} color={isDark ? c.goldLite : c.navy} />
            <Text style={s.shareImgT}>Share as image</Text>
          </Pressable>

          {shownValue != null && (
            <View style={{ marginTop: 18 }}>
              <CostsCard valuePerSqm={shownValue} code={info?.code} />
            </View>
          )}

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

      {/* Off-screen branded card captured to PNG for "Share as image" */}
      <View style={s.offscreen} pointerEvents="none">
        <ShareCard
          ref={shotRef}
          name={name}
          address={info?.addr || ""}
          value={shownValue}
          code={info?.code ?? null}
          hazardLabel={haz?.riskLabel ?? null}
          hazardScore={haz?.score ?? null}
          hazardColor={haz?.riskColor ?? null}
          preparedBy={preparedBy}
          dateStr={dateStr}
        />
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    shareBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.chip },
    body: { flex: 1, backgroundColor: c.paper },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
    dim: { color: c.slate, fontSize: 12.5, textAlign: "center" },
    hazLoad: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 16 },
    report: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.gold, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, shadowColor: c.goldDeep, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
    reportIc: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
    reportT: { color: "#ffffff", fontSize: 15.5, fontWeight: "800" },
    reportSub: { color: "#3a3520", fontSize: 11, fontWeight: "600", marginTop: 2 },
    ai: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.navy, borderRadius: 13, paddingVertical: 13 },
    aiSpark: { color: c.goldLite, fontSize: 14 },
    aiT: { color: "#fff", fontSize: 13, fontWeight: "700" },
    shareImg: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingVertical: 12 },
    shareImgT: { color: c.isDark ? c.goldLite : c.navy, fontSize: 13, fontWeight: "700" },
    offscreen: { position: "absolute", left: -10000, top: 0 },
    note: { marginTop: 18, fontSize: 10, color: c.slate, lineHeight: 15, textAlign: "center" },
  });
}
