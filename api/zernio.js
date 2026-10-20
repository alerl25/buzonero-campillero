// Enrutador de integraciones de la app (una sola función: el plan gratis de Vercel admite 12 y esta es la última):
//  · WhatsApp por Zernio, SOLO LECTURA (decisión del dueño, 20-oct-2026): GET ?r=estado | conversaciones | mensajes.
//    No hay ningún camino para enviar ni para marcar como leído (en WhatsApp eso manda el doble check azul al cliente).
//    La clave (ZERNIO_API_KEY) vive solo en las variables de Vercel.
//  · Panel de integraciones: GET ?r=integraciones (qué está conectado, sin claves).
//  · Metricool con el token de cada persona: GET ?r=mc-posts · POST { accion: 'mc-conectar' | 'mc-actualizar' | 'mc-quitar' | 'mc-publicar' | 'mc-borrar' }.
//    Solo con sesión de la app (nunca con la llave del conector).
//  · Nombres de números de WhatsApp y permiso de Contactos de Google: POST { accion: 'nombre' | 'quitar-contactos' }.
import { validSession, sameOrigin, noStore, esMaquina, readCrm, updateCrm, quitarContactos } from './_lib.js';
import { agenda, clave9 } from './_agenda.js';
import { zernio, hayZernio, ID_ZERNIO as ID, nombreConv, soloDigitos } from './_zernio.js';
import { mcEstado, mcConectar, mcActualizar, mcQuitar, mcPosts, mcPublicar, mcBorrar } from './_metricool.js';

export default async function handler(req, res) {
  noStore(res);
  const maquina = esMaquina(req);
  if (!maquina && !validSession(req)) return res.status(401).json({ error: 'sesion' });
  if (!maquina && !sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  try {
    const q = req.query || {};
    if (req.method === 'GET') {
      const r = String(q.r || '');
      if (r === 'integraciones') {
        // para el panel y para saber qué entradas lleva la barra lateral: nada de claves
        const out = { ok: true, zernio: { clave: hayZernio(), whatsapp: 0 }, metricool: await mcEstado().catch(() => ({ conectado: false })), contactos: [], agenda: { n: 0, fotos: 0, fallos: [] } };
        if (hayZernio()) { try { const x = await zernio('/accounts'); out.zernio.whatsapp = x.status === 200 ? (x.body.accounts || []).filter((a) => a.platform === 'whatsapp').length : 0; } catch (e) {} }
        try { const g = await agenda(); out.contactos = g.emails; out.agenda = { n: g.n, fotos: g.fotos, fallos: g.fallos }; } catch (e) {}
        return res.status(200).json(out);
      }
      if (r === 'mc-posts') {
        if (maquina) return res.status(403).json({ error: 'sesion' });
        return res.status(200).json(await mcPosts(String(q.blogId || ''), String(q.desde || ''), String(q.hasta || '')));
      }
      if (!hayZernio()) return res.status(200).json({ ok: false, error: 'sin_clave' });
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
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      // Metricool: solo desde la app, con tu sesión
      if (String(b.accion || '').startsWith('mc-')) {
        if (maquina) return res.status(403).json({ error: 'sesion' });
        if (b.accion === 'mc-conectar') { const r = await mcConectar(b); return res.status(r.ok ? 200 : 400).json(r.ok ? { ok: true, marcas: r.marcas } : { ok: false, error: 'conectar', mensaje: r.error }); }
        if (b.accion === 'mc-actualizar') { const r = await mcActualizar(); return res.status(r.ok ? 200 : 400).json(r.ok ? r : { ok: false, ...r }); }
        if (b.accion === 'mc-quitar') { await mcQuitar(); return res.status(200).json({ ok: true }); }
        if (b.accion === 'mc-publicar') { const r = await mcPublicar(b); return res.status(r.ok ? 200 : 400).json(r.ok ? r : { ok: false, ...r }); }
        if (b.accion === 'mc-borrar') { const r = await mcBorrar(b.blogId, b.id); return res.status(r.ok ? 200 : 400).json(r.ok ? r : { ok: false, ...r }); }
        return res.status(400).json({ error: 'accion' });
      }
      if (b.accion === 'quitar-contactos') {
        if (maquina) return res.status(403).json({ error: 'sesion' });   // solo desde la app, con tu sesión
        await quitarContactos(String(b.email || '').toLowerCase().slice(0, 120));
        return res.status(200).json({ ok: true });
      }
      // Lo único que se escribe del WhatsApp: el nombre que TÚ le pones a un número (en nuestro almacén). A Zernio no se le manda nada.
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
