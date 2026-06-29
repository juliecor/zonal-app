// Google Maps inside a WebView, with custom price-tag pins drawn via an OverlayView.
// Bridge:  RN → web: window.ZV.setPins(arr) / .center(lat,lon,zoom) / .setType('roadmap'|'hybrid')
//          web → RN: postMessage {type:'ready'|'bounds'|'tap'|'pin', ...}
// Each pin: {lat, lon, label, sel?, ...passthrough fields returned on click}.

export function mapHtml(key: string, night = false): string {
  return `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:${night ? "#0a1022" : "#e8edf0"};font-family:-apple-system,system-ui,sans-serif}
  .tag{position:absolute;transform:translate(-50%,-100%);background:#fff;border-radius:10px;padding:3px 8px;
    font-size:11px;font-weight:800;color:#16276a;box-shadow:0 6px 14px -6px rgba(12,20,48,.4);
    border:1px solid rgba(12,20,48,.08);white-space:nowrap;cursor:pointer}
  .tag::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:#fff;
    transform:translateX(-50%) rotate(45deg);border-right:1px solid rgba(12,20,48,.08);border-bottom:1px solid rgba(12,20,48,.08)}
  .tag.sel{background:linear-gradient(150deg,#e6c976,#c9a84c);color:#16223a;z-index:60;
    box-shadow:0 11px 22px -6px rgba(201,168,76,.75);font-size:12.5px;padding:5px 11px}
  .tag.sel::after{background:#c9a84c;border-color:transparent}
</style></head><body><div id="map"></div>
<script>
  var map, overlay, PINS=[], LAYERS={};
  // Hazard overlays (esp. raster tiles) re-fetch on every zoom level and flicker while
  // tiles stream in. Hide them during the zoom gesture, fade them back once the map settles.
  var hazHidden=false, fadeRAF=0;
  function setRaster(v){ for(var k in LAYERS){ var L=LAYERS[k]; if(L&&L.raster) L.obj.setOpacity(v); } }
  function setVectorMap(m){ for(var k in LAYERS){ var L=LAYERS[k]; if(L&&!L.raster&&L.obj) L.obj.setMap(m); } }
  function hazCount(){ var n=0; for(var k in LAYERS){ if(LAYERS[k]) n++; } return n; }
  function hideHaz(){ if(hazHidden||!hazCount()) return; hazHidden=true; if(fadeRAF){cancelAnimationFrame(fadeRAF);fadeRAF=0;} setRaster(0); setVectorMap(null); }
  function showHaz(){ if(!hazHidden) return; hazHidden=false; setVectorMap(map);
    var o=0; (function step(){ if(hazHidden) return; o+=0.14; var done=o>=0.55; setRaster(done?0.55:o); if(!done) fadeRAF=requestAnimationFrame(step); })(); }
  // Brand-navy "night" map style.
  var NIGHT_STYLE=[
    {elementType:"geometry",stylers:[{color:"#0f1830"}]},
    {elementType:"labels.text.stroke",stylers:[{color:"#0a1022"}]},
    {elementType:"labels.text.fill",stylers:[{color:"#8492b1"}]},
    {featureType:"administrative",elementType:"geometry",stylers:[{color:"#2a3556"}]},
    {featureType:"administrative.locality",elementType:"labels.text.fill",stylers:[{color:"#c5b074"}]},
    {featureType:"poi",elementType:"labels.text.fill",stylers:[{color:"#7d89a8"}]},
    {featureType:"poi.park",elementType:"geometry",stylers:[{color:"#13243a"}]},
    {featureType:"road",elementType:"geometry",stylers:[{color:"#1c2746"}]},
    {featureType:"road",elementType:"geometry.stroke",stylers:[{color:"#141d36"}]},
    {featureType:"road",elementType:"labels.text.fill",stylers:[{color:"#9aa6c4"}]},
    {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#2b3a5e"}]},
    {featureType:"road.highway",elementType:"labels.text.fill",stylers:[{color:"#d3b154"}]},
    {featureType:"transit",elementType:"labels.text.fill",stylers:[{color:"#7d89a8"}]},
    {featureType:"water",elementType:"geometry",stylers:[{color:"#070c1a"}]},
    {featureType:"water",elementType:"labels.text.fill",stylers:[{color:"#3b4a6c"}]}
  ];
  var NIGHT=${night ? "true" : "false"};
  function post(o){ try{ if(window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage==='function') window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
  function initMap(){
    map=new google.maps.Map(document.getElementById('map'),{
      center:{lat:10.3157,lng:123.8854}, zoom:16, disableDefaultUI:true, gestureHandling:'greedy', clickableIcons:true,
      styles: NIGHT ? NIGHT_STYLE : []
    });
    overlay=new google.maps.OverlayView();
    overlay.onAdd=function(){ this.layer=document.createElement('div'); this.layer.style.position='absolute'; this.layer.style.top='0'; this.layer.style.left='0';
      this.getPanes().overlayMouseTarget.appendChild(this.layer); };
    overlay.draw=function(){ render(); };
    overlay.onRemove=function(){};
    overlay.setMap(map);
    map.addListener('zoom_changed', hideHaz);   // hide hazard overlays while zooming → no flicker
    map.addListener('idle', function(){ showHaz(); var b=map.getBounds(); if(!b) return; var ne=b.getNorthEast(), sw=b.getSouthWest();
      post({type:'bounds', minLat:sw.lat(), maxLat:ne.lat(), minLon:sw.lng(), maxLon:ne.lng()}); });
    map.addListener('click', function(e){
      if(e.placeId){ e.stop(); post({type:'poi', lat:e.latLng.lat(), lon:e.latLng.lng(), placeId:e.placeId}); }
      else { post({type:'tap', lat:e.latLng.lat(), lon:e.latLng.lng()}); }
    });
    post({type:'ready'});
  }
  function render(){
    if(!overlay || !overlay.layer) return;
    var proj=overlay.getProjection(); if(!proj || !proj.fromLatLngToDivPixel) return;
    overlay.layer.innerHTML='';
    for(var i=0;i<PINS.length;i++){ (function(p){
      var pos=proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat,p.lon)); if(!pos) return;
      var el=document.createElement('div'); el.className='tag'+(p.sel?' sel':'');
      el.style.left=pos.x+'px'; el.style.top=pos.y+'px'; el.textContent=p.label;
      el.addEventListener('click', function(ev){ ev.stopPropagation(); post({type:'pin', pin:p}); });
      overlay.layer.appendChild(el);
    })(PINS[i]); }
  }
  window.ZV={
    setPins:function(arr){ PINS=Array.isArray(arr)?arr:[]; render(); },
    center:function(lat,lon,zoom){ if(!map) return; map.panTo({lat:lat,lng:lon}); if(zoom) map.setZoom(zoom); },
    setType:function(t){ if(map) map.setMapTypeId(t); },
    setNight:function(on){ NIGHT=!!on; if(map){ map.setOptions({styles: on ? NIGHT_STYLE : []}); } document.body.style.background = on ? '#0a1022' : '#e8edf0'; },
    setLayer:function(name,on){
      if(!map) return;
      var TILE={flood:'flood-tile',landslide:'landslide-tile',stormsurge:'stormsurge-tile'};
      var VEC={faults:'/api/faults',liquefaction:'/hazard/liquefaction_vec.geojson',tsunami:'/hazard/tsunami_vec.geojson'};
      if(TILE[name]){
        if(on){
          if(LAYERS[name]) return;
          var t=new google.maps.ImageMapType({ tileSize:new google.maps.Size(256,256), opacity:0.55,
            getTileUrl:function(c,z){ return 'https://zonalvalue.ph/api/'+TILE[name]+'/'+z+'/'+c.x+'/'+c.y; } });
          map.overlayMapTypes.push(t); LAYERS[name]={obj:t,raster:true};
        } else if(LAYERS[name]){
          var arr=map.overlayMapTypes;
          for(var i=0;i<arr.getLength();i++){ if(arr.getAt(i)===LAYERS[name].obj){ arr.removeAt(i); break; } }
          delete LAYERS[name];
        }
      } else if(VEC[name]){
        if(on){
          if(LAYERS[name]) return;
          var dl=new google.maps.Data();
          dl.loadGeoJson('https://zonalvalue.ph'+VEC[name]);
          var col=name==='liquefaction'?'#d97706':(name==='tsunami'?'#0891b2':'#b91c1c');
          dl.setStyle({ fillColor:col, fillOpacity:0.28, strokeColor:col, strokeWeight:name==='faults'?2.5:1 });
          dl.setMap(map); LAYERS[name]={obj:dl};
        } else if(LAYERS[name]){ LAYERS[name].obj.setMap(null); delete LAYERS[name]; }
      }
    }
  };
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap"></script>
</body></html>`;
}
