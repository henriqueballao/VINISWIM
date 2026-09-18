const BUILD='37';
const CACHE='viniswim-v37';
const CORE=['./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./viniswim-logo.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();

    // Important: when a new VINISWIM build activates, refresh every open PWA window.
    // This removes the need for Ctrl+F5, closing/reopening, or manual cache clearing.
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(list.map(c=>c.navigate(c.url).catch(()=>{})));
  })());
});

self.addEventListener('message',e=>{
  if(e.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(e.data?.type==='GET_BUILD')e.source?.postMessage({type:'VINISWIM_BUILD',build:BUILD});
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const isNavigation=e.request.mode==='navigate' || url.pathname.endsWith('/VINISWIM/') || url.pathname.endsWith('/VINISWIM/index.html');

  if(isNavigation){
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
    fetch(e.request,{cache:'no-cache'}).then(r=>{
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
    tag:d.tag||'viniswim-push',
    data:d.data||{url:'./#alerts'},
    renotify:true
  }));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=e.notification.data?.url||'./#alerts';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){
      if('focus' in c){
        c.navigate(target);
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
