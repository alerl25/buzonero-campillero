/* Buzonero Campillero · service worker
   Solo hace tres cosas: enseñar los avisos de correo nuevo que manda el servidor (aunque la app esté cerrada),
   poner el número rojo del icono y, al tocarlos, abrir ese correo. No guarda nada en caché: la app siempre se carga fresca de la red. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Buzonero', body: e.data ? e.data.text() : '' }; }
  // el número rojo del icono (correos de personas sin leer), que lo calcula el servidor al mandar el aviso
  if (typeof d.badge === 'number' && self.navigator && 'setAppBadge' in self.navigator) { try { (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(function () {}); } catch (err) {} }
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
