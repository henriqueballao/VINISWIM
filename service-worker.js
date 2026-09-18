const CACHE='viniswim-v26';
const CORE=['./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./viniswim-logo.svg'];

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

  const url=new URL(e.request.url);
  const isNavigation=e.request.mode==='navigate';
  const isIndex=url.pathname.endsWith('/VINISWIM/')||url.pathname.endsWith('/VINISWIM/index.html');

  if(isNavigation||isIndex){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy)).catch(()=>{});
        return r;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(e.request))
  );
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
