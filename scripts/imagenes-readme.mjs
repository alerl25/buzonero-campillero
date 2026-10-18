#!/usr/bin/env node
// Genera las imágenes del README a partir de HTML (con las capturas de scripts/capturas-demo.mjs, datos inventados):
//   docs/portada.jpg        cabecera del README (2560x1280)
//   docs/vista-previa.jpg   vista previa para redes (1280x640, < 1 MB: Settings → Social preview en GitHub)
//   docs/mcp-demo.png       un agente usando el MCP en todas las cuentas
// Uso: node scripts/imagenes-readme.mjs      (necesita Playwright)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import(process.env.PLAYWRIGHT_ESM || 'playwright')); }

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// las capturas van incrustadas (data:): una página hecha con setContent no puede leer ficheros del disco
const f = (p) => 'data:image/png;base64,' + fs.readFileSync(path.join(R, p)).toString('base64');
const logo = fs.readFileSync(path.join(R, 'app/logo-horizontal-oscuro.svg'), 'utf8');
const FUENTE = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">';

const portada = `<!doctype html><meta charset="utf-8">${FUENTE}<style>
*{box-sizing:border-box;margin:0}
body{width:1280px;height:640px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#f6f4f4;
 background:radial-gradient(60% 70% at 95% 105%,rgba(220,10,6,.38),transparent 70%),radial-gradient(45% 50% at 0% 0%,rgba(143,208,255,.10),transparent 70%),#07080b}
.puntos{position:absolute;inset:0;background-image:radial-gradient(rgba(255,60,40,.55) 1px,transparent 1.4px),radial-gradient(rgba(143,208,255,.35) 1px,transparent 1.4px);background-size:53px 61px,71px 47px;background-position:0 0,23px 17px;opacity:.35;-webkit-mask-image:linear-gradient(90deg,transparent,#000 60%)}
.txt{position:absolute;left:72px;top:92px;width:600px}
h1{text-wrap:balance}
.logo svg{height:46px;width:auto}
h1{font-size:47px;line-height:1.06;letter-spacing:-.045em;font-weight:700;margin:44px 0 22px}
h1 em{font-style:normal;color:#ff2a1f}
p{font-size:20px;line-height:1.45;color:#c3c7cd;max-width:500px}
.chips{display:flex;gap:10px;margin-top:34px;flex-wrap:wrap}
.chips span{font:500 14px/1 'JetBrains Mono',monospace;padding:10px 14px;border-radius:999px;border:1px solid #3a3f47;color:#e7e3e3;background:rgba(13,15,19,.7)}
.pc{position:absolute;left:660px;top:118px;width:760px;border-radius:14px;box-shadow:0 30px 90px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08);transform:perspective(1600px) rotateY(-14deg) rotateX(4deg);transform-origin:0 50%}
.movil{position:absolute;left:1000px;top:250px;width:210px;border-radius:30px;border:6px solid #15181e;box-shadow:0 30px 70px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.1)}
</style><div class="puntos"></div><div class="txt"><div class="logo">${logo}</div>
<h1>Todas tus cuentas de Gmail, <em>en tu agente de IA.</em></h1>
<p>Servidor MCP + app web. Te lo instalas gratis en tu propio Vercel: tu correo no pasa por servidores ajenos.</p>
<div class="chips"><span>Claude Code</span><span>Cursor</span><span>Codex</span><span>MCP</span></div></div>
<img class="pc" src="${f('docs/capturas/app-oscuro.png')}"><img class="movil" src="${f('docs/capturas/movil-lista.png')}">`;

const linea = (s) => `<div class="l">${s}</div>`;
const mcp = `<!doctype html><meta charset="utf-8">${FUENTE}<style>
*{box-sizing:border-box;margin:0}
body{width:1100px;padding:34px;background:#07080b;font-family:'JetBrains Mono',monospace;color:#e6e3e3}
.win{border-radius:14px;background:#0d0f13;box-shadow:0 0 0 1px #23272e,0 24px 70px rgba(0,0,0,.6);overflow:hidden}
.bar{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #23272e;font:500 13px Inter,sans-serif;color:#8f949c}
.bar i{width:12px;height:12px;border-radius:50%;background:#3a3f47;display:inline-block}.bar b{margin-left:10px;font-weight:500}
.cuerpo{padding:24px 28px 30px;font-size:15.5px;line-height:1.65}
.l{white-space:pre-wrap}.yo{color:#fff;font-weight:700;margin-top:6px}.yo::before{content:"› ";color:#ff2a1f}
.tool{color:#8fd0ff;margin-top:14px}.tool::before{content:"● ";color:#3ec7a0}.res{color:#8f949c;padding-left:22px}
.r{margin-top:12px;color:#e6e3e3;font-family:Inter,sans-serif;font-size:16px}.c{color:#8f949c}.k{color:#ffb648}
.sep{height:18px}
</style><div class="win"><div class="bar"><i></i><i></i><i></i><b>tu agente de IA · terminal</b></div><div class="cuerpo">
${linea('<span class="yo">¿Qué tengo pendiente en todas mis cuentas?</span>')}
${linea('<div class="tool">buzonero · buscar_en_todas <span class="c">(consulta: "is:unread")</span></div>')}
${linea('<div class="res">└ 5 hilos sin leer en 3 cuentas</div>')}
<div class="r">Tienes 5 correos sin leer:<br>
• <span class="k">Estudio Nube</span> · Marta Ibáñez: «Propuesta de identidad: revisión final». Quiere cerrar el logotipo el <b>jueves a las 10:30</b>.<br>
• <span class="k">Estudio Nube</span> · Javier Soto: presupuesto de 500 catálogos (PDF adjunto, entrega en 6 días).<br>
• <span class="k">Personal</span> · Tu lámpara llega <b>hoy</b> entre las 10:00 y las 14:00.<br>
• <span class="k">Personal</span> · Carmen: ¿comida el domingo?<br>
• <span class="k">Freelance</span> · Rocío Peña: nueva etiqueta para el vino joven.</div>
<div class="sep"></div>
${linea('<span class="yo">Contesta a Marta que el jueves a las 10:30 me va bien</span>')}
${linea('<div class="tool">buzonero · crear_borrador <span class="c">(cuenta: "Estudio Nube", responder_a_hilo: "18f3a2c41d3f7")</span></div>')}
${linea('<div class="res">└ Borrador creado en el hilo · no se ha enviado</div>')}
<div class="r">Listo: te he dejado la respuesta en <b>Borradores</b> de Estudio Nube. ¿La envío?</div>
</div></div>`;

const b = await chromium.launch();
async function pinta(html, w, h, dsf, salida, tipo) {
  const p = await b.newPage({ viewport: { width: w, height: h || 600 }, deviceScaleFactor: dsf });
  await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  const el = h ? null : await p.$('body');
  const opt = { path: path.join(R, salida), ...(tipo === 'jpeg' ? { type: 'jpeg', quality: 86 } : {}) };
  if (el) await el.screenshot(opt); else await p.screenshot(opt);
  await p.close(); console.log(salida, Math.round(fs.statSync(path.join(R, salida)).size / 1024) + ' KB');
}
await pinta(portada, 1280, 640, 2, 'docs/portada.jpg', 'jpeg');
await pinta(portada, 1280, 640, 1, 'docs/vista-previa.jpg', 'jpeg');
await pinta(mcp, 1100, 0, 2, 'docs/mcp-demo.png');
await b.close();
