import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
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
import { peso, SERIF, titleCase, Z } from "@/theme/zonal";

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

  const [info, setInfo] = useState<{ name: string; city: string; value: number | null; code: string } | null>(null);
  const [haz, setHaz] = useState<HazardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const dateStr = useMemo(() => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }, []);
  const preparedBy = titleCase(user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ")) || "Filipino Homes Agent";

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
    staticMapDataUrl(lat, lon).then((u) => alive && setMapUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [lat, lon, params.name]);

  const name = info?.name || params.name || "Property";
  const city = info?.city || "Philippines";
  const value = info?.value ?? null;
  const code = info?.code || "";
  const flood = haz?.hazards.find((h) => h.key === "flood");
  const fault = haz?.hazards.find((h) => h.key === "fault");

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
          <Text style={s.rsub}>{city} · {dateStr}</Text>
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

          {/* PRIMARY: see the full, downloadable report (preview first) */}
          <Pressable onPress={() => setPreviewOpen(true)} disabled={!html} style={({ pressed }) => [s.fullBtn, (!html || pressed) && { opacity: 0.85 }]}>
            <Ionicons name="document-text-outline" size={18} color="#16223a" />
            <Text style={s.fullBtnT}>{html ? "View Full Report" : "Preparing report…"}</Text>
            <Ionicons name="chevron-forward" size={16} color="#16223a" />
          </Pressable>
          <Text style={s.hint}>A branded, downloadable PDF — preview it before you save or share.</Text>

          <View style={s.hzr}>
            <Cell k="Overall" v={haz ? `${haz.riskLabel}` : "—"} c={haz?.riskColor ?? Z.slate} sub={haz ? haz.score.toFixed(1) : ""} />
            <Cell k="Flood" v={flood?.text ?? "—"} c={flood?.color ?? Z.slate} />
            <Cell k="Fault" v={fault?.text ?? "—"} c={fault?.color ?? Z.slate} />
          </View>

          <Text style={s.note}>Zonal values are BIR-assessed references, not market prices. Hazard overlays from PHIVOLCS &amp; Project NOAH. For due-diligence reference only.</Text>
        </ScrollView>
      )}

      {/* Full report preview — WebView renders the exact HTML that becomes the PDF */}
      <Modal visible={previewOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <StatusBar style="light" />
          <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.navy }}>
            <View style={s.bar}>
              <Pressable onPress={() => setPreviewOpen(false)} hitSlop={10} style={s.barIc}><Ionicons name="close" size={20} color="#fff" /></Pressable>
              <Text style={s.barTitle}>Report Preview</Text>
              <View style={{ width: 32 }} />
            </View>
          </SafeAreaView>
          {html ? (
            <WebView originWhitelist={["*"]} source={{ html }} style={{ flex: 1, backgroundColor: "#fff" }} />
          ) : (
            <View style={s.center}><ActivityIndicator color={Z.gold} /></View>
          )}
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: Z.line }}>
            <Pressable onPress={onDownload} disabled={downloading || !html} style={({ pressed }) => [s.downloadBtn, (downloading || pressed) && { opacity: 0.85 }]}>
              {downloading ? <ActivityIndicator color="#16223a" /> : (
                <>
                  <Ionicons name="download-outline" size={18} color="#16223a" />
                  <Text style={s.downloadT}>Download PDF</Text>
                </>
              )}
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
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

  fullBtn: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Z.gold, borderRadius: 13, paddingVertical: 15, shadowColor: Z.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  fullBtnT: { color: "#16223a", fontWeight: "800", fontSize: 15 },
  hint: { fontSize: 11, color: Z.slate, marginTop: 8, textAlign: "center" },

  hzr: { flexDirection: "row", gap: 8, marginTop: 18 },
  cell: { flex: 1, borderWidth: 1, borderColor: Z.line, borderRadius: 11, paddingVertical: 11, alignItems: "center" },
  cellK: { fontSize: 9, color: Z.inkSoft, fontWeight: "700" },
  cellV: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  cellSub: { fontSize: 8.5, color: Z.slate, marginTop: 2 },

  note: { marginTop: 24, fontSize: 10, color: Z.slate, lineHeight: 15, paddingTop: 16, borderTopWidth: 1, borderTopColor: Z.line, borderStyle: "dashed" },

  downloadBtn: { margin: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Z.gold, borderRadius: 13, paddingVertical: 15, shadowColor: Z.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  downloadT: { color: "#16223a", fontWeight: "800", fontSize: 15 },
});
