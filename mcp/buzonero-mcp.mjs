#!/usr/bin/env node
// Buzonero Campillero · MCP
// Da a cualquier agente de IA (Claude Code, Cursor, Codex, Windsurf…) el control de TODAS tus cuentas de Gmail a la vez,
// con lo mismo que hace la app: buscar en todas, leer, borradores, enviar, reenviar, archivar, etiquetas con color,
// «Avísame si no contesta», paquetes, suscripciones y bajas, bloquear, filtros, firmas, contactos y basura parada.
// Un solo fichero, sin dependencias (Node 20+). Habla MCP por stdio.
// No guarda permisos de Google: pide a TU instalación de Buzonero un token de 1 hora con la clave del MCP.
// Configuración (variables de entorno):
//   BUZONERO_URL       la dirección de tu app, p. ej. https://mi-buzonero.vercel.app            (obligatoria)
//   BUZONERO_KEY       la clave del MCP (la de clave-mcp.txt), o bien
//   BUZONERO_KEY_FILE  la ruta de un fichero que la contiene (por defecto ~/.config/buzonero/mcp-key.txt)
// Normas: por defecto, BORRADORES. Enviar, darse de baja y bloquear exigen `confirmado: true`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';

const VERSION = '1.0.0';
const BASE = String(process.env.BUZONERO_URL || '').replace(/\/+$/, '');
const DIRECT_MAX = 25 * 1024 * 1024;
const DIA = 864e5;

function claveMcp() {
  if (process.env.BUZONERO_KEY) return process.env.BUZONERO_KEY.trim();
  const f = process.env.BUZONERO_KEY_FILE || path.join(os.homedir(), '.config', 'buzonero', 'mcp-key.txt');
  try { const k = fs.readFileSync(f, 'utf8').trim(); if (k) return k; } catch {}
  throw new Error('Falta la clave del MCP: pon BUZONERO_KEY o BUZONERO_KEY_FILE (ver INSTALAR.md, «Conectar un agente de IA»).');
}
function base() { if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(BASE)) throw new Error('Falta BUZONERO_URL (la dirección https de tu app de Buzonero).'); return BASE; }
const servidor = (ruta, o = {}) => fetch(base() + ruta, { ...o, headers: { Authorization: 'Bearer ' + claveMcp(), ...(o.headers || {}) } });

// ---------- cuentas ----------
let ACC = {};
async function cargarCuentas(forzar) {
  if (!forzar && Object.keys(ACC).length) return;
  const r = await servidor('/api/token?lista=1');
  if (r.status === 401 || r.status === 403) throw new Error('Tu Buzonero no acepta la clave del MCP (revisa MCP_KEY_HASH en Vercel y BUZONERO_KEY aquí).');
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !Array.isArray(j.cuentas)) throw new Error('No pude leer las cuentas de ' + BASE + ' (' + r.status + ').');
  ACC = {}; for (const c of j.cuentas) ACC[c.key] = { name: c.name, email: String(c.email).toLowerCase() };
}
// la cuenta se puede nombrar por su clave, su correo o su nombre (o un trozo que solo encaje con una)
function accKey(c) {
  const v = String(c || '').toLowerCase().trim();
  if (!v) throw new Error('Falta la cuenta.');
  if (ACC[v]) return v;
  const exacta = Object.keys(ACC).find((k) => ACC[k].email === v || ACC[k].name.toLowerCase() === v);
  if (exacta) return exacta;
  const parecidas = Object.keys(ACC).filter((k) => ACC[k].email.includes(v) || ACC[k].name.toLowerCase().includes(v));
  if (parecidas.length === 1) return parecidas[0];
  throw new Error('Cuenta desconocida o ambigua: «' + c + '». Hay: ' + Object.entries(ACC).map(([k, a]) => k + ' (' + a.name + ', ' + a.email + ')').join('; '));
}
const DOM_GRATIS = /^(gmail\.com|googlemail\.com|outlook\.[a-z.]+|hotmail\.[a-z.]+|live\.[a-z.]+|yahoo\.[a-z.]+|icloud\.com|me\.com|proton(mail)?\.[a-z.]+|gmx\.[a-z.]+)$/i;
const esMio = (e) => Object.values(ACC).some((a) => a.email === String(e).toLowerCase());
function esPropio(e) { const d = String(e).toLowerCase().split('@')[1] || ''; return Object.values(ACC).some((a) => { const da = a.email.split('@')[1] || ''; return da && !DOM_GRATIS.test(da) && (d === da || d.endsWith('.' + da)); }); }

// ---------- tokens y llamadas a Google ----------
const TOK = {};
async function token(k, force) {
  const t = TOK[k];
  if (!force && t && t.exp - Date.now() > 60000) return t.v;
  const r = await servidor('/api/token?acc=' + encodeURIComponent(k));
  const j = await r.json().catch(() => ({}));
  if (r.status === 409) throw new Error(`La cuenta ${ACC[k].name} está desconectada de Google: reconéctala desde la app (engranaje → Reconectar).`);
  if (!r.ok || !j.access_token) throw new Error('Buzonero no dio acceso a ' + ACC[k].name + ' (' + r.status + ').');
  TOK[k] = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}
async function api(k, url, opt = {}) {
  for (let i = 0; i < 3; i++) {
    const h = { Authorization: 'Bearer ' + await token(k, i === 1), ...(opt.headers || {}) };
    if (opt.json !== undefined) h['Content-Type'] = 'application/json';
    const r = await fetch(url, { method: opt.method || 'GET', headers: h, body: opt.json !== undefined ? JSON.stringify(opt.json) : opt.body });
    if (r.status === 401 && i === 0) continue;
    if ((r.status === 429 || r.status >= 500) && i < 2) { await new Promise((s) => setTimeout(s, 900 * (i + 1))); continue; }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e.error && e.error.message) || 'Error ' + r.status); }
    return r.status === 204 ? {} : r.json().catch(() => ({}));
  }
}
const gm = (k, p, o) => api(k, 'https://gmail.googleapis.com/gmail/v1/users/me/' + p, o);
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]).catch((e) => ({ _err: String(e.message || e) })); } })); return out; }
// todos los hilos de una búsqueda (con tope)
async function idsDe(k, q, tope = 100, labelIds) {
  const ids = []; let page = '';
  do {
    const p = new URLSearchParams({ maxResults: String(Math.min(100, tope - ids.length)) });
    if (q) p.set('q', q); (labelIds || []).forEach((l) => p.append('labelIds', l)); if (page) p.set('pageToken', page);
    const r = await gm(k, 'threads?' + p); (r.threads || []).forEach((t) => ids.push(t.id)); page = r.nextPageToken || '';
  } while (page && ids.length < tope);
  return ids;
}

