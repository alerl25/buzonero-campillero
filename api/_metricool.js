// Metricool (https://metricool.com) con DOS vías, a elegir por cada persona:
//  · API: el token de la API de su cuenta (planes Advanced o Custom de Metricool) + su userId.
//  · MCP: entrando con su cuenta de Metricool (OAuth), sin token ni plan de API: Buzonero es cliente del conector oficial
//    https://ai.metricool.com/mcp (registro dinámico + PKCE). Vale en cualquier plan.
// Lo que se conecta se guarda cifrado en el almacén de esta instalación (campo «metricool»); el navegador nunca ve ni token ni permiso.
// Publicar exige siempre la orden explícita de la persona desde la app (nunca el conector de Claude).
import crypto from 'node:crypto';
import { readStore, updateStore } from './_lib.js';

const API = 'https://app.metricool.com/api';
const MCP_URL = 'https://ai.metricool.com/mcp';
const OAUTH = { auth: 'https://app.metricool.com/oauth/authorize', token: 'https://app.metricool.com/oauth/token', registro: 'https://app.metricool.com/oauth/register' };
// campo de la marca en simpleProfiles (vía API) → red
const REDES_API = [['facebook', 'facebook'], ['instagram', 'instagram'], ['linkedinCompany', 'linkedin'], ['tiktok', 'tiktok'], ['twitter', 'twitter'], ['youtube', 'youtube'], ['pinterest', 'pinterest'], ['threads', 'threads'], ['bluesky', 'bluesky'], ['gmb', 'gmb']];
// campo de networksData (vía MCP) → red
const REDES_MCP = [['facebookData', 'facebook'], ['instagramData', 'instagram'], ['linkedinData', 'linkedin'], ['tiktokData', 'tiktok'], ['twitterData', 'twitter'], ['youtubeData', 'youtube'], ['pinterestData', 'pinterest'], ['threadsData', 'threads'], ['blueskyData', 'bluesky'], ['gmbData', 'gmb']];
// las que se pueden programar con el formulario sencillo (YouTube y Pinterest piden campos extra: se hacen en Metricool)
export const REDES_FORM = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'bluesky', 'threads', 'gmb'];

export async function mcConf() { return (await readStore()).metricool || null; }
const hace = (s) => Date.now() + s * 1000;

