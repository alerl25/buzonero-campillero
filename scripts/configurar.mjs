#!/usr/bin/env node
// Buzonero Campillero · configuración inicial (sin dependencias, Node 20+).
// Genera todas las claves que necesita tu instalación y saca el permiso de Google de tu cuenta principal
// (la «cuenta ancla»: guarda el almacén cifrado en su Drive y recibe los avisos).
// Al terminar deja `configuracion.env` (para Vercel: `node scripts/subir-a-vercel.mjs` o «Import .env» en la web),
// `clave-mcp.txt` (para conectar un agente de IA) y `contrasena.txt` (la contraseña de la web).
// Uso (lo puede lanzar tu agente de IA, sin preguntas):
//   node scripts/configurar.mjs --client-id ID --client-secret SECRETO --url https://tu-app.vercel.app [--nombre Personal]
// Sin parámetros, los pregunta. La contraseña de la web se genera sola (o --contrasena-pregunta para elegirla).
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { exec } from 'node:child_process';
import { MAIL_SCOPES } from '../api/auth/start.js';

const PUERTO = 53682, VUELTA = `http://localhost:${PUERTO}/callback`;
const ARG = {}; process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) ARG[a.slice(2)] = all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true; });
let rl = null;
const preguntar = async (t, def = '') => {
  if (!stdin.isTTY) { if (def) return def; console.error('\nFalta «' + t + '». Pásalo como parámetro (mira la cabecera de este script).'); process.exit(1); }
  rl = rl || readline.createInterface({ input: stdin, output: stdout });
  return ((await rl.question(t + (def ? ` [${def}]` : '') + ': ')).trim() || def);
};
const b64u = (b) => Buffer.from(b).toString('base64url');

console.log('\nBuzonero Campillero · configuración\n');
console.log('En tu cliente OAuth de Google Cloud (tipo «Aplicación web») tienen que estar estos dos URI de redireccionamiento:');
console.log('  ' + VUELTA + '\n  https://TU-APP.vercel.app/api/auth/callback\n');

const clientId = String(ARG['client-id'] || await preguntar('ID de cliente de Google (GOOGLE_CLIENT_ID)')).trim();
const clientSecret = String(ARG['client-secret'] || await preguntar('Secreto de cliente (GOOGLE_CLIENT_SECRET)')).trim();
const url = String(ARG.url || await preguntar('URL de tu app en Vercel, sin barra final (p. ej. https://mi-buzonero.vercel.app)')).trim().replace(/\/+$/, '');
if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId) || !clientSecret || !/^https:\/\/[a-z0-9.-]+$/i.test(url)) {
  console.error('\nFaltan datos o no tienen buena pinta (el ID acaba en .apps.googleusercontent.com y la URL empieza por https://). Revisa INSTALAR.md.'); process.exit(1);
}
// una sola contraseña abre todos los buzones: se genera una larga y aleatoria (también se puede entrar con Google)
let pass = '';
if (ARG['contrasena-pregunta']) while (pass.length < 16 || new Set(pass).size < 8) pass = await preguntar('Contraseña para entrar en la web (mínimo 16 caracteres)');
else { /* sin letras que se confunden (i, l, o, 0, 1) */ const L = 'abcdefghjkmnpqrstuvwxyz', P = L + L.toUpperCase() + '23456789'; pass = Array.from(crypto.randomBytes(20), (b) => P[b % P.length]).join('').replace(/(.{5})(?=.)/g, '$1-'); }

// ---------- 1) el permiso de la cuenta ancla, con un acceso local ----------
const estado = b64u(crypto.randomBytes(16));
const auth = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: VUELTA, response_type: 'code', scope: MAIL_SCOPES.join(' '),
  access_type: 'offline', prompt: 'consent select_account', state: estado,
});
const codigo = await new Promise((ok, mal) => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, VUELTA);
    if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const fallo = u.searchParams.get('error'), c = u.searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<meta charset="utf-8"><p style="font:18px system-ui;padding:40px">' + (c && u.searchParams.get('state') === estado ? 'Listo. Ya puedes cerrar esta pestaña y volver a la terminal.' : 'No se completó el acceso. Vuelve a la terminal.') + '</p>');
    srv.close();
    if (fallo || !c || u.searchParams.get('state') !== estado) mal(new Error(fallo || 'acceso no válido')); else ok(c);
  }).listen(PUERTO, '127.0.0.1');
  console.log('\nAbre este enlace, elige tu cuenta PRINCIPAL de Gmail y marca TODAS las casillas de permisos:\n\n' + auth + '\n');
  const abrir = process.platform === 'win32' ? `start "" "${auth}"` : process.platform === 'darwin' ? `open "${auth}"` : `xdg-open "${auth}"`;
  exec(abrir, () => {});
});
const r = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code: codigo, client_id: clientId, client_secret: clientSecret, redirect_uri: VUELTA, grant_type: 'authorization_code' }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok || !j.refresh_token || !j.id_token) { console.error('\nGoogle no devolvió el permiso permanente:', j.error_description || j.error || r.status); process.exit(1); }
const faltan = MAIL_SCOPES.filter((s) => s !== 'openid' && !String(j.scope || '').split(/\s+/).includes(s));
if (faltan.length) { console.error('\nFaltan permisos (marca todas las casillas):\n  ' + faltan.join('\n  ')); process.exit(1); }
const email = String(JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64url').toString()).email || '').toLowerCase();
const nombre = String(ARG.nombre || await preguntar(`Nombre corto para ${email} en las pestañas`, 'Personal')).slice(0, 40);

// ---------- 2) las claves ----------
const sal = crypto.randomBytes(16), hash = crypto.scryptSync(pass, sal, 32, { N: 16384, r: 8, p: 1 });
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' }), priv = privateKey.export({ format: 'jwk' });
const vapidPublic = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]));
const claveMcp = b64u(crypto.randomBytes(32));
const ini = nombre.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'YO';

const vars = {
  GOOGLE_CLIENT_ID: clientId,
  GOOGLE_CLIENT_SECRET: clientSecret,
  BZ_URL: url,
  BZ_CUENTAS: JSON.stringify([{ k: 'yo', email, nombre, ini, env: 'RT_ANCLA', entrar: true }]),
  BZ_ANCLA: 'yo',
  RT_ANCLA: j.refresh_token,
  SESSION_SECRET: b64u(crypto.randomBytes(48)),
  TOKEN_KEY: crypto.randomBytes(32).toString('base64'),
  APP_PASSWORD_HASH: `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`,
  VAPID_PUBLIC: vapidPublic,
  VAPID_PRIVATE: priv.d,
  VIGIA_KEY: b64u(crypto.randomBytes(24)),
  MCP_KEY_HASH: crypto.createHash('sha256').update(claveMcp).digest('hex'),
};
const salida = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
fs.writeFileSync('configuracion.env', salida, { mode: 0o600 });
fs.writeFileSync('clave-mcp.txt', claveMcp + '\n', { mode: 0o600 });
fs.writeFileSync('contrasena.txt', pass + '\n', { mode: 0o600 });
if (rl) rl.close();
console.log(`
Hecho. Cuenta principal: ${email}. He creado tres ficheros en esta carpeta (están en .gitignore: NO los subas a ningún sitio):
  configuracion.env  → las variables de Vercel: «node scripts/subir-a-vercel.mjs» las sube y vuelve a desplegar.
  clave-mcp.txt      → para conectar tu agente de IA (MCP). Guárdala como una contraseña.
  contrasena.txt     → la contraseña de la web (también puedes entrar con tu cuenta de Google). Apúntala en tu gestor y borra el fichero.`);
