// Zernio (https://zernio.com): la bandeja de mensajes de WhatsApp (y otras redes). SOLO LECTURA: aquí no hay nada que envíe
// ni que marque como leído (en WhatsApp eso manda el doble check azul al cliente). La clave vive en ZERNIO_API_KEY (Vercel).
const BASE = 'https://zernio.com/api/v1';
export const ID_ZERNIO = /^[A-Za-z0-9_.:@=+\-]{1,200}$/;   // ids opacos de Zernio: solo caracteres seguros
export const hayZernio = () => !!process.env.ZERNIO_API_KEY;

export async function zernio(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + process.env.ZERNIO_API_KEY, Accept: 'application/json' } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

// Las conversaciones de WhatsApp como leads del CRM: cada una es un lead (todo lo que llega por WhatsApp lo es).
// `etapas` = las del CRM; `guardadas` = { idConversación: etapa } que el usuario ya movió; «No es lead» las aparta.
export async function leadsWhatsApp(etapas, guardadas, noLead) {
  const x = await zernio('/inbox/conversations?' + new URLSearchParams({ platform: 'whatsapp', limit: '50' }));
  if (x.status !== 200) throw new Error('zernio ' + x.status);
  const convs = (x.body.data || []).filter((c) => c && c.id && c.accountId);
  const leads = convs.map((c) => {
    const tel = String(c.participantId || '').replace(/\s/g, '');
    return {
      k: 'wa', canal: 'whatsapp', email: '', nombre: c.participantName || c.whatsappUsername || '', telefono: /^\+?\d{6,}$/.test(tel) ? (tel[0] === '+' ? tel : '+' + tel) : '', empresa: '',
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
      if (!l.etapa) l.etapa = l.turno === 'suyo' && etapas[1] ? etapas[1] : etapas[0];
    }
  }));
  return leads.filter((l) => l.etapa !== noLead);
}
