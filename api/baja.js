// Baja con un toque (RFC 8058): el navegador no puede hacer este POST a otra web (CORS), así que lo hace el servidor.
// Solo con sesión válida, solo https y nunca hacia direcciones internas.
import dns from 'node:dns/promises';
import net from 'node:net';
import { validSession, sameOrigin, noStore } from './_lib.js';

function privada(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
  let u;
  try { u = new URL(String((req.body && req.body.url) || '')); } catch { return res.status(400).json({ error: 'direccion' }); }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || net.isIP(u.hostname)) return res.status(400).json({ error: 'direccion' });
  try {
    const ips = await dns.lookup(u.hostname, { all: true });
    if (!ips.length || ips.some((x) => privada(x.address))) return res.status(400).json({ error: 'direccion' });
  } catch { return res.status(400).json({ error: 'direccion' }); }
  try {
    const r = await fetch(u.toString(), {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Buzonero' },
      body: 'List-Unsubscribe=One-Click',
      signal: AbortSignal.timeout(8000),
    });
    return res.status(200).json({ ok: r.status < 400, status: r.status });
  } catch { return res.status(502).json({ error: 'sin-respuesta' }); }
}
