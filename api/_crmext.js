// CRM externo, SOLO LECTURA. Lee los contactos de un CRM propio que se maneja con una función «crm» (POST con la cabecera x-clave y
// el cuerpo { accion }) y devuelve { ok, data: [contacto…] }. Buzonero solo puede pedir las acciones «listar» y «ver» (ambas de lectura): el nombre de
// la acción está escrito aquí y no sale de ningún parámetro, así que nada de lo que llegue de la app o del conector puede escribir ni borrar.
// Variables de Vercel (nunca en el código): CRM_EXT_URL (https://…/functions/v1/crm), CRM_EXT_CLAVE, CRM_EXT_NOMBRE (rótulo de la
// vista) y CRM_EXT_PANEL (enlace al panel del CRM, opcional). Sin CRM_EXT_URL y CRM_EXT_CLAVE, la integración no existe.
// Coste: la respuesta pesa unos 30 KB comprimida y se pide cada minuto desde el vigía (≈1,3 GB al mes de salida del CRM); la vista de la app usa una memoria de 25 s.
const URL_CRM = () => String(process.env.CRM_EXT_URL || '').trim();
const CLAVE = () => String(process.env.CRM_EXT_CLAVE || '').trim();
export const hayCrmExt = () => /^https:\/\/[^\s]+$/.test(URL_CRM()) && CLAVE().length >= 8;
export const nombreCrmExt = () => String(process.env.CRM_EXT_NOMBRE || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 40);
export const panelCrmExt = () => { const p = String(process.env.CRM_EXT_PANEL || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(p) ? p : ''; };

const txt = (v, n) => (v == null ? '' : String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n));
// La última nota de la ficha, sin el apunte automático de «Datos cambiados…»: solo importan los que entran, no lo que se edita después.
const notaUtil = (v) => { const t = txt(v, 240); return /^datos cambiados/i.test(t) ? '' : t; };
let memoria = { t: 0, v: null }, enVuelo = null;

// { ok, filas: [normalizadas, sin límite], maxId, total } o { ok:false, error }
// fresco = true (el vigía) se salta la memoria: un aviso no puede llegar tarde por servir un dato de hace 50 s.
export async function crmExtListar(fresco = false) {
  if (!hayCrmExt()) return { ok: false, error: 'sin_clave' };
  if (!fresco && memoria.v && Date.now() - memoria.t < 25000) return memoria.v;
  if (fresco) return pedirLista();   // el vigía y el toque del CRM: siempre su propia consulta, nunca la de otro
  // la vista de la app: si ya hay una consulta en marcha en esta instancia (dos pestañas, el sondeo y la vuelta a la pestaña a la vez), se espera esa
  if (!enVuelo) enVuelo = pedirLista().finally(() => { enVuelo = null; });
  return enVuelo;
}
async function pedirLista() {
  let r;
  try {
    r = await fetch(URL_CRM(), { method: 'POST', headers: { 'x-clave': CLAVE(), 'content-type': 'application/json', 'accept-encoding': 'gzip' }, body: JSON.stringify({ accion: 'listar' }), signal: AbortSignal.timeout(15000) });
  } catch (e) { return { ok: false, error: 'red' }; }
  if (r.status !== 200) return { ok: false, error: 'crm', status: r.status };
  const j = await r.json().catch(() => null);
  if (!j || j.ok !== true || !Array.isArray(j.data)) return { ok: false, error: 'formato' };
  const filas = j.data.filter((c) => c && Number.isFinite(Number(c.id))).map((c) => ({
    id: Number(c.id), nombre: txt(c.nombre, 80) || 'Sin nombre', email: txt(c.email, 120), telefono: txt(c.telefono, 30), empresa: txt(c.empresa, 80), cargo: txt(c.cargo, 60),
    origen: txt(c.origen, 30), estado: txt(c.estado, 30), creado: txt(c.creado, 40), actualizado: txt(c.actualizado, 40), nota: notaUtil(c.ultima_nota), proximo: txt(c.proximo_paso, 160), archivado: !!c.archivado
  }));
  const vivos = filas.filter((c) => !c.archivado);
  const v = { ok: true, filas: vivos, maxId: filas.reduce((m, c) => Math.max(m, c.id), 0), total: vivos.length };
  memoria = { t: Date.now(), v };
  return v;
}

// Un contacto que ya estaba y vuelve a entrar (rellena un formulario, reserva una llamada…) no crea ficha nueva: el CRM lo reconoce por teléfono o correo y solo
// apunta una nota automática. Estas son las notas de ENTRADA; «Datos cambiados…», los cambios de estado y las notas que escribe el equipo no cuentan.
export const esEntrada = (t) => /^(Ha (entrado|reservado una llamada|escaneado|hecho el diagn)|Se ha (apuntado|registrado|inscrito))/i.test(String(t || ''));

