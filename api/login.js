import { checkPassword, makeSession, sessionCookie, sameOrigin, noStore, readStore, updateStore } from './_lib.js';

// Freno a quien prueba contraseñas: como mucho 10 fallos por hora entre todos (se cuentan en el almacén cifrado,
// porque en Vercel cada llamada puede ir a un servidor distinto). Pasado el límite, ni se comprueba la contraseña.
const MAX_FALLOS = 10, VENTANA = 3600e3;
const recientes = (st) => (Array.isArray(st.fallos) ? st.fallos : []).filter((t) => typeof t === 'number' && t > Date.now() - VENTANA);
// copia en memoria de esta instancia (respaldo para cuando el almacén no se puede leer o escribir)
const MAX_FALLOS_SIN_ALMACEN = 5;
const fallosMemoria = [];
const enMemoria = () => { while (fallosMemoria.length && fallosMemoria[0] <= Date.now() - VENTANA) fallosMemoria.shift(); return fallosMemoria; };

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origen' });
  let st = {}; try { st = await readStore(true); } catch {}
  // Si Drive no contesta, el freno NO se apaga: cuenta lo que esta instancia ha visto fallar (más corto, 5 por hora) y quien prueba sigue topándose con él.
  // Quien sabe la contraseña entra igual (no se le cierra la puerta por una caída de Drive); quien adivina no tiene intentos de sobra.
  const sinAlmacen = !!st._fallo || !Array.isArray(st.fallos) && !st.cuentas;
  if (recientes(st).length >= MAX_FALLOS || (sinAlmacen && enMemoria().length >= MAX_FALLOS_SIN_ALMACEN)) { res.setHeader('Retry-After', '900'); return res.status(429).json({ error: 'espera' }); }
  const pw = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (!checkPassword(pw)) {
    fallosMemoria.push(Date.now());
    try { await updateStore((n) => { n.fallos = recientes(n).concat(Date.now()).slice(-50); }); } catch {}
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'clave' });
  }
  res.setHeader('Set-Cookie', sessionCookie(makeSession()));
  return res.status(200).json({ ok: true });
}
