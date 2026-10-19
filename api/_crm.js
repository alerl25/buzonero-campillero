// Detección de leads del CRM. La usan el vigía (cada minuto, con el correo nuevo) y /api/crm («Buscar leads de los últimos 30 días»).
// Un lead es un hilo de Gmail con la etiqueta de su etapa («Leads/Nuevo», «Leads/Respondido»…): la etapa vive en Gmail,
// se ve también desde Gmail y no hace falta base de datos. Aquí no se guarda ningún correo.
import crypto from 'node:crypto';

export const PREFIJO = 'Leads';
export const ETIQUETA_BOT = 'Posible bot';
export const ETIQUETA_NOLEAD = 'No es lead';   // lo que se aparta a mano del tablero (propuestas de colaboración, proveedores…)
export const ETAPAS_DEF = ['Nuevo', 'Respondido', 'Propuesta', 'Reserva', 'Ganado', 'Perdido'];
export const PALABRAS_DEF = ['presupuesto', 'precio', 'tarifa', 'información', 'reserva', 'disponibilidad', 'alquiler', 'contratar', 'visita', 'quote', 'pricing', 'booking', 'availability'];
export const etiquetaEtapa = (nombre) => PREFIJO + '/' + nombre;

const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const lista = (v, max, n) => (Array.isArray(v) ? v : String(v || '').split(/[\n,]/)).map((x) => txt(x, n)).filter(Boolean).slice(0, max);

