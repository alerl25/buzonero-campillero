// «Enviar» pulsado en la app: el borrador final ya está en Gmail y aquí se apunta cuándo enviarlo.
// Si la app sigue abierta, lo envía ella al acabar la cuenta atrás y quita la nota; si se cierra (o se apaga el ordenador),
// el vigía, que pasa cada minuto, lo envía con drafts/send. Gmail no deja enviar dos veces el mismo borrador.
import { validSession, sameOrigin, noStore, readEnv, updateEnv, allAccounts, esMaquina } from './_lib.js';

export default async function handler(req, res) {
  noStore(res);
  const maquina = esMaquina(req);
  if (!maquina && !validSession(req)) return res.status(401).json({ error: 'sesion' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, env: await readEnv() });
    if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
    if (!maquina && !sameOrigin(req)) return res.status(403).json({ error: 'origen' });
    const b = req.body || {}, k = String(b.k || ''), draft = String(b.draft || '');
    if (!(await allAccounts())[k] || !/^r?-?[0-9A-Za-z]{6,40}$/.test(draft)) return res.status(400).json({ error: 'borrador' });
    const clave = k + '|' + draft;
    if (b.accion === 'poner') {
      const ahora = Date.now(), tras = Number(b.tras);
      if (!(tras > ahora - 120000 && tras < ahora + 3600000)) return res.status(400).json({ error: 'fecha' });
      const segVence = Number(b.segVence) || 0;
      const e = { k, draft, tras, puesto: ahora, asunto: String(b.asunto || '').slice(0, 200), para: String(b.para || '').slice(0, 200), segVence: segVence > ahora ? segVence : 0 };
      await updateEnv((env) => { env[clave] = e; });
      return res.status(200).json({ ok: true });
    }
    if (b.accion === 'quitar') { await updateEnv((env) => { if (!env[clave]) return false; delete env[clave]; }); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: 'accion' });
  } catch (e) { return res.status(500).json({ error: 'almacen' }); }
}
