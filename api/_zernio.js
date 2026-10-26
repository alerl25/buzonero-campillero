// Zernio (https://zernio.com): la bandeja de mensajes de WhatsApp (y otras redes). SOLO LECTURA: aquí no hay nada que envíe
// ni que marque como leído (en WhatsApp eso manda el doble check azul al cliente). La clave vive en ZERNIO_API_KEY (Vercel).
const BASE = 'https://zernio.com/api/v1';
export const ID_ZERNIO = /^[A-Za-z0-9_.:@=+\-]{1,200}$/;   // ids opacos de Zernio: solo caracteres seguros
export const hayZernio = () => !!process.env.ZERNIO_API_KEY;
export const DIAS_WA = 7;   // días de actividad para que una conversación de WhatsApp cuente como lead del CRM

export async function zernio(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + process.env.ZERNIO_API_KEY, Accept: 'application/json' } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

// Las conversaciones de WhatsApp como leads del CRM: cada una es un lead (todo lo que llega por WhatsApp lo es).
// `etapas` = las del CRM; `guardadas` = { idConversación: etapa } que el usuario ya movió; «No es lead» las aparta.
export async function leadsWhatsApp(etapas, guardadas, noLead, alias) {
  const x = await zernio('/inbox/conversations?' + new URLSearchParams({ platform: 'whatsapp', limit: '50' }));
  if (x.status !== 200) throw new Error('zernio ' + x.status);
  // solo las que han tenido movimiento en los últimos DIAS_WA días: las viejas y ya cerradas no son leads (si vuelven a escribir, vuelven al tablero)
  const desde = Date.now() - DIAS_WA * 86400000;
  const convs = (x.body.data || []).filter((c) => c && c.id && c.accountId && Date.parse(c.updatedTime) >= desde);
  const leads = convs.map((c) => {
    const tel = String(c.participantId || '').replace(/\s/g, '');
    const nc = nombreConv(c, alias);
    return {
      k: 'wa', canal: 'whatsapp', email: '', nombre: nc.nombre, telefono: /^\+?\d{6,}$/.test(tel) ? (tel[0] === '+' ? tel : '+' + tel) : '', empresa: '',
      asunto: 'WhatsApp', mensaje: c.lastMessage || '', origen: 'WhatsApp', etapa: guardadas[c.id] || '', fecha: Date.parse(c.updatedTime) || 0,
      hilo: c.id, ids: [c.id], cuenta: c.accountId, turno: '',
    };
  });
  // de quién es el turno: el último mensaje de la conversación (de a 4, para no pasar del límite de Zernio)
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < leads.length) {
      const l = leads[i++];
      try {
        const m = await zernio('/inbox/conversations/' + encodeURIComponent(l.hilo) + '/messages?' + new URLSearchParams({ accountId: l.cuenta, limit: '1', sortOrder: 'desc' }));
        const u = ((m.body && m.body.messages) || [])[0];
        if (u) { l.turno = u.direction === 'outgoing' ? 'suyo' : 'tuyo'; l.ultimo = Date.parse(u.createdAt) || l.fecha; }
      } catch (e) {}
      if (!l.turno) l.turno = 'desconocido';   // truthy: que el tablero no lo tome por «te toca»
      if (!l.etapa) l.etapa = l.turno === 'suyo' && etapas.find((e) => /^respondido$/i.test(e)) ? etapas.find((e) => /^respondido$/i.test(e)) : etapas[0];
    }
  }));
  return leads.filter((l) => l.etapa !== noLead);
}

// ---------- nombres y teléfonos legibles ----------
// WhatsApp no da la foto de perfil a las empresas, y el nombre solo si la persona lo puso en su perfil: casi siempre llega el número.
// El nombre sale, por orden, del que se puso a mano (alias, guardado en el almacén del CRM), del que trae WhatsApp o, si no hay, del número bien escrito.
export const soloDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const CC3 = new Set(['212', '213', '216', '351', '352', '353', '505', '506', '507', '591', '593', '595', '598', '971', '972', '973', '974']);
export function formatoTel(v) {
  const d = soloDigitos(v);
  if (d.length < 8 || d.length > 15) return String(v || '');
  if (/^34\d{9}$/.test(d)) return '+34 ' + d.slice(2, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7, 9) + ' ' + d.slice(9);
  const cc = d[0] === '1' ? 1 : (CC3.has(d.slice(0, 3)) ? 3 : 2), resto = d.slice(cc);
  return '+' + d.slice(0, cc) + ' ' + (resto.match(/.{1,3}/g) || [resto]).join(' ');
}
const pareceTel = (v) => /^\+?[\d\s().-]{6,}$/.test(String(v || '').trim());
// { nombre, real, telefono } de una conversación; `alias` = { 34600550578: 'María' }
export function nombreConv(c, alias) {
  const tel = soloDigitos(c.participantId), propio = (alias || {})[tel];
  const wa = c.participantName && !pareceTel(c.participantName) ? String(c.participantName) : (c.whatsappUsername ? String(c.whatsappUsername) : '');
  const nombre = propio || wa;
  return { nombre: nombre || formatoTel(tel || c.participantName), real: !!nombre, telefono: tel ? '+' + tel : '' };
}
