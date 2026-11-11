// El TOQUE del CRM: cuando el CRM guarda un contacto nuevo o una nota de entrada, avisa aquí al instante (POST /api/zernio?r=crm-aviso&t=<CRM_EXT_HOOK>) y Buzonero, en vez de
// esperar a la siguiente pasada del vigía (cada minuto), consulta el CRM en ese momento y manda los avisos con la MISMA lógica (detectarCrmExt, api/_crmext.js).
// No se fía de nada de lo que traiga el cuerpo: es solo una señal de «mira ahora». Si el toque no llega o se descarta, el vigía lo recoge en el minuto siguiente.
// Va sin sesión (lo llama el CRM, no una persona), así que lleva su propia clave en la dirección (CRM_EXT_HOOK, de 20 caracteres o más) y un freno de 15 s entre consultas.
import crypto from 'node:crypto';
import { readStore, updateStore, pushTodos } from './_lib.js';
import { hayCrmExt, detectarCrmExt } from './_crmext.js';

let ultimo = 0;   // cuándo se hizo la última consulta por toque, en esta instancia
const claveOk = (t) => {
  const want = String(process.env.CRM_EXT_HOOK || ''), a = Buffer.from(String(t || '')), b = Buffer.from(want);
  return want.length >= 20 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

export async function crmAviso(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!claveOk(req.query && req.query.t)) return res.status(401).json({ error: 'clave' });
  if (!hayCrmExt()) return res.status(200).json({ ok: true, sinCrm: true });
  if (Date.now() - ultimo < 15000) return res.status(200).json({ ok: true, omitido: 'reciente' });   // varios toques seguidos: basta la primera consulta
  ultimo = Date.now();
  const st = await readStore(true);
  if (st._fallo) return res.status(503).json({ error: 'almacen' });
  if (!Object.keys(st.push || {}).length) return res.status(200).json({ ok: true, sinMoviles: true });
  const d = await detectarCrmExt(st.hist || {}, true);
  if (!d.ok) return res.status(200).json({ ok: false, error: 'crm' });
  // se «reclaman» los puntos antes de avisar: si el vigía ya los movió mientras tanto, no se avisa dos veces
  let reclamado = false;
  await updateStore((n) => {
    n.hist = n.hist || {};
    if ((Number(n.hist._crmext) || 0) !== d.punto) return false;
    Object.assign(n.hist, d.nuevosH, { _hookT: Date.now() });
    reclamado = true;
  }).catch(() => {});
  if (!reclamado) return res.status(200).json({ ok: true, omitido: 'ya_visto' });
  let entregas = 0;
  for (const a of d.avisos) entregas += (await pushTodos(a)).filter((c) => c >= 200 && c < 300).length;
  return res.status(200).json({ ok: true, avisos: d.avisos.length, nuevos: d.nuevos, vuelven: d.vuelven, entregas });
}
