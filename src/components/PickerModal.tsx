import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, type Palette } from "@/theme/theme";
import { titleCase } from "@/theme/zonal";

/** A searchable full-screen list picker (province cities, barangays, etc.). */
export function PickerModal({
  visible, title, items, onSelect, onClose, allLabel,
}: {
  visible: boolean; title: string; items: string[];
  onSelect: (value: string | null) => void; onClose: () => void; allLabel?: string;
}) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
  const data = allLabel ? [allLabel, ...filtered] : filtered;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={s.root} edges={["top", "bottom"]}>
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.close}><Ionicons name="close" size={20} color={c.slate} /></Pressable>
        </View>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={c.slate} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search…" placeholderTextColor={c.slate} style={s.search} autoFocus autoCorrect={false} />
        </View>
        <FlatList
          data={data}
          keyExtractor={(it, i) => it + i}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isAll = !!allLabel && item === allLabel;
            return (
              <Pressable style={s.row} onPress={() => { onSelect(isAll ? null : item); setQ(""); onClose(); }}>
                <Text style={[s.rowT, isAll && s.allT]}>{isAll ? item : titleCase(item)}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.line} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>No matches.</Text>}
        />
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    title: { fontSize: 16, fontWeight: "800", color: c.ink },
    close: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.chip },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 6 },
    search: { flex: 1, fontSize: 14, color: c.ink, padding: 0 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    rowT: { fontSize: 15, color: c.ink, fontWeight: "500" },
    allT: { fontWeight: "800", color: c.isDark ? c.goldLite : c.navy },
    empty: { textAlign: "center", color: c.slate, marginTop: 30, fontSize: 13 },
  });
}