// Valida lo que llega de la app. Lanza un Error con el motivo si algo no vale.
export function limpiarCrm(c, todas) {
  c = c || {};
  const nombre = txt(c.nombre, 40);
  if (!nombre) throw new Error('nombre');
  const cuentas = [...new Set((Array.isArray(c.cuentas) ? c.cuentas : []).map(String))].filter((k) => todas[k]);
  if (!cuentas.length) throw new Error('cuentas');
  const etapas = [...new Set(lista(c.etapas, 10, 30).map((e) => e.replace(/\//g, '-')))].filter((e) => e !== ETIQUETA_BOT);
  if (etapas.length < 2) throw new Error('etapas');
  const d = c.deteccion || {};
  const formularios = (Array.isArray(d.formularios) ? d.formularios : []).map((r) => ({ de: txt(r && r.de, 80), asunto: txt(r && r.asunto, 80) })).filter((r) => r.de || r.asunto).slice(0, 10);
  const id = /^c[0-9a-f]{8}$/.test(c.id || '') ? c.id : 'c' + crypto.randomBytes(4).toString('hex');
  return {
    id, nombre, cuentas, etapas, integOcultas: (Array.isArray(c.integOcultas) ? c.integOcultas : []).filter((x) => ['ga', 'gbp', 'wa', 'nx'].includes(x)),
    deteccion: { activa: !!d.activa, formularios, directo: !!d.directo, palabras: lista(d.palabras, 40, 30), frasesBot: lista(d.frasesBot, 40, 200) },
  };
}
// El CRM al que pertenece una cuenta (una cuenta solo puede estar en uno)
export function crmDeCuenta(crms, k) { return Object.values(crms || {}).find((c) => (c.cuentas || []).includes(k)) || null; }

// ---------- leer el correo de un formulario ----------
// Texto plano de un mensaje (format=full): el text/plain si lo hay; si no, el HTML sin etiquetas.
export function textoDe(payload) {
  let plano = '', html = '';
  const walk = (p) => {
    if (!p) return;
    const mt = String(p.mimeType || '').toLowerCase(), d = p.body && p.body.data;
    if (d && mt === 'text/plain' && !plano) plano = Buffer.from(d, 'base64url').toString('utf8');
    else if (d && mt === 'text/html' && !html) html = Buffer.from(d, 'base64url').toString('utf8');
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  if (plano) return plano;
  return html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<(br|\/p|\/div|\/tr|\/td|\/th|\/li|\/h\d)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
// Rótulos habituales de los formularios (WordPress, Elementor, Webflow, Wix, Typeform…), en español, inglés y francés
const CAMPOS = [
  ['nombre', /^(nombre( y apellidos?| completo)?|apellidos?|name|full name|your name|first name|nom|nom complet|pr[eé]nom)$/i],
  ['email', /^(e-?mail|correo( electr[oó]nico)?|email address|your email|adresse e-?mail|courriel)$/i],
  ['telefono', /^(tel[eé]fono|m[oó]vil|phone( number)?|telephone|t[eé]l[eé]phone|whatsapp)$/i],
  ['empresa', /^(empresa|compa[ñn][ií]a|company|organizaci[oó]n|organi[sz]ation|soci[eé]t[eé]|entreprise)$/i],
  ['asunto', /^(asunto|motivo|subject|topic|objet|sujet)$/i],
  ['mensaje', /^(mensaje|comentarios?|consulta|message|comments?|your message|votre message)$/i],
  ['otro', /^(consentimiento|consent|privacidad|privacy|newsletter|rgpd|gdpr)$/i],
];
function campoDe(etq) { const e = etq.replace(/[*:]+$/, '').trim(); for (const [c, re] of CAMPOS) if (re.test(e)) return c; return null; }
// Saca nombre, correo, teléfono, empresa, asunto y mensaje. Vale para «Rótulo: valor» y para el rótulo en una línea y el valor debajo.
export function leerFormulario(texto) {
  const lineas = String(texto || '').split(/\r?\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const f = {}; let actual = null;
  for (const l of lineas) {
    let c = l.length <= 40 ? campoDe(l) : null, resto = '';
    if (!c) { const m = /^([^:]{2,30}):\s*(.*)$/.exec(l); const c2 = m && campoDe(m[1]); if (c2) { c = c2; resto = m[2]; } }
    if (c) { actual = c; if (resto && c !== 'otro') f[c] = f[c] ? f[c] + ' ' + resto : resto; continue; }
    if (actual && actual !== 'otro') f[actual] = f[actual] ? f[actual] + ' ' + l : l;
  }
  const em = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/i.exec(f.email || '');
  return { nombre: txt(f.nombre, 80), email: em ? em[0].toLowerCase() : '', telefono: txt(String(f.telefono || '').replace(/[^\d+ ]/g, ''), 30), empresa: txt(f.empresa, 80), asunto: txt(f.asunto, 120), mensaje: txt(f.mensaje, 2000) };
}

// ---------- ¿es un bot? ----------
const GRATIS = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|aol|proton|protonmail|gmx|mail|yandex|zoho)\./i;
const RARO = (w) => /^[A-Za-z]{10,}$/.test(w) && (w.match(/[a-z][A-Z]/g) || []).length >= 3;   // «qzEDwKPBymANLtmCJ…»
const PUBLI = /\b(SEO|backlinks?|guest posts?|bitcoin|crypto(currency)?|casino|free shipping|\d{1,2} ?% off|lead generation|virtual assistant|web ?design services|i just visited|came across your (web ?)?site|wondered if you|increase your (sales|traffic|revenue)|first page of google|ranking on google)\b/i;
// Dominios «propios»: los de las cuentas del CRM y los remitentes de sus formularios (nunca gmail.com y compañía)
export function dominiosPropios(crm, todas) {
  const ds = new Set();
  (crm.cuentas || []).forEach((k) => { const d = ((todas[k] || {}).email || '').split('@')[1]; if (d) ds.add(d.toLowerCase()); });
  ((crm.deteccion || {}).formularios || []).forEach((r) => { const m = /@?([a-z0-9.-]+\.[a-z]{2,})\s*$/i.exec(r.de || ''); if (m) ds.add(m[1].toLowerCase()); });
  return [...ds].filter((d) => !GRATIS.test(d));
}
// Devuelve por qué parece un bot, o '' si parece una persona
export function motivoBot(f, { dominios = [], frases = [] } = {}) {
  if (!f.email) return 'sin correo';
  if (dominios.includes(f.email.split('@')[1])) return 'correo de tu propio dominio';
  const texto = [f.nombre, f.asunto, f.mensaje].join(' ');
  if (texto.split(/\s+/).some(RARO)) return 'texto sin sentido';
  const bajo = texto.toLowerCase();
  if (frases.some((x) => x && bajo.includes(x.toLowerCase()))) return 'frase de bot';
  if (PUBLI.test(texto)) return 'publicidad';
  return '';
}

// ---------- el detector de una cuenta ----------
const AUTOMATICO = /(^|[._+-])(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|notificaciones|bounces?|newsletters?|news|alerts?|avisos?)([._+-]|$)/i;
// remitentes de máquina que no llevan «noreply» (facturación, plataformas de envío)
const MAQUINA = /^(message-service|mailer|system|automated|billing|invoice|facturacion|notify|calendar-notification)[^@]*@|@(sender\.|mail\.|email\.|em\d*\.|bounce\.|mailer\.)/i;
const correoDe = (from) => { const m = /<([^>]+)>/.exec(from || ''); return ((m && m[1]) || from || '').trim().toLowerCase(); };
const nombreDe = (from) => { const m = /^\s*"?([^"<]*?)"?\s*</.exec(from || ''); return (m && m[1].trim()) || ''; };
const cab = (m, n) => (((m && m.payload && m.payload.headers) || []).find((h) => h.name.toLowerCase() === n) || {}).value || '';
const encaja = (r, from, subj) => (r.de || r.asunto) && (!r.de || from.toLowerCase().includes(r.de.toLowerCase())) && (!r.asunto || subj.toLowerCase().includes(r.asunto.toLowerCase()));

// hace fn sobre cada elemento, de n en n (para no pasarse del cupo de Gmail)
async function enTanda(lista, n, fn) {
  const out = new Array(lista.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => { while (i < lista.length) { const j = i++; out[j] = await fn(lista[j]).catch(() => null); } }));
  return out;
}
const dominio = (e) => String(e || '').split('@')[1] || '';
export const esGratis = (d) => GRATIS.test(String(d || '') + '.');

// tk: token de Gmail de la cuenta · esPropaganda: la misma regla que usa el vigía para no avisar de publicidad
export function detector(tk, crm, todas, k, esPropaganda) {
  const G = (u, o) => fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + u, Object.assign({ headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' } }, o || {}));
  const J = async (u, o) => { const r = await G(u, o); if (!r.ok) throw new Error('gmail ' + r.status); return r.json(); };
  const yo = String((todas[k] || {}).email || '').toLowerCase(), det = crm.deteccion || {}, propios = dominiosPropios(crm, todas);
  let etqs = null;
  const etiquetas = async () => { if (!etqs) etqs = (await J('labels')).labels || []; return etqs; };
  // las etiquetas de las etapas se crean solo cuando entra el primer lead en esa etapa, y OCULTAS en la barra y en la lista
  // (el dueño, 19-oct: «no quiero tantas etiquetas»): los leads se ven desde la sección CRM de Buzonero
  async function idEtiqueta(nombre) {
    const ls = await etiquetas(), ya = ls.find((l) => l.name === nombre); if (ya) return ya.id;
    const n = await G('labels', { method: 'POST', body: JSON.stringify({ name: nombre, labelListVisibility: 'labelHide', messageListVisibility: 'hide' }) }).then((r) => r.json()).catch(() => ({}));
    // si otra petición la creó a la vez (Gmail da 409), se vuelve a leer la lista y se usa esa
    if (!n.id) { etqs = null; const otra = (await etiquetas()).find((l) => l.name === nombre); return otra ? otra.id : null; }
    ls.push(n); return n.id;
  }
  const idsLeads = async () => new Set((await etiquetas()).filter((l) => l.name.startsWith(PREFIJO + '/')).map((l) => l.id));
  // ¿ha tratado antes con esta persona en otro hilo? (recibido o enviado)
  async function conocido(de, hilo) {
    // una sola búsqueda: Gmail cobra cada búsqueda aparte del cupo por minuto («Total Query Cost»)
    const a = await J('messages?maxResults=10&q=' + encodeURIComponent('{from:' + de + ' to:' + de + '}'));
    return (a.messages || []).some((x) => x.threadId !== hilo);
  }
  // los mensajes de un hilo con las cabeceras que hacen falta para decidir
  const hiloMeta = async (hilo) => (await J('threads/' + hilo + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject')).messages || [];
  const esFormulario = (x) => (det.formularios || []).some((r) => encaja(r, cab(x, 'from'), cab(x, 'subject')));
  const contestadoA = (msgs, desde, email) => !!email && msgs.some((x) => (x.labelIds || []).includes('SENT') && +x.internalDate > +desde && (cab(x, 'to') + ',' + cab(x, 'cc')).toLowerCase().includes(email));
  // OJO: Gmail junta en un mismo hilo envíos distintos del formulario (mismo asunto): un lead es un MENSAJE, no un hilo.
  // La etiqueta va en el mensaje (y en su copia gemela: cada envío suele llegar dos veces); el hilo la enseña igual.
  // ¿le ha escrito la cuenta a ese correo después del lead, en cualquier hilo? (a menudo se contesta en un correo nuevo, no en el del formulario)
  const escritoDespues = async (email, desde) => !!email && ((await J('messages?maxResults=1&q=' + encodeURIComponent('in:sent to:' + email + ' after:' + Math.floor(+desde / 1000)))).messages || []).length > 0;
  const etiquetar = (ids, add, rem) => G('messages/batchModify', { method: 'POST', body: JSON.stringify({ ids, addLabelIds: add, removeLabelIds: rem }) });
  return {
    // m: mensaje con format=metadata (cabeceras From, Subject y List-Unsubscribe). Devuelve null o { hilo, ids, f, origen, motivo, etapa }
    async revisar(m) {
      const from = cab(m, 'from'), subj = cab(m, 'subject'), de = correoDe(from);
      if (!de || de === yo) return null;
      const msgs = await hiloMeta(m.threadId), yoM = msgs.find((x) => x.id === m.id) || m;
      const leads = await idsLeads(), esLead = (x) => (x.labelIds || []).some((id) => leads.has(id));
      if (esLead(yoM)) return null;   // ya es lead (o ya se apartó como bot)
      let f, origen, ids = [m.id];
      if (esFormulario(m)) {
        const full = await J('messages/' + m.id + '?format=full');
        f = leerFormulario(textoDe(full.payload)); origen = 'formulario';
        // su gemelo: mismo remitente y mismo texto
        ids = msgs.filter((x) => x.id === m.id || (!esLead(x) && x.snippet === yoM.snippet && correoDe(cab(x, 'from')) === de)).map((x) => x.id);
      } else if (det.directo) {
        const H = { subject: subj, 'list-unsubscribe': cab(m, 'list-unsubscribe') };
        if (AUTOMATICO.test(de.split('@')[0]) || esPropaganda(m.labelIds, H)) return null;
        if (propios.includes(de.split('@')[1])) return null;   // compañeros de la empresa
        if (msgs.some(esLead)) return null;                     // la conversación ya es un lead
        if (msgs[0] && msgs[0].id !== m.id) return null;      // solo el primer correo del hilo
        const palabras = (det.palabras && det.palabras.length ? det.palabras : PALABRAS_DEF).map((x) => x.toLowerCase());
        const bajo = (subj + ' ' + (m.snippet || '')).toLowerCase();
        if (!palabras.some((p) => bajo.includes(p))) return null;
        if (await conocido(de, m.threadId)) return null;       // ya es cliente o contacto
        f = { nombre: nombreDe(from), email: de, telefono: '', empresa: '', asunto: subj, mensaje: String(m.snippet || '') }; origen = 'correo';
      } else return null;
      let motivo = motivoBot(f, { dominios: propios, frases: det.frasesBot || [] });
      // el mismo correo en otro envío del formulario con otro nombre: bot (los bots repiten dirección y cambian el nombre)
      if (!motivo && origen === 'formulario' && f.email && f.nombre) {
        const otros = ((await J('messages?maxResults=5&q=' + encodeURIComponent('"' + f.email + '" from:' + de))).messages || []).filter((x) => !ids.includes(x.id)).slice(0, 3);
        for (const o of otros) {
          const g = leerFormulario(textoDe((await J('messages/' + o.id + '?format=full')).payload));
          if (g.email === f.email && g.nombre && g.nombre.toLowerCase() !== f.nombre.toLowerCase()) { motivo = 'mismo correo con otro nombre'; break; }
        }
      }
      const etapa = motivo ? ETIQUETA_BOT : (contestadoA(msgs, yoM.internalDate, f.email) || await escritoDespues(f.email, yoM.internalDate) ? crm.etapas[1] : crm.etapas[0]);
      const lid = await idEtiqueta(etiquetaEtapa(etapa));
      if (lid) await etiquetar(ids, [lid], motivo ? ['UNREAD', 'INBOX'] : []);   // los bots, además, se archivan (el dueño, 19-oct): siguen en «Leads/Posible bot»
      return { hilo: m.threadId, ids, f, origen, motivo, etapa };
    },
    // la cuenta ha escrito en el hilo: los leads de la primera etapa a los que ha contestado pasan a la segunda («Respondido»)
    async contestado(hilo) {
      const n1 = (await etiquetas()).find((l) => l.name === etiquetaEtapa(crm.etapas[0])); if (!n1) return false;
      const msgs = await hiloMeta(hilo);
      const cands = msgs.filter((x) => (x.labelIds || []).includes(n1.id) && correoDe(cab(x, 'from')) !== yo).slice(0, 6);
      const mover = [];
      for (const c of cands) {
        const email = esFormulario(c) ? leerFormulario(textoDe((await J('messages/' + c.id + '?format=full')).payload)).email : correoDe(cab(c, 'from'));
        if (contestadoA(msgs, c.internalDate, email)) mover.push(c.id);
      }
      if (!mover.length) return false;
      const n2 = await idEtiqueta(etiquetaEtapa(crm.etapas[1])); if (!n2) return false;
      await etiquetar(mover, [n2], [n1.id]);
      return true;
    },
    // la cuenta ha enviado un correo (mensaje id): mira su hilo y, además, los leads de la primera etapa de cada destinatario
    async enviado(id) {
      const m = await J('messages/' + id + '?format=metadata&metadataHeaders=To&metadataHeaders=Cc');
      let n = (await this.contestado(m.threadId)) ? 1 : 0;
      const n1 = (await etiquetas()).find((l) => l.name === etiquetaEtapa(crm.etapas[0])); if (!n1) return n;
      const dest = [...new Set((cab(m, 'to') + ',' + cab(m, 'cc')).split(',').map(correoDe).filter((e) => e && e !== yo && !propios.includes(e.split('@')[1])))].slice(0, 5);
      const mover = [];
      for (const e of dest) {
        const j = await J('messages?maxResults=10&labelIds=' + n1.id + '&q=' + encodeURIComponent('"' + e + '"'));
        (j.messages || []).forEach((x) => { if (!mover.includes(x.id)) mover.push(x.id); });
      }
      if (!mover.length) return n;
      const n2 = await idEtiqueta(etiquetaEtapa(crm.etapas[1])); if (!n2) return n;
      await etiquetar(mover, [n2], [n1.id]);
      return n + mover.length;
    },
    // el tablero: los leads de cada etapa, uno por persona (su correo), con lo que dice su formulario o su correo
    async pipeline() {
      const ls = await etiquetas(), items = [];
      for (const etapa of crm.etapas) {
        const l = ls.find((x) => x.name === etiquetaEtapa(etapa)); if (!l) continue;
        const j = await J('messages?maxResults=100&labelIds=' + l.id);
        (j.messages || []).forEach((x) => items.push({ id: x.id, hilo: x.threadId, etapa }));
      }
      const lb = ls.find((x) => x.name === etiquetaEtapa(ETIQUETA_BOT));
      const bots = lb ? ((await J('labels/' + lb.id).catch(() => ({}))).threadsTotal || 0) : 0;
      const det2 = await enTanda(items, 8, async (x) => {
        const m = await J('messages/' + x.id + '?format=full'), from = cab(m, 'from'), de = correoDe(from);
        let f;
        if (esFormulario(m)) f = { ...leerFormulario(textoDe(m.payload)), origen: 'formulario' };
        else if (de === yo) { const to = cab(m, 'to').split(',')[0] || ''; f = { nombre: nombreDe(to), email: correoDe(to), asunto: cab(m, 'subject'), mensaje: String(m.snippet || ''), origen: 'a mano' }; }
        else f = { nombre: nombreDe(from), email: de, asunto: cab(m, 'subject'), mensaje: String(m.snippet || ''), origen: 'correo' };
        return { ...x, ...f, fecha: +m.internalDate };
      });
      const por = {};
      for (const x of det2.filter(Boolean)) {
        const c = x.email || x.id, ya = por[c];
        if (!ya) { por[c] = { k, email: x.email, nombre: x.nombre, telefono: x.telefono || '', empresa: x.empresa || '', asunto: x.asunto, mensaje: x.mensaje, origen: x.origen, etapa: x.etapa, fecha: x.fecha, hilo: x.hilo, ids: [x.id] }; continue; }
        ya.ids.push(x.id);
        ['nombre', 'telefono', 'empresa'].forEach((q) => { if (!ya[q] && x[q]) ya[q] = x[q]; });
        if (x.fecha > ya.fecha) Object.assign(ya, { asunto: x.asunto, mensaje: x.mensaje, etapa: x.etapa, fecha: x.fecha, hilo: x.hilo });
      }
      return { leads: Object.values(por), bots };
    },
    // de quién es el turno con esa persona: el último correo entre los dos, en cualquier hilo
    async conversacion(email) {
      const j = await J('messages?maxResults=1&q=' + encodeURIComponent('{from:' + email + ' to:' + email + '} -in:drafts'));
      const m0 = (j.messages || [])[0]; if (!m0) return null;
      const m = await J('messages/' + m0.id + '?format=metadata&metadataHeaders=From');
      return { turno: correoDe(cab(m, 'from')) === yo ? 'suyo' : 'tuyo', ultimo: +m.internalDate };
    },
    // cambia de etapa unos mensajes: quita las demás etapas del CRM (y «Posible bot») y pone la nueva
    async mover(ids, etapa) {
      const ls = await etiquetas(), nombres = crm.etapas.concat([ETIQUETA_BOT, ETIQUETA_NOLEAD]).map(etiquetaEtapa);
      const quitar = ls.filter((l) => nombres.includes(l.name) && l.name !== etiquetaEtapa(etapa)).map((l) => l.id);
      const lid = await idEtiqueta(etiquetaEtapa(etapa)); if (!lid) throw new Error('etiqueta');
      await etiquetar(ids, [lid], quitar);
    },
    // «Añadir al CRM» desde un correo: marca el primer mensaje de la otra persona (o el primero, si empezaste tú)
    async anadir(hilo, etapa) {
      const msgs = (await hiloMeta(hilo)).filter((x) => !(x.labelIds || []).includes('DRAFT'));
      const m = msgs.find((x) => correoDe(cab(x, 'from')) !== yo) || msgs[0];
      if (!m) throw new Error('hilo');
      await this.mover([m.id], etapa || crm.etapas[0]);
      return m.id;
    },
    // clientes: toda persona de fuera que ha escrito a la cuenta en los últimos días (como los contactos de HubSpot)
    async clientes(dias = 90) {
      const formu = (det.formularios || []).map((r) => (r.de || '').toLowerCase()).filter(Boolean);
      // los hilos en los que la cuenta ha escrito (90 días) y lo recibido del último mes: las notificaciones no tapan a la gente
      const vistos = new Set(), lista = [];
      for (const [q, n] of [['in:sent newer_than:' + dias + 'd', 250], ['newer_than:30d -in:sent -in:spam -in:trash -category:promotions -category:social -category:forums -category:updates', 100]]) {
        ((await J('threads?maxResults=' + n + '&q=' + encodeURIComponent(q))).threads || []).forEach((t) => { if (!vistos.has(t.id)) { vistos.add(t.id); lista.push(t); } });
      }
      const hilos = await enTanda(lista, 6, (t) => J('threads/' + t.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe'));
      const por = {};
      for (const t of hilos.filter(Boolean)) {
        for (const m of t.messages || []) {
          if ((m.labelIds || []).includes('DRAFT')) continue;
          const from = cab(m, 'from'), de = correoDe(from);
          const gente = de === yo ? (cab(m, 'to') + ',' + cab(m, 'cc')).split(',').map((x) => [nombreDe(x), correoDe(x)]) : (cab(m, 'list-unsubscribe') ? [] : [[nombreDe(from), de]]);
          for (const [nom, e] of gente) {
            if (!/@/.test(e) || e === yo || propios.includes(dominio(e)) || AUTOMATICO.test(e.split('@')[0]) || MAQUINA.test(e) || formu.some((f) => f.includes(e))) continue;
            const c = por[e] || (por[e] = { k, email: e, nombre: '', empresa: esGratis(dominio(e)) ? '' : dominio(e), hilos: [], ultimo: 0, asunto: '', hilo: '', escribio: false });
            if (nom && !c.nombre) c.nombre = nom;
            if (!c.hilos.includes(t.id)) c.hilos.push(t.id);
            if (de !== yo) c.escribio = true;
            if (+m.internalDate > c.ultimo) { c.ultimo = +m.internalDate; c.asunto = cab(m, 'subject'); c.hilo = t.id; }
          }
        }
      }
      // solo quien te ha escrito alguna vez (no cada dirección a la que mandaste algo una vez)
      return Object.values(por).filter((c) => c.escribio).map((c) => ({ ...c, hilos: c.hilos.length }));
    },
    // repasa los últimos días: los formularios y, si está activo, los correos directos de gente nueva
    async importar(dias = 30, max = 60) {
      const qs = (det.formularios || []).map((r) => [r.de ? 'from:(' + r.de.replace(/[()"]/g, '') + ')' : '', r.asunto ? 'subject:("' + r.asunto.replace(/[()"]/g, '') + '")' : ''].join(' ').trim());
      if (det.directo) qs.push('in:inbox -category:promotions -category:social -category:forums');
      const hilos = [];
      for (const q of qs) {
        const j = await J('threads?maxResults=' + max + '&q=' + encodeURIComponent(q + ' newer_than:' + dias + 'd -in:trash -in:spam'));
        (j.threads || []).forEach((x) => { if (!hilos.includes(x.id)) hilos.push(x.id); });
      }
      const res = { revisados: 0, leads: 0, bots: 0 };
      for (const id of hilos.slice(0, max)) {
        // con pausa: de golpe agota el cupo por minuto de Gmail y la app abierta se queda sin poder leer (visto el 19-oct con 40 hilos)
        await new Promise((r) => setTimeout(r, 600));
        try {
          const t = await J('threads/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe');
          const hechos = new Set();
          for (const m of (t.messages || []).filter((x) => correoDe(cab(x, 'from')) !== yo && !(x.labelIds || []).includes('DRAFT')).slice(0, 12)) {
            if (hechos.has(m.id)) continue;
            res.revisados++;
            const r = await this.revisar(m);
            if (r) { r.ids.forEach((x) => hechos.add(x)); r.motivo ? res.bots++ : res.leads++; }
          }
        } catch (e) {}
      }
      return res;
    },
  };
}
