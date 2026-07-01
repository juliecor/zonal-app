import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "@/lib/auth";
import { updateProfile, uploadAvatar, deleteAvatar, type AuthUser } from "@/lib/api";
import { useTheme, type Palette } from "@/theme/theme";

export default function EditProfileScreen() {
  const { user, token, applyUser } = useAuth();
  const { c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [first, setFirst] = useState(user?.first_name || "");
  const [last, setLast] = useState(user?.last_name || "");
  const [middle, setMiddle] = useState(user?.middle_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!user || !token) return null;

  const initials = ((first[0] || user.name?.[0] || "U") + (last[0] || "")).toUpperCase();

  async function pick(fromCamera: boolean) {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to change your picture."); return; }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setUploading(true);
      const r = await uploadAvatar(token!, res.assets[0].uri);
      const url = r.avatar_url || res.assets[0].uri;
      setAvatar(url);
      applyUser({ ...(user as AuthUser), avatar_url: url, avatar_path: r.avatar_path ?? user!.avatar_path });
    } catch (e: any) {
      Alert.alert("Couldn't update photo", e?.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function changePhoto() {
    Alert.alert("Profile photo", undefined, [
      { text: "Choose from library", onPress: () => pick(false) },
      { text: "Take a photo", onPress: () => pick(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function removePhoto() {
    try {
      setUploading(true);
      const u = await deleteAvatar(token!);
      setAvatar(null);
      applyUser({ ...(user as AuthUser), ...u, avatar_url: null, avatar_path: null });
    } catch (e: any) {
      Alert.alert("Couldn't remove photo", e?.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const u = await updateProfile(token!, {
        first_name: first.trim(), last_name: last.trim(),
        middle_name: middle.trim(), phone: phone.trim(),
      });
      applyUser({ ...(user as AuthUser), ...u, avatar_url: avatar ?? u.avatar_url ?? null });
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: c.header }}>
        <View style={s.bar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.barIc}><Ionicons name="chevron-back" size={18} color="#fff" /></Pressable>
          <Text style={s.barTitle}>Edit profile</Text>
          <Pressable onPress={save} hitSlop={10} disabled={saving} style={s.barIc}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={20} color={c.goldLite} />}
          </Pressable>
        </View>
        <View style={s.accent} />
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.body} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <Pressable onPress={changePhoto} style={s.avatarBtn}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={s.avatar} contentFit="cover" transition={150} />
              ) : (
                <View style={s.avatar}><Text style={s.avatarT}>{initials}</Text></View>
              )}
              <View style={s.camBadge}>
                {uploading ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons name="camera" size={15} color="#ffffff" />}
              </View>
            </Pressable>
            <Pressable onPress={changePhoto}><Text style={s.changeT}>Change photo</Text></Pressable>
            {!!avatar && <Pressable onPress={removePhoto}><Text style={s.removeT}>Remove photo</Text></Pressable>}
          </View>

          <Field label="FIRST NAME" value={first} onChange={setFirst} placeholder="Juan" s={s} c={c} />
          <Field label="LAST NAME" value={last} onChange={setLast} placeholder="Dela Cruz" s={s} c={c} />
          <Field label="MIDDLE NAME (OPTIONAL)" value={middle} onChange={setMiddle} placeholder="—" s={s} c={c} />
          <Field label="PHONE" value={phone} onChange={setPhone} placeholder="+63 9XX XXX XXXX" keyboardType="phone-pad" s={s} c={c} />

          <Text style={s.label}>EMAIL</Text>
          <View style={[s.input, s.inputDisabled]}>
            <Text style={s.disabledT}>{user.email}</Text>
            <Ionicons name="lock-closed" size={14} color={c.slate} />
          </View>
          <Text style={s.hint}>Email can't be changed here. Contact your admin if it's wrong.</Text>

          <Pressable onPress={save} disabled={saving} style={({ pressed }) => [s.saveBtn, (saving || pressed) && { opacity: 0.7 }]}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={s.saveT}>Save changes</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, s, c }: {
  label: string; value: string; onChange: (t: string) => void; placeholder?: string;
  keyboardType?: "default" | "phone-pad"; s: ReturnType<typeof makeStyles>; c: Palette;
}) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.slate}
        style={s.input} autoCapitalize="words" keyboardType={keyboardType || "default"} returnKeyType="done"
      />
    </>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
    barIc: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
    barTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
    accent: { height: 2, backgroundColor: c.gold },

    body: { flex: 1 },
    avatarWrap: { alignItems: "center", gap: 8, marginBottom: 18 },
    avatarBtn: { width: 104, height: 104 },
    avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: c.goldLite, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarT: { color: "#ffffff", fontWeight: "800", fontSize: 34 },
    camBadge: { position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: c.gold, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.paper },
    changeT: { color: c.isDark ? c.goldLite : c.navy, fontSize: 14, fontWeight: "800", marginTop: 4 },
    removeT: { color: "#c0392b", fontSize: 12.5, fontWeight: "600" },

    label: { fontSize: 10.5, letterSpacing: 1, fontWeight: "800", color: c.slate, marginTop: 14, marginBottom: 6 },
    input: {
      backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 13,
      paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 13 : 11, fontSize: 15, color: c.ink,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    inputDisabled: { backgroundColor: c.isDark ? "rgba(255,255,255,0.04)" : "#f1f3f7" },
    disabledT: { fontSize: 15, color: c.slate },
    hint: { fontSize: 11.5, color: c.slate, marginTop: 6, lineHeight: 16 },

    saveBtn: { marginTop: 24, alignItems: "center", justifyContent: "center", backgroundColor: c.gold, borderRadius: 14, paddingVertical: 15, shadowColor: c.goldDeep, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
    saveT: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  });
}
