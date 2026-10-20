// Contactos de Google (solo si se han conectado con el botón de la vista WhatsApp): nombre y foto por teléfono.
// Solo lectura de Contactos. Se cruza en el servidor y a la app solo le llegan los de quien ha escrito por WhatsApp.
import { emailsContactos, tokenContactos } from './_lib.js';

let CACHE = { t: 0, clave: '', m: {}, n: 0, fotos: 0, fallos: [] };
export const clave9 = (v) => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : ''; };

// { m: { últimos9: [nombre, foto] }, emails, n: teléfonos cargados, fotos: cuántos con foto, fallos: [códigos de Google] }
export async function agenda() {
  const emails = await emailsContactos().catch(() => []);
  if (!emails.length) return { m: {}, emails: [], n: 0, fotos: 0, fallos: [] };
  const clave = emails.join(',');
  if (CACHE.clave === clave && Date.now() - CACHE.t < 30 * 60000 && !CACHE.fallos.length) return { m: CACHE.m, emails, n: CACHE.n, fotos: CACHE.fotos, fallos: CACHE.fallos };
  const m = {}, fallos = []; let fotos = 0;
  for (const e of emails) {
    try {
      const tk = await tokenContactos(e); if (!tk) { fallos.push('sin-permiso'); continue; }
      let pag = '';
      for (let i = 0; i < 12; i++) {
        const r = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,photos&pageSize=1000' + (pag ? '&pageToken=' + encodeURIComponent(pag) : ''), { headers: { Authorization: 'Bearer ' + tk } });
        if (!r.ok) { fallos.push('google-' + r.status); break; }
        const j = await r.json().catch(() => ({}));
        for (const p of j.connections || []) {
          const nom = (p.names && p.names[0] && p.names[0].displayName) || '', f = (p.photos || []).filter((x) => !x.default && x.url)[0];
          for (const n of p.phoneNumbers || []) { const k = clave9(n.canonicalForm || n.value); if (k && (nom || f) && !m[k]) { m[k] = [nom, f ? f.url.replace(/=s\d+(-c)?$/, '=s96-c') : '']; if (f) fotos++; } }
        }
        pag = j.nextPageToken || ''; if (!pag) break;
      }
    } catch (err) { fallos.push('error'); }
  }
  const n = Object.keys(m).length;
  CACHE = { t: Date.now(), clave, m, n, fotos, fallos };
  return { m, emails, n, fotos, fallos };
}
