const CACHE='viniswim-v2';
const CORE=['./VINISWIM.html','./manifest.webmanifest','./icon-192.svg','./icon-512.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{let c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./VINISWIM.html'))))});
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?.text()||''}}
  const title=d.title||'VINISWIM';
  const options={body:d.body||'Novo aviso do VINISWIM.',icon:'./icon-192.svg',badge:'./icon-192.svg',tag:d.tag||'viniswim-push',data:d.data||{url:'./VINISWIM.html#alerts'},renotify:true};
  e.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const target=e.notification.data?.url||'./VINISWIM.html#alerts';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c){c.navigate(target);return c.focus()}}
    return clients.openWindow(target)
  }));
});