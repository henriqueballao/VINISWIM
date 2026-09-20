const BUILD='73';
const PREFIX='viniswim-andre-';
const CACHE=PREFIX+'v72';
const CORE=['./','./index.html','./manifest.webmanifest','../../icon-192.png','../../icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});await Promise.all(list.map(c=>c.navigate(c.url).catch(()=>{})));})());});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();if(e.data?.type==='GET_BUILD')e.source?.postMessage({type:'VINISWIM_BUILD',build:BUILD});});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);

  // Não interceptar chamadas externas (Render, Dropbox, SwimSystem, FDAP etc.).
  // Deixa o navegador receber o erro real/retry, evitando respondWith(null).
  if(u.origin!==self.location.origin)return;

  const nav=e.request.mode==='navigate'||u.pathname.endsWith('/andre/')||u.pathname.endsWith('/andre/index.html');
  if(nav){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy)).catch(()=>{});
        return r;
      }).catch(async()=>{
        const cached=await caches.match('./index.html');
        return cached||new Response('Offline',{status:503,statusText:'Offline'});
      })
    );
    return;
  }

  e.respondWith(
    fetch(e.request,{cache:'no-cache'}).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{});
      return r;
    }).catch(async()=>{
      const cached=await caches.match(e.request);
      return cached||new Response('Offline',{status:503,statusText:'Offline'});
    })
  );
});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?.text()||''}}e.waitUntil(self.registration.showNotification(d.title||'VINISWIM',{body:d.body||'Novo aviso do VINISWIM.',icon:'../../icon-192.png',badge:'../../icon-192.png',tag:d.tag||'viniswim-andre-push',data:d.data||{url:'./#alerts'},renotify:false}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const target=e.notification.data?.url||'./#alerts';e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(target);return c.focus();}}return self.clients.openWindow(target);}));});