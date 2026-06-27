import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { titleCase, Z } from "@/theme/zonal";

/** A searchable full-screen list picker (province cities, barangays, etc.). */
export function PickerModal({
  visible, title, items, onSelect, onClose, allLabel,
}: {
  visible: boolean; title: string; items: string[];
  onSelect: (value: string | null) => void; onClose: () => void; allLabel?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
  const data = allLabel ? [allLabel, ...filtered] : filtered;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={s.root} edges={["top", "bottom"]}>
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.close}><Ionicons name="close" size={20} color={Z.slate} /></Pressable>
        </View>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={Z.slate} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search…" placeholderTextColor={Z.slate} style={s.search} autoFocus autoCorrect={false} />
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
                <Ionicons name="chevron-forward" size={16} color={Z.line} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>No matches.</Text>}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: "800", color: Z.ink },
  close: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#eef1fa" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Z.white, borderWidth: 1, borderColor: Z.line, borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 6 },
  search: { flex: 1, fontSize: 14, color: Z.ink, padding: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Z.line },
  rowT: { fontSize: 15, color: Z.ink, fontWeight: "500" },
  allT: { fontWeight: "800", color: Z.navy },
  empty: { textAlign: "center", color: Z.slate, marginTop: 30, fontSize: 13 },
});
