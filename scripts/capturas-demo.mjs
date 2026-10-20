#!/usr/bin/env node
// Capturas para el README con DATOS INVENTADOS: carga la app real en un navegador y contesta en su lugar a /api y a Gmail
// con una persona ficticia (Lucía Marín, dominios .example). Ningún correo de verdad sale en las fotos.
// Uso: node scripts/capturas-demo.mjs https://tu-app.vercel.app docs/capturas      (necesita Playwright instalado)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import(process.env.PLAYWRIGHT_ESM || 'playwright')); }

const BASE = (process.argv[2] || '').replace(/\/+$/, ''), OUT = process.argv[3] || 'docs/capturas';
if (!/^https:\/\//.test(BASE)) { console.error('Uso: node scripts/capturas-demo.mjs https://tu-app.vercel.app [carpeta]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const b64u = (s) => Buffer.from(s, 'utf8').toString('base64url');
const AHORA = Date.now(), MIN = 60e3, H = 60 * MIN, D = 24 * H;

// ---------- la persona ficticia ----------
const CUENTAS = [
  { key: 'tr', email: 'lucia@estudio-nube.example', name: 'Estudio Nube', ini: 'EN', ancla: false },
  { key: 'pe', email: 'lucia.marin@example.com', name: 'Personal', ini: 'LM', ancla: true },
  { key: 'fr', email: 'hola@luciamarin.example', name: 'Freelance', ini: 'LF', ancla: false },
];
const ETQ = {
  tr: [['Label_1', 'Clientes', '#4a86e8'], ['Label_2', 'Facturas', '#16a766'], ['Label_3', 'Urgente', '#fb4c2f'], ['Label_4', 'Proveedores', '#a479e2']],
  pe: [['Label_1', 'Viajes', '#2da2bb'], ['Label_2', 'Casa', '#ffad47'], ['Label_3', 'Basura filtrada', '#666666']],
  fr: [['Label_1', 'Propuestas', '#8e63ce'], ['Label_2', 'Cobros', '#0b804b']],
};
const cuerpo = (saludo, parrafos, firma) => '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">' + saludo + '<br><br>' + parrafos.map((p) => p + '<br><br>').join('') + firma + '</div>';
let n = 0x18f3a2c400000;
const hilo = (k, de, asunto, extracto, haceMin, o = {}) => ({ k, id: (n += 0x1d3f7).toString(16), de, asunto, extracto, fecha: AHORA - haceMin * MIN, unread: !!o.unread, star: !!o.star, labels: o.labels || [], cat: o.cat || 'CATEGORY_PERSONAL', html: o.html || cuerpo('Hola Lucía:', [extracto], 'Un saludo,<br>' + de.split('<')[0].replace(/"/g, '').trim()), mensajes: o.mensajes || 1, unsub: o.unsub, adj: o.adj, sent: !!o.sent, para: o.para });
const HILOS = [
  hilo('tr', 'Marta Ibáñez <marta@cafeteria-alba.example>', 'Propuesta de identidad: revisión final', 'He revisado las tres opciones con el equipo y nos quedamos con la segunda. ¿Podemos cerrar los ajustes del logotipo el jueves?', 14, { unread: true, star: true, labels: ['Label_1'], mensajes: 3,
    html: cuerpo('Hola Lucía:', ['He revisado las tres opciones con el equipo y <b>nos quedamos con la segunda</b>: la tipografía redondeada encaja mucho mejor con la cafetería.', 'Nos gustaría cerrar los ajustes del logotipo el <b>jueves 23 de octubre a las 10:30</b>. Si te viene mejor por la tarde, dime y lo movemos.', 'Te dejo mi teléfono por si es más rápido: 612 345 678.'], 'Un abrazo,<br><b>Marta Ibáñez</b><br>Cafetería Alba') }),
  hilo('tr', 'Javier Soto <javier@imprenta-sur.example>', 'Presupuesto de impresión – catálogos', 'Te adjunto el presupuesto para 500 catálogos a color con acabado mate. El plazo de entrega es de 6 días laborables.', 75, { unread: true, labels: ['Label_4'], adj: 'presupuesto-catalogos.pdf' }),
  hilo('tr', 'Ana López <ana@estudio-nube.example>', 'Reunión de equipo del lunes', 'Os paso el orden del día: estado de los proyectos, vacaciones de diciembre y la nueva herramienta de facturas.', 3 * H / MIN, { labels: [], mensajes: 4 }),
  hilo('tr', 'Facturación Nube Hosting <facturas@nubehosting.example>', 'Tu factura de octubre ya está disponible', 'Importe: 24,20 €. La cargaremos en tu tarjeta terminada en 4821 el día 25.', 7 * H / MIN, { labels: ['Label_2'], cat: 'CATEGORY_UPDATES' }),
  hilo('tr', 'Pablo Serrano <pablo@agencia-faro.example>', 'Re: Campaña de Navidad', 'Perfecto, entonces lanzamos el 1 de diciembre. Te mando hoy los textos definitivos para las piezas.', 26 * H / MIN, { mensajes: 6, labels: ['Label_1', 'Label_3'] }),
  hilo('tr', 'Newsletter Diseño Hoy <boletin@disenohoy.example>', '10 tendencias de tipografía para 2027', 'Las variables, las serif con carácter y el regreso de las mayúsculas espaciadas: repasamos lo que viene.', 30 * H / MIN, { cat: 'CATEGORY_PROMOTIONS', unsub: true }),
  hilo('tr', 'Clara Vidal <clara@cliente-ondas.example>', 'Fotos para la web', 'Ya están subidas a la carpeta compartida. Son 48, en alta resolución. Cualquier cosa me dices.', 2 * D / MIN, { adj: 'fotos-web.zip' }),
  hilo('tr', 'Tienda Norte <pedidos@tiendanorte.example>', 'Tu pedido ha sido enviado: «Monitor 27" para estudio»', 'Tu pedido 40281 está en camino con Transportes Veloz. Número de seguimiento: TV123456789ES.', 3 * D / MIN, { cat: 'CATEGORY_UPDATES' }),
  hilo('pe', 'Carmen Marín <carmen.marin@example.com>', 'Comida del domingo 🍲', '¿Venís a comer el domingo? Hago arroz. Dile a Dani que traiga el postre, que la última vez se escaqueó.', 40, { unread: true, star: true }),
  hilo('pe', 'Viajes Brisa <reservas@viajesbrisa.example>', 'Confirmación de tu reserva: Lisboa, 14–17 nov', 'Localizador BRZ-58213. Vuelo de ida el viernes 14 a las 08:45. Hotel Rossio, 3 noches con desayuno.', 5 * H / MIN, { labels: ['Label_1'], cat: 'CATEGORY_UPDATES' }),
  hilo('pe', 'Comunidad de vecinos <admin@fincas-centro.example>', 'Junta ordinaria: miércoles 29 a las 19:00', 'Se tratará la reparación del ascensor y la renovación del seguro. Rogamos confirméis asistencia.', 20 * H / MIN, { labels: ['Label_2'] }),
  hilo('pe', 'Tienda Norte <pedidos@tiendanorte.example>', 'En reparto: «Lámpara de pie nórdica»', 'Tu paquete llega hoy entre las 10:00 y las 14:00. Puedes seguirlo con el número TV987654321ES.', 4 * H / MIN, { cat: 'CATEGORY_UPDATES', unread: true }),
  hilo('pe', 'Ofertas Mercado Ya <ofertas@mercadoya.example>', '¡Solo hoy! -40 % en toda la sección de hogar', 'No te lo pierdas: descuentos en textil, menaje y decoración hasta medianoche.', 9 * H / MIN, { cat: 'CATEGORY_PROMOTIONS', unsub: true }),
  hilo('pe', 'Dani García <dani.garcia@example.com>', 'Entradas del concierto', 'Ya tengo las entradas para el 6 de diciembre. Te las reenvío y me haces un Bizum cuando puedas.', 2 * D / MIN, { mensajes: 2 }),
  hilo('fr', 'Rocío Peña <rocio@bodega-pena.example>', 'Nueva etiqueta para el vino joven', 'Nos encantó lo que hiciste con el reserva. ¿Te animas con la etiqueta del joven? Te paso el briefing.', 55, { unread: true, labels: ['Label_1'] }),
  hilo('fr', 'Pagos Rápidos <avisos@pagosrapidos.example>', 'Has recibido 850,00 €', 'Bodega Peña te ha enviado un pago: «Factura 2026-031 · diseño etiqueta reserva».', 6 * H / MIN, { labels: ['Label_2'], cat: 'CATEGORY_UPDATES' }),
  hilo('fr', 'Lucía Marín <hola@luciamarin.example>', 'Propuesta: rediseño web Taller Oliva', 'Te adjunto la propuesta con las tres fases y el calendario. Quedo pendiente de tus comentarios.', 2 * D / MIN, { sent: true, para: 'Óscar Oliva <oscar@taller-oliva.example>', adj: 'propuesta-taller-oliva.pdf' }),
];
const PAQ = HILOS.filter((t) => /pedido|reparto/i.test(t.asunto));
const SUS = HILOS.filter((t) => t.unsub);


// ---------- WhatsApp (Zernio), CRM y Metricool de la persona ficticia ----------
const MARCAS_DEMO = [
  { id: '1001', nombre: 'Estudio Nube', redes: ['facebook', 'instagram', 'linkedin'], tz: 'Europe/Madrid' },
  { id: '1002', nombre: 'Taller Oliva', redes: ['facebook', 'instagram', 'tiktok'], tz: 'Europe/Madrid' },
];
const iso = (ms) => new Date(ms).toISOString();
const CONVS = [
  ['Marta Ibáñez', '+34600000101', '¿Tenéis hueco para una reunión el jueves por la tarde?', 22, false],
  ['', '+34611000202', 'Hola, ¿cuánto cuesta una mesa fija al mes?', 95, false],
  ['Javier Soto', '+34622000303', 'Perfecto, os mando el logotipo en vector hoy mismo.', 3 * 60, true],
  ['', '+447700900123', 'Hi! Do you have a meeting room for 8 people next Monday?', 5 * 60, false],
  ['Clara Vidal', '+34633000404', 'Gracias por la propuesta, la reviso con el equipo y os digo algo.', 26 * 60, true],
  ['', '+34644000505', 'Buenas, ¿abrís los sábados?', 30 * 60, false],
  ['Pablo Serrano', '+34655000606', 'Genial, quedamos entonces el martes a las 10:00.', 52 * 60, true],
].map(([nombre, tel, texto, haceMin, nuestro], i) => ({ id: 'conv' + i, accountId: 'wa1', platform: 'whatsapp', accountUsername: '+34 600 000 000', participantId: tel.replace('+', ''), participantName: nombre || tel.replace(/^\+(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})$/, '+$1 $2 $3 $4 $5') || tel, sinNombre: !nombre, telefono: tel,
  lastMessage: texto, updatedTime: iso(AHORA - haceMin * MIN), status: 'active', unreadCount: nuestro ? 0 : 1, participantPicture: '', _nuestro: nuestro }));
const MSGS = (c) => [
  { id: 'm1', direction: 'incoming', message: c._nuestro ? 'Hola, quería concretar lo que hablamos ayer.' : c.lastMessage, createdAt: iso(Date.parse(c.updatedTime) - (c._nuestro ? 40 : 0) * MIN) },
  ...(c._nuestro ? [{ id: 'm2', direction: 'outgoing', message: 'Claro, ahora te cuento. ¿Te viene bien por la tarde?', createdAt: iso(Date.parse(c.updatedTime) - 20 * MIN) }, { id: 'm3', direction: 'incoming', message: c.lastMessage, createdAt: c.updatedTime }] : []),
];
const lunesDe = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const cuando = (dias, h, m) => { const d = new Date(lunesDe(AHORA)); d.setDate(d.getDate() + dias); const z = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(h) + ':' + z(m) + ':00'; };
const POSTS = [
  [1, 10, 0, 'Abrimos plazas para el taller de identidad de marca de noviembre. Sitios limitados.', ['instagram', 'facebook'], 2],
  [2, 9, 30, 'Tres errores que vemos siempre al elegir la tipografía de una marca.', ['linkedin'], 0],
  [2, 9, 45, 'Detrás de las cámaras: así preparamos una sesión de fotos de producto.', ['instagram', 'tiktok'], 1],
  [3, 13, 0, 'Nuevo en el estudio: ya puedes reservar tu primera consultoría gratuita.', ['facebook', 'linkedin'], 0],
  [4, 18, 15, 'Cerramos la semana con el antes y el después de la web de Taller Oliva.', ['instagram'], 4],
  [5, 11, 0, 'Domingo de inspiración: nuestros 5 carteles favoritos del mes.', ['instagram', 'facebook'], 1],
].map(([dia, h, m, texto, redes, media], i) => ({ id: String(900 + i), texto, fecha: cuando(dia, h, m), borrador: false, redes: redes.map((red) => ({ red, estado: 'PENDING', url: '' })), media, enlace: '' }));
const INTEG_DEMO = { ok: true, zernio: { clave: true, whatsapp: 1 }, metricool: { conectado: true, modo: 'mcp', marcas: MARCAS_DEMO }, contactos: ['hola@luciamarin.example'], agenda: { n: 128, fotos: 34, fallos: [] } };
const LEADS_DEMO = [
  ['wa', 'Marta Ibáñez', 'marta@cafeteria-alba.example', '+34600000101', 'WhatsApp', '¿Tenéis hueco para una reunión el jueves por la tarde?', 'Nuevo', 22, 'tuyo', 'WhatsApp'],
  ['wa', '+34 611 00 02 02', '', '+34611000202', 'WhatsApp', 'Hola, ¿cuánto cuesta una mesa fija al mes?', 'Nuevo', 95, 'tuyo', 'WhatsApp'],
  ['tr', 'Rocío Peña', 'rocio@bodega-pena.example', '+34 677 000 707', 'Nueva etiqueta para el vino joven', 'Nos encantó lo que hiciste con el reserva. ¿Te animas con la etiqueta del joven?', 'Nuevo', 6 * 60, 'tuyo', 'formulario'],
  ['wa', 'Javier Soto', '', '+34622000303', 'WhatsApp', 'Perfecto, os mando el logotipo en vector hoy mismo.', 'Respondido', 3 * 60, 'suyo', 'WhatsApp'],
  ['tr', 'Clara Vidal', 'clara@cliente-ondas.example', '', 'Fotos para la web', 'Ya están subidas a la carpeta compartida. Son 48, en alta resolución.', 'Respondido', 2 * 24 * 60, 'suyo', 'correo'],
  ['tr', 'Pablo Serrano', 'pablo@agencia-faro.example', '', 'Presupuesto de campaña', 'Te adjunto el briefing y el presupuesto de la campaña de Navidad.', 'Propuesta', 3 * 24 * 60, 'suyo', 'correo'],
  ['wa', 'Carmen Marín', '', '+34655000606', 'WhatsApp', 'Genial, quedamos entonces el martes a las 10:00.', 'Reserva', 52 * 60, 'suyo', 'WhatsApp'],
  ['tr', 'Taller Oliva', 'hola@taller-oliva.example', '', 'Rediseño web: primera fase', 'Pago recibido de la primera fase. ¡Gracias!', 'Ganado', 5 * 24 * 60, 'suyo', 'correo'],
].map(([k, nombre, email, tel, asunto, mensaje, etapa, haceMin, turno, origen], i) => ({ k, nombre, email, telefono: tel, empresa: '', asunto, mensaje, origen, etapa, fecha: AHORA - haceMin * MIN, hilo: 'l' + i, ids: ['l' + i], turno, ultimo: AHORA - haceMin * MIN, ...(k === 'wa' ? { canal: 'whatsapp', cuenta: 'wa1' } : {}) }));
const CRM_DEMO = { ok: true, crms: { c1: { id: 'c1', nombre: 'Estudio Nube', cuentas: ['tr', 'pe', 'fr'], etapas: ['Nuevo', 'Respondido', 'Propuesta', 'Reserva', 'Ganado', 'Perdido'], deteccion: { activa: true, directo: false, palabras: [], frasesBot: [], formularios: [] }, integOcultas: [] } }, integ: { c1: { zr: { cuentas: ['Estudio Nube'], conectado: new Date().toISOString() } } } };

// ---------- respuestas de Gmail ----------
const yo = (k) => CUENTAS.find((c) => c.key === k);
function mensaje(t, i, total, full) {
  const ultimo = i === total - 1, fecha = t.fecha - (total - 1 - i) * 3 * H;
  const de = (t.sent || (!ultimo && i % 2 === 1)) ? yo(t.k).name === 'Freelance' ? 'Lucía Marín <hola@luciamarin.example>' : 'Lucía Marín <' + yo(t.k).email + '>' : t.de;
  const headers = [['From', de], ['To', t.sent ? t.para : 'Lucía Marín <' + yo(t.k).email + '>'], ['Subject', (i ? 'Re: ' : '') + t.asunto], ['Date', new Date(fecha).toUTCString()], ['Message-ID', '<' + t.id + i + '@demo.example>']];
  if (t.unsub) headers.push(['List-Unsubscribe', '<https://' + t.de.split('@')[1].replace('>', '') + '/baja>'], ['List-Unsubscribe-Post', 'List-Unsubscribe=One-Click']);
  const labelIds = ['INBOX', t.cat].concat(ultimo && t.unread ? ['UNREAD'] : [], ultimo && t.star ? ['STARRED'] : [], t.labels, t.sent ? ['SENT'] : []);
  const html = ultimo ? t.html : cuerpo('Hola:', ['Gracias, lo vemos así.'], 'Un saludo');
  const payload = { mimeType: t.adj && full ? 'multipart/mixed' : 'text/html', headers: headers.map(([name, value]) => ({ name, value })) };
  if (full) {
    if (t.adj && ultimo) payload.parts = [{ mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=UTF-8' }], body: { data: b64u(html), size: html.length } }, { mimeType: 'application/pdf', filename: t.adj, headers: [{ name: 'Content-Disposition', value: 'attachment' }], body: { attachmentId: 'adj' + t.id, size: 1843200 } }];
    else payload.body = { data: b64u(html), size: html.length };
  } else if (t.adj && ultimo) payload.mimeType = 'multipart/mixed';
  return { id: t.id + (ultimo ? '' : 'a' + i), threadId: t.id, labelIds, snippet: ultimo ? t.extracto : 'Gracias, lo vemos así.', internalDate: String(fecha), historyId: '9000', payload };
}
const hiloDe = (t, full) => ({ id: t.id, historyId: '9000', messages: Array.from({ length: t.mensajes }, (_, i) => mensaje(t, i, t.mensajes, full)) });
function lista(k, u) {
  const q = (u.searchParams.get('q') || '').toLowerCase(), labs = u.searchParams.getAll('labelIds');
  let hs = HILOS.filter((t) => t.k === k);
  if (/newer_than:45d/.test(q)) hs = PAQ.filter((t) => t.k === k);
  else if (/unsubscribe|newsletter/.test(q)) hs = SUS.filter((t) => t.k === k);
  else if (/basura-filtrada/.test(q)) hs = [];
  else {
    if (labs.includes('SENT')) hs = hs.filter((t) => t.sent); else if (labs.includes('INBOX')) hs = hs.filter((t) => !t.sent);
    const cat = labs.find((l) => l.startsWith('CATEGORY_')); if (cat) hs = hs.filter((t) => t.cat === cat);
    const ul = labs.find((l) => l.startsWith('Label_')); if (ul) hs = hs.filter((t) => t.labels.includes(ul));
    if (labs.includes('STARRED')) hs = hs.filter((t) => t.star);
    if (/is:unread/.test(q)) hs = hs.filter((t) => t.unread);
    const libre = q.replace(/\b[\w-]+:\S+/g, '').trim(); if (libre) hs = hs.filter((t) => (t.asunto + ' ' + t.extracto + ' ' + t.de).toLowerCase().includes(libre));
  }
  hs.sort((a, b) => b.fecha - a.fecha);
  return { threads: hs.map((t) => ({ id: t.id, historyId: '9000', snippet: t.extracto })), resultSizeEstimate: hs.length };
}
function gmail(k, ruta, u) {
  if (ruta === 'profile') return { emailAddress: yo(k).email, historyId: '9000' };
  if (ruta === 'labels') return { labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }].concat(ETQ[k].map(([id, name, bg]) => ({ id, name, type: 'user', labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: bg, textColor: '#ffffff' } }))) };
  if (ruta.startsWith('labels/')) {
    const id = ruta.slice(7), mias = HILOS.filter((t) => t.k === k && !t.sent);
    const del = id === 'INBOX' ? mias : id.startsWith('CATEGORY_') ? mias.filter((t) => t.cat === id) : mias.filter((t) => t.labels.includes(id));
    return { id, threadsTotal: id === 'DRAFT' ? 0 : del.length, threadsUnread: del.filter((t) => t.unread).length, messagesTotal: 0, messagesUnread: del.filter((t) => t.unread).length };
  }
  if (ruta === 'settings/sendAs') return { sendAs: [{ sendAsEmail: yo(k).email, isPrimary: true, displayName: 'Lucía Marín', signature: 'Lucía Marín<br>' + yo(k).name }] };
  if (ruta === 'threads') return lista(k, u);
  if (ruta.startsWith('threads/')) { const t = HILOS.find((x) => x.id === ruta.split('/')[1]); return t ? hiloDe(t, u.searchParams.get('format') === 'full') : null; }
  if (ruta.startsWith('drafts')) return { drafts: [] };
  if (ruta.startsWith('history')) return { historyId: '9000' };
  if (ruta.startsWith('settings/filters')) return { filter: [] };
  return {};
}

// ---------- el navegador ----------
const b = await chromium.launch();
async function pagina(opt, tema) {
  const c = await b.newContext(opt);
  await c.addInitScript((t) => { try { localStorage.clear(); if (t) localStorage.setItem('buzonero-tema', t); localStorage.setItem('buzonero-avisos', 'no'); } catch (e) {} }, tema || 'light');
  await c.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin === BASE && u.pathname === '/api/session') return r.fulfill({ json: { ok: true, accounts: CUENTAS.map((x) => ({ key: x.key, email: x.email, name: x.name, ini: x.ini, extra: false, ancla: x.ancla, foto: null, caida: null })), vapid: null, version: '' } });
    if (u.origin === BASE && u.pathname === '/api/token') return r.fulfill({ json: { access_token: 'demo-' + u.searchParams.get('acc'), expires_in: 3600 } });   // el token dice de qué cuenta es
    if (u.origin === BASE && u.pathname === '/api/zernio') {
      const q = u.searchParams.get('r');
      if (q === 'integraciones') return r.fulfill({ json: INTEG_DEMO });
      if (q === 'estado') return r.fulfill({ json: { ok: true, cuentas: [{ id: 'wa1', plataforma: 'whatsapp', nombre: 'Estudio Nube', usuario: '+34 600 000 000' }], contactos: INTEG_DEMO.contactos, agenda: INTEG_DEMO.agenda } });
      if (q === 'conversaciones') return r.fulfill({ json: { ok: true, conversaciones: CONVS, pagina: null } });
      if (q === 'mensajes') { const c = CONVS.find((x) => x.id === u.searchParams.get('id')) || CONVS[0]; return r.fulfill({ json: { ok: true, mensajes: MSGS(c) } }); }
      if (q === 'mc-posts') return r.fulfill({ json: { ok: true, posts: POSTS } });
      return r.fulfill({ json: { ok: true } });
    }
    if (u.origin === BASE && u.pathname === '/api/crm') {
      if (u.searchParams.get('r') === 'leads') return r.fulfill({ json: { ok: true, leads: LEADS_DEMO, clientes: [], bots: 0, fallos: [] } });
      if (u.searchParams.get('r') === 'clientes') return r.fulfill({ json: { ok: true, leads: [], clientes: [], bots: 0, fallos: [] } });
      return r.fulfill({ json: CRM_DEMO });
    }
    if (u.origin === BASE && u.pathname.startsWith('/api/')) return r.fulfill({ json: { ok: true, seg: {} } });
    if (u.hostname === 'gmail.googleapis.com') {
      const k = (r.request().headers().authorization || '').replace('Bearer demo-', '');
      const ruta = u.pathname.replace('/gmail/v1/users/me/', '');
      const j = gmail(k, ruta, u); return j ? r.fulfill({ json: j }) : r.fulfill({ status: 404, json: { error: { message: 'no' } } });
    }
    if (/people\.googleapis\.com|www\.googleapis\.com\/drive|t\d\.gstatic\.com\/faviconV2/.test(u.href)) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  const p = await c.newPage();
  return { c, p };
}
async function preparar(p) {
  await p.goto(BASE + '/app'); await p.waitForSelector('.rw .open', { timeout: 30000 });
  await sleep(1500);
}
const shots = [];
async function foto(p, nombre, opt) { const f = path.join(OUT, nombre); await p.screenshot({ path: f, ...(opt || {}) }); shots.push(f); }

// 1) PC, oscuro, con un correo abierto
{ const { c, p } = await pagina({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, 'dark');
  await preparar(p); await p.evaluate(() => KEYS.forEach((k) => loadAccountMeta(k).then(() => { drawTabs(); drawSide(); }))); await sleep(1500);
  await p.locator('.rw .open').first().click(); await p.waitForSelector('.read-bar'); await sleep(2500);
  await foto(p, 'app-oscuro.png');
  // 2) el mismo, en claro y con la portada vacía (el sobre de partículas)
  await p.evaluate(() => aplicarPaleta('claro')); await p.keyboard.press('Escape'); await p.evaluate(() => { cur = null; drawEmptyRead && drawEmptyRead(); }); await sleep(2500);
  await foto(p, 'app-claro.png');
  // 3) temas
  await p.evaluate(() => aplicarPaleta('neon')); await sleep(800); await p.locator('.rw .open').nth(1).click(); await sleep(2200); await foto(p, 'tema-neon.png');
  await p.evaluate(() => aplicarPaleta('papel')); await sleep(1500); await foto(p, 'tema-papel.png');
  await p.evaluate(() => { aplicarPaleta('oscuro'); abrirTemas(); }); await sleep(2500); await foto(p, 'temas.png');
  await c.close(); }
// 4b) WhatsApp, CRM, Integraciones y Redes sociales (PC, claro, con el movimiento reducido para ver la figura ya formada)
{ const { c, p } = await pagina({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' }, 'light');
  await preparar(p); await sleep(2500);
  const ir = async (carpeta) => { await p.evaluate((f) => { const b = document.querySelector('#folders [data-f="' + f + '"]'); if (b) b.click(); }, carpeta); await sleep(2800); };
  await ir('MENSAJES'); await foto(p, 'whatsapp-vacio.png');
  await p.locator('.men-it').first().click(); await sleep(1800); await foto(p, 'whatsapp.png');
  await p.evaluate(() => abrirVistaCrm('tablero')); await sleep(3500); await foto(p, 'crm-whatsapp.png');
  await p.evaluate(() => cerrarVistaCrm && cerrarVistaCrm()); await sleep(600);
  await ir('INTEGRACIONES'); await foto(p, 'integraciones.png');
  await ir('REDES'); await sleep(1500); await foto(p, 'redes-calendario.png');
  await c.close(); }
// 4) móvil
{ const { c, p } = await pagina({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 'dark');
  await preparar(p); await sleep(1500); await foto(p, 'movil-lista.png');
  await p.locator('.rw .open').first().click(); await sleep(2500); await foto(p, 'movil-correo.png');
  await c.close(); }
await b.close();
console.log(shots.join('\n'));
