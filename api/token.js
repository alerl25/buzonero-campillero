// Entrega un access token de corta duración (1 h) de UNA cuenta:
// - a la sesión abierta en la web (cookie), o
// - al conector de Claude (cabecera Authorization: Bearer <llave de máquina>, guardada en el baúl).
// El refresh token nunca sale del servidor.
import crypto from 'node:crypto';
import { allAccounts, validSession, sameOrigin, noStore, refreshAccess } from './_lib.js';

function validMachineKey(req) {
  const h = req.headers.authorization || '';
  const want = process.env.MCP_KEY_HASH || '';
  if (!h.startsWith('Bearer ') || want.length !== 64) return false;
  const got = crypto.createHash('sha256').update(h.slice(7).trim()).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'metodo' });
  const machine = validMachineKey(req);
  if (!machine) {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
    if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
  }
  const todas = await allAccounts();
  // ?lista=1: qué cuentas hay (para el conector de Claude, que no tiene la lista fija)
  if (req.query.lista) return res.status(200).json({ cuentas: Object.entries(todas).map(([k, a]) => ({ key: k, email: a.email, name: a.name })) });
  const key = String(req.query.acc || '');
  if (!Object.prototype.hasOwnProperty.call(todas, key)) return res.status(400).json({ error: 'cuenta' });
  const r = await refreshAccess(key);
  return res.status(r.status).json(r.body);
}
