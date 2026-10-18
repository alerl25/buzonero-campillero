// «Avísame si no contesta»: apunta un hilo y hasta cuándo esperar.
// El vigía, que pasa cada minuto, mira al vencer si alguien ha respondido; si no, avisa al móvil y devuelve el hilo a Recibidos.
// Se guarda cifrado en su propio fichero de Drive (readSeg/updateSeg), nunca el correo: solo cuenta, hilo, asunto, a quién y las fechas.
import { validSession, sameOrigin, noStore, readSeg, updateSeg, allAccounts } from './_lib.js';

const DIA = 86400000;
export default async function handler(req, res) {
  noStore(res);
  if (!validSession(req)) return res.status(401).json({ error: 'sesion' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, seg: await readSeg() });
    if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
    const b = req.body || {}, k = String(b.k || ''), hilo = String(b.hilo || '');
    if (!(await allAccounts())[k] || !/^[0-9a-f]{6,24}$/.test(hilo)) return res.status(400).json({ error: 'hilo' });
    const clave = k + '|' + hilo;
    if (b.accion === 'poner') {
      // margen de 30 s por si el reloj del móvil va algo por detrás del servidor
      const ahora = Date.now(), vence = Number(b.vence), desde = Number(b.desde) || ahora;
      if (!(vence > ahora + 30000 && vence < ahora + 62 * DIA) || !(desde <= ahora + 60000 && desde > ahora - 62 * DIA)) return res.status(400).json({ error: 'fecha' });
      const s = { k, hilo, vence, desde, asunto: String(b.asunto || '').slice(0, 200), para: String(b.para || '').slice(0, 200), puesto: ahora };
      return res.status(200).json({ ok: true, seg: await updateSeg((seg) => { seg[clave] = s; }) });
    }
    if (b.accion === 'quitar') return res.status(200).json({ ok: true, seg: await updateSeg((seg) => { if (!seg[clave]) return false; delete seg[clave]; }) });
    return res.status(400).json({ error: 'accion' });
  } catch (e) { return res.status(500).json({ error: 'almacen' }); }
}
