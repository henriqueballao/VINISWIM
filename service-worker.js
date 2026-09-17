const CACHE='viniswim-v22';
const CORE=['./','./index.html','./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./viniswim-logo.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{
    const c=r.clone();
    caches.open(CACHE).then(cache=>cache.put(e.request,c)).catch(()=>{});
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?.text()||''}}
  e.waitUntil(self.registration.showNotification(d.title||'VINISWIM',{
    body:d.body||'Novo aviso do VINISWIM.',
    icon:'./icon-192.png',badge:'./icon-192.png',
    tag:d.tag||'viniswim-push',data:d.data||{url:'./#alerts'},renotify:true
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=e.notification.data?.url||'./#alerts';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c){c.navigate(target);return c.focus()}}
    return clients.openWindow(target)
  }));
});
