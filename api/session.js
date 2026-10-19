// La sesión: GET → cuentas y estado · POST ?r=salir → cerrar sesión · POST ?r=cuenta { quitar } → quitar una cuenta añadida.
// Salir y quitar cuenta vivían en logout.js y cuenta.js; se juntaron aquí porque el plan gratis de Vercel admite 12 funciones
// (vercel.json sigue llevando /api/logout y /api/cuenta hasta aquí).
import { allAccounts, validSession, sameOrigin, noStore, readStore, ANCLA, sessionCookie, removeAccount } from './_lib.js';

export default async function handler(req, res) {
  noStore(res);
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  const r = String((req.query && req.query.r) || '');
  if (r === 'salir') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return res.status(200).json({ ok: true });
  }
  if (r === 'cuenta') {
    // Quitar una cuenta añadida con «Añadir cuenta» (las fijas de BZ_CUENTAS no se pueden quitar).
    if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
    if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
    const key = String((req.body && req.body.quitar) || '');
    if (!/^x[0-9a-f]{6}$/.test(key)) return res.status(400).json({ error: 'cuenta' });
    try { return (await removeAccount(key)) ? res.status(200).json({ ok: true }) : res.status(404).json({ error: 'cuenta' }); }
    catch { return res.status(500).json({ error: 'almacen' }); }
  }
  if (!validSession(req)) return res.status(401).json({ ok: false });
  let st = { fotos: {}, caidas: {}, cuentas: {} }, todas = {};
  try { st = await readStore(); todas = await allAccounts(); } catch {}
  const accounts = Object.entries(todas).map(([key, a]) => ({ key, email: a.email, name: a.name, ini: a.ini || '', extra: !!a.extra, ancla: key === ANCLA, foto: st.fotos[a.email] || null, caida: st.caidas[key] || null, reconectada: (st.cuentas[key] && st.cuentas[key].actualizado) || null }));
  return res.status(200).json({ ok: true, accounts, vapid: process.env.VAPID_PUBLIC || null, version: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || '' });
}
