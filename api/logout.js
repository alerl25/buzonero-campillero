import { sessionCookie, sameOrigin, noStore } from './_lib.js';

export default function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return res.status(200).json({ ok: true });
}
