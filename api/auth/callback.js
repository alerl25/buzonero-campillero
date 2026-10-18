// Vuelta de Google para los dos fines (entrar / reconectar).
import { LOGIN_EMAILS, allAccounts, addAccount, makeSession, sessionCookie, noStore, readCookie, YEAR, SHORT, saveReconnected, savePhoto } from '../_lib.js';
import { redirectUri, MAIL_SCOPES, unpackState } from './start.js';

function back(res, query, extraCookies = []) {
  res.statusCode = 302;
  res.setHeader('Set-Cookie', ['bz_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0', ...extraCookies]);
  res.setHeader('Location', '/app' + (query ? '?' + query : ''));
  res.end();
}

export default async function handler(req, res) {
  noStore(res);
  const { code, state, error } = req.query || {};
  const st = unpackState(readCookie(req, 'bz_state'));
  const rec = !!(st && st.fin === 'reconectar'), add = !!(st && st.fin === 'anadir');
  const fail = (m) => back(res, (rec ? 'reconectar=' : add ? 'anadir=' : 'acceso=') + encodeURIComponent(m) + (rec ? '&acc=' + encodeURIComponent(st.acc) : ''));
  if (error) return fail('cancelado');
  if (!st || !state || !code || st.n !== String(state)) return fail('caducado');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: String(code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(req), grant_type: 'authorization_code' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id_token) return fail('google');
  let p = {};
  try { p = JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64url').toString()); } catch { return fail('google'); }
  const okIss = p.iss === 'https://accounts.google.com' || p.iss === 'accounts.google.com';
  const email = String(p.email || '').toLowerCase();
  if (!okIss || p.aud !== process.env.GOOGLE_CLIENT_ID || !(p.exp * 1000 > Date.now()) || p.email_verified !== true) return fail('google');

  if (add) {
    // cuenta nueva: la que haya elegido en Google, con todos los permisos y permiso permanente
    const granted = String(j.scope || '').split(/\s+/);
    if (MAIL_SCOPES.some((s) => s !== 'openid' && !granted.includes(s))) return fail('faltan_permisos');
    if (!j.refresh_token) return fail('sin_permiso_offline');
    let key; try { key = await addAccount(email, st.nombre, j.refresh_token, p.picture); } catch { return fail('guardar'); }
    return back(res, 'anadida=' + encodeURIComponent(key));
  }
  if (!rec) {
    if (!LOGIN_EMAILS.includes(email)) return fail('cuenta');
    try { await savePhoto(email, p.picture); } catch {}
    const age = st.r ? YEAR : SHORT;
    return back(res, '', [sessionCookie(makeSession(age), age, !!st.r)]);
  }
  // reconectar: tiene que ser exactamente la cuenta de ese hueco y con todos los permisos
  const slot = (await allAccounts())[st.acc];
  if (!slot || email !== slot.email.toLowerCase()) return fail('otra_cuenta');
  const granted = String(j.scope || '').split(/\s+/);
  const missing = MAIL_SCOPES.filter((s) => s !== 'openid' && !granted.includes(s));
  if (missing.length) return fail('faltan_permisos');
  if (!j.refresh_token) return fail('sin_permiso_offline');
  try { await saveReconnected(st.acc, j.refresh_token, p.picture); } catch { return fail('guardar'); }
  return back(res, 'reconectada=' + encodeURIComponent(st.acc));
}
