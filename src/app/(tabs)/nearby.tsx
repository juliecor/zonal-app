import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";

import { ValueCard } from "@/components/ValueCard";
import { HazardChips } from "@/components/HazardChips";
import { ParcelCard } from "@/components/ParcelCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ClassChip } from "@/components/ClassChip";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import { nearestValue, preciseAddress, resolveDomain, scanArea, type ZPoint } from "@/lib/api";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF, titleCase } from "@/theme/zonal";
import { useAuth } from "@/lib/auth";
import { ShareCard } from "@/components/ShareCard";
import { shareViewAsImage } from "@/lib/shareImage";

interface Info { lat: number; lon: number; value: number | null; code: string | null; name: string; addr: string }
type Phase = "idle" | "intro" | "locating" | "ready" | "denied" | "error";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function NearbyScreen() {
  const { c } = useTheme();
  const { user, token } = useAuth();
  const s = useMemo(() => makeStyles(c), [c]);
  const shotRef = useRef<View>(null);
  const preparedBy = titleCase(user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ")) || undefined;
  const dateStr = useMemo(() => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }, []);
  const [phase, setPhase] = useState<Phase>("locating");
  const [info, setInfo] = useState<Info | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [nearby, setNearby] = useState<ZPoint[]>([]);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    // If location was already granted, go straight to it; otherwise explain WHY before
    // triggering the OS prompt (Google Play prominent-disclosure expectation).
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) locate(); else setPhase("intro");
      } catch { setPhase("intro"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function locate() {
    setPhase("locating");
    setHaz(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") { setPhase("denied"); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const near = await nearestValue(lat, lon).catch(() => null);
      const domain = await resolveDomain(lat, lon, near?.city, near?.province).catch(() => "cebu.zonalvalue.com");
      const d = 0.0032;
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "", token).catch(() => null);

      const scanPt = scan?.points?.[0];
      const value = scanPt?.value_per_sqm
        ?? scan?.classes?.find((c) => c.group === scan.defaultGroup)?.value
        ?? near?.value_per_sqm ?? null;
      const code = scanPt?.classification_code ?? near?.classification_code ?? null;
      const name = scanPt?.street ? titleCase(scanPt.street) : near?.street ? titleCase(near.street) : "Your location";
      const pa = await preciseAddress(lat, lon, { barangay: scanPt?.barangay || near?.barangay, city: scanPt?.city || near?.city });
      const addr = [titleCase(pa.barangay || ""), titleCase(pa.city || "")].filter(Boolean).join(" · ") || "Current location";

      setInfo({ lat, lon, value, code, name, addr });
      setNearby((near?.nearby || []).filter((p) => Number(p.value_per_sqm) > 0).sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9)).slice(0, 6));
      hazardsAt(lat, lon).then(setHaz).catch(() => {});
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  function openReport() {
    if (!info) return;
    router.push({ pathname: "/report", params: { lat: String(info.lat), lon: String(info.lon), name: info.name } } as any);
  }
  function askAI() {
    if (!info) return;
    const hz = (k: string) => haz?.hazards.find((h) => h.key === k)?.text;
    router.push({
      pathname: "/assistant",
      params: {
        q: `Give a professional assessment of where I am now — ${info.name}${info.addr ? ", " + info.addr : ""}.`,
        ctx: JSON.stringify({
          street: info.name, classification: info.code, zonalValue: info.value,
          flood: hz("flood"), landslide: hz("landslide"), stormSurge: hz("surge"),
          overallRisk: haz ? `${haz.riskLabel} (${haz.score.toFixed(1)} / 3.0)` : undefined,
        }),
      },
    } as any);
  }

  async function shareImage() {
    const r = await shareViewAsImage(shotRef, info?.name || "Zonal value");
    if (!r.ok) Alert.alert("Share as image", "This works in the installed app (not available in Expo Go).");
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.header}>
          <View style={s.icon}><Ionicons name="navigate" size={17} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.brand}>Near Me</Text>
            <Text style={s.brandSub}>Zonal value where you're standing</Text>
          </View>
          {phase === "ready" && (
            <Pressable onPress={locate} hitSlop={8} style={s.refresh}><Ionicons name="refresh" size={17} color="#fff" /></Pressable>
          )}
        </View>
      </SafeAreaView>

      {phase === "intro" ? (
        <View style={s.center}>
          <View style={s.bigIcon}><Ionicons name="navigate" size={26} color={c.goldDeep} /></View>
          <Text style={s.cTitle}>See values near you</Text>
          <Text style={s.dim}>zonalvalue.ph uses your location <Text style={{ fontWeight: "800" }}>only while the app is open</Text> — to show the BIR zonal value where you&apos;re standing and nearby lots. We never track you in the background.</Text>
          <Pressable onPress={locate} style={s.cta}><Ionicons name="navigate" size={16} color="#ffffff" /><Text style={s.ctaT}>Enable location</Text></Pressable>
        </View>
      ) : phase === "locating" ? (
        <View style={s.center}>
          <View style={s.bigIcon}><Ionicons name="navigate" size={26} color={c.goldDeep} /></View>
          <ActivityIndicator color={c.gold} style={{ marginTop: 14 }} />
          <Text style={s.dim}>Finding your location…</Text>
        </View>
      ) : phase === "denied" ? (
        <View style={s.center}>
          <Ionicons name="location-outline" size={30} color={c.slate} />
          <Text style={s.cTitle}>Location is off</Text>
          <Text style={s.dim}>Allow location access so we can read the zonal value where you are.</Text>
          <Pressable onPress={locate} style={s.cta}><Ionicons name="navigate" size={16} color="#ffffff" /><Text style={s.ctaT}>Enable location</Text></Pressable>
        </View>
      ) : phase === "error" ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={30} color={c.slate} />
          <Text style={s.dim}>Couldn&apos;t get your location. Make sure GPS is on, then try again.</Text>
          <Pressable onPress={locate} style={s.cta}><Ionicons name="refresh" size={16} color="#ffffff" /><Text style={s.ctaT}>Try again</Text></Pressable>
        </View>
      ) : info ? (
        <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <View style={s.locRow}>
            <Ionicons name="location" size={15} color={c.gold} />
            <Text style={s.locName} numberOfLines={1}>{info.name}</Text>
            {!!info.code && <ClassChip code={info.code} size="sm" />}
          </View>
          <Text style={s.locAddr}>{info.addr}</Text>

          <View style={{ marginTop: 12 }}>
            <ValueCard value={info.value} label="Zonal value near you" appliesTo={info.addr} />
          </View>

          <View style={s.hazCard}>
            {haz ? (
              <>
                <View style={s.hazTop}>
                  <Text style={s.hazLbl}>GEOHAZARD READ</Text>
                  <Text style={[s.hazRisk, { color: haz.riskColor }]}>{haz.riskLabel} · {haz.score.toFixed(1)}/3.0</Text>
                </View>
                <HazardChips hazards={haz.hazards} />
              </>
            ) : (
              <View style={s.hazLoading}><ActivityIndicator color={c.gold} size="small" /><Text style={s.dim}>Checking 6 geohazards…</Text></View>
            )}
          </View>

          {/* PRIMARY — branded, downloadable report for where you're standing */}
          <Pressable onPress={openReport} style={s.report}>
            <View style={s.reportIc}><Ionicons name="document-text" size={20} color={c.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.reportT}>View Property Report</Text>
              <Text style={s.reportSub}>Branded PDF · preview, download &amp; share</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </Pressable>
          <Pressable onPress={askAI} style={s.aiFull}>
            <Text style={s.aiSpark}>✦</Text><Text style={s.aiT}>Ask the AI about this spot</Text>
          </Pressable>
          <Pressable onPress={shareImage} style={s.shareImg}>
            <Ionicons name="share-social-outline" size={17} color={c.isDark ? c.goldLite : c.navy} />
            <Text style={s.shareImgT}>Share as image</Text>
          </Pressable>

          {nearby.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Nearby zonal values" subtitle="Around your location" count={`${nearby.length} near`} />
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
        </ScrollView>
      ) : null}

      {/* Off-screen branded card captured to PNG for "Share as image" */}
      <View style={s.offscreen} pointerEvents="none">
        <ShareCard
          ref={shotRef}
          name={info?.name || "Your location"}
          address={info?.addr || ""}
          value={info?.value ?? null}
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
    header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
    icon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.navy2 },
    brand: { color: c.white, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
    brandSub: { color: "#9fb0d8", fontSize: 11, marginTop: 2, fontWeight: "600" },
    refresh: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 36 },
    bigIcon: { width: 56, height: 56, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: c.isDark ? "rgba(21,94,239,0.14)" : "#e8f0ff" },
    cTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: "600", color: c.ink, marginTop: 4 },
    dim: { color: c.slate, fontSize: 13, textAlign: "center", lineHeight: 19 },

    body: { flex: 1 },
    locRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    locName: { flex: 1, fontFamily: SERIF, fontSize: 18, fontWeight: "600", color: c.ink },
    locAddr: { fontSize: 12, color: c.slate, marginTop: 3 },

    hazCard: { marginTop: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14 },
    hazTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
    hazLbl: { fontSize: 8.5, letterSpacing: 1.3, color: c.slate, fontWeight: "800" },
    hazRisk: { fontSize: 13, fontWeight: "800" },
    hazLoading: { flexDirection: "row", alignItems: "center", gap: 10 },

    cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.gold, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 16, marginTop: 16, shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
    ctaT: { fontSize: 13, fontWeight: "800", color: "#ffffff" },
    report: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.gold, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, shadowColor: c.goldDeep, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
    reportIc: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
    reportT: { color: "#ffffff", fontSize: 15.5, fontWeight: "800" },
    reportSub: { color: "#3a3520", fontSize: 11, fontWeight: "600", marginTop: 2 },
    aiFull: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.navy, borderRadius: 13, paddingVertical: 13 },
    aiSpark: { color: c.goldLite, fontSize: 13 },
    aiT: { color: "#fff", fontSize: 13, fontWeight: "700" },
    shareImg: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingVertical: 12 },
    shareImgT: { color: c.isDark ? c.goldLite : c.navy, fontSize: 13, fontWeight: "700" },
    offscreen: { position: "absolute", left: -10000, top: 0 },
  });
}
