import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { Z } from "@/theme/zonal";

// Google Maps JS key (same one the website uses) — from the gitignored .env.
const KEY = process.env.EXPO_PUBLIC_MAPS_KEY || "";

// Illustrative value pins for now; real per-spot values come with login + the lookup.
const MAP_HTML = `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eef1f5}</style></head>
<body><div id="map"></div>
<script>
function initMap(){
  var map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:11.6,lng:122.9}, zoom:6, disableDefaultUI:true, zoomControl:true, gestureHandling:'greedy'
  });
  var icon={ path: google.maps.SymbolPath.CIRCLE, scale:9, fillColor:'#c9a84c', fillOpacity:1, strokeColor:'#9d7a2e', strokeWeight:2.5 };
  var pins=[
    {t:'Metro Manila',v:'₱120,000',lat:14.5995,lng:120.9842},
    {t:'Cebu City',v:'₱46,540',lat:10.3157,lng:123.8854},
    {t:'Davao City',v:'₱20,000',lat:7.1907,lng:125.4553},
    {t:'Iloilo City',v:'₱28,000',lat:10.7202,lng:122.5621}
  ];
  var info=new google.maps.InfoWindow();
  pins.forEach(function(p){
    var m=new google.maps.Marker({position:{lat:p.lat,lng:p.lng},map:map,icon:icon,title:p.t});
    m.addListener('click',function(){
      info.setContent('<div style="font-family:sans-serif;padding:3px 5px;min-width:118px"><div style="color:#16276a;font-weight:800;font-size:16px">'+p.v+'<span style="color:#999;font-size:11px;font-weight:600"> /sqm</span></div><div style="color:#444;font-size:12px;margin-top:2px">'+p.t+'</div></div>');
      info.open(map,m);
    });
  });
}
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${KEY}&callback=initMap"></script>
</body></html>`;

export default function MapScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        style={StyleSheet.absoluteFill}
        originWhitelist={["*"]}
        source={{ html: MAP_HTML, baseUrl: "https://zonalvalue.ph" }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />

      {/* frosted search header */}
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
  root: { flex: 1, backgroundColor: "#eef1f5" },
  headWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 9,
    marginHorizontal: 14, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 100, paddingHorizontal: 15, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.35)",
    shadowColor: "#0c1430", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  searchT: { color: Z.slate, fontSize: 13.5, fontWeight: "500" },

  footWrap: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  legend: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14,
    backgroundColor: "rgba(16,26,48,0.92)", borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, elevation: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Z.gold },
  legendT: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
});