// ---------------- vía API ----------------
async function apiFetch(conf, ruta, { metodo = 'GET', q = {}, cuerpo } = {}) {
  const r = await fetch(API + ruta + '?' + new URLSearchParams({ userId: conf.userId, ...q }), {
    method: metodo,
    headers: { 'X-Mc-Auth': conf.token, Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, j, txt: txt.slice(0, 300) };
}
const marcasApi = (lista) => (Array.isArray(lista) ? lista : []).map((b) => ({ id: String(b.id), nombre: String(b.label || b.title || b.id).slice(0, 60), redes: REDES_API.filter(([c]) => b[c]).map(([, r]) => r), tz: b.timezone || 'Europe/Madrid' }));

// ---------------- vía MCP (OAuth) ----------------
async function clienteMcp(redirect) {
  const st = await readStore(true), c = st.metricoolCliente;
  if (c && c.id && c.redirect === redirect) return c.id;
  const r = await fetch(OAUTH.registro, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Buzonero Campillero', redirect_uris: [redirect], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: 'mcp:read mcp:write' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.client_id) throw new Error('registro ' + r.status);
  await updateStore((n) => { n.metricoolCliente = { id: j.client_id, redirect }; });
  return j.client_id;
}
// Paso 1: la dirección de Metricool a la que se manda a la persona (PKCE)
export async function mcpEmpezar(redirect, estado) {
  const client = await clienteMcp(redirect);
  const verifier = crypto.randomBytes(32).toString('base64url'), challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const url = OAUTH.auth + '?' + new URLSearchParams({ response_type: 'code', client_id: client, redirect_uri: redirect, scope: 'mcp:read mcp:write', state: estado, code_challenge: challenge, code_challenge_method: 'S256', resource: MCP_URL });
  return { url, verifier };
}
// Paso 2: Metricool devuelve un código; se cambia por el permiso y se guarda cifrado
export async function mcpTerminar(redirect, code, verifier) {
  const client = await clienteMcp(redirect);
  const r = await fetch(OAUTH.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: client, code_verifier: verifier }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('token ' + r.status);
  const nuevo = { modo: 'mcp', mcp: { access: j.access_token, exp: hace(j.expires_in || 3600), refresh: j.refresh_token || '', client_id: client }, marcas: [], conectado: new Date().toISOString() };
  await updateStore((n) => { n.metricool = nuevo; });
  try { nuevo.marcas = await marcasDeMcp(nuevo); await updateStore((n) => { if (n.metricool) n.metricool.marcas = nuevo.marcas; }); } catch (e) {}
  return true;
}
async function tokenMcp(conf) {
  const m = conf.mcp || {};
  if (m.access && m.exp - Date.now() > 60000) return m.access;
  if (!m.refresh) throw Object.assign(new Error('permiso'), { codigo: 'permiso' });
  const r = await fetch(OAUTH.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: m.refresh, client_id: m.client_id }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw Object.assign(new Error('permiso'), { codigo: 'permiso' });   // Metricool ya no reconoce el permiso: hay que volver a conectar
  m.access = j.access_token; m.exp = hace(j.expires_in || 3600); if (j.refresh_token) m.refresh = j.refresh_token;
  await updateStore((n) => { if (n.metricool && n.metricool.modo === 'mcp') n.metricool.mcp = { ...n.metricool.mcp, access: m.access, exp: m.exp, refresh: m.refresh }; });
  return m.access;
}
// Una llamada a una herramienta del MCP de Metricool (JSON-RPC sobre HTTP; la respuesta puede venir como JSON o como eventos SSE)
async function mcpLlamar(conf, herramienta, args) {
  const tk = await tokenMcp(conf);
  const post = async (cuerpo, sesion) => {
    const r = await fetch(MCP_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(sesion ? { 'Mcp-Session-Id': sesion } : {}) }, body: JSON.stringify(cuerpo) });
    const txt = await r.text(); let j = null;
    if ((r.headers.get('content-type') || '').includes('text/event-stream')) { for (const l of txt.split('\n')) if (l.startsWith('data:')) { try { const o = JSON.parse(l.slice(5)); if (o.result || o.error) j = o; } catch {} } }
    else { try { j = JSON.parse(txt); } catch {} }
    return { status: r.status, j, sesion: r.headers.get('mcp-session-id') };
  };
  const ini = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'buzonero-campillero', version: '1' } } });
  if (ini.status === 401 || ini.status === 403) throw Object.assign(new Error('permiso'), { codigo: 'permiso' });
  if (ini.status >= 300) throw Object.assign(new Error('mcp ' + ini.status), { codigo: 'mcp' });
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, ini.sesion).catch(() => {});
  const r = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: herramienta, arguments: args } }, ini.sesion);
  if (r.status >= 300 || !r.j) throw Object.assign(new Error('mcp ' + r.status), { codigo: 'mcp' });
  if (r.j.error) throw Object.assign(new Error(String(r.j.error.message || 'error')), { codigo: 'mcp' });
  const res = r.j.result || {}, texto = ((res.content || []).find((c) => c.type === 'text') || {}).text || '';
  let datos = texto; try { datos = JSON.parse(texto); } catch {}
  if (res.isError) throw Object.assign(new Error(typeof datos === 'string' ? datos.slice(0, 300) : JSON.stringify(datos).slice(0, 300)), { codigo: 'herramienta' });
  return datos;
}
async function marcasDeMcp(conf) {
  const d = await mcpLlamar(conf, 'getBrandSettings', {});
  const lista = Array.isArray(d) ? d : (d && (d.data || d.brands)) || [];
  return lista.map((b) => ({ id: String(b.id), nombre: String(b.label || b.title || b.id).slice(0, 60), tz: b.timezone || 'Europe/Madrid', redes: REDES_MCP.filter(([c]) => b.networksData && b.networksData[c]).map(([, r]) => r) }));
}
// 'YYYY-MM-DDTHH:mm[:ss]' en la zona de la marca → con su desfase (+02:00), que es lo que pide el MCP
function conOffset(local, tz) {
  const l = local.length === 16 ? local + ':00' : local; let off = '+00:00';
  try { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(l + 'Z')).find((x) => x.type === 'timeZoneName'); const m = /GMT([+-]\d\d):?(\d\d)?/.exec((p && p.value) || ''); if (m) off = m[1] + ':' + (m[2] || '00'); } catch {}
  return l + off;
}

