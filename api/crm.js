// CRM: los CRM de esta instalación (uno por negocio), con sus cuentas, etapas y reglas para detectar leads.
// Una sola función para todo el CRM (el plan gratis de Vercel admite 12 funciones): ?r= elige la parte.
// GET → la lista · POST { accion: 'guardar' | 'borrar' | 'importar' }
import { validSession, sameOrigin, noStore, esMaquina, allAccounts, accessToken, readCrm, updateCrm } from './_lib.js';
import { limpiarCrm, detector, ETIQUETA_NOLEAD } from './_crm.js';
import { esPropaganda } from './vigia.js';
import { conectarGA, conectarWA, conectarNX, estadoPublico, nexudusCliente } from './_integ.js';

export default async function handler(req, res) {
  noStore(res);
  const maquina = esMaquina(req);
  if (!maquina && !validSession(req)) return res.status(401).json({ error: 'sesion' });
  if (!maquina && !sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  try {
    const r = String((req.query && req.query.r) || '');
    if (req.method === 'GET' && (r === 'leads' || r === 'clientes')) {
      // el tablero (leads por etapa) o los clientes de un CRM, de todas sus cuentas
      const dcrm = await readCrm(), c = dcrm.crms[String(req.query.id || '')];
      if (!c) return res.status(404).json({ error: 'crm' });
      const todas = await allAccounts(), out = { ok: true, leads: [], clientes: [], bots: 0, fallos: [] }, dets = {};
      for (const k of c.cuentas) {
        try {
          const tk = await accessToken(k); if (!tk) { out.fallos.push(k); continue; }
          const d = dets[k] = detector(tk, c, todas, k, esPropaganda);
          if (r === 'leads') { const p = await d.pipeline(); out.leads.push(...p.leads); out.bots += p.bots; }
          else out.clientes.push(...await d.clientes());
        } catch (e) { out.fallos.push(k); }
      }
      if (r === 'leads') {
        // cada lead: de quién es el turno y qué hay en Nexudus; con reserva o factura pasa solo a «Reserva», y pagada a «Ganado» (nunca hacia atrás)
        const nx = ((dcrm.integ || {})[c.id] || {}).nx, nxOk = nx && nx.token && nx.caduca > Date.now();
        const pos = (n) => c.etapas.findIndex((e) => e.toLowerCase() === n);
        const iRes = pos('reserva'), iGan = pos('ganado');
        let i = 0;
        await Promise.all(Array.from({ length: 3 }, async () => {
          while (i < out.leads.length) {
            const l = out.leads[i++], d = dets[l.k];
            try { if (d && l.email) { const cv = await d.conversacion(l.email); if (cv) { l.turno = cv.turno; l.ultimo = cv.ultimo; } } } catch (e) {}
            if (!l.turno) l.turno = 'tuyo';
            if (!nxOk || !l.email) continue;
            try {
              const n = await nexudusCliente(nx.token, l.email); if (!n) continue;
              const desde = (l.fecha || 0) - 7 * 86400000;   // solo lo que viene después de su consulta
              const fs = n.facturas.filter((f) => Date.parse(f.fecha) >= desde), rs = n.reservas.filter((b) => Date.parse(b.desde) >= desde);
              l.nexudus = { facturas: n.facturas.slice(0, 8), reservas: n.reservas.slice(0, 8) };
              const cur = c.etapas.indexOf(l.etapa);
              const obj = fs.some((f) => f.pagada) && iGan >= 0 ? iGan : ((fs.length || rs.length) && iRes >= 0 ? iRes : -1);
              if (obj > cur && d) { await d.mover(l.ids, c.etapas[obj]); l.etapa = c.etapas[obj]; l.auto = 'Nexudus'; }
            } catch (e) {}
          }
        }));
      }
      return res.status(200).json(out);
    }
    if (req.method === 'GET') {
      // la lista de CRM y, de cada uno, qué integraciones tiene (sin claves ni tokens)
      const d = await readCrm(), integ = {};
      Object.keys(d.integ || {}).forEach((x) => { integ[x] = estadoPublico(d.integ[x]); });
      return res.status(200).json({ ok: true, crms: d.crms, integ });
    }
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
      return res.status(200).json({ ok: true, id: c.id });
    }
    const id = String(b.id || '');
    if (!/^c[0-9a-f]{8}$/.test(id)) return res.status(400).json({ error: 'crm' });
    if (b.accion === 'borrar') {
      // las etiquetas de Gmail se quedan: borrar el CRM no toca el correo
      await updateCrm((d) => { if (!d.crms[id]) return false; delete d.crms[id]; if (d.integ) delete d.integ[id]; });
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'mover' || b.accion === 'anadir') {
      // cambiar de etapa (tablero) o meter en el CRM un correo cualquiera («Añadir al CRM»)
      const c = (await readCrm()).crms[id], k = String(b.k || '');
      if (!c || !c.cuentas.includes(k)) return res.status(404).json({ error: 'crm' });
      const etapa = String(b.etapa || c.etapas[0]);
      if (!c.etapas.includes(etapa) && etapa !== ETIQUETA_NOLEAD) return res.status(400).json({ error: 'etapa' });
      const tk = await accessToken(k); if (!tk) return res.status(409).json({ error: 'reconectar' });
      const d = detector(tk, c, todas, k, esPropaganda);
      if (b.accion === 'anadir') {
        if (!/^[0-9a-f]{6,24}$/.test(String(b.hilo || ''))) return res.status(400).json({ error: 'hilo' });
        return res.status(200).json({ ok: true, id: await d.anadir(String(b.hilo), etapa) });
      }
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => /^[0-9a-f]{6,24}$/.test(x)).slice(0, 50);
      if (!ids.length) return res.status(400).json({ error: 'ids' });
      await d.mover(ids, etapa);
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'ocultar') {
      // qué integraciones no quiere ver este CRM (no toca sus claves)
      const svc = String(b.svc || '');
      if (!['ga', 'gbp', 'wa', 'nx'].includes(svc)) return res.status(400).json({ error: 'svc' });
      await updateCrm((d) => { const c = d.crms[id]; if (!c) return false; const o = new Set(c.integOcultas || []); b.ocultar ? o.add(svc) : o.delete(svc); c.integOcultas = [...o]; });
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'integrar' || b.accion === 'desintegrar') {
      // conectar (se prueba antes de guardar) o quitar una integración: ga, wa (varios números) o nx
      const svc = String(b.svc || '');
      if (!['ga', 'wa', 'nx'].includes(svc)) return res.status(400).json({ error: 'svc' });
      if (!(await readCrm()).crms[id]) return res.status(404).json({ error: 'crm' });
      if (b.accion === 'desintegrar') {
        const num = String(b.numero || '');
        await updateCrm((d) => { const x = (d.integ || {})[id]; if (!x) return false; if (svc === 'wa' && num) x.wa = (x.wa || []).filter((n) => n.id !== num); else delete x[svc]; });
        return res.status(200).json({ ok: true });
      }
      let r2;
      try { r2 = await ({ ga: conectarGA, wa: conectarWA, nx: conectarNX })[svc](b.datos || {}); }
      catch (e) { return res.status(400).json({ error: 'integ', mensaje: String(e.message || e).slice(0, 300), pide: e.pide || null }); }
      await updateCrm((d) => {
        d.integ = d.integ || {}; const x = d.integ[id] = d.integ[id] || {};
        if (svc === 'wa') { x.wa = (x.wa || []).filter((n) => n.id !== r2.guardar.id); x.wa.push(r2.guardar); } else x[svc] = r2.guardar;
      });
      return res.status(200).json({ ok: true, estado: r2.estado });
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
