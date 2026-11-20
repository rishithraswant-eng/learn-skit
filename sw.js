/* This cache contains only the public app shell, never API responses or study packs. */
const VERSION='__BUILD_VERSION__';
const R2_CONTENT_READY='__R2_CONTENT_ENABLED__'==='true';
const CACHE='learn-skit-shell-'+VERSION;
const ASSETS=['./','./index.html','./css/styles.css','./css/fonts.css','./fonts/dm-sans-0.woff2','./fonts/ibm-plex-sans-1.woff2','./fonts/plus-jakarta-sans-2.woff2','./css/workspace.css','./js/config.js','./js/data.js','./js/access.js','./js/compat.js','./js/study-core.js','./js/workspace.js','./js/private-cache.js','./js/vendor/supabase.js','./js/app.js','./js/theme.js','./manifest.webmanifest','./icons/app.svg','./icons/app-192.png','./icons/app-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  const hadOldShell=keys.some(k=>k.startsWith('learn-skit-shell-')&&k!==CACHE);
  await Promise.all(keys.filter(k=>k.startsWith('learn-skit-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
  if(!R2_CONTENT_READY)return;
  const state=await caches.open('learn-skit-migrations');
  const marker=new URL('r2-delivery-v1',self.registration.scope).href;
  if(await state.match(marker))return;
  await state.put(marker,new Response('done'));
  if(!hadOldShell)return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(windows.map(async client=>{
    const url=new URL(client.url);
    // A callback may be exchanging a single-use OAuth code; leave it alone.
    if(url.origin!==self.location.origin||url.searchParams.has('code')||url.searchParams.has('error'))return;
    // Existing pagehide handlers synchronously retain pending progress locally.
    await client.navigate(client.url).catch(()=>{});
  }));
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search)return;
  const path=url.pathname,allowed=ASSETS.some(a=>new URL(a,self.registration.scope).pathname===path);
  if(!allowed)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||new Response('Offline. Reconnect to load this page.',{status:503,headers:{'Content-Type':'text/plain'}}))));
});
