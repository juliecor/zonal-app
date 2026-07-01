// A fixed, branded card captured to PNG for sharing on Messenger/WhatsApp.
// Fixed colors (navy/gold/white) so the shared image looks the same regardless of app theme.
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { peso } from "@/theme/zonal";

export interface ShareCardData {
  name: string;
  address: string;
  value: number | null;
  code: string | null;
  hazardLabel?: string | null;
  hazardScore?: number | null;
  hazardColor?: string | null;
  preparedBy?: string;
  dateStr?: string;
}

const NAVY = "#16276a", GOLD = "#c9a84c", INK = "#16223a";

export const ShareCard = forwardRef<View, ShareCardData>(function ShareCard(d, ref) {
  const estimate = d.value != null ? d.value * 250 : null;
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      <View style={s.head}>
        <Ionicons name="location-sharp" size={22} color={GOLD} />
        <Text style={s.wm}>zonalvalue<Text style={{ color: GOLD }}>.ph</Text></Text>
        <Text style={s.headTag}>BIR ZONAL VALUE</Text>
      </View>

      <View style={s.body}>
        <Text style={s.locLabel}>LOCATION</Text>
        <Text style={s.name} numberOfLines={2}>{d.name}</Text>
        {!!d.address && <Text style={s.addr} numberOfLines={1}>{d.address}</Text>}

        <View style={s.valueCard}>
          <Text style={s.vLabel}>ZONAL VALUE</Text>
          <View style={s.vRow}>
            <Text style={s.vNum}>{d.value != null ? peso(d.value) : "—"}</Text>
            <Text style={s.vPer}>/sqm</Text>
          </View>
          <View style={s.vMeta}>
            {!!d.code && <View style={s.classPill}><Text style={s.classT}>{d.code}</Text></View>}
            {estimate != null && <Text style={s.est}>≈ {peso(estimate)} for 250 sqm</Text>}
          </View>
        </View>

        {(d.hazardLabel || d.hazardScore != null) && (
          <View style={s.hazRow}>
            <View style={[s.hazDot, { backgroundColor: d.hazardColor || GOLD }]} />
            <Text style={s.hazT}>Geohazard: </Text>
            <Text style={[s.hazVal, { color: d.hazardColor || INK }]}>
              {d.hazardLabel || "—"}{d.hazardScore != null ? `  ·  ${d.hazardScore.toFixed(1)}/3.0` : ""}
            </Text>
          </View>
        )}
      </View>

      <View style={s.foot}>
        <Text style={s.footT} numberOfLines={1}>
          {d.preparedBy ? `Prepared by ${d.preparedBy}` : "via zonalvalue.ph"}
          {d.dateStr ? `  ·  ${d.dateStr}` : ""}
        </Text>
        <Text style={s.footBrand}>zonalvalue.ph · BIR-indexed · estimates only</Text>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  card: { width: 360, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NAVY, paddingHorizontal: 18, paddingVertical: 14 },
  wm: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  headTag: { marginLeft: "auto", color: GOLD, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },

  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  locLabel: { fontSize: 9.5, letterSpacing: 1.4, fontWeight: "800", color: "#8a93a8" },
  name: { fontSize: 22, fontWeight: "800", color: INK, marginTop: 4, lineHeight: 26, letterSpacing: -0.3 },
  addr: { fontSize: 12.5, color: "#5a6079", marginTop: 3 },

  valueCard: { backgroundColor: NAVY, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginTop: 14 },
  vLabel: { color: GOLD, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.4 },
  vRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  vNum: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: -1, lineHeight: 34 },
  vPer: { color: "#c6d0ea", fontSize: 13, fontWeight: "600", marginBottom: 4 },
  vMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  classPill: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  classT: { color: "#fff", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
  est: { color: "#c6d0ea", fontSize: 11.5, fontWeight: "600" },

  hazRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  hazDot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  hazT: { fontSize: 12.5, color: "#5a6079", fontWeight: "600" },
  hazVal: { fontSize: 12.5, fontWeight: "800" },

  foot: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, marginTop: 12, borderTopWidth: 1, borderTopColor: "#eef1f5" },
  footT: { fontSize: 11.5, color: INK, fontWeight: "700" },
  footBrand: { fontSize: 10, color: "#8a93a8", marginTop: 2 },
});
