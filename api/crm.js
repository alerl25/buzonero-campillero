// CRM: los CRM de esta instalación (uno por negocio), con sus cuentas, etapas y reglas para detectar leads.
// Una sola función para todo el CRM (el plan gratis de Vercel admite 12 funciones): ?r= elige la parte.
// GET → la lista · POST { accion: 'guardar' | 'borrar' | 'importar' }
import { validSession, sameOrigin, noStore, esMaquina, allAccounts, accessToken, readCrm, updateCrm } from './_lib.js';
import { limpiarCrm, detector } from './_crm.js';
import { esPropaganda } from './vigia.js';

export default async function handler(req, res) {
  noStore(res);
  const maquina = esMaquina(req);
  if (!maquina && !validSession(req)) return res.status(401).json({ error: 'sesion' });
  if (!maquina && !sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, crms: (await readCrm()).crms });
    if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
    const b = req.body || {}, todas = await allAccounts();
    if (b.accion === 'guardar') {
      let c;
      try { c = limpiarCrm(b.crm, todas); } catch (e) { return res.status(400).json({ error: e.message }); }
      let choque = null;
      await updateCrm((d) => {
        // una cuenta solo puede estar en un CRM: si no, un mismo correo sería dos leads
        const otro = Object.values(d.crms).find((x) => x.id !== c.id && x.cuentas.some((k) => c.cuentas.includes(k)));
        if (otro) { choque = otro.nombre; return false; }
        const ahora = new Date().toISOString();
        d.crms[c.id] = { ...(d.crms[c.id] || {}), ...c, creado: (d.crms[c.id] || {}).creado || ahora, actualizado: ahora };
      });
      if (choque) return res.status(409).json({ error: 'cuenta-en-otro', crm: choque });
      // las etiquetas de las etapas se crean ya, para que se vean en la barra lateral
      const avisos = [];
      for (const k of c.cuentas) {
        try { const tk = await accessToken(k); if (!tk) { avisos.push(k); continue; } await detector(tk, c, todas, k, esPropaganda).prepararEtiquetas(); } catch (e) { avisos.push(k); }
      }
      return res.status(200).json({ ok: true, id: c.id, sinEtiquetas: avisos });
    }
    const id = String(b.id || '');
    if (!/^c[0-9a-f]{8}$/.test(id)) return res.status(400).json({ error: 'crm' });
    if (b.accion === 'borrar') {
      // las etiquetas de Gmail se quedan: borrar el CRM no toca el correo
      await updateCrm((d) => { if (!d.crms[id]) return false; delete d.crms[id]; });
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'importar') {
      const c = (await readCrm()).crms[id];
      if (!c) return res.status(404).json({ error: 'crm' });
      const dias = Math.min(90, Math.max(1, Number(b.dias) || 30)), total = { revisados: 0, leads: 0, bots: 0 }, fallos = [];
      for (const k of c.cuentas) {
        try {
          const tk = await accessToken(k); if (!tk) { fallos.push(k); continue; }
          const r = await detector(tk, c, todas, k, esPropaganda).importar(dias);
          total.revisados += r.revisados; total.leads += r.leads; total.bots += r.bots;
        } catch (e) { fallos.push(k); }
      }
      return res.status(200).json({ ok: true, ...total, fallos });
    }
    return res.status(400).json({ error: 'accion' });
  } catch (e) { return res.status(500).json({ error: 'almacen' }); }
}
