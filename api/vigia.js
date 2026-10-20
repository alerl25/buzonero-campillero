// El vigía: lo llama cada minuto un despertador externo (cron-job.org) con la clave VIGIA_KEY.
// Mira en el historial de Gmail de cada cuenta si ha entrado correo nuevo en Recibidos desde la última vez
// y, si lo hay, manda el aviso a los móviles suscritos. No guarda correos: solo el punto del historial de cada cuenta.
// También vigila los «Avísame si no contesta» (su propio fichero, readSeg): al vencer, si nadie ha respondido, avisa y devuelve el hilo a Recibidos.
import crypto from 'node:crypto';
// Y, en las cuentas que están en un CRM con la detección activa, marca los leads nuevos («Leads/Nuevo») y avisa «Nuevo lead»;
// cuando la cuenta contesta en un hilo de la primera etapa, lo pasa a la segunda («Respondido»).
import { allAccounts, accessToken, readStore, updateStore, readSeg, updateSeg, readEnv, updateEnv, readCrm, pushTodos, noStore } from './_lib.js';
import { zernio, hayZernio, nombreConv } from './_zernio.js';
import { crmDeCuenta, detector } from './_crm.js';

const MAX_POR_CUENTA = 4;   // si entran más de golpe, el resto va en un aviso de resumen
const ETIQUETA_SEG = 'Sin respuesta';
function claveOk(req) {
  const want = process.env.VIGIA_KEY || '', got = String((req.headers['x-vigia'] || req.query.k || ''));
  const a = Buffer.from(got), b = Buffer.from(want);
  return want.length >= 20 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
const nombre = (from) => { const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>/.exec(from || ''); return (m && m[1].trim()) || (m && m[2]) || (from || '').trim(); };
const correoDe = (from) => { const m = /<([^>]+)>/.exec(from || ''); return ((m && m[1]) || from || '').trim().toLowerCase(); };
// Propaganda de cualquier empresa: sin aviso (también en cuentas sin pestañas de Gmail, por la cabecera List-Unsubscribe).
// Es propaganda si trae «darse de baja» (List-Unsubscribe) o va a Promociones/Social/Foros; salvo si habla de algo suyo de verdad.
const IMPORTA = /pedido|env[ií]o|enviado|entrega|reparto|paquete|factura|recibo|pago|cobro|reembolso|devoluci|reserva|cita\b|c[oó]digo|verifica|contraseña|seguridad|inicio de sesi[oó]n|tu cuenta|order|shipped|deliver|invoice|receipt|payment|password|security|verification|formulario|form submission|presupuesto|consulta|solicitud/i;
export function esPropaganda(labels, H) {
  if ((labels || []).some((l) => l === 'CATEGORY_PROMOTIONS' || l === 'CATEGORY_SOCIAL' || l === 'CATEGORY_FORUMS')) return !IMPORTA.test(H.subject || '');
  return !!H['list-unsubscribe'] && !IMPORTA.test(H.subject || '');
}
const cabecera = (m, n) => (((m && m.payload && m.payload.headers) || []).find((h) => h.name.toLowerCase() === n) || {}).value || '';

export default async function handler(req, res) {
  noStore(res);
  if (!claveOk(req)) return res.status(401).json({ error: 'clave' });
  const st0 = await readStore(true);
  // sin el almacén no se sabe qué cuentas hay ni dónde se quedó el historial: mejor no hacer nada que borrar avisos o repetirlos
  if (st0._fallo) return res.status(503).json({ error: 'almacen' });
  const hayMoviles = Object.keys(st0.push || {}).length > 0;
  const vencidos = Object.values(await readSeg().catch(() => ({}))).filter((s) => s && s.vence <= Date.now());
  // envíos pulsados en la app que la app no llegó a mandar (se cerró o se apagó): 20 s de margen sobre su hora
  const pendEnv = Object.values(await readEnv().catch(() => ({}))).filter((e) => e && e.tras + 20000 <= Date.now());
  // los CRM con la detección de leads activa: sus cuentas se miran aunque no haya móviles
  const crmFull = await readCrm().catch(() => ({ crms: {} })), crms = crmFull.crms || {};
  const todas = await allAccounts(), nuevosH = {}, avisos = [], hist = st0.hist || {};
  const crmDe = {}; Object.keys(todas).forEach((k) => { const c = crmDeCuenta(crms, k); if (c && c.deteccion && c.deteccion.activa && c.etapas && c.etapas.length >= 2) crmDe[k] = c; });
  if (!hayMoviles && !vencidos.length && !pendEnv.length && !Object.keys(crmDe).length) return res.status(200).json({ ok: true, sinMoviles: true });
  const tokens = {}, leads = { nuevos: 0, bots: 0, respondidos: 0 };
  const tok = async (k) => { if (!(k in tokens)) tokens[k] = await accessToken(k).catch(() => null); return tokens[k]; };
  await Promise.all(Object.entries(todas).filter(([k]) => hayMoviles || crmDe[k]).map(async ([k, acc]) => {
    try {
      const tk = await tok(k); if (!tk) return;
      const G = (u) => fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + u, { headers: { Authorization: 'Bearer ' + tk } });
      const desde = hist[k];
      if (!desde) { const p = await (await G('profile')).json(); if (p.historyId) nuevosH[k] = p.historyId; return; }   // primera vez: solo se apunta el punto
      const r = await G('history?historyTypes=messageAdded&labelId=INBOX&maxResults=100&startHistoryId=' + desde);
      if (r.status === 404) { const p = await (await G('profile')).json(); if (p.historyId) nuevosH[k] = p.historyId; return; }   // punto caducado: se reinicia
      const j = await r.json(); if (!r.ok) return;
      if (j.historyId && j.historyId !== desde) nuevosH[k] = j.historyId;
      const crm = crmDe[k], det = crm ? detector(tk, crm, todas, k, esPropaganda) : null;
      // lo que ha enviado esta cuenta: si contesta a un lead de la primera etapa, pasa a la segunda
      if (det) {
        try {
          const s = await (await G('history?historyTypes=messageAdded&labelId=SENT&maxResults=100&startHistoryId=' + desde)).json();
          const env = [...new Set((s.history || []).flatMap((h) => (h.messagesAdded || []).map((x) => x.message)).filter((m) => (m.labelIds || []).includes('SENT')).map((m) => m.id))];
          for (const id of env.slice(0, 5)) leads.respondidos += await det.enviado(id).catch(() => 0);
        } catch (e) {}
      }
      // nuevos en Recibidos: los leídos también cuentan para el CRM (un filtro puede marcarlos), pero solo los no leídos avisan
      const vistos = new Set(), msgs = [];
      (j.history || []).forEach((h) => (h.messagesAdded || []).forEach((x) => {
        const m = x.message, L = m.labelIds || [];
        if (vistos.has(m.id) || !L.includes('INBOX') || L.includes('SENT') || L.includes('DRAFT') || L.includes('SPAM')) return;
        if (!L.includes('UNREAD') && !det) return;
        vistos.add(m.id); msgs.push(m);
      }));
      if (!msgs.length) return;
      const detalle = await Promise.all(msgs.slice(det ? -8 : -MAX_POR_CUENTA).map((m) => G('messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe').then((x) => x.json()).catch(() => null)));
      const yaLead = new Set();   // mensajes ya tratados como lead o bot (un envío del formulario suele llegar dos veces)
      for (const m of detalle.filter(Boolean)) {
        if (!det) continue;
        if (yaLead.has(m.id)) continue;
        const l = await det.revisar(m).catch(() => null);
        if (!l) continue;
        l.ids.forEach((x) => yaLead.add(x));
        if (l.motivo) { leads.bots++; continue; }   // posible bot: se etiqueta y no se avisa
        leads.nuevos++;
        avisos.push({ title: 'Nuevo lead · ' + (l.f.nombre || l.f.email) + ' · ' + crm.nombre, body: (l.f.asunto ? l.f.asunto + '\n' : '') + (l.f.mensaje || '').slice(0, 140), tag: k + '-' + m.threadId, url: '/app?acc=' + encodeURIComponent(k) + '&hilo=' + encodeURIComponent(m.threadId) });
      }
      const sinLeer = detalle.filter((m) => m && !yaLead.has(m.id) && (m.labelIds || []).includes('UNREAD'));
      if (!hayMoviles) return;
      sinLeer.slice(-MAX_POR_CUENTA).forEach((m) => {
        const H = {}; ((m.payload && m.payload.headers) || []).forEach((h) => { H[h.name.toLowerCase()] = h.value; });
        if (esPropaganda(m.labelIds, H)) return;   // publicidad: entra, pero sin avisar
        if (nombre(H.from).toLowerCase() === acc.email.toLowerCase() || (H.from || '').toLowerCase().includes('<' + acc.email.toLowerCase() + '>')) return;   // lo que envía esa misma cuenta, no
        const snip = String(m.snippet || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        avisos.push({ title: nombre(H.from) + ' · ' + acc.name, body: (H.subject || '(sin asunto)') + (snip ? '\n' + snip.slice(0, 140) : ''), tag: k + '-' + m.threadId, url: '/app?acc=' + encodeURIComponent(k) + '&hilo=' + encodeURIComponent(m.threadId) });
      });
      const nSinLeer = msgs.filter((m) => (m.labelIds || []).includes('UNREAD')).length;
      if (nSinLeer > MAX_POR_CUENTA) avisos.push({ title: acc.name, body: 'Y ' + (nSinLeer - MAX_POR_CUENTA) + ' correos nuevos más', tag: k + '-resumen', url: '/app?acc=' + encodeURIComponent(k) });
    } catch (e) {}
  }));

  // «Avísame si no contesta»: los que han vencido. Si alguien escribió en el hilo después, se quita sin avisar.
  const segHechos = [];
  for (const s of vencidos.slice(0, 10)) {
    const acc = todas[s.k]; if (!acc) { segHechos.push(s); continue; }
    try {
      const tk = await tok(s.k); if (!tk) continue;   // cuenta caída: se reintenta en la siguiente pasada
      const G = (u, o) => fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + u, Object.assign({ headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' } }, o || {}));
      const r = await G('threads/' + s.hilo + '?format=metadata&metadataHeaders=From');
      if (r.status === 404) { segHechos.push(s); continue; }   // el hilo ya no existe
      if (!r.ok) continue;
      const t = await r.json(), yo = acc.email.toLowerCase();
      const contestado = (t.messages || []).some((m) => +m.internalDate > s.desde + 1000 && !(m.labelIds || []).includes('DRAFT') && correoDe(cabecera(m, 'from')) !== yo);
      segHechos.push(s);
      if (contestado) continue;
      // de vuelta a Recibidos, sin leer y con su etiqueta, para que se vea
      let lid = null;
      try {
        const ls = await (await G('labels')).json();
        const ya = (ls.labels || []).find((l) => l.name === ETIQUETA_SEG);
        lid = ya ? ya.id : (await (await G('labels', { method: 'POST', body: JSON.stringify({ name: ETIQUETA_SEG, labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: '#ff7537', textColor: '#ffffff' } }) })).json()).id || null;
      } catch (e) {}
      await G('threads/' + s.hilo + '/modify', { method: 'POST', body: JSON.stringify({ addLabelIds: ['INBOX', 'UNREAD'].concat(lid ? [lid] : []) }) }).catch(() => {});
      const dias = Math.max(1, Math.round((Date.now() - s.desde) / 86400000));
      avisos.push({ title: 'Sin respuesta · ' + (s.para || acc.name), body: (s.asunto || '(sin asunto)') + '\nLo enviaste hace ' + dias + (dias === 1 ? ' día' : ' días') + ' y no ha contestado.', tag: 'seg-' + s.k + '-' + s.hilo, url: '/app?acc=' + encodeURIComponent(s.k) + '&hilo=' + encodeURIComponent(s.hilo) });
    } catch (e) {}
  }

  const envHechos = [];
  for (const e of pendEnv.slice(0, 10)) {
    const acc = todas[e.k]; if (!acc) { envHechos.push(e); continue; }
    try {
      const tk = await tok(e.k); if (!tk) continue;   // cuenta caída: se reintenta en la siguiente pasada
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/send', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.draft }) });
      if (r.status === 404 || r.status === 400) { envHechos.push(e); continue; }   // ya lo envió la app, o el borrador ya no existe
      if (!r.ok) continue;
      const m = await r.json().catch(() => ({}));
      envHechos.push(e);
      if (e.segVence && m.threadId) await updateSeg((seg) => { seg[e.k + '|' + m.threadId] = { k: e.k, hilo: m.threadId, vence: e.segVence, desde: Date.now(), asunto: e.asunto, para: e.para, puesto: Date.now() }; }).catch(() => {});
      avisos.push({ title: 'Enviado · ' + acc.name, body: (e.asunto || '(sin asunto)') + (e.para ? '\nA ' + e.para : ''), tag: 'env-' + e.k + '-' + e.draft, url: '/app?acc=' + encodeURIComponent(e.k) + (m.threadId ? '&hilo=' + encodeURIComponent(m.threadId) : '') });
    } catch (err) {}
  }
  if (envHechos.length) await updateEnv((env) => { envHechos.forEach((e) => { const c = e.k + '|' + e.draft, x = env[c]; if (x && x.puesto === e.puesto) delete env[c]; }); }).catch(() => {});
  // WhatsApp (Zernio): un aviso por conversación que haya recibido algo desde la última pasada. El punto es la fecha de
  // actividad más reciente vista (no el reloj de aquí), y la primera vez solo se apunta. Si el último mensaje es nuestro, no avisa.
  let wa = 0;
  if (hayMoviles && hayZernio()) {
    try {
      const x = await zernio('/inbox/conversations?' + new URLSearchParams({ platform: 'whatsapp', limit: '20' }));
      if (x.status === 200) {
        const convs = (x.body.data || []).filter((c) => c && c.id && c.accountId && Date.parse(c.updatedTime));
        const punto = Number(hist._wa) || 0, maxT = convs.reduce((m, c) => Math.max(m, Date.parse(c.updatedTime)), punto);
        if (punto) {
          for (const c of convs.filter((c) => Date.parse(c.updatedTime) > punto).slice(0, 5)) {
            const m = await zernio('/inbox/conversations/' + encodeURIComponent(c.id) + '/messages?' + new URLSearchParams({ accountId: c.accountId, limit: '1', sortOrder: 'desc' }));
            const u = ((m.body && m.body.messages) || [])[0];
            if (!u || u.direction === 'outgoing') continue;
            wa++;
            avisos.push({ title: 'WhatsApp · ' + nombreConv(c, crmFull.waNombres || {}).nombre, body: String(u.message || c.lastMessage || '(adjunto)').slice(0, 200), tag: 'wa-' + c.id, url: '/app?vista=MENSAJES' });
          }
        }
        if (maxT > punto) nuevosH._wa = maxT;
      }
    } catch (e) {}
  }
  if (Object.keys(nuevosH).length) await updateStore((n) => { Object.assign(n.hist, nuevosH); });
  // se borran solo los que se han mirado y no se han vuelto a poner mientras tanto
  if (segHechos.length) await updateSeg((seg) => { segHechos.forEach((s) => { const c = s.k + '|' + s.hilo, a = seg[c]; if (a && a.puesto === s.puesto) delete seg[c]; }); }).catch(() => {});
  // el número rojo del icono: correos de personas sin leer (Principal, último mes) en todas las cuentas
  if (avisos.length && hayMoviles) {
    const cuentas = await Promise.all(Object.keys(todas).map(async (k) => {
      try { const tk = await tok(k); if (!tk) return 0; const j = await (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=100&fields=threads/id&q=' + encodeURIComponent('in:inbox is:unread category:primary newer_than:30d'), { headers: { Authorization: 'Bearer ' + tk } })).json(); return (j.threads || []).length; } catch (e) { return 0; }
    }));
    const badge = cuentas.reduce((x, y) => x + y, 0);
    avisos.forEach((a) => { a.badge = badge; });
  }
  const enviados = [];
  if (hayMoviles) for (const a of avisos) enviados.push(await pushTodos(a));
  return res.status(200).json({ ok: true, avisos: avisos.length, entregas: enviados.flat().filter((c) => c >= 200 && c < 300).length, puntos: Object.keys(nuevosH).length, whatsapp: wa, seguimientos: segHechos.length, enviosServidor: envHechos.length, leads });
}
