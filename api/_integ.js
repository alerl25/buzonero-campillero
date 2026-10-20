// Integraciones de cada CRM: se prueban al conectar y se guardan cifradas en buzonero-crm.enc (campo «integ»).
// Ninguna mete una cuenta de Google en Buzonero: Analytics va con la clave de una cuenta de servicio,
// WhatsApp con el token de la API de Meta y Nexudus con un pase de solo lectura (la contraseña no se guarda).
import crypto from 'node:crypto';

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// ---------- Google Analytics (cuenta de servicio) ----------
async function tokenCuentaServicio(sa, scope) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = b64u({ alg: 'RS256', typ: 'JWT' }) + '.' + b64u({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 });
  const firma = crypto.sign('RSA-SHA256', Buffer.from(cuerpo), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cuerpo + '.' + firma }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error('La clave no vale: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
export async function informeGA(ga, cuerpo) {
  const tk = await tokenCuentaServicio(ga.sa, 'https://www.googleapis.com/auth/analytics.readonly');
  const r = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + ga.propiedad + ':runReport', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (j.error && j.error.message) || String(r.status);
    if (/has not been used|is disabled/i.test(m)) throw new Error('Falta activar la «Google Analytics Data API» en el proyecto de la cuenta de servicio.');
    if (r.status === 403) throw new Error('La cuenta de servicio no tiene acceso a esa propiedad: añádela en Analytics como Lector.');
    if (r.status === 400 || r.status === 404) throw new Error('No existe esa propiedad de Analytics: revisa el número.');
    throw new Error(m);
  }
  return j;
}
export async function conectarGA(d) {
  let sa;
  try { sa = typeof d.clave === 'string' ? JSON.parse(d.clave) : d.clave; } catch { throw new Error('El fichero de la clave no es un JSON válido.'); }
  if (!sa || sa.type !== 'service_account' || !sa.client_email || !sa.private_key) throw new Error('Esa no es la clave de una cuenta de servicio (falta client_email o private_key).');
  const propiedad = String(d.propiedad || '').replace(/^properties\//, '').trim();
  if (!/^\d{5,15}$/.test(propiedad)) throw new Error('El ID de la propiedad es un número (Administrar → Detalles de la propiedad).');
  const ga = { propiedad, sa: { client_email: sa.client_email, private_key: sa.private_key } };
  const j = await informeGA(ga, { dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: [{ name: 'activeUsers' }] });
  const usuarios = Number((((j.rows || [])[0] || {}).metricValues || [{}])[0].value || 0);
  return { guardar: { ...ga, conectado: new Date().toISOString() }, estado: { cuenta: sa.client_email, propiedad, resumen: usuarios + ' usuarios en los últimos 7 días', sinDatos: usuarios === 0 } };
}

// ---------- WhatsApp (Cloud API de Meta), uno o varios números ----------
export async function conectarWA(d) {
  const id = String(d.numeroId || '').trim(), token = String(d.token || '').trim(), nombre = String(d.nombre || '').trim().slice(0, 40) || 'WhatsApp';
  if (!/^\d{6,25}$/.test(id)) throw new Error('El «Identificador del número de teléfono» es un número largo (WhatsApp → Configuración de la API).');
  if (token.length < 20) throw new Error('Pega el token completo.');
  const r = await fetch('https://graph.facebook.com/v21.0/' + id + '?fields=display_phone_number,verified_name', { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Meta no lo acepta: ' + ((j.error && j.error.message) || r.status));
  return { guardar: { id, token, nombre, numero: j.display_phone_number || '', verificado: j.verified_name || '', conectado: new Date().toISOString() }, estado: { nombre, numero: j.display_phone_number || '', verificado: j.verified_name || '' } };
}

// ---------- Nexudus (solo lectura) ----------
export async function conectarNX(d) {
  const espacio = String(d.espacio || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9-]+\.spaces\.nexudus\.com$/i.test(espacio)) throw new Error('La dirección de tu espacio es como «tuespacio.spaces.nexudus.com».');
  // pase ya hecho (p. ej. el que usa el MCP o un script con la verificación en dos pasos ya pasada): se prueba y se guarda tal cual
  if (d.token) {
    const p = await fetch('https://spaces.nexudus.com/api/spaces/bookings?size=1', { headers: { Authorization: 'Bearer ' + String(d.token), Accept: 'application/json' } });
    if (!p.ok) throw new Error('Nexudus no acepta ese pase (' + p.status + ').');
    const caduca = Number(d.caduca) > Date.now() ? Number(d.caduca) : Date.now() + 20 * 86400 * 1000;
    return { guardar: { espacio, usuario: String(d.usuario || ''), token: String(d.token), caduca, conectado: new Date().toISOString() }, estado: { espacio, usuario: String(d.usuario || ''), caduca } };
  }
  const body = new URLSearchParams({ grant_type: 'password', username: String(d.usuario || ''), password: String(d.clave || '') });
  if (d.codigo) body.set('totp', String(d.codigo).replace(/\D/g, ''));
  const r = await fetch('https://' + espacio + '/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (j.error === 'two_factor_auth_check') { const e = new Error('Escribe el código de 6 cifras de tu app de verificación.'); e.pide = 'codigo'; throw e; }
  if (!j.access_token) throw new Error('Nexudus no acepta ese usuario o contraseña' + (j.error_description ? ': ' + j.error_description : '.'));
  // prueba de solo lectura: una reserva cualquiera
  const p = await fetch('https://spaces.nexudus.com/api/spaces/bookings?size=1', { headers: { Authorization: 'Bearer ' + j.access_token, Accept: 'application/json' } });
  if (!p.ok) throw new Error('Nexudus deja entrar, pero ese usuario no puede leer las reservas (' + p.status + ').');
  const caduca = Date.now() + (Number(j.expires_in) || 20 * 86400) * 1000;
  return { guardar: { espacio, usuario: String(d.usuario || ''), token: j.access_token, caduca, conectado: new Date().toISOString() }, estado: { espacio, usuario: String(d.usuario || ''), caduca } };
}

// ---------- Metricool (token de la API de la cuenta de cada persona) ----------
// El token sale de Metricool → Ajustes → API (planes Advanced o Custom). Cada instalación guarda el suyo, cifrado; nunca va en el código.
export async function metricoolGet(mc, ruta, q) {
  const r = await fetch('https://app.metricool.com/api' + ruta + '?' + new URLSearchParams(Object.assign({ userId: mc.userId }, q || {})), { headers: { 'X-Mc-Auth': mc.token, Accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error('metricool ' + r.status); e.status = r.status; throw e; }
  return j;
}
export async function conectarMC(d) {
  const token = String(d.token || '').trim(), userId = String(d.userId || '').trim();
  if (token.length < 20) throw new Error('Pega el token completo (Metricool → Ajustes → API).');
  if (!/^\d{3,12}$/.test(userId)) throw new Error('El «userId» es un número: sale en la dirección de Metricool, después de «userId=».');
  let lista;
  try { lista = await metricoolGet({ token, userId }, '/admin/simpleProfiles'); }
  catch (e) { throw new Error(e.status === 401 || e.status === 403 ? 'Metricool no acepta ese token o ese userId.' : 'No se pudo hablar con Metricool (' + (e.status || 'red') + ').'); }
  if (!Array.isArray(lista)) throw new Error('Metricool respondió algo inesperado: revisa el token y el userId.');
  const marcas = lista.map((b) => ({ id: String(b.id), nombre: String(b.label || b.title || b.name || b.id).slice(0, 60) }));
  return { guardar: { token, userId, marcas, conectado: new Date().toISOString() }, estado: { userId, marcas: marcas.length, resumen: marcas.length + ' marca' + (marcas.length === 1 ? '' : 's') } };
}

// Lo que la app puede ver de cada integración: nunca claves ni tokens
export function estadoPublico(integ) {
  const i = integ || {}, out = {};
  if (i.ga) out.ga = { propiedad: i.ga.propiedad, cuenta: (i.ga.sa || {}).client_email, conectado: i.ga.conectado };
  if (Array.isArray(i.wa) && i.wa.length) out.wa = i.wa.map((n) => ({ id: n.id, nombre: n.nombre, numero: n.numero, verificado: n.verificado, conectado: n.conectado }));
  if (i.mc) out.mc = { userId: i.mc.userId, marcas: i.mc.marcas || [], conectado: i.mc.conectado };
  if (i.nx) out.nx = { espacio: i.nx.espacio, usuario: i.nx.usuario, caduca: i.nx.caduca, conectado: i.nx.conectado };
  return out;
}

// Lo que hay en Nexudus de un correo: su ficha, sus facturas (sin anuladas ni abonos) y sus reservas. Solo lectura.
// OJO: «Coworker_Email» filtra; «Coworker_Email_Exact» NO (devuelve los 40.000). Comprobado el 19-oct-2026 con un valor imposible.
export async function nexudusCliente(token, email) {
  const H = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  const g = async (ruta, q) => { const r = await fetch('https://spaces.nexudus.com/api' + ruta + '?' + new URLSearchParams(q), { headers: H }); if (!r.ok) throw new Error('nexudus ' + r.status); return r.json(); };
  const c = ((await g('/spaces/coworkers', { Coworker_Email: email, size: 5 })).Records || []).find((x) => String(x.Email || '').toLowerCase() === email);
  if (!c) return null;
  const [fs, rs] = await Promise.all([g('/billing/coworkerinvoices', { CoworkerInvoice_Coworker: c.Id, size: 25 }), g('/spaces/bookings', { Booking_Coworker: c.Id, size: 25 })]);
  const facturas = (fs.Records || []).filter((f) => !f.Void && !f.CreditNote).map((f) => ({ numero: f.InvoiceNumber, total: f.TotalAmount, pagada: !!f.Paid, fecha: f.CreatedOn })).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const reservas = (rs.Records || []).map((b) => ({ desde: b.FromTime, hasta: b.ToTime, sala: b.ResourceName, tentativa: !!b.Tentative })).sort((a, b) => String(b.desde).localeCompare(String(a.desde)));
  return { id: c.Id, nombre: c.FullName, facturas, reservas };
}
