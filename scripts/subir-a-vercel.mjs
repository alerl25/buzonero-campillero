#!/usr/bin/env node
// Sube a Vercel (entorno Production) todas las variables de `configuracion.env` y vuelve a desplegar.
// Necesita la carpeta enlazada a tu proyecto de Vercel (`npx vercel link` o el primer `npx vercel deploy`).
// Uso:  node scripts/subir-a-vercel.mjs [--sin-desplegar]
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!fs.existsSync('configuracion.env')) { console.error('No encuentro configuracion.env: lanza antes «node scripts/configurar.mjs».'); process.exit(1); }
const vars = fs.readFileSync('configuracion.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]);
const vercel = (args, entrada) => spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'vercel@latest', ...args], { input: entrada, encoding: 'utf8', shell: process.platform === 'win32' });
for (const [k, v] of vars) {
  if (!v) continue;
  vercel(['env', 'rm', k, 'production', '--yes']);   // si ya estaba, se cambia por la nueva
  const r = vercel(['env', 'add', k, 'production'], v);
  console.log((r.status === 0 ? 'ok   ' : 'FALLO') + ' ' + k + (r.status === 0 ? '' : '\n' + (r.stderr || r.stdout).slice(-300)));
}
if (!process.argv.includes('--sin-desplegar')) {
  const d = vercel(['deploy', '--prod', '--yes']);
  console.log(d.status === 0 ? '\nDesplegado: ' + ((d.stdout.match(/https:\/\/\S+\.vercel\.app/g) || []).pop() || '') : '\nNo se pudo desplegar:\n' + (d.stderr || d.stdout).slice(-500));
}
try { fs.rmSync('.env.local', { force: true }); } catch {}