// ---------- utilidades de correo ----------
const hdr = (p, n) => { n = n.toLowerCase(); for (const h of (p && p.headers) || []) if (h.name.toLowerCase() === n) return h.value; return ''; };
const b64u = (s) => Buffer.from(String(s || ''), 'base64url');
function decode(data, ct) { const m = /charset="?([^";]+)/i.exec(ct || ''); try { return new TextDecoder((m ? m[1] : 'utf-8').toLowerCase()).decode(b64u(data)); } catch { return b64u(data).toString('utf8'); } }
function htmlToText(h) { return String(h || '').replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim(); }
function walk(part, out) {
  if (!part) return; const mt = (part.mimeType || '').toLowerCase(), b = part.body || {};
  if (part.filename && (b.attachmentId || b.data)) out.atts.push({ nombre: part.filename, tipo: mt, tamano: b.size || 0, adjunto_id: b.attachmentId || null, datos: b.data || null, inline: /^inline/i.test(hdr(part, 'Content-Disposition')) });
  else if (mt === 'text/plain' && b.data) out.text = (out.text || '') + decode(b.data, hdr(part, 'Content-Type'));
  else if (mt === 'text/html' && b.data) out.html = (out.html || '') + decode(b.data, hdr(part, 'Content-Type'));
  (part.parts || []).forEach((p) => walk(p, out));
}
const encH = (s) => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?=';
const encName = (n) => { n = String(n || '').replace(/["\r\n]/g, ''); return /^[\x20-\x7e]*$/.test(n) ? '"' + n + '"' : encH(n); };
function splitAddrs(s) { return String(s || '').split(/[,;](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.trim()).filter(Boolean); }
function parseAddr(s) { const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s || ''); return m ? { name: m[1].trim(), email: m[2].trim() } : { name: '', email: String(s || '').trim() }; }
const correoDe = (s) => parseAddr(s).email.toLowerCase();
const encList = (s) => splitAddrs(s).map((x) => { const p = parseAddr(x); return p.name ? encName(p.name) + ' <' + p.email + '>' : p.email; }).join(', ');
const wrap76 = (b) => b.replace(/.{76}(?=.)/g, '$&\r\n');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sinCRLF = (s) => String(s || '').replace(/[\r\n]+/g, ' ');
const mimeOf = (f) => ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg' }[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream');
const fecha = (ms) => new Date(+ms).toISOString();

async function sendAs(k) { try { const r = await gm(k, 'settings/sendAs'); const p = (r.sendAs || []).find((s) => s.isPrimary) || {}; return { name: p.displayName || '', sig: p.signature || '', email: p.sendAsEmail || ACC[k].email }; } catch { return { name: '', sig: '', email: ACC[k].email }; } }

async function uploadDrive(k, file, people) {
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', { method: 'POST', headers: { Authorization: 'Bearer ' + await token(k), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeOf(file) }, body: JSON.stringify({ name: path.basename(file) }) });
  if (!init.ok) throw new Error('Drive no aceptó la subida de ' + path.basename(file));
  const put = await fetch(init.headers.get('Location'), { method: 'PUT', headers: { 'Content-Type': mimeOf(file) }, body: fs.readFileSync(file) });
  const f = await put.json(); if (!f.id) throw new Error('Drive no devolvió el archivo');
  await pool(people, 3, (email) => api(k, 'https://www.googleapis.com/drive/v3/files/' + f.id + '/permissions?sendNotificationEmail=false', { method: 'POST', json: { role: 'reader', type: 'user', emailAddress: email } }));
  return { nombre: path.basename(file), url: f.webViewLink || 'https://drive.google.com/file/d/' + f.id + '/view', tamano: fs.statSync(file).size };
}

// construye el mensaje: responder dentro de un hilo, reenviar uno (con sus adjuntos) y adjuntos del disco (>25 MB, por Drive al enviar)
async function buildMessage(k, a, opts = {}) {
  const me = await sendAs(k);
  let threadId = null, inReplyTo = '', refs = '', subject = a.asunto || '', cita = '', citaHtml = '';
  const enMemoria = [];
  if (a.responder_a_hilo) {
    const th = await gm(k, 'threads/' + a.responder_a_hilo + '?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Reply-To');
    const ms = (th.messages || []).filter((m) => !(m.labelIds || []).includes('DRAFT')), last = ms[ms.length - 1] || th.messages[th.messages.length - 1];
    threadId = th.id; inReplyTo = hdr(last.payload, 'Message-ID'); refs = hdr(last.payload, 'References');
    if (!subject) { subject = hdr(th.messages[0].payload, 'Subject'); if (!/^(re|rv|fw|fwd):/i.test(subject)) subject = 'Re: ' + subject; }
    if (!a.para) { const de = hdr(last.payload, 'Reply-To') || hdr(last.payload, 'From'); a.para = esMio(correoDe(de)) ? hdr(last.payload, 'To') : de; }
  }
  if (a.reenviar_hilo) {
    const th = await gm(k, 'threads/' + a.reenviar_hilo + '?format=full');
    const ms = (th.messages || []).filter((m) => !(m.labelIds || []).includes('DRAFT')), m = ms[ms.length - 1];
    if (!m) throw new Error('Ese hilo no tiene mensajes que reenviar.');
    const o = { atts: [] }; walk(m.payload, o);
    const orig = hdr(m.payload, 'Subject');
    if (!subject) subject = /^(fw|fwd|rv):/i.test(orig) ? orig : 'Fwd: ' + orig;
    cita = '\n\n---------- Mensaje reenviado ----------\nDe: ' + hdr(m.payload, 'From') + '\nFecha: ' + hdr(m.payload, 'Date') + '\nAsunto: ' + orig + '\nPara: ' + hdr(m.payload, 'To') + '\n\n' + (o.text || htmlToText(o.html));
    citaHtml = '<br><br><div class="gmail_quote">---------- Mensaje reenviado ----------<br>De: ' + esc(hdr(m.payload, 'From')) + '<br>Fecha: ' + esc(hdr(m.payload, 'Date')) + '<br>Asunto: ' + esc(orig) + '<br>Para: ' + esc(hdr(m.payload, 'To')) + '<br><br>' + (o.html ? o.html : esc(o.text || '').replace(/\n/g, '<br>')) + '</div>';
    if (a.sin_adjuntos !== true) for (const x of o.atts.filter((x) => !x.inline)) {
      const d = x.datos ? { data: x.datos } : await gm(k, 'messages/' + m.id + '/attachments/' + x.adjunto_id);
      enMemoria.push({ nombre: x.nombre, tipo: x.tipo || 'application/octet-stream', buf: b64u(d.data) });
    }
  }
  const files = (a.adjuntos || []).map((f) => path.resolve(String(f)));
  for (const f of files) if (!fs.existsSync(f)) throw new Error('No existe el archivo: ' + f);
  const sized = files.map((f) => ({ f, s: fs.statSync(f).size })).sort((x, y) => y.s - x.s);
  let total = sized.reduce((t, x) => t + x.s, 0) + enMemoria.reduce((t, x) => t + x.buf.length, 0); const toDrive = new Set();
  for (const x of sized) { if (total <= DIRECT_MAX) break; toDrive.add(x.f); total -= x.s; }
  if (total > DIRECT_MAX) throw new Error('Los adjuntos del correo reenviado pasan de 25 MB: reenvíalo con sin_adjuntos: true y comparte los archivos por Drive.');
  const links = [];
  if (toDrive.size && opts.uploadDrive) { const people = splitAddrs([a.para, a.cc, a.cco].filter(Boolean).join(',')).map((x) => parseAddr(x).email); for (const f of toDrive) links.push(await uploadDrive(k, f, people)); }
  const body = String(a.cuerpo || '');
  const text = body + (links.length ? '\n\n' + links.map((l) => l.nombre + ': ' + l.url).join('\n') : '') + (me.sig ? '\n\n-- \n' + htmlToText(me.sig) : '') + cita;
  const html = '<div dir="ltr">' + esc(body).replace(/\n/g, '<br>') + '</div>' + (links.length ? '<div style="margin:14px 0">' + links.map((l) => '<div><a href="' + esc(l.url) + '">' + esc(l.nombre) + '</a> (en Google Drive)</div>').join('') + '</div>' : '') + (me.sig ? '<br><div class="gmail_signature">' + me.sig + '</div>' : '') + citaHtml;
  const H = ['From: ' + (me.name ? encName(me.name) + ' <' + ACC[k].email + '>' : ACC[k].email)];
  if (a.para) H.push('To: ' + encList(sinCRLF(a.para))); if (a.cc) H.push('Cc: ' + encList(sinCRLF(a.cc))); if (a.cco) H.push('Bcc: ' + encList(sinCRLF(a.cco)));
  H.push('Subject: ' + encH(sinCRLF(subject)), 'MIME-Version: 1.0');
  if (inReplyTo) H.push('In-Reply-To: ' + inReplyTo, 'References: ' + ((refs ? refs + ' ' : '') + inReplyTo).trim());
  const alt = 'alt' + Date.now().toString(36), mix = 'mix' + Math.random().toString(36).slice(2);
  const altPart = ['Content-Type: multipart/alternative; boundary="' + alt + '"', '', '--' + alt, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(text).toString('base64')), '--' + alt, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(html).toString('base64')), '--' + alt + '--'].join('\r\n');
  const direct = files.filter((f) => !toDrive.has(f));
  const partes = direct.map((f) => ({ nombre: path.basename(f), tipo: mimeOf(f), buf: fs.readFileSync(f) })).concat(enMemoria);
  let raw;
  if (!partes.length) raw = H.join('\r\n') + '\r\n' + altPart;
  else {
    const parts = ['--' + mix, altPart];
    for (const p of partes) parts.push('--' + mix, 'Content-Type: ' + p.tipo + '; name="' + encH(p.nombre.replace(/"/g, '')) + '"', 'Content-Disposition: attachment; filename="' + encH(p.nombre.replace(/"/g, '')) + '"', 'Content-Transfer-Encoding: base64', '', wrap76(p.buf.toString('base64')));
    parts.push('--' + mix + '--');
    raw = H.join('\r\n') + '\r\nContent-Type: multipart/mixed; boundary="' + mix + '"\r\n\r\n' + parts.join('\r\n');
  }
  const msg = { raw: Buffer.from(raw).toString('base64url') }; if (threadId) msg.threadId = threadId;
  return { msg, resumen: { cuenta: ACC[k].name, de: ACC[k].email, para: a.para || '', cc: a.cc || '', cco: a.cco || '', asunto: subject, adjuntos: partes.map((p) => p.nombre), por_drive: [...toDrive].map((f) => path.basename(f)), hilo: threadId } };
}

