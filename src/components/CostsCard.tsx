import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  computeCosts, estimatedValue, realPropertyTax,
  TRANSFER_RATE_CITY, TRANSFER_RATE_PROVINCE,
} from "@/lib/phComputations";
import { peso, SERIF, Z } from "@/theme/zonal";

const DOWN = [10, 20, 30];
const TERMS = [10, 15, 20];

/** Interactive Philippine cost & tax breakdown for a lot at a given zonal value. */
export function CostsCard({ valuePerSqm, code }: { valuePerSqm: number; code?: string | null }) {
  const [areaStr, setAreaStr] = useState("250");
  const [downPct, setDownPct] = useState(20);
  const [rateStr, setRateStr] = useState("6.5");
  const [term, setTerm] = useState(20);
  const [city, setCity] = useState(true);

  const area = Math.max(0, parseFloat(areaStr.replace(/,/g, "")) || 0);
  const rate = Math.max(0, parseFloat(rateStr) || 0);

  const { c, rpt, price } = useMemo(() => {
    const price = estimatedValue(valuePerSqm, area);
    const c = computeCosts({
      price, transferRate: city ? TRANSFER_RATE_CITY : TRANSFER_RATE_PROVINCE,
      downPct, annualRatePct: rate, termYears: term,
    });
    const rpt = realPropertyTax(price, code || undefined, city);
    return { c, rpt, price };
  }, [valuePerSqm, area, city, downPct, rate, term, code]);

  const money = (n: number) => peso(Math.round(n));

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.headIc}><Ionicons name="calculator-outline" size={16} color={Z.navy} /></View>
        <Text style={s.title}>Costs &amp; Taxes</Text>
        <View style={s.estTag}><Text style={s.estTagT}>ESTIMATE</Text></View>
      </View>

      {/* Lot area → estimated value */}
      <View style={s.valRow}>
        <View style={s.areaWrap}>
          <Text style={s.areaLbl}>LOT AREA</Text>
          <View style={s.areaInputRow}>
            <TextInput
              value={areaStr} onChangeText={setAreaStr} keyboardType="numeric"
              style={s.areaInput} maxLength={9} selectTextOnFocus
            />
            <Text style={s.areaUnit}>sqm</Text>
          </View>
        </View>
        <View style={s.estWrap}>
          <Text style={s.estLbl}>ESTIMATED VALUE</Text>
          <Text style={s.estVal}>{money(price)}</Text>
          <Text style={s.estSub}>{money(valuePerSqm)}/sqm</Text>
        </View>
      </View>

      {/* Taxes & transfer fees */}
      <View style={s.secHead}>
        <Text style={s.secT}>TAXES &amp; TRANSFER FEES</Text>
        <View style={s.toggle}>
          <Pressable onPress={() => setCity(false)} style={[s.tgBtn, !city && s.tgOn]}><Text style={[s.tgT, !city && s.tgTOn]}>Prov 0.5%</Text></Pressable>
          <Pressable onPress={() => setCity(true)} style={[s.tgBtn, city && s.tgOn]}><Text style={[s.tgT, city && s.tgTOn]}>City 0.75%</Text></Pressable>
        </View>
      </View>
      <Row label="Capital Gains Tax" sub="6% · seller" value={money(c.cgt)} />
      <Row label="Documentary Stamp Tax" sub="1.5% · buyer" value={money(c.dst)} />
      <Row label="Transfer Tax" sub={`${city ? "0.75%" : "0.5%"} · buyer`} value={money(c.transferTax)} />
      <Row label="Registration Fee" sub="~0.25% · buyer" value={money(c.registrationFee)} />
      <Row label="Total taxes & fees" value={money(c.totalFees)} strong />
      <View style={s.splitRow}>
        <Text style={s.splitT}>Buyer {money(c.buyerFees)}</Text>
        <Text style={s.splitT}>Seller {money(c.sellerFees)}</Text>
      </View>

      {/* Financing */}
      <Text style={[s.secT, { marginTop: 16 }]}>FINANCING</Text>
      <View style={s.chipRow}>
        <Text style={s.chipLbl}>Down</Text>
        {DOWN.map((d) => (
          <Pressable key={d} onPress={() => setDownPct(d)} style={[s.chip, downPct === d && s.chipOn]}>
            <Text style={[s.chipT, downPct === d && s.chipTOn]}>{d}%</Text>
          </Pressable>
        ))}
        <View style={s.rateWrap}>
          <TextInput value={rateStr} onChangeText={setRateStr} keyboardType="numeric" style={s.rateInput} maxLength={4} selectTextOnFocus />
          <Text style={s.rateUnit}>% p.a.</Text>
        </View>
      </View>
      <View style={s.chipRow}>
        <Text style={s.chipLbl}>Term</Text>
        {TERMS.map((t) => (
          <Pressable key={t} onPress={() => setTerm(t)} style={[s.chip, term === t && s.chipOn]}>
            <Text style={[s.chipT, term === t && s.chipTOn]}>{t}y</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.monthly}>
        <View>
          <Text style={s.monthlyLbl}>MONTHLY AMORTIZATION</Text>
          <Text style={s.monthlySub}>{downPct}% down · {money(c.loanPrincipal)} loan</Text>
        </View>
        <Text style={s.monthlyVal}>{money(c.monthlyAmortization)}<Text style={s.monthlyPer}>/mo</Text></Text>
      </View>
      <View style={s.splitRow}>
        <Text style={s.splitT}>Total interest {money(c.totalInterest)}</Text>
        <Text style={s.splitT}>Cash upfront {money(c.cashIfFinanced)}</Text>
      </View>

      {/* Annual */}
      <Text style={[s.secT, { marginTop: 16 }]}>ANNUAL</Text>
      <Row label="Real Property Tax (amilyar)" sub={`${(rpt.basicRate * 100).toFixed(0)}% + 1% SEF · ${(rpt.level * 100).toFixed(0)}% assessed`} value={`${money(rpt.total)}/yr`} />

      <Text style={s.note}>
        Estimates only — not tax advice. Taxes use the higher of price or BIR zonal value; transfer tax &amp; amilyar vary by LGU. Consult a licensed CPA or PRC broker.
      </Text>
    </View>
  );
}

