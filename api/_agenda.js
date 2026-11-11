// Contactos de Google (solo si se han conectado con el botón de la vista WhatsApp): nombre y foto por teléfono.
// Solo lectura de Contactos. Se cruza en el servidor y a la app solo le llegan los de quien ha escrito por WhatsApp.
import { conexionesContactos, tokenContactos } from './_lib.js';

let CACHE = { t: 0, clave: '', m: {}, n: 0, fotos: 0, fallos: [] };
export const clave9 = (v) => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : ''; };
// Cuánto vale lo leído: 30 min si todo fue bien; 2 min si alguna agenda falló. Antes, con un fallo no se guardaba nada y cada sondeo de la lista
// de WhatsApp (cada 10 s) volvía a bajar TODAS las agendas, también las sanas. Reconectar una agenda cambia su `desde` y con él la clave: se relee al momento.
const VALE_BIEN = 30 * 60000, VALE_CON_FALLOS = 2 * 60000;

// Los teléfonos de UNA agenda: { m: { últimos9: [nombre, foto] }, fallos }. Si se corta a medias, se queda con lo leído hasta ahí.
async function leerAgenda(e) {
  const m = {}, fallos = [];
  try {
    const tk = await tokenContactos(e); if (!tk) { fallos.push('sin-permiso'); return { m, fallos }; }
    let pag = '';
    for (let i = 0; i < 12; i++) {
      const r = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,photos&pageSize=1000' + (pag ? '&pageToken=' + encodeURIComponent(pag) : ''), { headers: { Authorization: 'Bearer ' + tk } });
      if (!r.ok) { fallos.push('google-' + r.status); break; }
      const j = await r.json().catch(() => ({}));
      for (const p of j.connections || []) {
        const nom = (p.names && p.names[0] && p.names[0].displayName) || '', f = (p.photos || []).filter((x) => !x.default && x.url)[0];
        for (const n of p.phoneNumbers || []) { const k = clave9(n.canonicalForm || n.value); if (k && (nom || f) && !m[k]) m[k] = [nom, f ? f.url.replace(/=s\d+(-c)?$/, '=s96-c') : '']; }
      }
      pag = j.nextPageToken || ''; if (!pag) break;
    }
  } catch (err) { fallos.push('error'); }
  return { m, fallos };
}

// { m: { últimos9: [nombre, foto] }, emails, n: teléfonos cargados, fotos: cuántos con foto, fallos: [códigos de Google] }
// fresco = false: vale la copia del almacén de hasta 60 s para saber qué agendas hay (lo usa la lista de conversaciones, que se sondea cada pocos segundos).
export async function agenda(fresco = true) {
  const conex = await conexionesContactos(fresco).catch(() => []), emails = conex.map(([e]) => e);
  if (!emails.length) return { m: {}, emails: [], n: 0, fotos: 0, fallos: [] };
  const clave = JSON.stringify(conex);
  if (CACHE.clave === clave && Date.now() - CACHE.t < (CACHE.fallos.length ? VALE_CON_FALLOS : VALE_BIEN)) return { m: CACHE.m, emails, n: CACHE.n, fotos: CACHE.fotos, fallos: CACHE.fallos };
  // las agendas se leen a la vez (antes una detrás de otra) y se juntan en el orden de siempre: si un teléfono está en dos, gana la primera
  const partes = await Promise.all(emails.map(leerAgenda));
  const m = {}, fallos = []; let fotos = 0;
  for (const parte of partes) {
    for (const k of Object.keys(parte.m)) { if (!m[k]) { m[k] = parte.m[k]; if (parte.m[k][1]) fotos++; } }
    fallos.push(...parte.fallos);
  }
  const n = Object.keys(m).length;
  CACHE = { t: Date.now(), clave, m, n, fotos, fallos };
  return { m, emails, n, fotos, fallos };
}