// resumen de hilos (para listas)
async function resumenHilos(k, ids) {
  const th = await pool(ids, 6, (id) => gm(k, 'threads/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject'));
  return th.filter((t) => t && !t._err).map((t) => { const ms = t.messages || [], f = ms[0], l = ms[ms.length - 1]; const labels = new Set(ms.flatMap((m) => m.labelIds || []));
    return { cuenta: k, hilo_id: t.id, asunto: hdr(f.payload, 'Subject'), de: hdr(l.payload, 'From'), para: hdr(l.payload, 'To'), fecha: fecha(l.internalDate), mensajes: ms.length, sin_leer: labels.has('UNREAD'), destacado: labels.has('STARRED'), extracto: htmlToText(l.snippet), etiquetas: [...labels] }; });
}

// ---------- etiquetas con color (solo valen los colores de la paleta de Gmail) ----------
const COLORES = { azul: ['#4a86e8', '#ffffff'], verde: ['#16a766', '#ffffff'], rojo: ['#fb4c2f', '#ffffff'], naranja: ['#ffad47', '#000000'], morado: ['#a479e2', '#ffffff'], turquesa: ['#2da2bb', '#ffffff'], rosa: ['#e07798', '#ffffff'], amarillo: ['#fad165', '#000000'], violeta: ['#8e63ce', '#ffffff'], granate: ['#cc3a21', '#ffffff'], verde_oscuro: ['#0b804b', '#ffffff'], marron: ['#cf8933', '#ffffff'], marino: ['#285bac', '#ffffff'], menta: ['#43d692', '#000000'], malva: ['#b65775', '#ffffff'], coral: ['#ff7537', '#ffffff'], gris: ['#666666', '#ffffff'], rosa_claro: ['#f691b3', '#000000'] };
const nombreColor = (bg) => (Object.entries(COLORES).find(([, v]) => v[0] === String(bg || '').toLowerCase()) || [bg || null])[0];
function colorPedido(c) { const v = String(c || '').toLowerCase().trim().replace(/\s+/g, '_'); if (COLORES[v]) return COLORES[v]; const h = Object.values(COLORES).find((x) => x[0] === v); if (h) return h; throw new Error('Color no válido. Usa uno de: ' + Object.keys(COLORES).join(', ')); }
async function etiquetasDe(k) { return ((await gm(k, 'labels')).labels || []); }
function colorLibre(labs) { const usados = new Set(labs.map((l) => l.color && l.color.backgroundColor).filter(Boolean)); return Object.values(COLORES).find((c) => !usados.has(c[0])) || COLORES.azul; }
async function labelIds(k, names, create) {
  if (!names || !names.length) return [];
  const all = await etiquetasDe(k); const out = [];
  for (const n of names) {
    let L = all.find((l) => l.name.toLowerCase() === String(n).toLowerCase() || l.id === n);
    if (!L && create) { const c = colorLibre(all); L = await gm(k, 'labels', { method: 'POST', json: { name: n, labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: c[0], textColor: c[1] } } }); all.push(L); }
    if (!L) throw new Error('No existe la etiqueta «' + n + '».');
    out.push(L.id);
  }
  return out;
}
async function etiquetaBasura(k) { const all = await etiquetasDe(k); const L = all.find((l) => l.name === 'Basura filtrada'); if (L) return L.id; return (await gm(k, 'labels', { method: 'POST', json: { name: 'Basura filtrada', labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: '#666666', textColor: '#ffffff' } } })).id; }

