// Genera los iconos PNG de la app instalable (iPhone y Android) desde app/logo.svg: buzón centrado sobre blanco.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(path.join(process.env.APPDATA, 'npm', 'node_modules', 'x.js'));
const { chromium } = require('playwright');
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..');
const svg = fs.readFileSync(path.join(RAIZ, 'app', 'logo.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();
for (const [nombre, lado, escala] of [['icono-180.png', 180, 0.62], ['icono-192.png', 192, 0.62], ['icono-512.png', 512, 0.62], ['icono-512-mask.png', 512, 0.5]]) {
  await page.setViewportSize({ width: lado, height: lado });
  await page.setContent('<html><body style="margin:0;width:' + lado + 'px;height:' + lado + 'px;display:grid;place-items:center;background:radial-gradient(120% 90% at 85% 110%, #fde6e5 0%, #ffffff 55%)">'
    + '<div style="width:' + Math.round(lado * escala) + 'px;height:' + Math.round(lado * escala) + 'px">' + svg.replace('<svg', '<svg style="width:100%;height:100%"') + '</div></body></html>');
  await page.screenshot({ path: path.join(RAIZ, 'app', nombre), omitBackground: false });
  console.log('hecho', nombre);
}
await browser.close();