// ---------------- lo común ----------------
// Lo que la app puede ver: nunca el token ni el permiso
export async function mcEstado() {
  const c = await mcConf();
  return c ? { conectado: true, modo: c.modo || 'api', userId: c.userId || '', marcas: c.marcas || [], desde: c.conectado } : { conectado: false };
}
export async function mcConectar(d) {   // vía API
  const token = String(d.token || '').trim(), userId = String(d.userId || '').trim();
  if (token.length < 20) return { error: 'Pega el token completo (Metricool → Ajustes → API).' };
  if (!/^\d{3,12}$/.test(userId)) return { error: 'El «userId» es un número: sale en la dirección de Metricool, después de «userId=».' };
  const x = await apiFetch({ token, userId }, '/admin/simpleProfiles').catch(() => null);
  if (!x) return { error: 'No se pudo hablar con Metricool.' };
  if (x.status === 401 || x.status === 403) return { error: 'Metricool no acepta ese token o ese userId.' };
  if (x.status !== 200 || !Array.isArray(x.j)) return { error: 'Metricool respondió algo inesperado (' + x.status + ').' };
  const marcas = marcasApi(x.j);
  await updateStore((n) => { n.metricool = { modo: 'api', token, userId, marcas, conectado: new Date().toISOString() }; });
  return { ok: true, marcas };
}
export async function mcActualizar() {   // vuelve a leer las marcas y sus redes
  const c = await mcConf(); if (!c) return { error: 'no-conectado' };
  try {
    const marcas = c.modo === 'mcp' ? await marcasDeMcp(c) : marcasApi((await apiFetch(c, '/admin/simpleProfiles')).j);
    await updateStore((n) => { if (n.metricool) n.metricool.marcas = marcas; });
    return { ok: true, marcas };
  } catch (e) { return { error: e.codigo || 'metricool' }; }
}
export async function mcQuitar() { await updateStore((n) => { if (!n.metricool) return false; delete n.metricool; }); }

const marcaDe = (c, blogId) => (c.marcas || []).find((x) => x.id === String(blogId));
const errMcp = (e) => ({ error: e.codigo || 'metricool', detalle: String(e.message || '').slice(0, 300) });

// publicaciones programadas de una marca entre dos fechas (YYYY-MM-DD)
export async function mcPosts(blogId, desde, hasta) {
  const c = await mcConf(); if (!c) return { error: 'no-conectado' };
  const m = marcaDe(c, blogId); if (!m) return { error: 'marca' };
  if (!/^\d{4}-\d\d-\d\d$/.test(desde) || !/^\d{4}-\d\d-\d\d$/.test(hasta)) return { error: 'fechas' };
  let lista;
  try {
    if (c.modo === 'mcp') {
      const d = await mcpLlamar(c, 'getScheduledPosts', { brandId: m.id, fromDate: conOffset(desde + 'T00:00:00', m.tz), toDate: conOffset(hasta + 'T23:59:59', m.tz), timezone: m.tz });
      lista = Array.isArray(d) ? d : (d && (d.data || d.posts)) || [];
    } else {
      const x = await apiFetch(c, '/v2/scheduler/posts', { q: { blogId: m.id, start: desde + 'T00:00:00', end: hasta + 'T23:59:59', timezone: m.tz } });
      if (x.status !== 200) return { error: 'metricool', status: x.status };
      lista = Array.isArray(x.j) ? x.j : (x.j && (x.j.data || x.j.posts)) || [];
    }
  } catch (e) { return errMcp(e); }
  return { ok: true, posts: lista.map((p) => ({
    id: String(p.id), texto: String(p.text || '').slice(0, 2000), fecha: (p.publicationDate && p.publicationDate.dateTime) || '', borrador: !!p.draft,
    redes: (p.providers || []).map((v) => ({ red: v.network, estado: v.status || '', url: v.publicUrl || '' })), media: (p.media || []).length, enlace: p.plannerUrl || '',
  })) };
}

