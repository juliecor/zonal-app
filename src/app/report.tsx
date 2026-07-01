import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/lib/auth";
import { hazardsAt, type HazardProfile } from "@/lib/hazards";
import { nearestValue, preciseAddress, resolveDomain, scanArea } from "@/lib/api";
import { buildReportHtml } from "@/lib/reportHtml";
import { peso, titleCase } from "@/theme/zonal";
import { useTheme, type Palette } from "@/theme/theme";
import { ShareCard } from "@/components/ShareCard";
import { shareViewAsImage } from "@/lib/shareImage";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pesoBig(n: number): string {
  if (n >= 1e6) return "₱" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "₱" + Math.round(n / 1e3) + "k";
  return "₱" + Math.round(n);
}

// Google Static Map → data URL (best-effort; a referrer-restricted key may refuse,
// in which case the report simply omits the map rather than show a broken image).
async function staticMapDataUrl(lat: number, lon: number): Promise<string | null> {
  const key = process.env.EXPO_PUBLIC_MAPS_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=16&size=640x320&scale=2&maptype=roadmap&markers=color:0x1e3a8a%7C${lat},${lon}&key=${key}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" && fr.result.startsWith("data:image") ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function ReportScreen() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; name?: string }>();
  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const { user, token } = useAuth();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const shotRef = useRef<View>(null);

  const [info, setInfo] = useState<{ name: string; city: string; value: number | null; code: string } | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const dateStr = useMemo(() => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }, []);
  const preparedBy = titleCase(user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ")) || "Filipino Homes Agent";

  useEffect(() => {
    let alive = true;
    if (!isFinite(lat) || !isFinite(lon)) return;
    (async () => {
      const v = await nearestValue(lat, lon).catch(() => null);
      const domain = await resolveDomain(lat, lon, v?.city, v?.province).catch(() => "cebu.zonalvalue.com");
      const d = 0.0032;
      const scan = await scanArea({ minLat: lat - d, maxLat: lat + d, minLon: lon - d, maxLon: lon + d }, domain, "", token).catch(() => null);
      if (!alive) return;
      const scanPt = scan?.points?.[0];
      const value = scanPt?.value_per_sqm
        ?? scan?.classes?.find((c) => c.group === scan.defaultGroup)?.value
        ?? v?.value_per_sqm ?? null;
      const pa = await preciseAddress(lat, lon, { barangay: scanPt?.barangay || v?.barangay, city: scanPt?.city || v?.city });
      if (!alive) return;
      setInfo({
        name: params.name || (scanPt?.street ? titleCase(scanPt.street) : v?.street ? titleCase(v.street) : "Property"),
        city: [titleCase(pa.barangay || ""), titleCase(pa.city || "")].filter(Boolean).join(", ") || "Philippines",
        value,
        code: scanPt?.classification_code || v?.classification_code || "",
      });
    })();
    hazardsAt(lat, lon).then((h) => alive && setHaz(h)).catch(() => {});
    staticMapDataUrl(lat, lon).then((u) => alive && setMapUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [lat, lon, params.name]);

  const title = info?.name || params.name || "Property Report";

  const html = useMemo(() => {
    if (!info || !haz) return "";
    const street = info.name && info.name !== "Property" ? info.name : "";
    const location = street ? `${street}, ${info.city}` : info.city;
    return buildReportHtml({
      location, value: info.value, classification: info.code, dateStr,
      mapDataUrl: mapUrl, hazards: haz.hazards, score: haz.score,
      riskLabel: haz.riskLabel, riskColor: haz.riskColor, checked: haz.checked, preparedBy,
    });
  }, [info, haz, mapUrl, dateStr, preparedBy]);

  const onDownload = useCallback(async () => {
    if (!html) return;
    setDownloading(true);
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Zonal Value Report", UTI: "com.adobe.pdf" });
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      Alert.alert("Couldn't create the PDF", e?.message || "Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [html]);

  const shareReport = useCallback(async () => {
    if (!info) return;
    const lines = [
      `📍 ${info.name}${info.city ? " — " + info.city : ""}`,
      info.value != null ? `Zonal value: ${peso(info.value)}/sqm${info.code ? " (" + info.code + ")" : ""}` : "",
      info.value != null ? `≈ ${pesoBig(info.value * 250)} for 250 sqm · BIR-indexed` : "",
      haz ? `Overall geohazard risk: ${haz.riskLabel} (${haz.score.toFixed(1)}/3.0)` : "",
      "",
      "via zonalvalue.ph",
    ].filter(Boolean);
    try { await Share.share({ message: lines.join("\n") }); } catch { /* cancelled */ }
  }, [info, haz]);

  const shareImage = useCallback(async () => {
    const r = await shareViewAsImage(shotRef, title);
    if (!r.ok) Alert.alert("Share as image", "This works in the installed app (not available in Expo Go).");
  }, [title]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.bar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.barIc}><Ionicons name="chevron-back" size={18} color="#fff" /></Pressable>
          <Text style={s.barTitle} numberOfLines={1}>{title}</Text>
          <Pressable onPress={shareReport} hitSlop={10} style={s.barIc}><Ionicons name="share-outline" size={18} color="#fff" /></Pressable>
        </View>
        <View style={s.accent} />
      </SafeAreaView>

      {html ? (
        <WebView originWhitelist={["*"]} source={{ html }} style={{ flex: 1, backgroundColor: "#fff" }} />
      ) : (
        <View style={s.center}>
          <ActivityIndicator color={c.gold} />
          <Text style={s.dim}>Preparing your report…</Text>
        </View>
      )}

      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line }}>
        <View style={s.btnRow}>
          <Pressable onPress={shareImage} disabled={!html} style={({ pressed }) => [s.imgBtn, (!html || pressed) && { opacity: 0.6 }]}>
            <Ionicons name="share-social-outline" size={18} color={c.isDark ? c.goldLite : c.navy} />
            <Text style={s.imgT}>Share image</Text>
          </Pressable>
          <Pressable onPress={onDownload} disabled={downloading || !html} style={({ pressed }) => [s.downloadBtn, (downloading || !html || pressed) && { opacity: 0.6 }]}>
            {downloading ? <ActivityIndicator color="#16223a" /> : (
              <>
                <Ionicons name="download-outline" size={18} color="#16223a" />
                <Text style={s.downloadT}>Download PDF</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Off-screen branded card captured to PNG for "Share image" */}
      <View style={s.offscreen} pointerEvents="none">
        <ShareCard
          ref={shotRef}
          name={info?.name || title}
          address={info?.city || ""}
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
    root: { flex: 1, backgroundColor: c.card },
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    barIc: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
    barTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.2 },
    accent: { height: 2, backgroundColor: c.gold },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: c.card },
    dim: { color: c.slate, fontSize: 12.5 },
    btnRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    imgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.isDark ? c.goldLite : c.navy, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16 },
    imgT: { color: c.isDark ? c.goldLite : c.navy, fontWeight: "800", fontSize: 13.5 },
    downloadBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.gold, borderRadius: 13, paddingVertical: 14, shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
    downloadT: { color: "#16223a", fontWeight: "800", fontSize: 15 },
    offscreen: { position: "absolute", left: -10000, top: 0 },
  });
}
