import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import {
  adminApproveTokenRequest, adminDenyTokenRequest, adminListTokenRequests, type AdminTokenRequest,
} from "@/lib/api";
import { useTheme, type Palette } from "@/theme/theme";
import { SERIF, titleCase } from "@/theme/zonal";

type Filter = "pending" | "approved" | "denied";
const FILTERS: Filter[] = ["pending", "approved", "denied"];

/** Admin-only: review credit requests and approve/deny them (adds credits on approve). */
export function AdminCreditRequestsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [filter, setFilter] = useState<Filter>("pending");
  const [items, setItems] = useState<AdminTokenRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setItems(await adminListTokenRequests(token, f)); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (visible) load(filter); }, [visible, filter, load]);

  async function act(id: number, action: "approve" | "deny") {
    if (!token) return;
    setActingId(id); setErr(null);
    try {
      if (action === "approve") await adminApproveTokenRequest(token, id);
      else await adminDenyTokenRequest(token, id);
      await load(filter); // refresh (the row leaves "pending")
    } catch (e: any) {
      setErr(e?.message || `Couldn't ${action} the request.`);
    } finally {
      setActingId(null);
    }
  }

  const who = (r: AdminTokenRequest) =>
    titleCase(r.user?.name || [r.user?.first_name, r.user?.last_name].filter(Boolean).join(" ")) || "User";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <StatusBar style="light" />
        <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
          <View style={s.bar}>
            <Text style={s.barTitle}>Credit requests</Text>
            <Pressable onPress={onClose} hitSlop={10} style={s.barIc}><Ionicons name="close" size={20} color="#fff" /></Pressable>
          </View>
          <View style={s.tabs}>
            {FILTERS.map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[s.tab, filter === f && s.tabOn]}>
                <Text style={[s.tabT, filter === f && s.tabTOn]}>{f[0].toUpperCase() + f.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>

        {!!err && <View style={s.err}><Ionicons name="alert-circle" size={15} color={c.red} /><Text style={s.errT}>{err}</Text></View>}

        {loading ? (
          <View style={s.center}><ActivityIndicator color={c.gold} /></View>
        ) : items.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="checkmark-done-outline" size={30} color={c.slate} />
            <Text style={s.dim}>No {filter} requests.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 11, paddingBottom: 40 }}>
            {items.map((r) => (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.who}>{who(r)}</Text>
                    {!!r.user?.email && <Text style={s.email}>{r.user.email}</Text>}
                  </View>
                  <View style={s.qtyWrap}>
                    <Text style={s.qty}>{r.quantity}</Text>
                    <Text style={s.qtyLbl}>credits</Text>
                  </View>
                </View>
                {!!r.message && <Text style={s.msg}>“{r.message}”</Text>}
                {filter === "pending" ? (
                  <View style={s.actions}>
                    <Pressable onPress={() => act(r.id, "deny")} disabled={actingId === r.id} style={[s.deny, actingId === r.id && { opacity: 0.5 }]}>
                      <Text style={s.denyT}>Deny</Text>
                    </Pressable>
                    <Pressable onPress={() => act(r.id, "approve")} disabled={actingId === r.id} style={[s.approve, actingId === r.id && { opacity: 0.6 }]}>
                      {actingId === r.id ? <ActivityIndicator color="#fff" size="small" /> : (
                        <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={s.approveT}>Approve</Text></>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <View style={[s.statusPill, { backgroundColor: (r.status === "approved" ? c.safe : c.red) + "22" }]}>
                    <Text style={[s.statusT, { color: r.status === "approved" ? c.safe : c.red }]}>{r.status === "approved" ? "Approved" : "Denied"}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
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
    tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.10)" },
    tabOn: { backgroundColor: "#fff" },
    tabT: { fontSize: 12.5, fontWeight: "700", color: "#cdd7f1" },
    tabTOn: { color: c.navy },

    err: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.isDark ? "rgba(240,82,74,0.12)" : "#fdecec", borderBottomWidth: 1, borderBottomColor: c.isDark ? "rgba(240,82,74,0.32)" : "#f6c9c9", paddingHorizontal: 14, paddingVertical: 10 },
    errT: { color: c.red, fontSize: 12.5, fontWeight: "600", flex: 1 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
    dim: { color: c.slate, fontSize: 13.5 },

    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14 },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    who: { fontSize: 14.5, fontWeight: "800", color: c.ink },
    email: { fontSize: 11.5, color: c.slate, marginTop: 2 },
    qtyWrap: { alignItems: "flex-end" },
    qty: { fontFamily: SERIF, fontSize: 22, fontWeight: "700", color: c.isDark ? c.goldLite : c.navy, lineHeight: 24 },
    qtyLbl: { fontSize: 9, color: c.slate, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
    msg: { fontSize: 12.5, color: c.inkSoft, fontStyle: "italic", marginTop: 9, lineHeight: 18 },

    actions: { flexDirection: "row", gap: 9, marginTop: 13 },
    deny: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: c.isDark ? "rgba(240,82,74,0.4)" : "#f6c2c2", backgroundColor: c.isDark ? "rgba(240,82,74,0.10)" : "#fdecec" },
    denyT: { color: c.red, fontWeight: "800", fontSize: 13.5 },
    approve: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 11, backgroundColor: c.safe },
    approveT: { color: "#fff", fontWeight: "800", fontSize: 13.5 },

    statusPill: { alignSelf: "flex-start", marginTop: 11, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 4 },
    statusT: { fontSize: 10.5, fontWeight: "800" },
  });
}
