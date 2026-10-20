// Mensajes: la bandeja unificada de Zernio (WhatsApp, Instagram, Facebook, Telegram, X…) dentro de Buzonero.
// La clave (ZERNIO_API_KEY) vive solo en las variables de Vercel: el navegador nunca la ve.
// Una sola función (el plan gratis de Vercel admite 12): ?r= elige la parte.
// GET  ?r=estado | conversaciones | mensajes · POST { accion: 'enviar' | 'leido' }
import crypto from 'node:crypto';
import { validSession, sameOrigin, noStore, esMaquina } from './_lib.js';

const BASE = 'https://zernio.com/api/v1';
const ID = /^[A-Za-z0-9_.:@=+\-]{1,200}$/;   // ids opacos de Zernio: solo caracteres seguros

async function zernio(path, opt = {}) {
  const r = await fetch(BASE + path, {
    method: opt.method || 'GET',
    headers: Object.assign({ Authorization: 'Bearer ' + process.env.ZERNIO_API_KEY, 'Content-Type': 'application/json' }, opt.headers || {}),
    body: opt.json !== undefined ? JSON.stringify(opt.json) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

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
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const c = String(b.id || ''), a = String(b.cuenta || '');
      if (!ID.test(c) || !ID.test(a)) return res.status(400).json({ error: 'id' });
      if (b.accion === 'leido') {
        const x = await zernio('/inbox/conversations/' + encodeURIComponent(c) + '/read', { method: 'POST', json: { accountId: a } });
        return res.status(200).json({ ok: x.status < 300 });
      }
      if (b.accion === 'enviar') {
        // Enviar solo con la orden explícita de quien usa la app (o de Claude con confirmado: true a petición del dueño)
        if (maquina && b.confirmado !== true) return res.status(400).json({ error: 'confirmado' });
        const texto = String(b.texto || '').trim();
        if (!texto || texto.length > 4000) return res.status(400).json({ error: 'texto' });
        const x = await zernio('/inbox/conversations/' + encodeURIComponent(c) + '/messages', {
          method: 'POST', json: { accountId: a, message: texto }, headers: { 'Idempotency-Key': crypto.randomUUID() },
        });
        if (x.status >= 300) return res.status(200).json({ ok: false, error: 'zernio', status: x.status, detalle: (x.body && (x.body.error || x.body.message)) || '' });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'accion' });
    }
    return res.status(405).json({ error: 'metodo' });
  } catch (e) {
    return res.status(500).json({ error: 'interno' });
  }
}