// ---------- baja con un clic (RFC 8058), desde tu ordenador: solo https y nunca a direcciones internas ----------
function ipPrivada(ip) {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || /^(fc|fd|fe8|fe9|fea|feb|::ffff:)/.test(l); }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
async function bajaUnClic(url) {
  let u; try { u = new URL(url); } catch { return { ok: false, motivo: 'dirección no válida' }; }
  if (u.protocol !== 'https:' || u.username || u.password || net.isIP(u.hostname)) return { ok: false, motivo: 'dirección no permitida' };
  const ips = await dns.lookup(u.hostname, { all: true }).catch(() => []);
  if (!ips.length || ips.some((x) => ipPrivada(x.address))) return { ok: false, motivo: 'dirección no permitida' };
  try { const r = await fetch(u, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Buzonero' }, body: 'List-Unsubscribe=One-Click', signal: AbortSignal.timeout(8000) }); return { ok: r.status < 400, estado: r.status }; }
  catch { return { ok: false, motivo: 'la web no respondió' }; }
}

// ---------- «Avísame si no contesta»: igual que en la app (vence a una hora razonable, entre las 9 y las 20) ----------
function venceEn(dias) { const d = new Date(Date.now() + dias * DIA); if (d.getHours() < 9 || d.getHours() >= 20) d.setHours(9, 0, 0, 0); else d.setSeconds(0, 0); if (d.getTime() < Date.now() + 60000) d.setTime(Date.now() + dias * DIA); return d.getTime(); }

// ---------- paquetes ----------
const PAQ_Q = '-label:basura-filtrada -category:promotions -category:social -from:me (subject:(pedido OR envío OR envio OR enviado OR "en camino" OR entrega OR entregado OR reparto OR paquete OR seguimiento OR shipped OR delivered OR delivery OR "tu compra" OR "your order" OR recogida) OR from:(aliexpress OR amazon OR correos OR seur OR gls OR mrw OR dhl OR ups OR fedex OR inpost OR nacex OR ctt OR celeritas OR envialia OR zeleris OR cainiao OR shein OR temu OR zalando OR vinted OR wallapop OR miravia OR packlink))';
// las mismas reglas que la vista Paquetes de la app: el estado sale del último correo que habla de envío
const ESTADOS = [
  ['cancelado', /cancelad[oa]|cancelled|canceled|anulad[oa]/i],
  ['incidencia', /incidencia|no (?:hemos|se ha|hayamos) podido entregar|intento de entrega|ausente|retras|problema con (?:tu|el|su) (?:pedido|envío|paquete)|delivery (?:attempt|failed|exception)|devuelto al remitente/i],
  ['entregado', /entregad[oa]|delivered|ya (?:está|lo tienes) en tus manos|has recogido|recogid[oa] con éxito/i],
  ['hoy', /en reparto|out for delivery|llega hoy|lo recibirás hoy|se entregará hoy|arriving today|reparto de hoy/i],
  ['recoger', /listo para (?:recoger|su recogida|recogida)|disponible para (?:recoger|recogida)|ready for pick ?up|en (?:tu|el) (?:punto|locker|taquilla|citypaq)|punto de recogida|amazon locker/i],
  ['camino', /enviad[oa]|en camino|shipped|ha salido|en tránsito|in transit|despachad|expedid|on (?:its|the) way|preparado para (?:el )?envío|seguimiento de (?:tu|su) (?:pedido|envío)/i],
  ['devolucion', /reembolso|devolución|refund/i],
  ['pedido', /pedido (?:confirmado|realizado|recibido|n[ºo°.])|order (?:confirmed|placed|received)|gracias por (?:tu|su) (?:compra|pedido)|confirmación (?:de|del) (?:tu )?pedido|hemos recibido (?:tu|su) pedido|tu pedido/i],
];
const NO_PAQ = /eventbrite|ticketmaster|fever|dice\.fm|meetup|lu\.ma|holded|stripe|calendly|nexudus|linkedin|google|notion|booking|airbnb|renfe|ryanair|vueling|iberia/i;
const TIENDAS = /aliexpress|amazon|correos|seur|gls|mrw|dhl|ups\.com|fedex|inpost|nacex|ctt|celeritas|envialia|zeleris|cainiao|shein|temu|zalando|vinted|wallapop|miravia|packlink|decathlon|pccomponentes|mediamarkt|elcorteingles|ikea|leroymerlin|primor|druni|carrefour|lidl|zara|mango|nike|adidas|xiaomi|ebay|etsy|asos|uber|glovo|correosexpress|paack|spring|yodel|dpd/i;
const SEGUIMIENTO = /\b(1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|(?:LP|YT|UB|LX|SF)\d{10,18})\b/g;
const TRANSP = /correos|seur|gls|mrw|dhl|ups\.com|fedex|inpost|nacex|ctt|celeritas|envialia|zeleris|cainiao|paack|dpd/i;

// ---------- herramientas ----------
const CUENTA = { type: 'string', description: 'La cuenta: su clave, su correo o su nombre (la herramienta «cuentas» las lista).' };
const ACCIONES = { archivar: [[], ['INBOX']], recibidos: [['INBOX'], []], leido: [[], ['UNREAD']], no_leido: [['UNREAD'], []], destacar: [['STARRED'], []], quitar_destacado: [[], ['STARRED']], spam: [['SPAM'], ['INBOX']], no_spam: [['INBOX'], ['SPAM']], importante: [['IMPORTANT'], []], no_importante: [[], ['IMPORTANT']] };
const MENSAJE = { para: { type: 'string', description: 'Destinatarios separados por comas. Al responder, si se omite, va a quien escribió.' }, cc: { type: 'string' }, cco: { type: 'string' }, asunto: { type: 'string' }, cuerpo: { type: 'string', description: 'Texto del correo (la firma de la cuenta se añade sola).' }, adjuntos: { type: 'array', items: { type: 'string' }, description: 'Rutas de archivos del disco. Si pasan de 25 MB, los más grandes van como enlace de Drive.' }, responder_a_hilo: { type: 'string', description: 'id del hilo al que se responde (queda dentro de la conversación).' }, reenviar_hilo: { type: 'string', description: 'id del hilo cuyo último mensaje se reenvía, con sus adjuntos.' }, sin_adjuntos: { type: 'boolean', description: 'Al reenviar, no incluir los adjuntos del original.' } };
const T = (name, description, properties = {}, required = []) => ({ name, description, inputSchema: { type: 'object', properties, required } });
const TOOLS = [
  T('cuentas', 'Todas tus cuentas de correo: si están conectadas, cuántos hilos sin leer y cuántos en Recibidos.'),
  T('buscar_en_todas', 'Busca A LA VEZ en todas las cuentas con la sintaxis de Gmail (from:, to:, subject:, has:attachment, is:unread, newer_than:7d, label:…). Sin consulta, devuelve la bandeja unificada (lo último de Recibidos de todas). Ordenado por fecha.', { consulta: { type: 'string' }, max_por_cuenta: { type: 'number', description: '1-30, por defecto 10.' } }),
  T('buscar', 'Busca hilos en UNA cuenta con la sintaxis de Gmail. Sin consulta, lista Recibidos.', { cuenta: CUENTA, consulta: { type: 'string' }, max: { type: 'number', description: '1-50, por defecto 15.' } }, ['cuenta']),
  T('leer_hilo', 'Lee un hilo completo: remitentes, destinatarios, fechas, texto y adjuntos (con sus ids para descargarlos). No lo marca como leído salvo que se pida.', { cuenta: CUENTA, hilo_id: { type: 'string' }, marcar_leido: { type: 'boolean' } }, ['cuenta', 'hilo_id']),
  T('descargar_adjunto', 'Guarda un adjunto en el disco y devuelve la ruta (por defecto en Descargas/Buzonero).', { cuenta: CUENTA, mensaje_id: { type: 'string' }, adjunto_id: { type: 'string' }, nombre: { type: 'string' }, carpeta: { type: 'string' } }, ['cuenta', 'mensaje_id', 'adjunto_id', 'nombre']),
  T('crear_borrador', 'Crea un BORRADOR (no envía): lo que se usa por defecto. Sirve para escribir uno nuevo, responder dentro de un hilo o reenviar uno con sus adjuntos.', { cuenta: CUENTA, ...MENSAJE }, ['cuenta']),
  T('enviar', 'ENVÍA un correo (nuevo, respuesta o reenvío). Solo cuando el usuario lo ha pedido expresamente. Sin `confirmado: true` no envía: devuelve el resumen para enseñárselo.', { cuenta: CUENTA, ...MENSAJE, confirmado: { type: 'boolean' } }, ['cuenta', 'confirmado']),
  T('enviar_borrador', 'Envía un borrador que ya existe. Solo con `confirmado: true` y cuando el usuario lo ha pedido.', { cuenta: CUENTA, borrador_id: { type: 'string' }, confirmado: { type: 'boolean' } }, ['cuenta', 'borrador_id', 'confirmado']),
  T('listar_borradores', 'Lista los borradores de una cuenta.', { cuenta: CUENTA, max: { type: 'number' } }, ['cuenta']),
  T('borrar_borrador', 'Borra un borrador (no afecta a correos enviados).', { cuenta: CUENTA, borrador_id: { type: 'string' } }, ['cuenta', 'borrador_id']),
  T('modificar_hilos', 'Acciones sobre hilos, como en Gmail: archivar, recibidos (devolver a Recibidos), leido, no_leido, destacar, quitar_destacado, importante, no_importante, spam, no_spam, papelera, restaurar; y añadir o quitar etiquetas por nombre (si no existe, se crea con un color libre). Los hilos se dan por id o con una búsqueda (`consulta`, hasta 300).', { cuenta: CUENTA, hilos: { type: 'array', items: { type: 'string' } }, consulta: { type: 'string', description: 'En vez de ids: todos los hilos de esta búsqueda de Gmail.' }, accion: { type: 'string', enum: [...Object.keys(ACCIONES), 'papelera', 'restaurar'] }, etiquetas_anadir: { type: 'array', items: { type: 'string' } }, etiquetas_quitar: { type: 'array', items: { type: 'string' } } }, ['cuenta']),
  T('etiquetas', 'Lista las etiquetas propias de una cuenta, con su color y cuántos hilos sin leer tienen.', { cuenta: CUENTA }, ['cuenta']),
  T('crear_etiqueta', 'Crea una etiqueta con el color que elijas (si no, uno que no use ninguna otra). Admite subetiquetas con «/» (Clientes/Acme).', { cuenta: CUENTA, nombre: { type: 'string' }, color: { type: 'string', enum: Object.keys(COLORES) } }, ['cuenta', 'nombre']),
  T('color_etiqueta', 'Cambia el color de una etiqueta.', { cuenta: CUENTA, etiqueta: { type: 'string', description: 'Nombre o id.' }, color: { type: 'string', enum: Object.keys(COLORES) } }, ['cuenta', 'etiqueta', 'color']),
  T('avisame_si_no_contesta', '«Avísame si no contesta»: si en ese plazo nadie responde en el hilo, el hilo vuelve a Recibidos sin leer con la etiqueta «Sin respuesta» y llega un aviso al móvil.', { cuenta: CUENTA, hilo_id: { type: 'string' }, dias: { type: 'number', description: '1-60 (1 = mañana, 3, 7, 14…).' } }, ['cuenta', 'hilo_id', 'dias']),
  T('avisos_pendientes', 'Los «Avísame si no contesta» puestos en todas las cuentas y cuándo vence cada uno.'),
  T('quitar_aviso', 'Quita un «Avísame si no contesta».', { cuenta: CUENTA, hilo_id: { type: 'string' } }, ['cuenta', 'hilo_id']),
  T('paquetes', 'Pedidos y envíos de TODAS las cuentas (Amazon, Correos, SEUR, AliExpress, Shein…): tienda, estado aproximado (pedido, en camino, hoy, entregado, cancelado), número de seguimiento si aparece y el hilo.', { dias: { type: 'number', description: 'Cuántos días atrás (por defecto 30, máximo 120).' } }),
  T('suscripciones', 'Boletines y publicidad de los últimos 90 días agrupados por remitente: cuántos, cuántos sin abrir, y si admiten baja en un clic. Sirve para decidir de cuáles darse de baja.', { cuenta: { type: 'string', description: 'Opcional: solo esta cuenta (si no, todas).' } }),
  T('darse_de_baja', 'Se da de baja de un remitente (baja en un clic si la web la admite; nunca envía correos de baja) y crea un filtro para que lo que llegue después vaya a «Basura filtrada» sin pasar por Recibidos; lo que ya hay en Recibidos de ese remitente también se aparta. Sin `confirmado: true` solo dice lo que haría.', { cuenta: CUENTA, remitente: { type: 'string', description: 'Correo del remitente.' }, confirmado: { type: 'boolean' } }, ['cuenta', 'remitente', 'confirmado']),
  T('bloquear_remitente', 'Bloquea un remitente: filtro que manda todo lo suyo a la papelera, y lo que ya hay de él también. Sin `confirmado: true` solo dice lo que haría.', { cuenta: CUENTA, remitente: { type: 'string' }, confirmado: { type: 'boolean' } }, ['cuenta', 'remitente', 'confirmado']),
  T('filtros', 'Lista los filtros de Gmail de una cuenta, en palabras.', { cuenta: CUENTA }, ['cuenta']),
  T('crear_filtro', 'Crea un filtro de Gmail. Criterios: de, para, asunto, contiene, no_contiene, con_adjuntos. Acciones: archivar, marcar_leido, destacar, importante, nunca_spam, papelera, etiqueta (nombre; se crea si no existe).', { cuenta: CUENTA, de: { type: 'string' }, para: { type: 'string' }, asunto: { type: 'string' }, contiene: { type: 'string' }, no_contiene: { type: 'string' }, con_adjuntos: { type: 'boolean' }, archivar: { type: 'boolean' }, marcar_leido: { type: 'boolean' }, destacar: { type: 'boolean' }, importante: { type: 'boolean' }, nunca_spam: { type: 'boolean' }, papelera: { type: 'boolean' }, etiqueta: { type: 'string' } }, ['cuenta']),
  T('borrar_filtro', 'Borra un filtro de Gmail por su id (la herramienta «filtros» los lista).', { cuenta: CUENTA, filtro_id: { type: 'string' } }, ['cuenta', 'filtro_id']),
  T('firma', 'Muestra la firma de una cuenta (texto y HTML) y el nombre con el que envía.', { cuenta: CUENTA }, ['cuenta']),
  T('cambiar_firma', 'Cambia la firma de una cuenta. Texto con saltos de línea o HTML.', { cuenta: CUENTA, firma: { type: 'string' } }, ['cuenta', 'firma']),
  T('buscar_contacto', 'Busca un contacto por nombre o correo en los contactos y en la gente con la que te has escrito, en todas las cuentas: nombre, correos y teléfonos.', { consulta: { type: 'string' } }, ['consulta']),
  T('basura_parada', 'Cuánta publicidad y basura han parado tus filtros («Basura filtrada») en todas las cuentas, y de quién viene más.', { dias: { type: 'number', description: 'Por defecto 7.' } }),
];

const HANDLERS = {
  async cuentas() {
    return Promise.all(Object.entries(ACC).map(async ([k, a]) => {
      try { const l = await gm(k, 'labels/INBOX'); return { cuenta: k, nombre: a.name, email: a.email, conectada: true, sin_leer: l.threadsUnread, en_recibidos: l.threadsTotal }; }
      catch (e) { return { cuenta: k, nombre: a.name, email: a.email, conectada: false, error: String(e.message) }; }
    }));
  },
  async buscar_en_todas({ consulta, max_por_cuenta }) {
    const n = Math.min(Math.max(+max_por_cuenta || 10, 1), 30);
    const res = await pool(Object.keys(ACC), 4, async (k) => resumenHilos(k, await idsDe(k, consulta || '', n, consulta ? null : ['INBOX'])));
    const hilos = res.flatMap((r, i) => (r && r._err ? [] : r.map((h) => ({ ...h, cuenta: Object.keys(ACC)[i], nombre_cuenta: ACC[Object.keys(ACC)[i]].name })))).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const fallos = res.map((r, i) => (r && r._err ? Object.keys(ACC)[i] + ': ' + r._err : null)).filter(Boolean);
    return { consulta: consulta || '(Recibidos)', hilos, ...(fallos.length ? { fallos } : {}) };
  },
  async buscar({ cuenta, consulta, max }) {
    const k = accKey(cuenta);
    return { cuenta: ACC[k].name, hilos: await resumenHilos(k, await idsDe(k, consulta || '', Math.min(Math.max(+max || 15, 1), 50), consulta ? null : ['INBOX'])) };
  },
  async leer_hilo({ cuenta, hilo_id, marcar_leido }) {
    const k = accKey(cuenta); const t = await gm(k, 'threads/' + encodeURIComponent(hilo_id) + '?format=full');
    if (marcar_leido) await gm(k, 'threads/' + encodeURIComponent(hilo_id) + '/modify', { method: 'POST', json: { removeLabelIds: ['UNREAD'] } });
    return { cuenta: ACC[k].name, hilo_id, mensajes: (t.messages || []).map((m) => { const o = { atts: [] }; walk(m.payload, o);
      return { mensaje_id: m.id, de: hdr(m.payload, 'From'), para: hdr(m.payload, 'To'), cc: hdr(m.payload, 'Cc'), fecha: fecha(m.internalDate), asunto: hdr(m.payload, 'Subject'), etiquetas: m.labelIds, borrador: (m.labelIds || []).includes('DRAFT'), texto: (o.text || htmlToText(o.html)).slice(0, 20000), adjuntos: o.atts.filter((x) => !x.inline).map(({ datos, ...x }) => x) }; }) };
  },
  async descargar_adjunto({ cuenta, mensaje_id, adjunto_id, nombre, carpeta }) {
    const k = accKey(cuenta); const d = await gm(k, 'messages/' + encodeURIComponent(mensaje_id) + '/attachments/' + encodeURIComponent(adjunto_id));
    const dir = carpeta ? path.resolve(carpeta) : path.join(os.homedir(), 'Downloads', 'Buzonero'); fs.mkdirSync(dir, { recursive: true });
    let dest = path.join(dir, path.basename(String(nombre)).replace(/[<>:"|?*\x00-\x1f]/g, '_')); const ext = path.extname(dest), stem = dest.slice(0, dest.length - ext.length); let n = 1;
    while (fs.existsSync(dest)) dest = stem + ' (' + (n++) + ')' + ext;
    fs.writeFileSync(dest, b64u(d.data)); return { guardado_en: dest, bytes: fs.statSync(dest).size };
  },
  async crear_borrador(a) {
    const k = accKey(a.cuenta); const { msg, resumen } = await buildMessage(k, a, { uploadDrive: false });
    if (resumen.por_drive.length) resumen.aviso = 'Los adjuntos de más de 25 MB no caben en un borrador: con «enviar» se suben a Drive. En el borrador no van.';
    const d = await gm(k, 'drafts', { method: 'POST', json: { message: msg } });
    return { borrador_id: d.id, ...resumen, nota: 'Borrador creado: se ve en Gmail y en Buzonero. No se ha enviado.' };
  },
  async enviar(a) {
    const k = accKey(a.cuenta);
    if (a.confirmado !== true) { const { resumen } = await buildMessage(k, { ...a }, { uploadDrive: false }); return { enviado: false, motivo: 'Falta confirmado: true. Enséñale esto al usuario y envía solo si lo confirma.', ...resumen }; }
    if (!a.para && !a.cc && !a.cco && !a.responder_a_hilo) throw new Error('Falta el destinatario.');
    const { msg, resumen } = await buildMessage(k, a, { uploadDrive: true });
    const r = await gm(k, 'messages/send', { method: 'POST', json: msg });
    return { enviado: true, mensaje_id: r.id, hilo_id: r.threadId, ...resumen };
  },
  async enviar_borrador({ cuenta, borrador_id, confirmado }) {
    const k = accKey(cuenta);
    if (confirmado !== true) { const d = await gm(k, 'drafts/' + encodeURIComponent(borrador_id) + '?format=metadata'); const p = d.message.payload; return { enviado: false, motivo: 'Falta confirmado: true.', para: hdr(p, 'To'), asunto: hdr(p, 'Subject') }; }
    const r = await gm(k, 'drafts/send', { method: 'POST', json: { id: borrador_id } });
    return { enviado: true, mensaje_id: r.id, hilo_id: r.threadId, cuenta: ACC[k].name };
  },
  async listar_borradores({ cuenta, max }) {
    const k = accKey(cuenta); const r = await gm(k, 'drafts?maxResults=' + Math.min(+max || 20, 50));
    const ds = await pool(r.drafts || [], 5, (d) => gm(k, 'drafts/' + d.id + '?format=metadata'));
    return ds.filter((d) => d && !d._err).map((d) => ({ borrador_id: d.id, hilo_id: d.message.threadId, para: hdr(d.message.payload, 'To'), asunto: hdr(d.message.payload, 'Subject'), extracto: htmlToText(d.message.snippet) }));
  },
  async borrar_borrador({ cuenta, borrador_id }) { const k = accKey(cuenta); await gm(k, 'drafts/' + encodeURIComponent(borrador_id), { method: 'DELETE' }); return { borrado: true }; },
  async modificar_hilos({ cuenta, hilos, consulta, accion, etiquetas_anadir, etiquetas_quitar }) {
    const k = accKey(cuenta);
    if ((!hilos || !hilos.length) && consulta) hilos = await idsDe(k, consulta, 300);
    if (!hilos || !hilos.length) return { cuenta: ACC[k].name, hilos: 0, nota: 'Ningún hilo que cambiar.' };
    let res = [];
    if (accion === 'papelera' || accion === 'restaurar') res = await pool(hilos, 5, (id) => gm(k, 'threads/' + encodeURIComponent(id) + '/' + (accion === 'papelera' ? 'trash' : 'untrash'), { method: 'POST' }));
    else {
      let [add, rem] = accion ? (ACCIONES[accion] || (() => { throw new Error('Acción desconocida: ' + accion); })()) : [[], []];
      add = add.concat(await labelIds(k, etiquetas_anadir, true)); rem = rem.concat(await labelIds(k, etiquetas_quitar, false));
      if (accion === 'destacar') { res = await pool(hilos, 5, async (id) => { const t = await gm(k, 'threads/' + encodeURIComponent(id) + '?format=minimal'); return gm(k, 'messages/' + t.messages[t.messages.length - 1].id + '/modify', { method: 'POST', json: { addLabelIds: ['STARRED'] } }); }); add = add.filter((x) => x !== 'STARRED'); }
      if (add.length || rem.length) res = res.concat(await pool(hilos, 5, (id) => gm(k, 'threads/' + encodeURIComponent(id) + '/modify', { method: 'POST', json: { addLabelIds: add, removeLabelIds: rem } })));
    }
    return { cuenta: ACC[k].name, hilos: hilos.length, accion: accion || 'etiquetas', fallos: res.filter((x) => x && x._err).map((x) => x._err) };
  },
  async etiquetas({ cuenta }) {
    const k = accKey(cuenta); const propias = (await etiquetasDe(k)).filter((l) => l.type === 'user');
    const det = await pool(propias, 5, (l) => gm(k, 'labels/' + l.id));
    return propias.map((l, i) => ({ nombre: l.name, id: l.id, color: nombreColor(l.color && l.color.backgroundColor), sin_leer: (det[i] && det[i].threadsUnread) || 0, hilos: (det[i] && det[i].threadsTotal) || 0 }));
  },
  async crear_etiqueta({ cuenta, nombre, color }) {
    const k = accKey(cuenta); const all = await etiquetasDe(k);
    if (all.some((l) => l.name.toLowerCase() === String(nombre).toLowerCase())) throw new Error('Ya existe la etiqueta «' + nombre + '».');
    const c = color ? colorPedido(color) : colorLibre(all);
    const L = await gm(k, 'labels', { method: 'POST', json: { name: nombre, labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: c[0], textColor: c[1] } } });
    return { creada: true, nombre: L.name, id: L.id, color: nombreColor(c[0]) };
  },
  async color_etiqueta({ cuenta, etiqueta, color }) {
    const k = accKey(cuenta); const [id] = await labelIds(k, [etiqueta], false); const c = colorPedido(color);
    await gm(k, 'labels/' + id, { method: 'PATCH', json: { color: { backgroundColor: c[0], textColor: c[1] } } });
    return { etiqueta, color: nombreColor(c[0]) };
  },
  async avisame_si_no_contesta({ cuenta, hilo_id, dias }) {
    const k = accKey(cuenta); const d = Math.min(Math.max(Math.round(+dias || 3), 1), 60);
    const t = await gm(k, 'threads/' + encodeURIComponent(hilo_id) + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject');
    const ms = (t.messages || []).filter((m) => !(m.labelIds || []).includes('DRAFT')), last = ms[ms.length - 1];
    if (!last) throw new Error('Ese hilo no tiene mensajes.');
    const mio = esMio(correoDe(hdr(last.payload, 'From')));
    const cuerpo = { accion: 'poner', k, hilo: t.id, vence: venceEn(d), desde: mio ? Math.max(+last.internalDate, Date.now() - 60 * DIA) : Date.now(), asunto: hdr(ms[0].payload, 'Subject'), para: (mio ? splitAddrs(hdr(last.payload, 'To')).map((x) => parseAddr(x).name || parseAddr(x).email).join(', ') : parseAddr(hdr(last.payload, 'From')).name) || '' };
    const r = await servidor('/api/seguir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (!r.ok) throw new Error('Tu Buzonero no guardó el aviso (' + r.status + ').');
    return { puesto: true, cuenta: ACC[k].name, asunto: cuerpo.asunto, avisa: fecha(cuerpo.vence), si: 'nadie responde en el hilo antes de esa fecha' };
  },
  async avisos_pendientes() {
    const r = await servidor('/api/seguir'); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Tu Buzonero no devolvió los avisos (' + r.status + ').');
    return Object.values(j.seg || {}).sort((a, b) => a.vence - b.vence).map((s) => ({ cuenta: s.k, nombre_cuenta: (ACC[s.k] || {}).name, hilo_id: s.hilo, asunto: s.asunto, para: s.para, avisa: fecha(s.vence) }));
  },
  async quitar_aviso({ cuenta, hilo_id }) {
    const k = accKey(cuenta);
    const r = await servidor('/api/seguir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'quitar', k, hilo: hilo_id }) });
    if (!r.ok) throw new Error('Tu Buzonero no quitó el aviso (' + r.status + ').');
    return { quitado: true };
  },
  async paquetes({ dias }) {
    const n = Math.min(Math.max(+dias || 30, 1), 120);
    const res = await pool(Object.keys(ACC), 3, async (k) => {
      const ids = await idsDe(k, 'newer_than:' + n + 'd ' + PAQ_Q, 60);
      const th = await pool(ids, 5, (id) => gm(k, 'threads/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject'));
      const out = [];
      for (const t of th) {
        if (!t || t._err || !t.messages) continue;
        const ms = t.messages, todo = ms.map((m) => hdr(m.payload, 'Subject') + ' ' + htmlToText(m.snippet || '')).join(' ');
        for (let i = ms.length - 1; i >= 0; i--) {   // el estado lo da el correo más reciente que diga algo de envío
          const m = ms[i], from = hdr(m.payload, 'From'), subj = hdr(m.payload, 'Subject'), txt = subj + ' · ' + htmlToText(m.snippet || '');
          if (esMio(correoDe(from))) continue;
          const e = (ESTADOS.find(([, rx]) => rx.test(txt)) || [])[0]; if (!e) continue;
          if (e === 'cancelado' || NO_PAQ.test(from)) break;   // cancelado o no es una tienda
          // números solo de cifras: valen como seguimiento si escribe una empresa de transporte
          const trk = [...new Set([...(todo.match(SEGUIMIENTO) || []), ...(TRANSP.test(from) ? todo.match(/\b\d{10,22}\b/g) || [] : [])])].slice(0, 3);
          if (!TIENDAS.test(from) && !trk.length && (e === 'pedido' || e === 'devolucion' || !/pedido|env[ií]o|paquete|order|shipment|entrega/i.test(subj))) break;   // no parece un envío
          const de = parseAddr(from);
          out.push({ cuenta: k, hilo_id: t.id, tienda: de.name || de.email.split('@')[1], asunto: subj, estado: e, seguimiento: trk, ultima_noticia: fecha(m.internalDate), extracto: htmlToText(m.snippet).slice(0, 200) });
          break;
        }
      }
      return out;
    });
    // un mismo pedido manda varios correos (enviado, en reparto, entregado): se queda el más reciente de cada producto o seguimiento
    const visto = new Set();
    const lista = res.flatMap((r) => (r && r._err ? [] : r)).sort((a, b) => b.ultima_noticia.localeCompare(a.ultima_noticia)).filter((p) => {
      const prod = (/[“"«]([^”"»]{6,})[”"»]/.exec(p.asunto) || [])[1];
      const claves = [...p.seguimiento, prod && p.cuenta + '|' + prod.toLowerCase()].filter(Boolean);
      if (claves.some((c) => visto.has(c))) return false; claves.forEach((c) => visto.add(c)); return true;
    });
    return { dias: n, activos: lista.filter((p) => !['entregado', 'devolucion'].includes(p.estado)).length, paquetes: lista };
  },
  async suscripciones({ cuenta }) {
    const ks = cuenta ? [accKey(cuenta)] : Object.keys(ACC);
    const Q = 'in:inbox newer_than:90d (category:promotions OR unsubscribe OR "darse de baja" OR "darte de baja" OR "cancelar suscripción" OR "dejar de recibir" OR newsletter OR boletín)';
    const grupos = {};
    await pool(ks, 2, async (k) => {
      const ids = await idsDe(k, Q, 150);
      const th = await pool(ids, 5, (id) => gm(k, 'threads/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post'));
      for (const t of th) {
        if (!t || t._err) continue; const m = (t.messages || [])[0]; if (!m) continue;
        const baja = hdr(m.payload, 'List-Unsubscribe'); if (!baja) continue;
        const e = correoDe(hdr(m.payload, 'From')); if (!e || esMio(e) || esPropio(e)) continue;
        const g = grupos[k + '|' + e] || (grupos[k + '|' + e] = { cuenta: k, remitente: e, nombre: parseAddr(hdr(m.payload, 'From')).name, correos: 0, sin_abrir: 0, ultimo: 0, asunto: '', baja_un_clic: false, baja_solo_por_correo: false });
        g.correos++; if ((m.labelIds || []).includes('UNREAD')) g.sin_abrir++;
        if (+m.internalDate > g.ultimo) { g.ultimo = +m.internalDate; g.asunto = hdr(m.payload, 'Subject'); }
        if (/<https:/i.test(baja) && /one-click/i.test(hdr(m.payload, 'List-Unsubscribe-Post'))) g.baja_un_clic = true;
        else if (!/<https?:/i.test(baja) && /<mailto:/i.test(baja)) g.baja_solo_por_correo = true;
      }
    });
    const lista = Object.values(grupos).map((g) => ({ ...g, ultimo: fecha(g.ultimo), nunca_abiertos: g.correos >= 2 && g.sin_abrir / g.correos >= 0.8 })).sort((a, b) => b.correos - a.correos);
    return { remitentes: lista.length, suscripciones: lista, nota: 'Con «darse_de_baja» se da de baja en un clic (si la web lo admite) y se filtra lo que llegue después.' };
  },
  async darse_de_baja({ cuenta, remitente, confirmado }) {
    const k = accKey(cuenta), e = correoDe(remitente);
    if (!/^[^\s@]+@[^\s@]+$/.test(e)) throw new Error('Remitente no válido.');
    const ids = await idsDe(k, 'from:' + e, 1);
    let web = null, unClic = false;
    if (ids.length) { const t = await gm(k, 'threads/' + ids[0] + '?format=metadata&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post'); const m = t.messages[t.messages.length - 1]; web = ((hdr(m.payload, 'List-Unsubscribe').match(/<(https:[^>]+)>/i) || [])[1]) || null; unClic = !!web && /one-click/i.test(hdr(m.payload, 'List-Unsubscribe-Post')); }
    const enRecibidos = (await idsDe(k, 'in:inbox from:' + e, 300)).length;
    if (confirmado !== true) return { hecho: false, motivo: 'Falta confirmado: true.', haria: [unClic ? 'darse de baja en un clic en ' + new URL(web).hostname : 'no hay baja en un clic: solo se filtra', 'filtro: lo nuevo de ' + e + ' va a «Basura filtrada» sin pasar por Recibidos', 'apartar ' + enRecibidos + ' hilos que ya hay en Recibidos'] };
    const baja = unClic ? await bajaUnClic(web) : { ok: false, motivo: 'sin baja en un clic' };
    const lid = await etiquetaBasura(k);
    await gm(k, 'settings/filters', { method: 'POST', json: { criteria: { from: e }, action: { addLabelIds: [lid], removeLabelIds: ['INBOX', 'UNREAD'] } } }).catch((err) => { if (!/exist/i.test(err.message)) throw err; });
    const mover = await idsDe(k, 'in:inbox from:' + e, 300);
    await pool(mover, 5, (id) => gm(k, 'threads/' + id + '/modify', { method: 'POST', json: { addLabelIds: [lid], removeLabelIds: ['INBOX', 'UNREAD'] } }));
    return { hecho: true, remitente: e, baja: baja.ok ? 'hecha en la web' : 'no (' + (baja.motivo || 'la web respondió ' + baja.estado) + '): queda filtrado', filtro: 'creado', apartados: mover.length };
  },
  async bloquear_remitente({ cuenta, remitente, confirmado }) {
    const k = accKey(cuenta), e = correoDe(remitente);
    if (!/^[^\s@]+@[^\s@]+$/.test(e)) throw new Error('Remitente no válido.');
    const suyos = await idsDe(k, 'from:' + e + ' -in:trash', 300);
    if (confirmado !== true) return { hecho: false, motivo: 'Falta confirmado: true.', haria: ['filtro: todo lo de ' + e + ' a la papelera', 'mover a la papelera ' + suyos.length + ' hilos que ya hay'] };
    await gm(k, 'settings/filters', { method: 'POST', json: { criteria: { from: e }, action: { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX', 'UNREAD'] } } }).catch((err) => { if (!/exist/i.test(err.message)) throw err; });
    await pool(suyos, 5, (id) => gm(k, 'threads/' + id + '/trash', { method: 'POST' }));
    return { hecho: true, remitente: e, a_la_papelera: suyos.length };
  },
  async filtros({ cuenta }) {
    const k = accKey(cuenta); const [fs_, labs] = await Promise.all([gm(k, 'settings/filters'), etiquetasDe(k)]);
    const nom = (id) => (labs.find((l) => l.id === id) || {}).name || id;
    return (fs_.filter || []).map((f) => { const c = f.criteria || {}, a = f.action || {};
      return { filtro_id: f.id, si: Object.entries({ de: c.from, para: c.to, asunto: c.subject, contiene: c.query, no_contiene: c.negatedQuery, con_adjuntos: c.hasAttachment }).filter(([, v]) => v).map(([kk, v]) => kk + ': ' + v).join(' · '),
        entonces: [...(a.addLabelIds || []).map((x) => x === 'TRASH' ? 'a la papelera' : x === 'STARRED' ? 'destacar' : x === 'IMPORTANT' ? 'importante' : 'etiqueta «' + nom(x) + '»'), ...(a.removeLabelIds || []).map((x) => x === 'INBOX' ? 'saltar Recibidos' : x === 'UNREAD' ? 'marcar leído' : x === 'SPAM' ? 'nunca spam' : 'quitar «' + nom(x) + '»'), ...(a.forward ? ['reenviar a ' + a.forward] : [])].join(' · ') }; });
  },
  async crear_filtro(a) {
    const k = accKey(a.cuenta);
    const criteria = {}; if (a.de) criteria.from = a.de; if (a.para) criteria.to = a.para; if (a.asunto) criteria.subject = a.asunto; if (a.contiene) criteria.query = a.contiene; if (a.no_contiene) criteria.negatedQuery = a.no_contiene; if (a.con_adjuntos) criteria.hasAttachment = true;
    if (!Object.keys(criteria).length) throw new Error('Falta algún criterio (de, para, asunto, contiene…).');
    const add = [], rem = [];
    if (a.archivar) rem.push('INBOX'); if (a.marcar_leido) rem.push('UNREAD'); if (a.destacar) add.push('STARRED'); if (a.importante) add.push('IMPORTANT'); if (a.nunca_spam) rem.push('SPAM');
    if (a.papelera) { add.push('TRASH'); if (!rem.includes('INBOX')) rem.push('INBOX'); }
    if (a.etiqueta) add.push(...await labelIds(k, [a.etiqueta], true));
    if (!add.length && !rem.length) throw new Error('Falta alguna acción (archivar, marcar_leido, etiqueta…).');
    const f = await gm(k, 'settings/filters', { method: 'POST', json: { criteria, action: { addLabelIds: add, removeLabelIds: rem } } });
    return { creado: true, filtro_id: f.id };
  },
  async borrar_filtro({ cuenta, filtro_id }) { const k = accKey(cuenta); await gm(k, 'settings/filters/' + encodeURIComponent(filtro_id), { method: 'DELETE' }); return { borrado: true }; },
  async firma({ cuenta }) { const k = accKey(cuenta); const me = await sendAs(k); return { cuenta: ACC[k].name, nombre: me.name, texto: htmlToText(me.sig), html: me.sig }; },
  async cambiar_firma({ cuenta, firma }) {
    const k = accKey(cuenta); const me = await sendAs(k);
    const html = /<[a-z][\s\S]*>/i.test(firma) ? firma : esc(firma).replace(/\n/g, '<br>');
    await gm(k, 'settings/sendAs/' + encodeURIComponent(me.email), { method: 'PATCH', json: { signature: html } });
    return { cambiada: true, cuenta: ACC[k].name };
  },
  async buscar_contacto({ consulta }) {
    const q = encodeURIComponent(String(consulta || '').trim()); if (!q) throw new Error('Falta qué buscar.');
    const vistos = {}, out = [];
    await pool(Object.keys(ACC), 3, async (k) => {
      const P = (u) => api(k, 'https://people.googleapis.com/v1/' + u);
      await P('people:searchContacts?query=&readMask=names').catch(() => {});   // Google pide «calentar» la búsqueda
      const [c, o] = await Promise.all([P('people:searchContacts?query=' + q + '&readMask=names,emailAddresses,phoneNumbers,organizations&pageSize=10').catch(() => ({})), P('otherContacts:search?query=' + q + '&readMask=names,emailAddresses,phoneNumbers&pageSize=10').catch(() => ({}))]);
      for (const r of [...(c.results || []), ...(o.results || [])]) {
        const p = r.person || {}, correos = (p.emailAddresses || []).map((x) => x.value.toLowerCase()), clave = correos[0] || (p.names || [{}])[0].displayName;
        if (!clave || vistos[clave]) continue; vistos[clave] = 1;
        out.push({ nombre: ((p.names || [])[0] || {}).displayName || '', correos, telefonos: (p.phoneNumbers || []).map((x) => x.value), empresa: ((p.organizations || [])[0] || {}).name || '', en_cuenta: ACC[k].name });
      }
    });
    return out;
  },
  async basura_parada({ dias }) {
    const n = Math.min(Math.max(+dias || 7, 1), 90);
    const res = await pool(Object.keys(ACC), 3, async (k) => {
      const ids = await idsDe(k, 'label:basura-filtrada newer_than:' + n + 'd', 300);
      const muestra = await pool(ids.slice(0, 80), 5, (id) => gm(k, 'threads/' + id + '?format=metadata&metadataHeaders=From'));
      const por = {}; muestra.forEach((t) => { if (t && !t._err) { const e = correoDe(hdr(t.messages[0].payload, 'From')); por[e] = (por[e] || 0) + 1; } });
      return { cuenta: k, nombre: ACC[k].name, parados: ids.length, mas_frecuentes: Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e, c]) => e + ' (' + c + ')') };
    });
    const ok = res.filter((r) => r && !r._err);
    return { dias: n, total: ok.reduce((t, r) => t + r.parados, 0), cuentas: ok };
  },
};

// ---------- MCP por stdio (JSON-RPC 2.0, una línea por mensaje) ----------
function send(o) { process.stdout.write(JSON.stringify(o) + '\n'); }
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buf += chunk; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(line); } });
const INSTRUCCIONES = 'Correo de Gmail del usuario en varias cuentas a la vez (Buzonero Campillero). Usa «cuentas» para verlas y «buscar_en_todas» para mirar todas juntas. '
  + 'Por defecto deja BORRADORES; enviar, darse de baja y bloquear solo cuando el usuario lo pida, con confirmado: true. No escribas a nadie por iniciativa propia.';
async function handle(line) {
  let m; try { m = JSON.parse(line); } catch { return; }
  const { id, method, params } = m;
  if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'buzonero', version: VERSION }, instructions: INSTRUCCIONES } });
  if (method && method.startsWith('notifications/')) return;
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    const fn = HANDLERS[params && params.name];
    if (!fn) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Herramienta desconocida' } });
    try { await cargarCuentas(); const out = await fn({ ...((params && params.arguments) || {}) }); return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] } }); }
    catch (e) { return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Error: ' + String(e.message || e) }] } }); }
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Método no soportado: ' + method } });
}
