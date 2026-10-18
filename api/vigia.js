// El vigía: lo llama cada minuto un despertador externo (cron-job.org) con la clave VIGIA_KEY.
// Mira en el historial de Gmail de cada cuenta si ha entrado correo nuevo en Recibidos desde la última vez
// y, si lo hay, manda el aviso a los móviles suscritos. No guarda correos: solo el punto del historial de cada cuenta.
// También vigila los «Avísame si no contesta» (su propio fichero, readSeg): al vencer, si nadie ha respondido, avisa y devuelve el hilo a Recibidos.
import crypto from 'node:crypto';
import { allAccounts, accessToken, readStore, updateStore, readSeg, updateSeg, pushTodos, noStore } from './_lib.js';

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
  if (!hayMoviles && !vencidos.length) return res.status(200).json({ ok: true, sinMoviles: true });
  const todas = await allAccounts(), nuevosH = {}, avisos = [], hist = st0.hist || {};
  const tokens = {};
  const tok = async (k) => { if (!(k in tokens)) tokens[k] = await accessToken(k).catch(() => null); return tokens[k]; };
  if (hayMoviles) await Promise.all(Object.entries(todas).map(async ([k, acc]) => {
    try {
      const tk = await tok(k); if (!tk) return;
      const G = (u) => fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + u, { headers: { Authorization: 'Bearer ' + tk } });
      const desde = hist[k];
      if (!desde) { const p = await (await G('profile')).json(); if (p.historyId) nuevosH[k] = p.historyId; return; }   // primera vez: solo se apunta el punto
      const r = await G('history?historyTypes=messageAdded&labelId=INBOX&maxResults=100&startHistoryId=' + desde);
      if (r.status === 404) { const p = await (await G('profile')).json(); if (p.historyId) nuevosH[k] = p.historyId; return; }   // punto caducado: se reinicia
      const j = await r.json(); if (!r.ok) return;
      if (j.historyId && j.historyId !== desde) nuevosH[k] = j.historyId;
      const vistos = new Set(), msgs = [];
      (j.history || []).forEach((h) => (h.messagesAdded || []).forEach((x) => {
        const m = x.message, L = m.labelIds || [];
        if (vistos.has(m.id) || !L.includes('INBOX') || !L.includes('UNREAD') || L.includes('SENT') || L.includes('DRAFT') || L.includes('SPAM')) return;
        vistos.add(m.id); msgs.push(m);
      }));
      if (!msgs.length) return;
      const detalle = await Promise.all(msgs.slice(-MAX_POR_CUENTA).map((m) => G('messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe').then((x) => x.json()).catch(() => null)));
      detalle.filter(Boolean).forEach((m) => {
        const H = {}; ((m.payload && m.payload.headers) || []).forEach((h) => { H[h.name.toLowerCase()] = h.value; });
        if (esPropaganda(m.labelIds, H)) return;   // publicidad: entra, pero sin avisar
        if (nombre(H.from).toLowerCase() === acc.email.toLowerCase() || (H.from || '').toLowerCase().includes('<' + acc.email.toLowerCase() + '>')) return;   // lo que envía esa misma cuenta, no
        const snip = String(m.snippet || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        avisos.push({ title: nombre(H.from) + ' · ' + acc.name, body: (H.subject || '(sin asunto)') + (snip ? '\n' + snip.slice(0, 140) : ''), tag: k + '-' + m.threadId, url: '/app?acc=' + encodeURIComponent(k) + '&hilo=' + encodeURIComponent(m.threadId) });
      });
      if (msgs.length > MAX_POR_CUENTA) avisos.push({ title: acc.name, body: 'Y ' + (msgs.length - MAX_POR_CUENTA) + ' correos nuevos más', tag: k + '-resumen', url: '/app?acc=' + encodeURIComponent(k) });
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
  return res.status(200).json({ ok: true, avisos: avisos.length, entregas: enviados.flat().filter((c) => c >= 200 && c < 300).length, puntos: Object.keys(nuevosH).length, seguimientos: segHechos.length });
}
