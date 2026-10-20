// Mensajes: la bandeja unificada de Zernio (WhatsApp, Instagram, Facebook, Telegram, X…) dentro de Buzonero.
// La clave (ZERNIO_API_KEY) vive solo en las variables de Vercel: el navegador nunca la ve.
// Una sola función (el plan gratis de Vercel admite 12): ?r= elige la parte.
// SOLO LECTURA (decisión del dueño, 20-oct-2026): GET ?r=estado | conversaciones | mensajes. No hay ningún camino para enviar
// ni para marcar como leído (en WhatsApp eso manda el doble check azul al cliente).
import { validSession, sameOrigin, noStore, esMaquina } from './_lib.js';
import { zernio, ID_ZERNIO as ID } from './_zernio.js';

export default async function handler(req, res) {
  noStore(res);
  const maquina = esMaquina(req);
  if (!maquina && !validSession(req)) return res.status(401).json({ error: 'sesion' });
  if (!maquina && !sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  if (!process.env.ZERNIO_API_KEY) return res.status(200).json({ ok: false, error: 'sin_clave' });
  try {
    const q = req.query || {};
    if (req.method === 'GET') {
      const r = String(q.r || '');
      if (r === 'estado') {
        const x = await zernio('/accounts');
        if (x.status !== 200) return res.status(200).json({ ok: false, error: 'zernio', status: x.status });
        const cuentas = (x.body.accounts || []).map((a) => ({ id: a._id || a.id, plataforma: a.platform, nombre: a.displayName || a.username || a.name || a.platform, usuario: a.username || '', foto: a.profilePicture || '' }));
        return res.status(200).json({ ok: true, cuentas });
      }
      if (r === 'conversaciones') {
        const p = new URLSearchParams({ limit: '50' });
        if (q.cuenta && ID.test(String(q.cuenta))) p.set('accountId', String(q.cuenta));
        if (q.cursor && ID.test(String(q.cursor))) p.set('cursor', String(q.cursor));
        const x = await zernio('/inbox/conversations?' + p);
        if (x.status !== 200) return res.status(200).json({ ok: false, error: 'zernio', status: x.status });
        return res.status(200).json({ ok: true, conversaciones: x.body.data || [], pagina: x.body.pagination || null });
      }
      if (r === 'mensajes') {
        const c = String(q.id || ''), a = String(q.cuenta || '');
        if (!ID.test(c) || !ID.test(a)) return res.status(400).json({ error: 'id' });
        const x = await zernio('/inbox/conversations/' + encodeURIComponent(c) + '/messages?' + new URLSearchParams({ accountId: a, limit: '100', sortOrder: 'asc' }));
        if (x.status !== 200) return res.status(200).json({ ok: false, error: 'zernio', status: x.status });
        return res.status(200).json({ ok: true, mensajes: x.body.messages || [] });
      }
      return res.status(400).json({ error: 'r' });
    }
    return res.status(405).json({ error: 'metodo' });
  } catch (e) {
    return res.status(500).json({ error: 'interno' });
  }
}
