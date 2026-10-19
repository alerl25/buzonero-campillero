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
  return { guardar: { ...ga, conectado: new Date().toISOString() }, estado: { cuenta: sa.client_email, propiedad, resumen: usuarios + ' usuarios en los últimos 7 días' } };
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

// Lo que la app puede ver de cada integración: nunca claves ni tokens
export function estadoPublico(integ) {
  const i = integ || {}, out = {};
  if (i.ga) out.ga = { propiedad: i.ga.propiedad, cuenta: (i.ga.sa || {}).client_email, conectado: i.ga.conectado };
  if (Array.isArray(i.wa) && i.wa.length) out.wa = i.wa.map((n) => ({ id: n.id, nombre: n.nombre, numero: n.numero, verificado: n.verificado, conectado: n.conectado }));
  if (i.nx) out.nx = { espacio: i.nx.espacio, usuario: i.nx.usuario, caduca: i.nx.caduca, conectado: i.nx.conectado };
  return out;
}
