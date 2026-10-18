// Avisos al móvil: dar de alta o de baja este dispositivo, y mandar un aviso de prueba. Solo con la sesión abierta.
import crypto from 'node:crypto';
import { validSession, sameOrigin, noStore, updateStore, webPush, readStore } from './_lib.js';

const hash = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 24);
// solo los servicios de avisos de verdad (Google, Mozilla, Apple, Microsoft): el vigía hace POST a esta dirección con cada correo
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[\w.-]+\.push\.apple\.com|[\w.-]+\.notify\.windows\.com)\//;
const validSub = (s) => s && typeof s.endpoint === 'string' && PUSH_HOSTS.test(s.endpoint) && s.endpoint.length < 1000 && s.keys && typeof s.keys.p256dh === 'string' && s.keys.p256dh.length < 200 && typeof s.keys.auth === 'string' && s.keys.auth.length < 100;

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
  const b = req.body || {};
  try {
    if (b.accion === 'alta') {
      if (!validSub(b.sub)) return res.status(400).json({ error: 'suscripcion' });
      const sub = { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } };
      const h = hash(sub.endpoint), st = await readStore();
      if (st.push && st.push[h] && st.push[h].sub.keys.auth === sub.keys.auth) return res.status(200).json({ ok: true, ya: true });
      await updateStore((n) => { n.push[h] = { sub, disp: String(b.disp || '').slice(0, 60), alta: new Date().toISOString() }; });
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'baja') {
      const h = hash(b.endpoint);
      await updateStore((n) => { if (!n.push[h]) return false; delete n.push[h]; });
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'prueba') {
      const st = await readStore(true), s = st.push && st.push[hash(b.endpoint)];
      if (!s) return res.status(404).json({ error: 'no dado de alta' });
      const c = await webPush(s.sub, { title: 'Buzonero Campillero', body: 'Así te llegarán los avisos de correo nuevo.', tag: 'prueba', url: '/app' });
      return res.status(c >= 200 && c < 300 ? 200 : 502).json({ ok: c >= 200 && c < 300, codigo: c });
    }
    return res.status(400).json({ error: 'accion' });
  } catch (e) { return res.status(500).json({ error: 'avisos' }); }
}
