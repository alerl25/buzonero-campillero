// Mensajes: la bandeja unificada de Zernio (WhatsApp, Instagram, Facebook, Telegram, X…) dentro de Buzonero.
// La clave (ZERNIO_API_KEY) vive solo en las variables de Vercel: el navegador nunca la ve.
// Una sola función (el plan gratis de Vercel admite 12): ?r= elige la parte.
// SOLO LECTURA hacia Zernio (decisión del dueño, 20-oct-2026): GET ?r=estado | conversaciones | mensajes. No hay ningún camino para enviar
// ni para marcar como leído (en WhatsApp eso manda el doble check azul al cliente).
import { validSession, sameOrigin, noStore, esMaquina, readCrm, updateCrm, quitarContactos } from './_lib.js';
import { agenda, clave9 } from './_agenda.js';
import { zernio, ID_ZERNIO as ID, nombreConv, soloDigitos } from './_zernio.js';

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
        let contactos = [], ag = { n: 0, fotos: 0, fallos: [] }; try { const g = await agenda(); contactos = g.emails; ag = { n: g.n, fotos: g.fotos, fallos: g.fallos }; } catch (e) {}
        return res.status(200).json({ ok: true, cuentas, contactos, agenda: ag });
      }
      if (r === 'conversaciones') {
        const p = new URLSearchParams({ limit: '50', platform: 'whatsapp' });   // solo WhatsApp (y Gmail aparte): decisión del dueño, 20-oct-2026
        if (q.cuenta && ID.test(String(q.cuenta))) p.set('accountId', String(q.cuenta));
        if (q.cursor && ID.test(String(q.cursor))) p.set('cursor', String(q.cursor));
        const x = await zernio('/inbox/conversations?' + p);
        if (x.status !== 200) return res.status(200).json({ ok: false, error: 'zernio', status: x.status });
        let alias = {}; try { alias = (await readCrm()).waNombres || {}; } catch (e) {}
        let ag = { m: {} }; try { ag = await agenda(); } catch (e) {}
        const conversaciones = (x.body.data || []).map((c) => {
          const n = nombreConv(c, alias), hit = ag.m[clave9(n.telefono)];
          const sinNombre = !n.real && !(hit && hit[0]);
          return { ...c, participantName: !n.real && hit && hit[0] ? hit[0] : n.nombre, sinNombre, telefono: n.telefono, participantPicture: (hit && hit[1]) || c.participantPicture || '' };
        });
        return res.status(200).json({ ok: true, conversaciones, pagina: x.body.pagination || null });
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
      // Lo único que se escribe: el nombre que TÚ le pones a un número (en nuestro almacén). A Zernio no se le manda nada.
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (b.accion === 'quitar-contactos') {
        if (maquina) return res.status(403).json({ error: 'sesion' });   // solo desde la app, con tu sesión
        await quitarContactos(String(b.email || '').toLowerCase().slice(0, 120));
        return res.status(200).json({ ok: true });
      }
      if (b.accion !== 'nombre') return res.status(400).json({ error: 'accion' });
      const tel = soloDigitos(b.numero), nom = String(b.nombre || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60);
      if (tel.length < 6 || tel.length > 16) return res.status(400).json({ error: 'numero' });
      await updateCrm((d) => { d.waNombres = d.waNombres || {}; if (nom) d.waNombres[tel] = nom; else delete d.waNombres[tel]; });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'metodo' });
  } catch (e) {
    return res.status(500).json({ error: 'interno' });
  }
}
