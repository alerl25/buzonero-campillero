/* Buzonero Campillero · service worker
   Solo hace tres cosas: enseñar los avisos de correo nuevo que manda el servidor (aunque la app esté cerrada),
   poner el número rojo del icono y, al tocarlos, abrir ese correo. No guarda nada en caché: la app siempre se carga fresca de la red. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

// el contador vive en la caché del navegador (el service worker no tiene localStorage); la app lo pone a 0 al abrirse
function leerN() { return caches.open('bz-n').then(function (c) { return c.match('/n'); }).then(function (r) { return r ? r.text() : '0'; }).then(function (t) { return parseInt(t, 10) || 0; }).catch(function () { return 0; }); }
function ponerN(n) { return caches.open('bz-n').then(function (c) { return c.put('/n', new Response(String(n))); }).catch(function () {}); }
function contarAviso(d) {
  if (!self.navigator || !('setAppBadge' in self.navigator)) return Promise.resolve();
  // con la app a la vista no se cuenta: ya lo está viendo
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    if (cs.some(function (c) { return c.visibilityState === 'visible'; })) return;
    return leerN().then(function (n) { n++; return ponerN(n).then(function () { return self.navigator.setAppBadge(n); }); });
  }).catch(function () {});
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Buzonero', body: e.data ? e.data.text() : '' }; }
  // el número rojo del icono = avisos recibidos desde la última vez que se abrió la app (arranca en 0; la app lo pone a 0 al abrirse).
  // Se cuenta aquí, en el dispositivo: ya no es «correos sin leer del último mes», que enseñaba un número aunque no hubiera nada nuevo.
  e.waitUntil(contarAviso(d));
  e.waitUntil(self.registration.showNotification(d.title || 'Buzonero Campillero', {
    body: d.body || 'Tienes correo nuevo',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/app/icono-192.png',
    badge: '/app/icono-192.png',
    data: { url: d.url || '/app' },
    timestamp: Date.now()
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/app', self.location.origin).href;
  if (new URL(url).origin !== self.location.origin) url = self.location.origin + '/app';   // solo se abre la propia app
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].url.indexOf(self.location.origin + '/app') === 0) { cs[i].postMessage({ abrir: url }); return cs[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
