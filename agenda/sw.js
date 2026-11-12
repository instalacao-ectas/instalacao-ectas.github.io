// Guarda o app no celular para abrir sem internet (a agenda em si fica salva pelo app)
const CACHE="agenda-v2";
const ARQUIVOS=["./","index.html","style.css?v=2","comum.js?v=2","app.js?v=2","config.js?v=2","../config.js?v=3","supervisor.html","supervisor.js?v=2","icon-192.png","icon-512.png","manifest.webmanifest","../logo.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("agenda-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.hostname.endsWith("script.google.com")||u.hostname.endsWith("googleusercontent.com"))return;
  e.respondWith(
    fetch(e.request,u.origin===location.origin?{cache:"no-cache"}:{}).then(r=>{
      if(r.ok&&(u.origin===location.origin||u.hostname.includes("fonts.g"))){const c=r.clone();caches.open(CACHE).then(k=>k.put(e.request,c));}
      return r;
    }).catch(()=>caches.match(e.request,{ignoreSearch:true}))
  );
});
