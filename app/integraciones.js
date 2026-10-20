/* Buzonero Campillero · Integraciones
   Vista «Integraciones» de la barra lateral: TODO lo que se puede conectar a la app, en un solo sitio.
   - Cuentas de Google (correo y calendario): reconectar o añadir.
   - Contactos de Google: conexión aparte, solo lectura (nombres y fotos de los números de WhatsApp).
   - WhatsApp (por Zernio): solo lectura. Solo sale en la barra lateral si hay un WhatsApp conectado.
   - CRM: sus integraciones (Analytics, WhatsApp, Nexudus…) y el acceso a ellas.
   - Metricool: por MCP (entrando con la cuenta de Metricool, vale en cualquier plan) o por API (token + userId).
     Solo sale «Redes sociales» en la barra lateral cuando Metricool está conectado.
   Se registra en VISTAS (INTEGRACIONES → pintarHub). Habla con /api/zernio (?r=integraciones, mc-…). */
var HUB = { j:null, cargando:false, error:false, mc:{ token:'', userId:'', error:'', probando:false, api:false } };

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    + '.shell:not(.crm-on):has(.vancha),.shell.reading:not(.crm-on):has(.vancha){grid-template-columns:236px minmax(0,1fr)}.shell:not(.crm-on):has(.vancha)>.read{display:none}'
    + '@media(max-width:1180px){.shell:not(.crm-on):has(.vancha),.shell.reading:not(.crm-on):has(.vancha){grid-template-columns:72px minmax(0,1fr)}}'
    + '@media(max-width:900px){.shell:not(.crm-on):has(.vancha),.shell.reading:not(.crm-on):has(.vancha){grid-template-columns:minmax(0,1fr)}}'
    + '.shell:not(.crm-on):has(.vancha)>.list{overflow:hidden;display:flex;flex-direction:column}.shell:has(.vancha) .rows{flex:1;min-height:0;overflow:auto;padding-bottom:24px}'
    + '.vista-esp.vancha{max-width:1100px;margin:0 auto;width:100%}'
    + '.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;padding:6px 16px 24px}'
    + '.hub-card{border:1px solid var(--line);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}.hub-card.ancha{grid-column:1/-1}'
    + '.hub-h{display:flex;align-items:center;gap:10px}.hub-h .ph{font-size:22px;color:var(--acc)}.hub-h b{font-weight:600;font-size:15px}.hub-h .cv-est{margin-left:auto}'
    + '.hub-card p{margin:0;color:var(--mute);font-size:13.5px}.hub-card p small{color:var(--faint)}'
    + '.hub-fila{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:13.5px;min-width:0}.hub-fila>span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hub-fila small{color:var(--faint)}'
    + '.hub-pie{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}'
    + '.hub-chips{display:flex;gap:6px;flex-wrap:wrap}.hub-chip{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 9px;color:var(--mute)}.hub-chip.on{color:var(--acc);border-color:var(--acc)}'
    + '.hub-form{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding-top:12px}.hub-form label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px}'
    + '.hub-form input{font:inherit;font-weight:400;border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:8px 10px;background:var(--bg);color:var(--text);min-width:0}.hub-err{color:var(--acc);font-size:13px;margin:0}';
  document.head.appendChild(css);
})();

