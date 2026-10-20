// Empieza un acceso con Google. Dos fines:
// - entrar: identidad (openid, email y perfil, para la foto) para abrir sesión en la web;
// - reconectar: vuelve a dar a la app los permisos de correo de UNA cuenta (exige sesión abierta); con «cola», al terminar
//   sigue sola con las siguientes («Reconectar todas las cuentas»);
// - anadir: conecta una cuenta nueva que se elige en Google (exige sesión abierta);
// - contactos: conecta SOLO la lectura de Contactos de una cuenta de Google (no es una cuenta de correo; exige sesión abierta);
// - metricool: conecta Metricool por su MCP (OAuth con la cuenta de Metricool de la persona; exige sesión abierta).
import crypto from 'node:crypto';
import { noStore, validSession, ACCOUNTS, allAccounts, appUrl } from '../_lib.js';
import { mcpEmpezar } from '../_metricool.js';

// la vuelta de Google: la URL de esta instalación (tiene que estar dada de alta en el cliente OAuth de Google Cloud)
export const redirectUri = (req) => appUrl(req) + '/api/auth/callback';
export const MAIL_SCOPES = [
  'openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly', 'https://www.googleapis.com/auth/calendar',
];
const mac = (s) => crypto.createHmac('sha256', process.env.SESSION_SECRET).update('state:' + s).digest('base64url');
export function packState(o) { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + mac(p); }
export function unpackState(v) {
  const [p, sig] = String(v || '').split('.');
  if (!p || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
}

export default async function handler(req, res) {
  noStore(res);
  const q = req.query || {};
  const fin = ['reconectar', 'anadir', 'contactos', 'metricool'].includes(q.fin) ? q.fin : 'entrar';
  const acc = String(q.acc || '');
  const nombre = String(q.nombre || '').replace(/[<>"'&\u0000-\u001f]/g, '').trim().slice(0, 30);
  const go = (url) => { res.statusCode = 302; res.setHeader('Location', url); res.end(); };
  const todas = fin === 'reconectar' ? await allAccounts() : ACCOUNTS;
  if (fin === 'reconectar' && (!validSession(req) || !todas[acc])) return go('/app?reconectar=sesion');
  if (fin === 'anadir' && !validSession(req)) return go('/app?anadir=sesion');
  if (fin === 'contactos' && !validSession(req)) return go('/app?contactos=sesion');
  if (fin === 'metricool' && !validSession(req)) return go('/app?vista=INTEGRACIONES&metricool=sesion');
  const cola = fin === 'reconectar' ? [...new Set(String(q.cola || '').split(',').filter((k) => todas[k] && k !== acc))].slice(0, 12) : [];
  const n = crypto.randomBytes(16).toString('base64url');
  const r = String(q.r || '1') !== '0';
  // Metricool por MCP (OAuth con PKCE): el verificador viaja en la cookie firmada y vuelve con el código
  let mc = null;
  if (fin === 'metricool') { try { mc = await mcpEmpezar(redirectUri(req), n); } catch { return go('/app?vista=INTEGRACIONES&metricool=registro'); } }
  res.setHeader('Set-Cookie', `bz_state=${packState({ n, r, fin, acc, nombre, cola, v: mc ? mc.verifier : undefined })}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  if (mc) return go(mc.url);
  const params = { client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(req), response_type: 'code', state: n };
  if (fin === 'entrar') Object.assign(params, { scope: 'openid email profile', prompt: 'select_account' });
  else if (fin === 'contactos') Object.assign(params, { scope: 'openid email https://www.googleapis.com/auth/contacts.readonly', access_type: 'offline', prompt: 'consent select_account' });
  else if (fin === 'anadir') Object.assign(params, { scope: MAIL_SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account' });
  else Object.assign(params, { scope: MAIL_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', login_hint: todas[acc].email });
  go('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(params).toString());
}
