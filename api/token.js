// Entrega un access token de corta duración (1 h) de UNA cuenta:
// - a la sesión abierta en la web (cookie), o
// - al MCP (cabecera Authorization: Bearer <clave>; en el servidor solo está su SHA-256, MCP_KEY_HASH).
// El refresh token nunca sale del servidor.
import { allAccounts, validSession, sameOrigin, noStore, refreshAccess, esMaquina } from './_lib.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'metodo' });
  const machine = esMaquina(req);
  if (!machine) {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
    if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
  }
  const todas = await allAccounts();
  // ?lista=1: qué cuentas hay (para el MCP, que no tiene la lista fija)
  if (req.query.lista) return res.status(200).json({ cuentas: Object.entries(todas).map(([k, a]) => ({ key: k, email: a.email, name: a.name })) });
  const key = String(req.query.acc || '');
  if (!Object.prototype.hasOwnProperty.call(todas, key)) return res.status(400).json({ error: 'cuenta' });
  const r = await refreshAccess(key);
  return res.status(r.status).json(r.body);
}