function Row({ label, sub, value, strong }: { label: string; sub?: string; value: string; strong?: boolean }) {
  return (
    <View style={[s.row, strong && s.rowStrong]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowL, strong && s.rowLStrong]}>{label}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      <Text style={[s.rowV, strong && s.rowVStrong]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 16, padding: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 },
  headIc: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#eef1fa" },
  title: { flex: 1, fontFamily: SERIF, fontSize: 16, fontWeight: "600", color: Z.ink },
  estTag: { backgroundColor: "#fbf2d8", borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  estTagT: { fontSize: 8.5, fontWeight: "800", letterSpacing: 1, color: Z.goldDeep },

  valRow: { flexDirection: "row", gap: 12, backgroundColor: "#fffdf7", borderWidth: 1, borderColor: "#ece3cf", borderRadius: 12, padding: 12 },
  areaWrap: { flex: 1, justifyContent: "center" },
  areaLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: Z.slate },
  areaInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 5, marginTop: 4 },
  areaInput: { fontFamily: SERIF, fontSize: 24, fontWeight: "700", color: Z.ink, padding: 0, minWidth: 64, borderBottomWidth: 1.5, borderBottomColor: Z.gold },
  areaUnit: { fontSize: 12, color: Z.slate, fontWeight: "600", marginBottom: 4 },
  estWrap: { alignItems: "flex-end", justifyContent: "center" },
  estLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: Z.goldDeep },
  estVal: { fontFamily: SERIF, fontSize: 20, fontWeight: "700", color: Z.navy, marginTop: 3 },
  estSub: { fontSize: 10.5, color: Z.slate, marginTop: 2 },

  secHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 4 },
  secT: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, color: Z.slate },
  toggle: { flexDirection: "row", backgroundColor: "#eef1fa", borderRadius: 8, padding: 2, gap: 2 },
  tgBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tgOn: { backgroundColor: Z.navy },
  tgT: { fontSize: 10, fontWeight: "700", color: Z.slate },
  tgTOn: { color: "#fff" },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1ece0" },
  rowStrong: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: Z.navy, marginTop: 2, paddingTop: 10 },
  rowL: { fontSize: 13, color: Z.inkSoft, fontWeight: "600" },
  rowLStrong: { fontWeight: "800", color: Z.navy },
  rowSub: { fontSize: 9.5, color: Z.slate, marginTop: 1, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  rowV: { fontSize: 13.5, fontWeight: "800", color: Z.ink },
  rowVStrong: { fontSize: 15, color: Z.navy },
  splitRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  splitT: { fontSize: 10.5, color: Z.slate, fontWeight: "600" },

  chipRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 9 },
  chipLbl: { fontSize: 11, color: Z.slate, fontWeight: "700", width: 38 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: Z.line, backgroundColor: "#fff" },
  chipOn: { backgroundColor: Z.navy, borderColor: Z.navy },
  chipT: { fontSize: 12.5, fontWeight: "700", color: Z.inkSoft },
  chipTOn: { color: "#fff" },
  rateWrap: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", borderWidth: 1, borderColor: Z.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  rateInput: { fontSize: 13, fontWeight: "700", color: Z.ink, padding: 0, minWidth: 30, textAlign: "right" },
  rateUnit: { fontSize: 10.5, color: Z.slate, fontWeight: "600" },

  monthly: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Z.navy, borderRadius: 12, padding: 14, marginTop: 12 },
  monthlyLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: Z.goldLite },
  monthlySub: { fontSize: 10.5, color: "#c8d3f0", marginTop: 3 },
  monthlyVal: { fontFamily: SERIF, fontSize: 22, fontWeight: "700", color: "#fff" },
  monthlyPer: { fontSize: 12, fontWeight: "600", color: "#c8d3f0" },

  note: { fontSize: 10, color: Z.slate, lineHeight: 15, marginTop: 14 },
});
