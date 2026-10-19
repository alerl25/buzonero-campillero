// Utilidades compartidas de las funciones de Buzonero (Vercel ignora los ficheros que empiezan por _).
import crypto from 'node:crypto';

/* Las cuentas fijas de cada instalación salen de la variable BZ_CUENTAS (JSON), nunca del código:
   [{"k":"pe","email":"tu@gmail.com","nombre":"Personal","ini":"TU","env":"RT_ANCLA","entrar":true}, …]
   k: clave corta (letras y números) · env: variable con su permiso de Google (opcional: si no, vive en el almacén tras «Reconectar»)
   · entrar: si esa cuenta puede abrir sesión con Google. La genera scripts/configurar.mjs. */
function leerCuentas() {
  let lista = [];
  try { lista = JSON.parse(process.env.BZ_CUENTAS || '[]'); } catch { lista = []; }
  const out = {};
  for (const c of Array.isArray(lista) ? lista : []) {
    const k = String((c && c.k) || ''), email = String((c && c.email) || '').trim().toLowerCase();
    if (!/^[a-z0-9]{1,12}$/i.test(k) || !/^[^\s@]+@[^\s@]+$/.test(email) || out[k]) continue;
    out[k] = { email, name: String(c.nombre || email.split('@')[0]).slice(0, 40), ini: String(c.ini || '').slice(0, 3), env: /^[A-Z0-9_]{1,40}$/.test(c.env || '') ? c.env : null, entrar: !!c.entrar };
  }
  return out;
}
export const ACCOUNTS = leerCuentas();
// La cuenta ancla guarda el almacén cifrado en su Drive y recibe los avisos de cuentas caídas: BZ_ANCLA, o la primera.
export const ANCLA = ACCOUNTS[process.env.BZ_ANCLA] ? process.env.BZ_ANCLA : Object.keys(ACCOUNTS)[0] || null;
// URL pública de esta instalación (para el acceso con Google y los enlaces de los avisos): BZ_URL o la de Vercel
export function appUrl(req) {
  const fija = String(process.env.BZ_URL || '').replace(/\/+$/, '');
  if (/^https:\/\/[a-z0-9.-]+$/i.test(fija)) return fija;
  const host = String((req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '');
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? 'https://' + host : '';
}
// Las cuentas añadidas con «Añadir cuenta» viven en el almacén (store.extra) y se suman a estas.
export async function allAccounts() {
  const st = await readStore();
  const out = { ...ACCOUNTS };
  for (const [k, v] of Object.entries(st.extra || {})) if (!out[k]) out[k] = { email: v.email, name: v.name, extra: true };
  return out;
}
// Correos que pueden ENTRAR con Google: BZ_ENTRAR (separados por comas) o las cuentas fijas marcadas «entrar» y la ancla
export const LOGIN_EMAILS = (process.env.BZ_ENTRAR
  ? process.env.BZ_ENTRAR.split(',')
  : Object.entries(ACCOUNTS).filter(([k, a]) => a.entrar || k === ANCLA).map(([, a]) => a.email)
).map((e) => e.trim().toLowerCase()).filter(Boolean);

const COOKIE = 'bz';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días
export const YEAR = 60 * 60 * 24 * 365;
export const SHORT = 60 * 60 * 12; // sin «recordarme»: 12 horas, y la cookie muere al cerrar el navegador

const b64u = (buf) => Buffer.from(buf).toString('base64url');
// Cerrar TODAS las sesiones abiertas (p. ej. si pierdes el móvil): cambia BZ_SESION_VER en Vercel (2, 3…) y vuelve a desplegar
const SESSION_VER = String(process.env.BZ_SESION_VER || '1').slice(0, 20);

function hmac(data) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET ausente');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function makeSession(maxAge = MAX_AGE) {
  const payload = b64u(JSON.stringify({ exp: Date.now() + maxAge * 1000, n: crypto.randomBytes(8).toString('hex'), v: SESSION_VER }));
  return payload + '.' + hmac(payload);
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function validSession(req) {
  const tok = readCookie(req);
  if (!tok || tok.indexOf('.') < 0) return false;
  const [payload, sig] = tok.split('.');
  const expected = hmac(payload);
  const a = Buffer.from(sig || ''), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now() && (v || '1') === SESSION_VER;
  } catch { return false; }
}