// Programar o publicar. SIEMPRE con confirmado: true desde la app (la persona ya lo ha confirmado en pantalla).
export async function mcPublicar(d) {
  const c = await mcConf(); if (!c) return { error: 'no-conectado' };
  if (d.confirmado !== true) return { error: 'confirmado' };
  const m = marcaDe(c, d.blogId); if (!m) return { error: 'marca' };
  const texto = String(d.texto || '').trim();
  if (!texto || texto.length > 5000) return { error: 'texto' };
  const redes = [...new Set((Array.isArray(d.redes) ? d.redes : []).map(String))].filter((r) => m.redes.includes(r) && REDES_FORM.includes(r));
  if (!redes.length) return { error: 'redes' };
  const fecha = String(d.fecha || '');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(fecha)) return { error: 'fecha' };
  const media = (Array.isArray(d.media) ? d.media : []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (media.some((u) => !/^https:\/\/[^\s]+$/.test(u))) return { error: 'media' };
  if (redes.some((r) => ['instagram', 'tiktok'].includes(r)) && !media.length) return { error: 'media-obligatoria' };
  const dt = fecha.length === 16 ? fecha + ':00' : fecha, esVideo = /\.(mp4|mov)(\?|$)/i.test(media[0] || '');
  const datosRed = { facebookData: { type: 'POST' }, instagramData: esVideo ? { type: 'REEL', showReelOnFeed: true } : { type: 'POST' }, linkedinData: {}, twitterData: {}, tiktokData: {}, blueskyData: {}, threadsData: {}, gmbData: { type: 'publication' } };
  const info = { publicationDate: { dateTime: dt, timezone: m.tz }, text: texto, providers: redes.map((network) => ({ network })), autoPublish: true, draft: false, shortener: false, media };
  redes.forEach((r) => { info[r === 'twitter' ? 'twitterData' : r + 'Data'] = datosRed[r === 'twitter' ? 'twitterData' : r + 'Data']; });
  try {
    if (c.modo === 'mcp') {
      const out = await mcpLlamar(c, 'createScheduledPost', { blogId: m.id, date: conOffset(dt, m.tz), info });
      return { ok: true, id: String((out && (out.id || (out.data && out.data.id))) || ''), enlace: (out && (out.plannerUrl || (out.data && out.data.plannerUrl))) || '' };
    }
    const cuerpo = { ...info, saveExternalMediaFiles: media.length > 0 }; if (!media.length) delete cuerpo.media;
    const x = await apiFetch(c, '/v2/scheduler/posts', { metodo: 'POST', q: { blogId: m.id }, cuerpo });
    if (x.status >= 300) return { error: 'metricool', status: x.status, detalle: (x.j && (x.j.message || x.j.detail || x.j.title)) || x.txt };
    return { ok: true, id: String((x.j && (x.j.id || (x.j.data && x.j.data.id))) || '') };
  } catch (e) { return errMcp(e); }
}

export async function mcBorrar(blogId, id) {   // solo con la API: el MCP de Metricool no tiene herramienta de borrar
  const c = await mcConf(); if (!c) return { error: 'no-conectado' };
  if (c.modo === 'mcp') return { error: 'sin-borrar-mcp' };
  const m = marcaDe(c, blogId); if (!m || !/^\d{1,15}$/.test(String(id))) return { error: 'marca' };
  const x = await apiFetch(c, '/v2/scheduler/posts/' + id, { metodo: 'DELETE', q: { blogId: m.id } });
  return x.status < 300 ? { ok: true } : { error: 'metricool', status: x.status };
}
