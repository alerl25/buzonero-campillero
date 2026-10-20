// Contactos de Google (solo si se han conectado con el botón de la vista WhatsApp): nombre y foto por teléfono.
// Solo lectura de Contactos. Se cruza en el servidor y a la app solo le llegan los de quien ha escrito por WhatsApp.
import { emailsContactos, tokenContactos } from './_lib.js';

let CACHE = { t: 0, clave: '', m: {} };
export const clave9 = (v) => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : ''; };

export async function agenda() {
  const emails = await emailsContactos().catch(() => []);
  if (!emails.length) return { m: {}, emails: [] };
  const clave = emails.join(',');
  if (CACHE.clave === clave && Date.now() - CACHE.t < 30 * 60000) return { m: CACHE.m, emails };
  const m = {};
  for (const e of emails) {
    try {
      const tk = await tokenContactos(e); if (!tk) continue;
      let pag = '';
      for (let i = 0; i < 10; i++) {
        const r = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,photos&pageSize=1000' + (pag ? '&pageToken=' + encodeURIComponent(pag) : ''), { headers: { Authorization: 'Bearer ' + tk } });
        if (!r.ok) break;
        const j = await r.json().catch(() => ({}));
        for (const p of j.connections || []) {
          const nom = (p.names && p.names[0] && p.names[0].displayName) || '', f = (p.photos || []).filter((x) => !x.default && x.url)[0];
          for (const n of p.phoneNumbers || []) { const k = clave9(n.canonicalForm || n.value); if (k && (nom || f) && !m[k]) m[k] = [nom, f ? f.url.replace(/=s\d+(-c)?$/, '=s96-c') : '']; }
        }
        pag = j.nextPageToken || ''; if (!pag) break;
      }
    } catch (err) {}
  }
  CACHE = { t: Date.now(), clave, m };
  return { m, emails };
}
