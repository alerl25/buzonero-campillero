// CRM externo, SOLO LECTURA. Lee los contactos de un CRM propio que se maneja con una función «crm» (POST con la cabecera x-clave y
// el cuerpo { accion }) y devuelve { ok, data: [contacto…] }. Buzonero solo puede pedir la acción «listar»: el nombre de la acción
// está escrito aquí y no sale de ningún parámetro, así que nada de lo que llegue de la app o del conector puede escribir ni borrar.
// Variables de Vercel (nunca en el código): CRM_EXT_URL (https://…/functions/v1/crm), CRM_EXT_CLAVE, CRM_EXT_NOMBRE (rótulo de la
// vista) y CRM_EXT_PANEL (enlace al panel del CRM, opcional). Sin CRM_EXT_URL y CRM_EXT_CLAVE, la integración no existe.
// Coste: la respuesta pesa unos 30 KB comprimida y se pide cada 2 min desde el vigía; por eso hay una memoria de 55 s por instancia.
const URL_CRM = () => String(process.env.CRM_EXT_URL || '').trim();
const CLAVE = () => String(process.env.CRM_EXT_CLAVE || '').trim();
export const hayCrmExt = () => /^https:\/\/[^\s]+$/.test(URL_CRM()) && CLAVE().length >= 8;
export const nombreCrmExt = () => String(process.env.CRM_EXT_NOMBRE || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 40);
export const panelCrmExt = () => { const p = String(process.env.CRM_EXT_PANEL || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(p) ? p : ''; };

const txt = (v, n) => (v == null ? '' : String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n));
let memoria = { t: 0, v: null };

// { ok, filas: [normalizadas, sin límite], maxId, total } o { ok:false, error }
export async function crmExtListar() {
  if (!hayCrmExt()) return { ok: false, error: 'sin_clave' };
  if (memoria.v && Date.now() - memoria.t < 55000) return memoria.v;
  let r;
  try {
    r = await fetch(URL_CRM(), { method: 'POST', headers: { 'x-clave': CLAVE(), 'content-type': 'application/json', 'accept-encoding': 'gzip' }, body: JSON.stringify({ accion: 'listar' }), signal: AbortSignal.timeout(15000) });
  } catch (e) { return { ok: false, error: 'red' }; }
  if (r.status !== 200) return { ok: false, error: 'crm', status: r.status };
  const j = await r.json().catch(() => null);
  if (!j || j.ok !== true || !Array.isArray(j.data)) return { ok: false, error: 'formato' };
  const filas = j.data.filter((c) => c && Number.isFinite(Number(c.id))).map((c) => ({
    id: Number(c.id), nombre: txt(c.nombre, 80) || 'Sin nombre', email: txt(c.email, 120), telefono: txt(c.telefono, 30), empresa: txt(c.empresa, 80), cargo: txt(c.cargo, 60),
    origen: txt(c.origen, 30), estado: txt(c.estado, 30), creado: txt(c.creado, 40), nota: txt(c.ultima_nota, 240), proximo: txt(c.proximo_paso, 160), archivado: !!c.archivado
  }));
  const vivos = filas.filter((c) => !c.archivado);
  const v = { ok: true, filas: vivos, maxId: filas.reduce((m, c) => Math.max(m, c.id), 0), total: vivos.length };
  memoria = { t: Date.now(), v };
  return v;
}

// Lo que ve la app: los 150 más recientes por fecha de alta, sin el resto de la tabla.
export function paraVista(x) {
  if (!x || !x.ok) return x || { ok: false, error: 'interno' };
  const leads = x.filas.slice().sort((a, b) => (Date.parse(b.creado) || 0) - (Date.parse(a.creado) || 0) || b.id - a.id).slice(0, 150);
  return { ok: true, leads, total: x.total, nombre: nombreCrmExt(), panel: panelCrmExt() };
}
