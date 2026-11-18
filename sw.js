/* This cache contains only the public app shell, never API responses or study packs. */
const VERSION='__BUILD_VERSION__';
const CACHE='learn-skit-shell-'+VERSION;
const ASSETS=['./','./index.html','./css/styles.css','./css/fonts.css','./fonts/dm-sans-0.woff2','./fonts/ibm-plex-sans-1.woff2','./fonts/plus-jakarta-sans-2.woff2','./css/workspace.css','./js/config.js','./js/data.js','./js/access.js','./js/study-core.js','./js/workspace.js','./js/private-cache.js','./js/vendor/supabase.js','./js/app.js','./js/theme.js','./manifest.webmanifest','./icons/app.svg','./icons/app-192.png','./icons/app-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('learn-skit-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search)return;
  const path=url.pathname,allowed=ASSETS.some(a=>new URL(a,self.registration.scope).pathname===path);
  if(!allowed)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||new Response('Offline. Reconnect to load this page.',{status:503,headers:{'Content-Type':'text/plain'}}))));
});
