import { allAccounts, validSession, sameOrigin, noStore, readStore, ANCLA } from './_lib.js';

export default async function handler(req, res) {
  noStore(res);
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  if (!validSession(req)) return res.status(401).json({ ok: false });
  let st = { fotos: {}, caidas: {}, cuentas: {} }, todas = {};
  try { st = await readStore(); todas = await allAccounts(); } catch {}
  const accounts = Object.entries(todas).map(([key, a]) => ({ key, email: a.email, name: a.name, ini: a.ini || '', extra: !!a.extra, ancla: key === ANCLA, foto: st.fotos[a.email] || null, caida: st.caidas[key] || null, reconectada: (st.cuentas[key] && st.cuentas[key].actualizado) || null }));
  return res.status(200).json({ ok: true, accounts, vapid: process.env.VAPID_PUBLIC || null, version: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || '' });
}
