import { useCallback, useEffect, useMemo, useState } from "react";
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
import { nearestValue, resolveDomain, scanArea } from "@/lib/api";
import { buildReportHtml } from "@/lib/reportHtml";
import { peso, titleCase } from "@/theme/zonal";
import { useTheme, type Palette } from "@/theme/theme";

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
  const { user } = useAuth();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

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
      "via zonalvalue.ph · by Filipino Homes",
    ].filter(Boolean);
    try { await Share.share({ message: lines.join("\n") }); } catch { /* cancelled */ }
  }, [info, haz]);

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
        <Pressable onPress={onDownload} disabled={downloading || !html} style={({ pressed }) => [s.downloadBtn, (downloading || !html || pressed) && { opacity: 0.6 }]}>
          {downloading ? <ActivityIndicator color="#16223a" /> : (
            <>
              <Ionicons name="download-outline" size={18} color="#16223a" />
              <Text style={s.downloadT}>Download PDF</Text>
            </>
          )}
        </Pressable>
      </SafeAreaView>
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
    downloadBtn: { margin: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.gold, borderRadius: 13, paddingVertical: 15, shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
    downloadT: { color: "#16223a", fontWeight: "800", fontSize: 15 },
  });
}