// Acción «ver» (solo lectura): las notas de una ficha, de más reciente a más antigua. Segundo y último comando que este módulo puede enviar.
export async function crmExtVer(id) {
  id = Number(id);
  if (!hayCrmExt() || !Number.isInteger(id) || id <= 0) return null;
  let r;
  try {
    // 8 s (antes 15): es una ficha suelta, y el vigía pide hasta 6 en la misma pasada. Si no llega a tiempo, esa reentrada no se avisa en esta pasada (igual que con cualquier otro fallo).
    r = await fetch(URL_CRM(), { method: 'POST', headers: { 'x-clave': CLAVE(), 'content-type': 'application/json', 'accept-encoding': 'gzip' }, body: JSON.stringify({ accion: 'ver', p_id: id }), signal: AbortSignal.timeout(8000) });
  } catch (e) { return null; }
  if (r.status !== 200) return null;
  const j = await r.json().catch(() => null);
  const acts = j && j.ok === true && j.data && Array.isArray(j.data.actividades) ? j.data.actividades : null;
  return acts ? acts.map((a) => ({ tipo: txt(a.tipo, 20), texto: txt(a.texto, 400), creado: txt(a.creado, 40) })) : null;
}

// Lo que ve la app: hasta 500 contactos por fecha de alta (más recientes primero), solo con los campos que se pintan.
export function paraVista(x) {
  if (!x || !x.ok) return x || { ok: false, error: 'interno' };
  const leads = x.filas.slice().sort((a, b) => (Date.parse(b.creado) || 0) - (Date.parse(a.creado) || 0) || b.id - a.id).slice(0, 500);
  return { ok: true, leads, total: x.total, nombre: nombreCrmExt(), panel: panelCrmExt() };
}

// Qué avisar del CRM desde el último punto (hist._crmext = mayor id visto, hist._crmextT = última actualización vista): contactos NUEVOS (id mayor) y REENTRADAS
// (ficha que ya estaba con una nota de entrada nueva). Es pura: no escribe en el almacén ni manda nada; quien la llama (el vigía o el toque del CRM) decide.
// Devuelve { ok, avisos, nuevosH (puntos nuevos para guardar), nuevos, vuelven, punto }. La primera vez (sin punto) solo apunta, no avisa.
export async function detectarCrmExt(hist, fresco = true) {
  const x = await crmExtListar(fresco);
  if (!x.ok || !(x.maxId > 0)) return { ok: false, avisos: [], nuevosH: {}, nuevos: 0, vuelven: 0, punto: 0 };
  const punto = Number((hist || {})._crmext) || 0, rotulo = nombreCrmExt(), ms = (v) => Date.parse(v) || 0;
  const maxAct = x.filas.reduce((m, l) => Math.max(m, ms(l.actualizado)), 0);
  // con el punto de ids ya puesto pero sin el de tiempo, se miran los últimos 30 min; sin nada puesto, solo se apunta
  const T = Number((hist || {})._crmextT) || (punto ? Date.now() - 30 * 60000 : maxAct);
  const avisos = []; let nuevos = 0, vuelven = 0;
  if (punto) {
    const nv = x.filas.filter((l) => l.id > punto).sort((a, b) => a.id - b.id);
    nuevos = nv.length;
    if (nv.length > 5) avisos.push({ title: nv.length + ' contactos nuevos' + (rotulo ? ' · ' + rotulo : ''), body: 'Han entrado a la vez en el CRM', tag: 'cx-resumen-' + x.maxId, fuente: 'lx', url: '/app?vista=LEADSEXT' });
    else nv.forEach((l) => avisos.push({ title: 'Nuevo lead · ' + l.nombre + (rotulo ? ' · ' + rotulo : ''), body: [l.origen, l.estado, l.nota].filter(Boolean).join(' · ').slice(0, 160), tag: 'cx-' + l.id, fuente: 'lx', url: '/app?vista=LEADSEXT' }));
    const cand = x.filas.filter((l) => l.id <= punto && ms(l.actualizado) > T).sort((a, b) => ms(b.actualizado) - ms(a.actualizado)).slice(0, 6);
    // las fichas candidatas (6 como mucho) se consultan a la vez, no una detrás de otra; los avisos salen en el mismo orden que antes
    const vistas = await Promise.all(cand.map((l) => crmExtVer(l.id).catch(() => null)));
    cand.forEach((l, i) => {
      const nota = (vistas[i] || []).find((a) => a.tipo === 'nota' && ms(a.creado) > T && esEntrada(a.texto));
      if (!nota) return;
      vuelven++;
      avisos.push({ title: 'Vuelve a entrar · ' + l.nombre + (rotulo ? ' · ' + rotulo : ''), body: nota.texto.slice(0, 160), tag: 'cx-v-' + l.id + '-' + ms(nota.creado), fuente: 'lx', url: '/app?vista=LEADSEXT' });
    });
  }
  const nuevosH = {};
  if (x.maxId > punto) nuevosH._crmext = x.maxId;
  if (maxAct > T) nuevosH._crmextT = maxAct;
  return { ok: true, avisos, nuevosH, nuevos, vuelven, punto };
}