export function sessionCookie(value, maxAge = MAX_AGE, persistent = true) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict` + (persistent ? `; Max-Age=${maxAge}` : '');
}

export function checkPassword(pw) {
  // APP_PASSWORD_HASH = scrypt$<saltB64>$<hashB64>
  const stored = process.env.APP_PASSWORD_HASH || '';
  const [kind, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64 || typeof pw !== 'string' || pw.length > 200) return false;
  const want = Buffer.from(hashB64, 'base64');
  const got = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(got, want);
}

// El MCP (un agente en tu ordenador) entra con «Authorization: Bearer <clave>»; aquí solo vive el SHA-256 de la clave (MCP_KEY_HASH)
export function esMaquina(req) {
  const h = (req.headers && req.headers.authorization) || '';
  const want = process.env.MCP_KEY_HASH || '';
  if (!h.startsWith('Bearer ') || !/^[0-9a-f]{64}$/.test(want)) return false;
  const got = crypto.createHash('sha256').update(h.slice(7).trim()).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function sameOrigin(req) {
  // Bloquea llamadas de otros sitios: el navegador marca Sec-Fetch-Site en toda petición fetch.
  const site = req.headers['sec-fetch-site'];
  return !site || site === 'same-origin';
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ---------------- almacén de permisos ----------------
// Ancla: el refresh token de la cuenta ancla, en su variable (env de BZ_CUENTAS; solo sirve para leer/escribir el almacén).
// Tras una reconexión, los permisos de cada cuenta viven cifrados (AES-256-GCM, clave TOKEN_KEY) en un archivo
// del Drive de la cuenta ancla que solo ve esta app (drive.file). Si no hay archivo, se usan las variables de cada cuenta.
// El almacén guarda también la foto de perfil de cada cuenta y por qué cayó cada una.
const STORE_NAME = 'buzonero-permisos.enc';
let storeCache = null, storeAt = 0, storeFileId = null, anchorTok = null;

function aesKey() { const k = Buffer.from(process.env.TOKEN_KEY || '', 'base64'); if (k.length !== 32) throw new Error('TOKEN_KEY ausente'); return k; }
function seal(obj) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', aesKey(), iv); const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64'); }
function unseal(b64) { const b = Buffer.from(b64, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', aesKey(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); }

async function googleRefresh(rt) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: rt || '', grant_type: 'refresh_token' }),
  });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}
async function anchorToken() {
  if (anchorTok && anchorTok.exp - Date.now() > 60000) return anchorTok.v;
  const env = ANCLA && ACCOUNTS[ANCLA].env;
  if (!env || !process.env[env]) throw new Error('ancla sin configurar');
  const { ok, j } = await googleRefresh(process.env[env]);
  if (!ok || !j.access_token) throw new Error('ancla');
  anchorTok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return anchorTok.v;
}
const emptyStore = () => ({ cuentas: {}, caidas: {}, fotos: {}, extra: {}, push: {}, hist: {} });
export async function readStore(force) {
  if (!force && storeCache && Date.now() - storeAt < 60000) return storeCache;
  try {
    const H = { Authorization: 'Bearer ' + await anchorToken() };
    const q = encodeURIComponent("name='" + STORE_NAME + "' and trashed=false");
    const lr = await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,modifiedTime)&orderBy=modifiedTime%20desc', { headers: H });
    const l = await lr.json().catch(() => ({}));
    // un error de Drive NO es «no hay almacén»: si se tomara por vacío, la siguiente escritura crearía uno nuevo y se perderían los permisos
    if (!lr.ok || !Array.isArray(l.files)) throw new Error('drive ' + lr.status);
    const f = l.files[0];
    let nuevo;
    if (!f) { nuevo = emptyStore(); storeFileId = null; }
    else {
      const mr = await fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media', { headers: H });
      if (!mr.ok) throw new Error('drive ' + mr.status);
      storeFileId = f.id; nuevo = unseal((await mr.text()).trim());
    }
    storeCache = { ...emptyStore(), ...nuevo };
    storeAt = Date.now();
  } catch (e) {
    // lectura fallida: quien solo lee puede usar la copia anterior; quien va a escribir (force) recibe la marca y no escribe
    if (force || !storeCache) return { ...emptyStore(), ...(storeCache || {}), _fallo: true };
  }
  return storeCache;
}
async function writeStore(store) {
  if (store._fallo) throw new Error('almacen sin leer');   // nunca pisar el almacén con uno vacío por un fallo de lectura
  const t = await anchorToken(), body = seal(store);
  if (storeFileId) {
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + storeFileId + '?uploadType=media', { method: 'PATCH', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'text/plain' }, body });
    if (!r.ok) throw new Error('almacen ' + r.status);
  } else {
    const b = 'bz' + crypto.randomBytes(6).toString('hex');
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: STORE_NAME, mimeType: 'text/plain' }) + '\r\n--' + b + '\r\nContent-Type: text/plain\r\n\r\n' + body + '\r\n--' + b + '--';
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'multipart/related; boundary=' + b }, body: mp });
    const j = await r.json().catch(() => ({})); if (!j.id) throw new Error('almacen'); storeFileId = j.id;
  }
  storeCache = store; storeAt = Date.now();
}
export async function saveReconnected(key, rt, picture) {
  const acc = (await allAccounts())[key];
  const st = JSON.parse(JSON.stringify(await readStore(true)));
  st.cuentas[key] = { rt, email: acc.email, actualizado: new Date().toISOString() };
  if (picture) st.fotos[acc.email] = picture;
  delete st.caidas[key];
  await writeStore(st);
}
// «Añadir cuenta»: si el correo ya está, es una reconexión; si no, hueco nuevo con su permiso.
export async function addAccount(email, name, rt, picture) {
  const todas = await allAccounts();
  const ya = Object.keys(todas).find((k) => todas[k].email.toLowerCase() === email);
  if (ya) { await saveReconnected(ya, rt, picture); return ya; }
  const st = JSON.parse(JSON.stringify(await readStore(true)));
  let key; do { key = 'x' + crypto.randomBytes(3).toString('hex'); } while (todas[key]);
  st.extra[key] = { email, name: name || email.split('@')[0], creada: new Date().toISOString() };
  st.cuentas[key] = { rt, email, actualizado: new Date().toISOString() };
  if (picture) st.fotos[email] = picture;
  await writeStore(st);
  return key;
}
// Quitar una cuenta añadida: se borra del almacén y se le retira el permiso en Google. Las fijas no se quitan.
export async function removeAccount(key) {
  const st = JSON.parse(JSON.stringify(await readStore(true)));
  if (!st.extra[key]) return false;
  const rt = st.cuentas[key] && st.cuentas[key].rt;
  delete st.extra[key]; delete st.cuentas[key]; delete st.caidas[key];
  await writeStore(st);
  if (rt) await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(rt), { method: 'POST' }).catch(() => {});
  return true;
}
export async function savePhoto(email, picture) {
  if (!picture) return;
  const st = await readStore();
  if (st.fotos[email] === picture) return;
  // se escribe sobre una lectura fresca, nunca sobre la copia de hasta 60 s (pisaría cambios de otras funciones)
  await updateStore((n) => { if (n.fotos[email] === picture) return false; n.fotos[email] = picture; });
}

// Cambia el almacén con una función (lee de Drive, aplica, escribe). Para avisos y vigía.
export async function updateStore(fn) {
  const st = JSON.parse(JSON.stringify(await readStore(true)));
  st.push = st.push || {}; st.hist = st.hist || {};
  const cambiado = await fn(st);
  if (cambiado !== false) await writeStore(st);
  return st;
}

// ---------------- avisos de «Avísame si no contesta» ----------------
// Van en un fichero aparte (buzonero-seguir.enc), cifrado igual: el vigía reescribe el almacén principal casi cada minuto
// (el punto del historial de cada cuenta) y, al leer de Drive una copia aún sin actualizar, se llevaba por delante
// un aviso recién puesto (visto en la prueba de punta a punta, 18-oct-2026). Así cada cosa escribe solo lo suyo.
const SEG_NAME = 'buzonero-seguir.enc';
let segFileId = null;
export async function readSeg() {
  const H = { Authorization: 'Bearer ' + await anchorToken() };
  if (!segFileId) {
    const q = encodeURIComponent("name='" + SEG_NAME + "' and trashed=false");
    const l = await (await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)&orderBy=modifiedTime%20desc', { headers: H })).json();
    if (!Array.isArray(l.files)) throw new Error('drive');
    segFileId = (l.files[0] || {}).id || null;
  }
  if (!segFileId) return {};
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + segFileId + '?alt=media', { headers: H });
  if (r.status === 404) { segFileId = null; return {}; }
  if (!r.ok) throw new Error('drive ' + r.status);
  return unseal((await r.text()).trim()) || {};
}
// lee, cambia con fn y escribe; si la lectura falla, no se escribe nada (nunca se pisa con uno vacío)
export async function updateSeg(fn) {
  const seg = await readSeg();
  if ((await fn(seg)) === false) return seg;
  const t = await anchorToken(), body = seal(seg);
  if (segFileId) {
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + segFileId + '?uploadType=media', { method: 'PATCH', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'text/plain' }, body });
    if (!r.ok) throw new Error('seguir ' + r.status);
  } else {
    const b = 'bz' + crypto.randomBytes(6).toString('hex');
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: SEG_NAME, mimeType: 'text/plain' }) + '\r\n--' + b + '\r\nContent-Type: text/plain\r\n\r\n' + body + '\r\n--' + b + '--';
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'multipart/related; boundary=' + b }, body: mp });
    const j = await r.json().catch(() => ({})); if (!j.id) throw new Error('seguir'); segFileId = j.id;
  }
  return seg;
}

// ---------------- envíos pendientes («Enviar» pulsado: si la app se cierra, lo envía el vigía) ----------------
// Fichero aparte (buzonero-envios.enc), cifrado igual que los demás. Solo cuenta, id del borrador, cuándo y el asunto: nunca el correo.
const ENV_NAME = 'buzonero-envios.enc';
let envFileId = null;
export async function readEnv() {
  const H = { Authorization: 'Bearer ' + await anchorToken() };
  if (!envFileId) {
    const q = encodeURIComponent("name='" + ENV_NAME + "' and trashed=false");
    const l = await (await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)&orderBy=modifiedTime%20desc', { headers: H })).json();
    if (!Array.isArray(l.files)) throw new Error('drive');
    envFileId = (l.files[0] || {}).id || null;
  }
  if (!envFileId) return {};
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + envFileId + '?alt=media', { headers: H });
  if (r.status === 404) { envFileId = null; return {}; }
  if (!r.ok) throw new Error('drive ' + r.status);
  return unseal((await r.text()).trim()) || {};
}
export async function updateEnv(fn) {
  const env = await readEnv();
  if ((await fn(env)) === false) return env;
  const t = await anchorToken(), body = seal(env);
  if (envFileId) {
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + envFileId + '?uploadType=media', { method: 'PATCH', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'text/plain' }, body });
    if (!r.ok) throw new Error('envios ' + r.status);
  } else {
    const b = 'bz' + crypto.randomBytes(6).toString('hex');
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: ENV_NAME, mimeType: 'text/plain' }) + '\r\n--' + b + '\r\nContent-Type: text/plain\r\n\r\n' + body + '\r\n--' + b + '--';
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'multipart/related; boundary=' + b }, body: mp });
    const j = await r.json().catch(() => ({})); if (!j.id) throw new Error('envios'); envFileId = j.id;
  }
  return env;
}


// ---------------- avisos al móvil (Web Push, sin librerías) ----------------
// RFC 8291 (cifrado aes128gcm) + RFC 8292 (VAPID). Claves en VAPID_PUBLIC (punto P-256 sin comprimir, base64url)
// y VAPID_PRIVATE (d, base64url). Vale para el iPhone (web.push.apple.com), Chrome y Firefox.
const hmac256 = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
function vapidKey() {
  const pub = Buffer.from(process.env.VAPID_PUBLIC || '', 'base64url');
  if (pub.length !== 65 || !process.env.VAPID_PRIVATE) throw new Error('VAPID ausente');
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE, x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
}
export function vapidJwt(endpoint) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = b({ typ: 'JWT', alg: 'ES256' }) + '.' + b({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + (ANCLA ? ACCOUNTS[ANCLA].email : 'admin@example.com') });
  return data + '.' + crypto.sign('sha256', Buffer.from(data), { key: vapidKey(), dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
export function cifrar(sub, texto) {
  const uaPub = Buffer.from(sub.keys.p256dh, 'base64url'), auth = Buffer.from(sub.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), secreto = ecdh.computeSecret(uaPub);
  const ikm = hmac256(hmac256(auth, secreto), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const salt = crypto.randomBytes(16), prk = hmac256(salt, ikm);
  const cek = hmac256(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac256(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const cuerpo = Buffer.concat([c.update(Buffer.concat([Buffer.from(texto, 'utf8'), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, cuerpo]);
}
// Devuelve el código HTTP del servicio de avisos (201 = entregado; 404/410 = suscripción muerta)
export async function webPush(sub, datos, urgente = true) {
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: 'vapid t=' + vapidJwt(sub.endpoint) + ', k=' + process.env.VAPID_PUBLIC, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: urgente ? 'high' : 'normal' }, body: cifrar(sub, JSON.stringify(datos)) });
  return r.status;
}
// Manda un aviso a todos los móviles suscritos y borra los que ya no existen
export async function pushTodos(datos) {
  const st = await readStore(true), subs = Object.entries(st.push || {});
  const muertos = [], res = await Promise.all(subs.map(async ([h, s]) => { try { const c = await webPush(s.sub, datos); if (c === 404 || c === 410) muertos.push(h); return c; } catch (e) { return 0; } }));
  if (muertos.length) await updateStore((n) => { muertos.forEach((h) => delete n.push[h]); });
  return res;
}
export async function accessToken(key) { const r = await refreshAccess(key); return r.status === 200 ? r.body.access_token : null; }

// Aviso por correo a la cuenta ancla cuando otra cuenta se desconecta (una vez por caída)
async function alertEmail(key, caida) {
  if (!ANCLA) return;
  const to = ACCOUNTS[ANCLA].email, acc = (await allAccounts())[key];
  const names = { [key]: acc.name };
  const subject = 'Buzonero: ' + names[key] + ' se ha desconectado';
  const link = (appUrl() || '') + '/app';
  const text = 'Hola:\n\nLa cuenta ' + names[key] + ' (' + acc.email + ') se ha desconectado de Google en Buzonero Campillero.\n'
    + 'Motivo que da Google: ' + (caida.descripcion || caida.error) + '.\n\n'
    + 'Para volver a conectarla: entra en ' + link + ', pulsa el aviso rojo «Reconectar» (o el engranaje, Reconectar con Google) y elige esa cuenta.\n\nEnviado por Buzonero Campillero.';
  const mime = ['From: "Buzonero Campillero" <' + to + '>', 'To: ' + to, 'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(text).toString('base64')].join('\r\n');
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: 'Bearer ' + await anchorToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }) });
}

export async function refreshAccess(key, reintento) {
  const acc = (await allAccounts())[key];
  if (!acc) return { status: 400, body: { error: 'cuenta' } };
  const st = await readStore(reintento);
  const rt = (st.cuentas[key] && st.cuentas[key].rt) || (acc.env ? process.env[acc.env] : '');
  if (!rt) return { status: 409, body: { error: 'reconectar', email: acc.email, motivo: 'sin permiso guardado' } };
  const { ok, j } = await googleRefresh(rt);
  if (!ok || !j.access_token) {
    const reconnect = j.error === 'invalid_grant' || j.error === 'unauthorized_client';
    // la copia de 60 s puede traer el permiso de antes de un «Reconectar» recién hecho: se relee de Drive y se prueba otra vez
    if (reconnect && !reintento) return refreshAccess(key, true);
    let caida = null;
    if (reconnect) {
      // se apunta por qué cayó (una vez por motivo): caducidad, contraseña cambiada, administrador...
      try {
        const prev = st.caidas[key];
        caida = { error: j.error, descripcion: j.error_description || '', desde: prev && prev.error === j.error ? prev.desde : new Date().toISOString() };
        if (!prev || prev.error !== caida.error || prev.descripcion !== caida.descripcion) {
          await updateStore((n) => { n.caidas[key] = caida; });
          if (!prev && key !== ANCLA) await alertEmail(key, caida).catch(() => {});
        }
      } catch (e) {}
    }
    return { status: reconnect ? 409 : 502, body: { error: reconnect ? 'reconectar' : 'google', email: acc.email, ...(caida ? { motivo: caida.descripcion || caida.error, desde: caida.desde } : {}) } };
  }
  // vuelve a funcionar (p. ej. se cambió su variable): se borra la caída anterior para que una caída futura vuelva a avisar
  if (st.caidas && st.caidas[key]) await updateStore((n) => { if (!n.caidas[key]) return false; delete n.caidas[key]; }).catch(() => {});
  return { status: 200, body: { access_token: j.access_token, expires_in: j.expires_in, email: acc.email } };
}
