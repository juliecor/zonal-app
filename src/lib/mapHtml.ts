// Google Maps inside a WebView, with custom price-tag pins drawn via an OverlayView.
// Bridge:  RN → web: window.ZV.setPins(arr) / .center(lat,lon,zoom) / .setType('roadmap'|'hybrid')
//          web → RN: postMessage {type:'ready'|'bounds'|'tap'|'pin', ...}
// Each pin: {lat, lon, label, sel?, ...passthrough fields returned on click}.

export function mapHtml(key: string): string {
  return `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e8edf0;font-family:-apple-system,system-ui,sans-serif}
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
  var map, overlay, PINS=[];
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  function initMap(){
    map=new google.maps.Map(document.getElementById('map'),{
      center:{lat:10.3157,lng:123.8854}, zoom:13, disableDefaultUI:true, gestureHandling:'greedy', clickableIcons:false,
      styles:[{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',elementType:'labels',stylers:[{visibility:'off'}]}]
    });
    overlay=new google.maps.OverlayView();
    overlay.onAdd=function(){ this.layer=document.createElement('div'); this.layer.style.position='absolute'; this.layer.style.top='0'; this.layer.style.left='0';
      this.getPanes().overlayMouseTarget.appendChild(this.layer); };
    overlay.draw=function(){ render(); };
    overlay.onRemove=function(){};
    overlay.setMap(map);
    map.addListener('idle', function(){ var b=map.getBounds(); if(!b) return; var ne=b.getNorthEast(), sw=b.getSouthWest();
      post({type:'bounds', minLat:sw.lat(), maxLat:ne.lat(), minLon:sw.lng(), maxLon:ne.lng()}); });
    map.addListener('click', function(e){ post({type:'tap', lat:e.latLng.lat(), lon:e.latLng.lng()}); });
    post({type:'ready'});
  }
  function render(){
    if(!overlay || !overlay.layer) return;
    var proj=overlay.getProjection(); if(!proj) return;
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
    setType:function(t){ if(map) map.setMapTypeId(t); }
  };
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap"></script>
</body></html>`;
}
