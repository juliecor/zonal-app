import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { Z } from "@/theme/zonal";

// Illustrative value pins for now (Metro Manila, Cebu, Davao). Real per-spot
// values come once we wire login + the zonal lookup.
const PINS = [
  { id: "mnl", title: "Metro Manila", value: "₱120k", lat: 14.5995, lng: 120.9842 },
  { id: "ceb", title: "Cebu City", value: "₱46.5k", lat: 10.3157, lng: 123.8854 },
  { id: "dvo", title: "Davao City", value: "₱20k", lat: 7.1907, lng: 125.4553 },
  { id: "ilo", title: "Iloilo City", value: "₱28k", lat: 10.7202, lng: 122.5621 },
];

export default function MapScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: 11.6, longitude: 122.9, latitudeDelta: 11, longitudeDelta: 11 }}
      >
        {PINS.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} description={`Zonal value ≈ ${p.value}/sqm`}>
            <View style={styles.tag}>
              <Text style={styles.tagT}>{p.value}</Text>
              <View style={styles.tagPoint} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* frosted header overlay */}
      <SafeAreaView edges={["top"]} style={styles.headWrap} pointerEvents="box-none">
        <View style={styles.search} pointerEvents="auto">
          <Ionicons name="search" size={15} color={Z.navy} />
          <Text style={styles.searchT}>Search any address…</Text>
        </View>
      </SafeAreaView>

      {/* footer legend */}
      <SafeAreaView edges={["bottom"]} style={styles.footWrap} pointerEvents="box-none">
        <View style={styles.legend} pointerEvents="none">
          <View style={styles.dot} />
          <Text style={styles.legendT}>Tap a gold pin to see its value</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.paper },
  headWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 9,
    marginHorizontal: 14, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 100, paddingHorizontal: 15, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.35)",
    shadowColor: "#0c1430", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  searchT: { color: Z.slate, fontSize: 13.5, fontWeight: "500" },

  tag: { alignItems: "center" },
  tagT: {
    backgroundColor: Z.gold, color: "#16223a", fontWeight: "800", fontSize: 12.5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, overflow: "hidden",
    borderWidth: 1, borderColor: "#a9852f",
  },
  tagPoint: {
    width: 9, height: 9, backgroundColor: Z.gold, borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: "#a9852f", transform: [{ rotate: "45deg" }], marginTop: -5,
  },

  footWrap: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  legend: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14,
    backgroundColor: "rgba(16,26,48,0.9)", borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Z.gold },
  legendT: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
});