function hubEst(t, on){ return '<span class="cv-est' + (on ? ' on' : '') + '">' + t + '</span>'; }
async function hubFetch(url, opt){
  var r = await fetch(url, Object.assign({ cache:'no-store', credentials:'same-origin' }, opt || {}));
  var j = await r.json().catch(function(){ return {}; });
  if(r.status === 401) throw new Error('sesion');
  return j;
}
function hubPost(b){ return hubFetch('/api/zernio', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(b) }); }
async function cargarHub(){
  if(HUB.cargando) return; HUB.cargando = true; HUB.error = false; if(st.folder === 'INTEGRACIONES') pintarHub();
  try {
    var j = await hubFetch('/api/zernio?r=integraciones');
    if(!j.ok) throw new Error('x');
    HUB.j = j; if(window.integActualizar) integActualizar(j);
    try { if(!window.CRMS && window.crmCargar) await crmCargar(); } catch(e){}
  } catch(e){ HUB.error = true; }
  finally { HUB.cargando = false; if(st.folder === 'INTEGRACIONES') pintarHub(); }
}
var HUB_CRM = { ga:'Google Analytics', wa:'WhatsApp (Meta)', nx:'Nexudus', zr:'WhatsApp (Zernio)' };
function hubTarjeta(icono, nombre, estado, cuerpo, pie, ancha){
  return '<section class="hub-card' + (ancha ? ' ancha' : '') + '"><div class="hub-h"><i class="ph ' + icono + '"></i><b>' + nombre + '</b>' + estado + '</div>' + cuerpo + (pie ? '<div class="hub-pie">' + pie + '</div>' : '') + '</section>';
}
function pintarHub(){
  var el = $('rows'); if(!el) return;
  if(!HUB.j && !HUB.cargando && !HUB.error){ cargarHub(); }
  var sub = HUB.cargando && !HUB.j ? 'Cargando…' : 'Todo lo que se puede conectar a Buzonero';
  var h = '<div class="vista-esp vancha">' + cabezaVista('Integraciones', sub, 'hub', HUB.cargando);
  if(HUB.error && !HUB.j){ h += '<div class="empty"><h2>No se pudo <em>cargar.</em></h2><p>Prueba otra vez en un momento.</p></div>'; el.innerHTML = h + '</div>'; return; }
  var j = HUB.j || { zernio:{}, metricool:{}, contactos:[], agenda:{} };
  var cards = '';

  // 1) Cuentas de Google: correo y calendario
  var filas = KEYS.map(function(k){ var c = ACC[k];
    return '<div class="hub-fila"><span><b data-notr>' + esc(c.name) + '</b> <small data-notr>' + esc(c.email) + '</small></span>' + hubEst(c.broken ? 'Desconectada' : 'Conectada', !c.broken)
      + '<button type="button" class="btn sm" data-hub="recon" data-k="' + esc(k) + '">Reconectar</button></div>'; }).join('');
  cards += hubTarjeta('ph-envelope-simple', 'Gmail y Calendario de Google', hubEst(KEYS.length + (KEYS.length === 1 ? ' cuenta' : ' cuentas'), true),
    '<p>Cada cuenta de Google trae su correo y su calendario. Reconecta una si Google la desconecta, o añade otra.</p>' + filas,
    '<button type="button" class="btn primary" data-hub="anadir"><i class="ph ph-plus"></i> Añadir cuenta de Google</button>');

  // 2) Contactos de Google
  var ct = j.contactos || [], ag = j.agenda || {};
  cards += hubTarjeta('ph-address-book', 'Contactos de Google', hubEst(ct.length ? 'Conectado' : 'Sin conectar', !!ct.length),
    '<p>Conexión aparte, solo de lectura de Contactos (no es una cuenta de correo). Pone nombre y foto a los números de WhatsApp.</p>'
      + ct.map(function(e){ return '<div class="hub-fila"><span data-notr>' + esc(e) + ' <small>' + (ag.fallos && ag.fallos.length ? 'Google no los deja leer (' + esc(ag.fallos.join(', ')) + ')' : esc(ag.n || 0) + ' teléfonos, ' + esc(ag.fotos || 0) + ' con foto') + '</small></span>'
        + '<button type="button" class="btn sm" data-hub="ct-quitar" data-email="' + esc(e) + '">Quitar</button></div>'; }).join(''),
    '<button type="button" class="btn ' + (ct.length ? '' : 'primary') + '" data-hub="ct-conectar"><i class="ph ph-plug"></i> ' + (ct.length ? 'Conectar otra agenda' : 'Conectar contactos de Google') + '</button>');

  // 3) WhatsApp por Zernio
  var z = j.zernio || {}, wa = z.whatsapp || 0;
  cards += hubTarjeta('ph-whatsapp-logo', 'WhatsApp (por Zernio)', hubEst(wa ? 'Conectado' : 'Sin conectar', !!wa),
    '<p>Ver las conversaciones de WhatsApp, solo lectura: no se contesta ni se marca como leído. Todo lo que llega es un lead del CRM. <small>Solo sale en la barra lateral mientras haya un WhatsApp conectado.</small></p>'
      + (!z.clave ? '<p class="hub-err">Falta la clave de Zernio (<code>ZERNIO_API_KEY</code>) en las variables de Vercel de esta instalación.</p>' : (wa ? '<p><b>' + esc(wa) + '</b> ' + (wa === 1 ? 'número conectado' : 'números conectados') + ' en Zernio.</p>' : '<p>Conecta tu número de WhatsApp en zernio.com (las 2 primeras cuentas son gratis) y vuelve aquí.</p>')),
    (wa ? '<button type="button" class="btn primary" data-hub="abrir-wa"><i class="ph ph-whatsapp-logo"></i> Abrir WhatsApp</button>' : '') + '<a class="btn" href="https://zernio.com" target="_blank" rel="noopener"><i class="ph ph-arrow-square-out"></i> Zernio</a>');

  // 4) CRM
  var crms = Object.keys(window.CRMS || {}).map(function(i){ return window.CRMS[i]; });
  var integ = window.CRM_INTEG || {};
  cards += hubTarjeta('ph-kanban', 'CRM', hubEst(crms.length ? crms.length + (crms.length === 1 ? ' CRM' : ' CRMs') : 'Sin crear', !!crms.length),
    '<p>El CRM mira todo lo que llega: el correo de sus cuentas y el WhatsApp. Cada CRM tiene sus propias integraciones.</p>'
      + (crms.length ? crms.map(function(c){ var x = integ[c.id] || {};
          return '<div class="hub-fila"><span data-notr><b>' + esc(c.nombre) + '</b> <small>' + esc(c.cuentas.length) + ' cuenta' + (c.cuentas.length === 1 ? '' : 's') + '</small></span><span class="hub-chips">'
            + Object.keys(HUB_CRM).map(function(k){ var on = Array.isArray(x[k]) ? x[k].length > 0 : !!x[k]; return '<span class="hub-chip' + (on ? ' on' : '') + '">' + HUB_CRM[k] + '</span>'; }).join('') + '</span></div>'; }).join('')
        : '<p>Todavía no hay ningún CRM: se crea desde el CRM de la barra lateral.</p>'),
    '<button type="button" class="btn primary" data-hub="crm-abrir"><i class="ph ph-plugs-connected"></i> Abrir integraciones del CRM</button>', true);

  // 5) Metricool
  var m = j.metricool || {}, mc = HUB.mc;
  var cuerpoMc;
  if(m.conectado){
    cuerpoMc = '<p>Conectado por <b>' + (m.modo === 'mcp' ? 'MCP (tu cuenta de Metricool)' : 'API (token)') + '</b>. «Redes sociales» ya sale en la barra lateral.</p>'
      + (m.marcas || []).map(function(b){ return '<div class="hub-fila"><span data-notr><b>' + esc(b.nombre) + '</b></span><span class="hub-chips">' + (b.redes || []).map(function(r){ return '<span class="hub-chip on">' + esc((window.RED_NOMBRES || {})[r] || r) + '</span>'; }).join('') + '</span></div>'; }).join('');
  } else {
    cuerpoMc = '<p>Publicar y programar en todas tus redes desde Buzonero, con tus marcas de Metricool. Hay dos maneras de conectarlo; <small>mientras no se conecte, no sale en la barra lateral.</small></p>'
      + '<div class="hub-fila"><span><b>Con tu cuenta (MCP)</b> <small>entras en Metricool y das permiso; vale en cualquier plan, sin token</small></span><button type="button" class="btn primary" data-hub="mc-mcp"><i class="ph ph-plug"></i> Conectar</button></div>'
      + '<div class="hub-fila"><span><b>Con token (API)</b> <small>solo planes Advanced o Custom de Metricool</small></span><button type="button" class="btn" data-hub="mc-api-toggle">' + (mc.api ? 'Ocultar' : 'Usar token') + '</button></div>'
      + (mc.api ? '<div class="hub-form"><p><small>En Metricool: Ajustes → pestaña API → copia el token. Tu userId es el número que sale en la dirección de Metricool tras «userId=». El token se guarda cifrado en tu Buzonero.</small></p>'
        + '<label>Token de la API<input type="password" data-hub-in="token" value="' + esc(mc.token) + '" autocomplete="off"></label>'
        + '<label>userId<input type="text" data-hub-in="userId" value="' + esc(mc.userId) + '" placeholder="1234567" autocomplete="off"></label>'
        + (mc.error ? '<p class="hub-err" data-notr>' + esc(mc.error) + '</p>' : '')
        + '<div class="hub-pie"><button type="button" class="btn primary" data-hub="mc-api-probar"' + (mc.probando ? ' disabled' : '') + '><i class="ph ph-plug"></i> ' + (mc.probando ? 'Probando…' : 'Probar y guardar') + '</button></div></div>' : '');
  }
  cards += hubTarjeta('ph-share-network', 'Metricool · Redes sociales', hubEst(m.conectado ? 'Conectado' : 'Sin conectar', !!m.conectado), cuerpoMc,
    m.conectado ? '<button type="button" class="btn primary" data-hub="mc-abrir"><i class="ph ph-share-network"></i> Abrir Redes sociales</button><button type="button" class="btn" data-hub="mc-actualizar">Actualizar marcas</button><button type="button" class="btn" data-hub="mc-quitar">Quitar</button>' : '', true);

  el.innerHTML = h + '<div class="hub-grid">' + cards + '</div></div>';
}
function hubIr(carpeta){ var b = document.querySelector('#folders [data-f="' + carpeta + '"]'); if(b) b.click(); else toast('Todavía no está en la barra lateral: recarga'); }
document.addEventListener('click', async function(e){
  if(st.folder !== 'INTEGRACIONES') return;
  var t = e.target.closest('[data-hub]'), v = e.target.closest('[data-ve="hub"]');
  if(v){ HUB.j = null; cargarHub(); return; }
  if(!t) return;
  var a = t.dataset.hub;
  if(a === 'recon'){ location.href = '/api/auth/start?fin=reconectar&acc=' + encodeURIComponent(t.dataset.k); return; }
  if(a === 'anadir'){ var n = window.prompt('Nombre para la cuenta nueva (por ejemplo: Ventas):'); if(n && n.trim()) location.href = '/api/auth/start?fin=anadir&nombre=' + encodeURIComponent(n.trim()); return; }
  if(a === 'ct-conectar'){ location.href = '/api/auth/start?fin=contactos'; return; }
  if(a === 'ct-quitar'){ if(!confirm('¿Quitar los Contactos de Google? Se borra el permiso guardado y los números vuelven a salir sin nombre.')) return;
    try { await hubPost({ accion:'quitar-contactos', email:t.dataset.email }); toast('Contactos de Google quitados'); } catch(err){ toast('No se pudo quitar'); } HUB.j = null; cargarHub(); return; }
  if(a === 'abrir-wa'){ hubIr('MENSAJES'); return; }
  if(a === 'crm-abrir'){ if(window.abrirVistaCrm) abrirVistaCrm('integraciones'); return; }
  if(a === 'mc-mcp'){ location.href = '/api/auth/start?fin=metricool'; return; }
  if(a === 'mc-api-toggle'){ HUB.mc.api = !HUB.mc.api; pintarHub(); return; }
  if(a === 'mc-api-probar'){
    [].slice.call(document.querySelectorAll('[data-hub-in]')).forEach(function(i){ HUB.mc[i.dataset.hubIn] = i.value; });
    HUB.mc.probando = true; HUB.mc.error = ''; pintarHub();
    try { var j = await hubPost({ accion:'mc-conectar', token:HUB.mc.token, userId:HUB.mc.userId });
      if(!j.ok) throw new Error(j.mensaje || 'No se pudo conectar');
      HUB.mc = { token:'', userId:'', error:'', probando:false, api:false }; toast('Metricool conectado: ' + (j.marcas || []).length + ' marcas'); HUB.j = null; cargarHub();
    } catch(err){ HUB.mc.probando = false; HUB.mc.error = String(err.message || err); pintarHub(); }
    return; }
  if(a === 'mc-actualizar'){ try { var r = await hubPost({ accion:'mc-actualizar' }); toast(r.ok ? 'Marcas actualizadas' : 'No se pudieron leer las marcas (' + (r.error || '') + ')'); } catch(err){ toast('No se pudo actualizar'); } HUB.j = null; cargarHub(); return; }
  if(a === 'mc-quitar'){ if(!confirm('¿Quitar Metricool? Se borra el permiso o el token guardado y «Redes sociales» sale de la barra lateral.')) return;
    try { await hubPost({ accion:'mc-quitar' }); toast('Metricool quitado'); } catch(err){ toast('No se pudo quitar'); } HUB.j = null; cargarHub(); return; }
  if(a === 'mc-abrir'){ hubIr('REDES'); return; }
});
document.addEventListener('input', function(e){ var i = e.target; if(i && i.dataset && i.dataset.hubIn) HUB.mc[i.dataset.hubIn] = i.value; });
