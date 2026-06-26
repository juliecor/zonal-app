import { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { getBarangays, getCities, PROVINCES } from "@/lib/api";
import { titleCase, Z } from "@/theme/zonal";

export default function HomeScreen() {
  const [prov, setProv] = useState("CEBU");
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [brgys, setBrgys] = useState<string[]>([]);
  const [bLoading, setBLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(false); setCity(null); setBrgys([]); setQ("");
    getCities(prov)
      .then((c) => { if (alive) { setCities(c); setLoading(false); } })
      .catch(() => { if (alive) { setErr(true); setCities([]); setLoading(false); } });
    return () => { alive = false; };
  }, [prov]);

  function openCity(c: string) {
    if (city === c) { setCity(null); return; }
    setCity(c); setBLoading(true); setBrgys([]);
    getBarangays(prov, c)
      .then((b) => setBrgys(b))
      .catch(() => setBrgys([]))
      .finally(() => setBLoading(false));
  }

  const filtered = cities.filter((c) => c.toLowerCase().includes(q.toLowerCase()));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* ── Brand header ── */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Z.navy }}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Text style={styles.logoT}>Z</Text></View>
            <View>
              <Text style={styles.brand}>zonalvalue<Text style={{ color: Z.goldLite }}>.</Text>ph</Text>
              <Text style={styles.by}>BY FILIPINO HOMES</Text>
            </View>
          </View>
          <Text style={styles.h1}>Browse land value coverage</Text>
          <Text style={styles.sub}>Live from the BIR zonal database</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
        {/* province chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {PROVINCES.map((p) => {
            const on = p === prov;
            return (
              <Pressable key={p} onPress={() => setProv(p)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipT, on && styles.chipTOn]}>{titleCase(p)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* search */}
        <View style={styles.searchWrap}>
          <TextInput
            value={q} onChangeText={setQ}
            placeholder={`Search ${titleCase(prov)} cities…`}
            placeholderTextColor={Z.slate}
            style={styles.search}
            autoCorrect={false}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Z.gold} />
            <Text style={styles.dim}>Loading {titleCase(prov)}…</Text>
          </View>
        ) : err ? (
          <View style={styles.center}>
            <Text style={styles.dim}>Couldn&apos;t reach the server. Tap a province to retry.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.count}>{filtered.length} cities / municipalities</Text>
            {filtered.map((c) => {
              const open = city === c;
              return (
                <View key={c}>
                  <Pressable onPress={() => openCity(c)} style={[styles.row, open && styles.rowOn]}>
                    <Text style={styles.rowT}>{titleCase(c)}</Text>
                    <Text style={styles.chev}>{open ? "▾" : "›"}</Text>
                  </Pressable>
                  {open && (
                    <View style={styles.brgyBox}>
                      <Text style={styles.brgyH}>Barangays in {titleCase(c)}</Text>
                      {bLoading ? (
                        <ActivityIndicator color={Z.gold} style={{ alignSelf: "flex-start", marginTop: 4 }} />
                      ) : brgys.length ? (
                        <View style={styles.brgyWrap}>
                          {brgys.map((b) => (
                            <View key={b} style={styles.brgyPill}><Text style={styles.brgyPillT}>{titleCase(b)}</Text></View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.dim}>No barangays found.</Text>
                      )}
                      <Text style={styles.note}>Peso values + 6-point hazard profile unlock with sign-in — coming next.</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: Z.goldLite },
  logoT: { color: "#16223a", fontWeight: "800", fontSize: 19 },
  brand: { color: Z.white, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  by: { color: "#9fb0d8", fontSize: 9.5, letterSpacing: 2, marginTop: 3, fontWeight: "600" },
  h1: { color: Z.white, fontSize: 23, fontWeight: "800", marginTop: 18, letterSpacing: -0.4 },
  sub: { color: "#bcc8ee", fontSize: 12.5, marginTop: 5 },

  body: { flex: 1 },
  chipsRow: { paddingHorizontal: 14, paddingVertical: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line },
  chipOn: { backgroundColor: Z.navy, borderColor: Z.navy },
  chipT: { fontSize: 13, fontWeight: "700", color: Z.slate },
  chipTOn: { color: Z.white },

  searchWrap: { paddingHorizontal: 16, marginBottom: 6 },
  search: { backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Z.ink },

  center: { alignItems: "center", gap: 10, paddingVertical: 40 },
  dim: { color: Z.slate, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },

  list: { paddingHorizontal: 16, paddingTop: 8 },
  count: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Z.slate, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 8 },
  rowOn: { borderColor: Z.gold, backgroundColor: "#fffdf6" },
  rowT: { fontSize: 15, fontWeight: "600", color: Z.ink },
  chev: { fontSize: 16, color: Z.gold, fontWeight: "700" },

  brgyBox: { backgroundColor: "#fffdf6", borderWidth: 1, borderColor: "#ece3cf", borderRadius: 13, padding: 13, marginTop: -2, marginBottom: 10 },
  brgyH: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: Z.navy, marginBottom: 9 },
  brgyWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  brgyPill: { backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  brgyPillT: { fontSize: 11.5, color: Z.inkSoft, fontWeight: "600" },
  note: { marginTop: 12, fontSize: 11, color: Z.goldDeep, fontWeight: "600", lineHeight: 16 },
});
