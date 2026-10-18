// Quitar una cuenta añadida con «Añadir cuenta» (las fijas de BZ_CUENTAS no se pueden quitar).
import { validSession, sameOrigin, noStore, removeAccount } from './_lib.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
  const key = String((req.body && req.body.quitar) || '');
  if (!/^x[0-9a-f]{6}$/.test(key)) return res.status(400).json({ error: 'cuenta' });
  try { return (await removeAccount(key)) ? res.status(200).json({ ok: true }) : res.status(404).json({ error: 'cuenta' }); }
  catch { return res.status(500).json({ error: 'almacen' }); }
}
