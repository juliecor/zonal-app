import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { Logo } from "@/components/Logo";
import { PickerModal } from "@/components/PickerModal";
import { ParcelCard } from "@/components/ParcelCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useAuth } from "@/lib/auth";
import {
  getBarangays, getCities, getClassifications, getProvinces, getZonalValues,
  PROVINCES, type ZonalRecord,
} from "@/lib/api";
import { useTheme, type Palette } from "@/theme/theme";
import { titleCase } from "@/theme/zonal";

export default function ZonalsScreen() {
  const { token } = useAuth();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [provinces, setProvinces] = useState<string[]>(PROVINCES);
  const [provModal, setProvModal] = useState(false);
  const [prov, setProv] = useState("CEBU");
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [brgys, setBrgys] = useState<string[]>([]);
  const [brgy, setBrgy] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [cls, setCls] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [records, setRecords] = useState<ZonalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cityModal, setCityModal] = useState(false);
  const [brgyModal, setBrgyModal] = useState(false);
  const reqId = useRef(0);

  // full province list (all provinces with data)
  useEffect(() => {
    getProvinces().then((list) => { if (list.length) setProvinces(list); }).catch(() => {});
  }, []);

  // load cities when province changes
  useEffect(() => {
    setCity(null); setBrgy(null); setBrgys([]); setClasses([]); setCls(null);
    setRecords([]); setTotal(0); setErr(null);
    getCities(prov).then(setCities).catch(() => setCities([]));
  }, [prov]);

  async function search(opts: { reset?: boolean; nextPage?: number } = {}) {
    if (!city || !token) return;
    const pageToLoad = opts.nextPage ?? 1;
    const mine = ++reqId.current;
    if (opts.reset !== false && pageToLoad === 1) { setLoading(true); setRecords([]); } else { setLoadingMore(true); }
    setErr(null);
    try {
      const r = await getZonalValues(token, {
        province: prov, city, barangay: brgy || undefined, classification_code: cls || undefined,
        q: q.trim() || undefined, page: pageToLoad, per_page: 20,
      });
      if (mine !== reqId.current) return; // stale
      setRecords((prev) => (pageToLoad === 1 ? r.data : [...prev, ...r.data]));
      setTotal(r.total); setPage(r.current_page); setLastPage(r.last_page);
    } catch (e: any) {
      if (mine !== reqId.current) return;
      setErr(e?.message === "OUT_OF_CREDITS" ? "OUT_OF_CREDITS" : e?.message === "UNAUTHORIZED" ? "UNAUTHORIZED" : "Couldn't load values. Try again.");
      setRecords([]); setTotal(0);
    } finally {
      if (mine === reqId.current) { setLoading(false); setLoadingMore(false); }
    }
  }

  function pickCity(c: string | null) {
    setCity(c); setBrgy(null); setCls(null); setRecords([]); setTotal(0);
    if (c) {
      getBarangays(prov, c).then(setBrgys).catch(() => setBrgys([]));
      getClassifications(prov, c).then(setClasses).catch(() => setClasses([]));
      setTimeout(() => search({ nextPage: 1 }), 0);
    }
  }

  // re-search when barangay / classification change (after a city is chosen)
  useEffect(() => {
    if (city) search({ nextPage: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brgy, cls]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.header}>
          <Logo size={40} />
          <View>
            <Text style={s.brand}>Zonal Values</Text>
            <Text style={s.brandSub}>Search the official BIR database</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
        {/* province selector */}
        <View style={[s.selectors, { marginTop: 14 }]}>
          <Selector label="Province" value={titleCase(prov)} placeholder="Select province" onPress={() => setProvModal(true)} />
        </View>

        {/* city + barangay selectors */}
        <View style={[s.selectors, { marginTop: 10 }]}>
          <Selector label="City / Municipality" value={city ? titleCase(city) : null} placeholder="Select a city" onPress={() => setCityModal(true)} />
          <Selector label="Barangay" value={brgy ? titleCase(brgy) : city ? "All barangays" : null} placeholder="All barangays" disabled={!city} onPress={() => setBrgyModal(true)} />
        </View>

        {/* classification filter */}
        {!!city && classes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.clsRow}>
            <Pressable onPress={() => setCls(null)} style={[s.clsChip, !cls && s.clsOn]}><Text style={[s.clsT, !cls && s.clsTOn]}>All</Text></Pressable>
            {classes.map((c) => (
              <Pressable key={c} onPress={() => setCls(c)} style={[s.clsChip, cls === c && s.clsOn]}>
                <Text style={[s.clsT, cls === c && s.clsTOn]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* keyword search */}
        {!!city && (
          <View style={s.searchWrap}>
            <Ionicons name="search" size={15} color={c.slate} />
            <TextInput
              value={q} onChangeText={setQ} placeholder="Filter by street / subdivision…" placeholderTextColor={c.slate}
              style={s.search} returnKeyType="search" onSubmitEditing={() => search({ nextPage: 1 })} autoCorrect={false}
            />
            {q.length > 0 && <Pressable onPress={() => { setQ(""); search({ nextPage: 1 }); }} hitSlop={8}><Ionicons name="close-circle" size={16} color={c.slate} /></Pressable>}
          </View>
        )}

        {/* results */}
        <View style={s.results}>
          {!city ? (
            <View style={s.center}><Ionicons name="business-outline" size={28} color={c.slate} /><Text style={s.dim}>Pick a province and city to see its zonal values.</Text></View>
          ) : loading ? (
            <View style={s.center}><ActivityIndicator color={c.gold} /><Text style={s.dim}>Loading {titleCase(city)}…</Text></View>
          ) : err === "OUT_OF_CREDITS" ? (
            <View style={s.center}><Ionicons name="server-outline" size={26} color={c.slate} /><Text style={s.dim}>You're out of search credits. Request more from your account or ask an admin.</Text></View>
          ) : err === "UNAUTHORIZED" ? (
            <View style={s.center}><Ionicons name="lock-closed-outline" size={26} color={c.slate} /><Text style={s.dim}>Please sign in again to search records.</Text></View>
          ) : err ? (
            <View style={s.center}><Text style={s.dim}>{err}</Text></View>
          ) : records.length === 0 ? (
            <View style={s.center}><Text style={s.dim}>No zonal records found for this filter.</Text></View>
          ) : (
            <>
              <SectionHeader title={`${total} zonal value${total === 1 ? "" : "s"}`} subtitle={`${titleCase(city)}${brgy ? " · " + titleCase(brgy) : ""}`} count={cls || "all"} />
              <View style={{ gap: 8, marginTop: 12 }}>
                {records.map((r, i) => (
                  <ParcelCard
                    key={`${r.id}-${i}`}
                    value={Number(r.value_per_sqm)}
                    code={r.classification_code}
                    line={titleCase(r.street_location || r.vicinity || r.barangay || "Parcel")}
                    meta={[titleCase(r.barangay || ""), titleCase(r.city_municipality || "")].filter(Boolean).join(" · ")}
                  />
                ))}
              </View>
              {page < lastPage && (
                <Pressable onPress={() => search({ nextPage: page + 1 })} style={s.more} disabled={loadingMore}>
                  {loadingMore ? <ActivityIndicator color={c.navy} /> : <Text style={s.moreT}>Load more ({total - records.length} left)</Text>}
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <PickerModal visible={provModal} title="Province" items={provinces} onSelect={(p) => { if (p) setProv(p); }} onClose={() => setProvModal(false)} />
      <PickerModal visible={cityModal} title={`Cities in ${titleCase(prov)}`} items={cities} onSelect={pickCity} onClose={() => setCityModal(false)} />
      <PickerModal visible={brgyModal} title="Barangay" items={brgys} allLabel="All barangays" onSelect={(b) => setBrgy(b)} onClose={() => setBrgyModal(false)} />
    </View>
  );
}

function Selector({ label, value, placeholder, onPress, disabled }: { label: string; value: string | null; placeholder: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[s.sel, disabled && { opacity: 0.5 }]}>
      <Text style={s.selLbl}>{label}</Text>
      <View style={s.selRow}>
        <Text style={[s.selVal, !value && s.selPlaceholder]} numberOfLines={1}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={c.slate} />
      </View>
    </Pressable>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
    logo: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.goldLite },
    logoT: { color: "#16223a", fontWeight: "800", fontSize: 19 },
    brand: { color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
    brandSub: { color: "#9fb0d8", fontSize: 11, marginTop: 2, fontWeight: "600" },

    body: { flex: 1 },
    chipsRow: { paddingHorizontal: 14, paddingVertical: 14, gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
    chipOn: { backgroundColor: c.navy, borderColor: c.navy },
    chipT: { fontSize: 13, fontWeight: "700", color: c.slate },
    chipTOn: { color: "#fff" },

    selectors: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
    sel: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10 },
    selLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: c.slate, textTransform: "uppercase" },
    selRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4 },
    selVal: { flex: 1, fontSize: 14, fontWeight: "600", color: c.ink },
    selPlaceholder: { color: c.slate, fontWeight: "500" },

    clsRow: { paddingHorizontal: 16, paddingTop: 12, gap: 7 },
    clsChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
    clsOn: { backgroundColor: c.isDark ? "rgba(201,168,76,0.14)" : "#fbf2d8", borderColor: c.gold },
    clsT: { fontSize: 12, fontWeight: "700", color: c.slate },
    clsTOn: { color: c.isDark ? c.goldLite : c.navy },

    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 13, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 13, paddingVertical: 11 },
    search: { flex: 1, fontSize: 13.5, color: c.ink, padding: 0 },

    results: { paddingHorizontal: 16, paddingTop: 16 },
    center: { alignItems: "center", justifyContent: "center", gap: 11, paddingVertical: 44, paddingHorizontal: 24 },
    dim: { color: c.slate, fontSize: 13, textAlign: "center", lineHeight: 19 },
    more: { marginTop: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingVertical: 13 },
    moreT: { color: c.isDark ? c.goldLite : c.navy, fontWeight: "700", fontSize: 13 },
  });
}
