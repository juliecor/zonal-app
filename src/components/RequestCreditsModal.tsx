import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { myTokenRequests, requestTokens, type TokenRequest } from "@/lib/api";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF } from "@/theme/zonal";

const PRESETS = [50, 100, 250, 500];
const STATUS: Record<string, { label: string; color: (c: Palette) => string }> = {
  pending: { label: "Pending", color: (c) => c.amber },
  approved: { label: "Approved", color: (c) => c.safe },
  denied: { label: "Denied", color: (c) => c.red },
};

/** Ask an admin for more search credits, and see your past requests. */
export function RequestCreditsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { token, refresh } = useAuth();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [preset, setPreset] = useState(100);
  const [customQty, setCustomQty] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState<TokenRequest[]>([]);

  useEffect(() => {
    if (visible && token) {
      setDone(false); setErr(null); setMessage(""); setCustomQty("");
      myTokenRequests(token).then(setMine).catch(() => {});
    }
  }, [visible, token]);

  const quantity = customQty.trim() ? Math.max(0, parseInt(customQty.replace(/\D/g, ""), 10) || 0) : preset;

  async function submit() {
    if (!token || quantity < 1) { setErr("Enter how many credits you need."); return; }
    setBusy(true); setErr(null);
    try {
      await requestTokens(token, quantity, message);
      setDone(true);
      refresh().catch(() => {});
      myTokenRequests(token).then(setMine).catch(() => {});
    } catch (e: any) {
      setErr(e?.message || "Couldn't send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <StatusBar style="light" />
        <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
          <View style={s.bar}>
            <Text style={s.barTitle}>Request search credits</Text>
            <Pressable onPress={onClose} hitSlop={10} style={s.barIc}><Ionicons name="close" size={20} color="#fff" /></Pressable>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={s.doneCard}>
              <View style={s.doneIc}><Ionicons name="checkmark" size={26} color={c.safe} /></View>
              <Text style={s.doneT}>Request sent</Text>
              <Text style={s.doneSub}>You asked for {quantity} credits. An admin will review it — your balance updates once it's approved.</Text>
              <Pressable onPress={onClose} style={s.primary}><Text style={s.primaryT}>Done</Text></Pressable>
            </View>
          ) : (
            <>
              <Text style={s.intro}>Search credits unlock the full street-by-street record search. Tell us how many you need and an admin will top up your account.</Text>

              <Text style={s.lbl}>HOW MANY CREDITS</Text>
              <View style={s.chips}>
                {PRESETS.map((n) => {
                  const on = !customQty.trim() && preset === n;
                  return (
                    <Pressable key={n} onPress={() => { setCustomQty(""); setPreset(n); }} style={[s.chip, on && s.chipOn]}>
                      <Text style={[s.chipT, on && s.chipTOn]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={customQty} onChangeText={(t) => setCustomQty(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="Or enter a custom amount" placeholderTextColor={c.slate}
                keyboardType="number-pad" style={s.input}
              />

              <Text style={s.lbl}>MESSAGE (OPTIONAL)</Text>
              <TextInput
                value={message} onChangeText={setMessage}
                placeholder="e.g. For a client's due-diligence batch this week" placeholderTextColor={c.slate}
                style={[s.input, s.area]} multiline
              />

              {!!err && <View style={s.err}><Ionicons name="alert-circle" size={15} color={c.red} /><Text style={s.errT}>{err}</Text></View>}

              <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [s.primary, (busy || pressed) && { opacity: 0.85 }]}>
                {busy ? <ActivityIndicator color="#16223a" /> : (
                  <>
                    <Ionicons name="paper-plane-outline" size={17} color="#16223a" />
                    <Text style={s.primaryT}>Send request for {quantity} credits</Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          {mine.length > 0 && (
            <View style={s.history}>
              <Text style={s.lbl}>MY REQUESTS</Text>
              {mine.slice(0, 8).map((r) => {
                const st = STATUS[r.status] || STATUS.pending;
                return (
                  <View key={r.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowQty}>{r.quantity} credits</Text>
                      {!!r.message && <Text style={s.rowMsg} numberOfLines={1}>{r.message}</Text>}
                    </View>
                    <View style={[s.pill, { backgroundColor: st.color(c) + "22" }]}>
                      <Text style={[s.pillT, { color: st.color(c) }]}>{st.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
    barTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
    barIc: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },

    intro: { fontSize: 13, color: c.slate, lineHeight: 19, marginBottom: 18 },
    lbl: { fontSize: 10.5, fontWeight: "800", color: c.slate, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 16, marginBottom: 9 },
    chips: { flexDirection: "row", gap: 8 },
    chip: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card },
    chipOn: { backgroundColor: c.navy, borderColor: c.navy },
    chipT: { fontSize: 15, fontWeight: "800", color: c.inkSoft },
    chipTOn: { color: "#fff" },
    input: { marginTop: 9, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c.ink, fontSize: 14.5 },
    area: { minHeight: 70, textAlignVertical: "top" },

    err: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.isDark ? "rgba(240,82,74,0.12)" : "#fdecec", borderWidth: 1, borderColor: c.isDark ? "rgba(240,82,74,0.32)" : "#f6c9c9", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
    errT: { color: c.red, fontSize: 12.5, fontWeight: "600", flex: 1 },

    primary: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.gold, borderRadius: 13, paddingVertical: 15, shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
    primaryT: { color: "#16223a", fontWeight: "800", fontSize: 15 },

    doneCard: { alignItems: "center", paddingVertical: 24 },
    doneIc: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: c.isDark ? "rgba(34,197,94,0.16)" : "#e7f6ee" },
    doneT: { fontFamily: SERIF, fontSize: 22, fontWeight: "700", color: c.ink, marginTop: 14 },
    doneSub: { fontSize: 13, color: c.slate, lineHeight: 20, textAlign: "center", marginTop: 8, paddingHorizontal: 10 },

    history: { marginTop: 26, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.line },
    rowQty: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    rowMsg: { fontSize: 11.5, color: c.slate, marginTop: 2 },
    pill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
    pillT: { fontSize: 10.5, fontWeight: "800" },
  });
}
