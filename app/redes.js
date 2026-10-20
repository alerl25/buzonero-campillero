/* Buzonero Campillero · Redes sociales (Metricool)
   Vista «Redes sociales» de la barra lateral, a imagen del planificador de Metricool. Solo existe mientras Metricool esté
   conectado (Integraciones), por MCP o por API:
   - CALENDARIO semanal (lunes a domingo, de 0:00 a 23:59): cada publicación programada en su día y su hora, con sus redes;
     «Esta semana», flechas, selector de marca; pulsar un hueco libre abre «Crear publicación» con ese día y esa hora;
     pulsar una publicación la abre (texto entero, redes, enlace a Metricool).
   - LISTADO: lo mismo en lista, por días (7, 30 o 90 días).
   - Crear publicación: texto, redes de esa marca, día y hora, y enlaces https de imagen o vídeo. Pide confirmación y solo se
     programa cuando la persona la pulsa; nunca se publica nada por su cuenta.
   - Borrar una programada (solo con la vía API: el MCP de Metricool no tiene herramienta de borrar).
   Habla con /api/zernio (?r=mc-posts, mc-publicar, mc-borrar). Se registra en VISTAS (REDES → pintarRedes). */
var RED_NOMBRES = { facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn', tiktok:'TikTok', twitter:'X', youtube:'YouTube', pinterest:'Pinterest', threads:'Threads', bluesky:'Bluesky', gmb:'Google Business' };
var RED_ABREV = { facebook:'FB', instagram:'IG', linkedin:'in', tiktok:'TT', twitter:'X', youtube:'YT', pinterest:'Pi', threads:'Th', bluesky:'Bs', gmb:'GB' };
var RED_COL = { facebook:'#1877f2', instagram:'#c13584', linkedin:'#0a66c2', tiktok:'#1c1c1c', twitter:'#14171a', youtube:'#d4141c', pinterest:'#e60023', threads:'#3a3a3a', bluesky:'#1185fe', gmb:'#4285f4' };
var RED_FORM = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'bluesky', 'threads', 'gmb'];   // las que se programan con el formulario sencillo
var RED_PXH = 48;   // alto de una hora en el calendario
var RED = { marcas:null, marca:'', vista:'cal', dias:30, lunes:null, posts:null, cargando:false, error:'', modo:'', form:null, detalle:null };
try { RED.marca = localStorage.getItem('buzonero-red-marca') || ''; RED.dias = +localStorage.getItem('buzonero-red-dias') || 30; RED.vista = localStorage.getItem('buzonero-red-vista') === 'lista' ? 'lista' : 'cal'; } catch(e){}

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    + '.rs-barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 16px 12px}.rs-barra select{font:inherit;border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:7px 10px;background:var(--bg);color:var(--text);max-width:240px}'
    + '.rs-barra .push{margin-left:auto}.rs-titulo{font-weight:600;font-size:15px;margin:0 6px;white-space:nowrap}.rs-seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:999px;overflow:hidden}.rs-seg button{border:0;background:none;color:var(--mute);font:inherit;padding:6px 14px;cursor:pointer}.rs-seg button[aria-pressed=true]{background:var(--acc);color:#fff}'
    /* calendario semanal */
    + '.rs-cal{margin:0 16px 16px;border:1px solid var(--line);border-radius:var(--r);overflow:auto;background:var(--bg);max-height:calc(100vh - 250px);min-height:420px}.rs-cal-in{min-width:760px;position:relative}'
    + '.rs-cab{display:grid;grid-template-columns:52px repeat(7,minmax(0,1fr));position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}.rs-cab>div{padding:8px 4px;text-align:center;border-left:1px solid var(--line)}.rs-cab>div:first-child{border-left:0}'
    + '.rs-cab small{display:block;color:var(--faint);font-size:11px;letter-spacing:.08em;text-transform:uppercase}.rs-cab b{font-size:18px;font-weight:600}.rs-cab .hoy b{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:50%;background:var(--acc);color:#fff}'
    + '.rs-cuerpo{display:grid;grid-template-columns:52px repeat(7,minmax(0,1fr));position:relative}.rs-horas span{display:block;height:' + 48 + 'px;font-size:11px;color:var(--faint);text-align:right;padding-right:8px;transform:translateY(-7px)}'
    + '.rs-col{position:relative;border-left:1px solid var(--line);height:' + (48 * 24) + 'px;background-image:linear-gradient(var(--line) 1px,transparent 1px);background-size:100% ' + 48 + 'px;cursor:cell}.rs-col.pasado{background-color:rgba(127,127,127,.06);cursor:not-allowed}.rs-col.hoy{background-color:rgba(var(--acc-rgb),.05)}'
    + '.rs-ev{position:absolute;z-index:2;border:1px solid var(--bg);border-radius:6px;padding:2px 6px;color:#fff;background:var(--c,#555);text-align:left;font:inherit;font-size:11.5px;line-height:1.25;overflow:hidden;cursor:pointer;box-sizing:border-box}.rs-ev:hover{filter:brightness(1.12);z-index:3}'
    + '.rs-ev b{font-weight:600;margin-right:4px}.rs-ev i{font-style:normal;opacity:.85;margin-right:3px;font-size:10.5px}.rs-ev span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rs-ev.borr{opacity:.65;outline:1px dashed #fff}'
    + '.rs-ahora{position:absolute;left:0;right:0;height:0;border-top:2px solid var(--acc);z-index:4;pointer-events:none}.rs-ahora::before{content:"";position:absolute;left:-4px;top:-5px;width:8px;height:8px;border-radius:50%;background:var(--acc)}'
    /* listado */
    + '.rs-dia{padding:0 16px 8px}.rs-dia h3{font-size:13px;color:var(--mute);font-weight:600;margin:14px 0 8px}'
    + '.rs-post{display:flex;gap:12px;border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;margin-bottom:8px;background:var(--bg)}.rs-hora{font-variant-numeric:tabular-nums;font-weight:600;min-width:44px}'
    + '.rs-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}.rs-texto{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}.rs-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
    /* ventana de crear / ver */
    + '.rs-velo{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4);display:grid;place-items:center;padding:16px}.rs-modal{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--bg);border-radius:var(--r);padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:12px}'
    + '.rs-modal h3{margin:0;font-size:17px}.rs-modal label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px}'
    + '.rs-modal textarea,.rs-modal input[type=date],.rs-modal input[type=time]{font:inherit;font-weight:400;border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:8px 10px;background:var(--bg);color:var(--text);min-width:0}'
    + '.rs-checks{display:flex;gap:8px;flex-wrap:wrap}.rs-checks label{flex-direction:row;align-items:center;gap:6px;font-weight:500;border:1px solid var(--line);border-radius:999px;padding:4px 12px;cursor:pointer}.rs-fila{display:flex;gap:12px;flex-wrap:wrap}'
    + '.rs-aviso{color:var(--mute);font-size:13px;margin:0}.rs-err{color:var(--acc);font-size:13px;margin:0}.rs-full{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 12px}';
  document.head.appendChild(css);
})();

function redMarca(){ return (RED.marcas || []).filter(function(m){ return m.id === RED.marca; })[0] || null; }
function redZ(n){ return (n < 10 ? '0' : '') + n; }
function redIso(d){ return d.getFullYear() + '-' + redZ(d.getMonth() + 1) + '-' + redZ(d.getDate()); }
function redLunes(d){ var x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function redSuma(d, n){ var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function redMayus(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
if(!RED.lunes) RED.lunes = redLunes(new Date());

async function cargarRedes(){
  if(RED.cargando) return; RED.cargando = true; RED.error = ''; if(st.folder === 'REDES') pintarRedes();
  try {
    var j = (window.HUB && HUB.j && HUB.j.metricool && HUB.j.metricool.conectado) ? HUB.j : await hubFetch('/api/zernio?r=integraciones');
    if(!j.metricool || !j.metricool.conectado){ RED.marcas = []; RED.error = 'no-conectado'; }
    else {
      RED.marcas = j.metricool.marcas || []; RED.modo = j.metricool.modo;
      if(!redMarca()) RED.marca = (RED.marcas[0] || {}).id || '';
      RED.cargando = false; await cargarPostsRedes(); return;
    }
  } catch(e){ RED.error = 'red'; }
  RED.cargando = false; if(st.folder === 'REDES') pintarRedes();
}
async function cargarPostsRedes(){
  var m = redMarca(); if(!m){ RED.posts = []; if(st.folder === 'REDES') pintarRedes(); return; }
  RED.cargando = true; RED.error = ''; if(st.folder === 'REDES') pintarRedes();
  try {
    var desde, hasta;
    if(RED.vista === 'cal'){ desde = RED.lunes; hasta = redSuma(RED.lunes, 6); } else { desde = new Date(); hasta = redSuma(desde, RED.dias); }
    var j = await hubFetch('/api/zernio?r=mc-posts&blogId=' + encodeURIComponent(m.id) + '&desde=' + redIso(desde) + '&hasta=' + redIso(hasta));
    if(j.ok){ RED.posts = j.posts; } else { RED.posts = []; RED.error = j.error === 'permiso' ? 'permiso' : (j.error || 'metricool'); }
  } catch(e){ RED.posts = []; RED.error = 'red'; }
  RED.cargando = false; if(st.folder === 'REDES') pintarRedes();
}
function redFormNuevo(fecha, hora){
  var man = new Date(Date.now() + 86400000);
  return { texto:'', redes:[], fecha:fecha || redIso(man), hora:hora || '10:00', media:'', enviando:false, error:'' };
}
var RED_ERR = {
  permiso:'Metricool ya no reconoce el permiso: vuelve a conectarlo en Integraciones.', 'no-conectado':'Metricool no está conectado.', red:'No se pudo hablar con Buzonero.', fechas:'Fechas no válidas.',
  texto:'Escribe el texto de la publicación.', redes:'Elige al menos una red.', fecha:'Pon un día y una hora.', media:'Los enlaces de imagen o vídeo tienen que empezar por https://', 'media-obligatoria':'Instagram y TikTok necesitan una imagen o un vídeo (enlace público https).',
  marca:'Marca no válida.', confirmado:'Falta confirmar.', mcp:'Metricool no respondió bien. Prueba otra vez.', herramienta:'Metricool rechazó la publicación.', metricool:'Metricool no aceptó la petición.', 'sin-borrar-mcp':'Con la conexión por MCP no se puede borrar desde aquí: bórrala en Metricool.'
};
// reparte las publicaciones de un día en columnas cuando se pisan (como el calendario de Metricool)
function redColocar(ps){
  var out = [], activos = [], grupo = [];
  function cerrar(){ var n = grupo.reduce(function(m, x){ return Math.max(m, x.col + 1); }, 1); grupo.forEach(function(x){ x.n = n; }); }
  ps.forEach(function(p){
    activos = activos.filter(function(a){ return a.fin > p.min; });
    if(!activos.length){ cerrar(); grupo = []; }
    var usados = activos.map(function(a){ return a.col; }), col = 0; while(usados.indexOf(col) >= 0) col++;
    var it = { p:p, col:col, n:1, fin:p.min + 50 }; activos.push(it); grupo.push(it); out.push(it);
  });
  cerrar(); return out;
}
function pintarCalendarioRedes(m){
  var hoy = redIso(new Date()), ahora = new Date(), dias = [], DS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], i;
  for(i = 0; i < 7; i++) dias.push(redSuma(RED.lunes, i));
  var por = {}; (RED.posts || []).forEach(function(p){ var d = String(p.fecha).slice(0, 10), hh = +String(p.fecha).slice(11, 13), mm = +String(p.fecha).slice(14, 16); if(d.length < 10 || isNaN(hh)) return; p.min = hh * 60 + (mm || 0); (por[d] = por[d] || []).push(p); });
  var cab = '<div class="rs-cab"><div></div>' + dias.map(function(d, k){ return '<div class="' + (redIso(d) === hoy ? 'hoy' : '') + '"><small>' + DS[k] + '</small><b>' + d.getDate() + '</b></div>'; }).join('') + '</div>';
  var horas = '<div class="rs-horas">' + Array.apply(null, Array(24)).map(function(_, h){ return '<span>' + (h ? h + ':00' : '') + '</span>'; }).join('') + '</div>';
  var cols = dias.map(function(d){
    var iso = redIso(d), pasado = iso < hoy, lista = (por[iso] || []).sort(function(a, b){ return a.min - b.min; });
    var evs = redColocar(lista).map(function(x){ var p = x.p, r0 = (p.redes[0] || {}).red;
      return '<button type="button" class="rs-ev' + (p.borrador ? ' borr' : '') + '" data-red="ver" data-id="' + esc(p.id) + '" style="top:' + Math.round(p.min / 60 * RED_PXH) + 'px;height:' + Math.round(50 / 60 * RED_PXH) + 'px;left:' + (x.col / x.n * 100) + '%;width:' + (100 / x.n) + '%;--c:' + (RED_COL[r0] || '#555') + '" title="' + esc(p.texto.slice(0, 200)) + '">'
        + '<b>' + esc(String(p.fecha).slice(11, 16)) + '</b>' + p.redes.map(function(r){ return '<i>' + esc(RED_ABREV[r.red] || r.red) + '</i>'; }).join('') + '<span data-notr>' + esc(p.texto) + '</span></button>'; }).join('');
    var linea = iso === hoy ? '<div class="rs-ahora" style="top:' + Math.round((ahora.getHours() * 60 + ahora.getMinutes()) / 60 * RED_PXH) + 'px"></div>' : '';
    return '<div class="rs-col' + (pasado ? ' pasado' : '') + (iso === hoy ? ' hoy' : '') + '" data-dia="' + iso + '">' + evs + linea + '</div>';
  }).join('');
  return '<div class="rs-cal" id="rsScroll"><div class="rs-cal-in">' + cab + '<div class="rs-cuerpo">' + horas + cols + '</div></div></div>';
}
function pintarListaRedes(){
  var h = '', por = {};
  if(!RED.posts) return h;
  if(!RED.posts.length && !RED.error) h += '<div class="empty"><div class="halo"><i class="ph ph-calendar-blank"></i></div><h2>Nada <em>programado.</em></h2><p>No hay publicaciones programadas en estos días.</p></div>';
  RED.posts.slice().sort(function(a, b){ return String(a.fecha).localeCompare(String(b.fecha)); }).forEach(function(p){ var d = String(p.fecha).slice(0, 10) || 's/f'; (por[d] = por[d] || []).push(p); });
  Object.keys(por).sort().forEach(function(d){
    var t = Date.parse(d + 'T12:00:00'), tit = isFinite(t) ? redMayus(new Date(t).toLocaleDateString(BZ.loc, { weekday:'long', day:'numeric', month:'long' })) : 'Sin fecha';
    h += '<div class="rs-dia"><h3>' + esc(tit) + '</h3>' + por[d].map(function(p){
      return '<div class="rs-post"><span class="rs-hora">' + esc(String(p.fecha).slice(11, 16)) + '</span><div class="rs-tx"><span class="rs-chips">'
        + p.redes.map(function(r){ return '<span class="hub-chip on">' + esc(RED_NOMBRES[r.red] || r.red) + '</span>'; }).join('') + (p.borrador ? '<span class="hub-chip">Borrador</span>' : '') + (p.media ? '<span class="hub-chip"><i class="ph ph-image"></i> ' + esc(p.media) + '</span>' : '') + '</span>'
        + '<span class="rs-texto" data-notr>' + esc(p.texto) + '</span><span class="rs-chips"><button type="button" class="btn sm" data-red="ver" data-id="' + esc(p.id) + '">Abrir</button></span></div></div>'; }).join('') + '</div>';
  });
  return h;
}
function pintarRedes(){
  var el = $('rows'); if(!el) return;
  if(!RED.marcas && !RED.cargando && !RED.error){ cargarRedes(); }
  var m = redMarca(), enRef = $('rsScroll'), scroll = enRef ? enRef.scrollTop : null;
  var h = '<div class="vista-esp vancha">' + cabezaVista('Redes sociales', 'Metricool · ' + (RED.modo === 'mcp' ? 'conectado con tu cuenta' : RED.modo === 'api' ? 'conectado por API' : '…'), 'red', RED.cargando);
  if(RED.error === 'no-conectado' || (RED.marcas && !RED.marcas.length && !RED.cargando)){
    h += '<div class="empty"><h2>Metricool <em>sin conectar.</em></h2><p>Conéctalo en Integraciones para ver y programar tus publicaciones.</p><button type="button" class="btn primary" data-red="integ">Ir a Integraciones</button></div>';
    el.innerHTML = h + '</div>'; return;
  }
  if(!RED.marcas){ el.innerHTML = h + '<div class="empty"><p>Cargando tus marcas…</p></div></div>'; return; }
  var cal = RED.vista === 'cal', fin = redSuma(RED.lunes, 6);
  var titulo = RED.lunes.getMonth() === fin.getMonth()
    ? RED.lunes.getDate() + ' – ' + fin.getDate() + ' de ' + fin.toLocaleDateString(BZ.loc, { month:'long' }) + ' de ' + fin.getFullYear()
    : RED.lunes.getDate() + ' ' + RED.lunes.toLocaleDateString(BZ.loc, { month:'short' }) + ' – ' + fin.getDate() + ' ' + fin.toLocaleDateString(BZ.loc, { month:'short' }) + ' ' + fin.getFullYear();
  h += '<div class="rs-barra">'
    + (cal ? '<button type="button" class="btn" data-red="hoy">Esta semana</button><button type="button" class="icon-btn" data-red="ant" aria-label="Semana anterior"><i class="ph ph-caret-left"></i></button><button type="button" class="icon-btn" data-red="sig" aria-label="Semana siguiente"><i class="ph ph-caret-right"></i></button><span class="rs-titulo">' + esc(titulo) + '</span>'
          : '<select data-red-sel="dias" aria-label="Periodo">' + [7, 30, 90].map(function(d){ return '<option value="' + d + '"' + (d === RED.dias ? ' selected' : '') + '>Próximos ' + d + ' días</option>'; }).join('') + '</select>')
    + '<select data-red-sel="marca" aria-label="Marca">' + RED.marcas.map(function(b){ return '<option value="' + esc(b.id) + '"' + (b.id === RED.marca ? ' selected' : '') + ' data-notr>' + esc(b.nombre) + '</option>'; }).join('') + '</select>'
    + '<span class="rs-seg push" role="group" aria-label="Vista"><button type="button" data-red="vista-cal" aria-pressed="' + cal + '">Calendario</button><button type="button" data-red="vista-lista" aria-pressed="' + !cal + '">Listado</button></span>'
    + '<button type="button" class="btn primary" data-red="nueva"><i class="ph ph-plus"></i> Crear publicación</button></div>';
  if(RED.error && RED.error !== 'no-conectado') h += '<p class="rs-err" style="padding:0 16px">' + esc(RED_ERR[RED.error] || ('Error: ' + RED.error)) + '</p>';
  h += cal ? pintarCalendarioRedes(m) : pintarListaRedes();
  if(RED.form) h += pintarFormRedes(m);
  if(RED.detalle) h += pintarDetalleRedes();
  el.innerHTML = h + '</div>';
  var sc = $('rsScroll');
  if(sc){ if(scroll !== null && enRef) sc.scrollTop = scroll; else { var primero = (RED.posts || []).map(function(p){ return p.min; }).filter(function(x){ return x >= 0; }).sort(function(a, b){ return a - b; })[0]; sc.scrollTop = Math.max(0, ((primero != null ? Math.min(primero, 12 * 60) : 8 * 60) - 60) / 60 * RED_PXH); } }
}
function pintarFormRedes(m){
  var f = RED.form, ok = (m ? m.redes : []).filter(function(r){ return RED_FORM.indexOf(r) >= 0; });
  return '<div class="rs-velo" data-red="velo"><form class="rs-modal" id="rsForm"><h3>Crear publicación · <span data-notr>' + esc(m ? m.nombre : '') + '</span></h3>'
    + '<label>Texto de la publicación<textarea rows="5" data-red-in="texto" placeholder="Escribe aquí…">' + esc(f.texto) + '</textarea></label>'
    + '<div><b style="font-size:13px">Redes</b><div class="rs-checks" style="margin-top:6px">'
    + (ok.length ? ok.map(function(r){ return '<label><input type="checkbox" data-red-chk="' + r + '"' + (f.redes.indexOf(r) >= 0 ? ' checked' : '') + '> ' + esc(RED_NOMBRES[r] || r) + '</label>'; }).join('') : '<span class="rs-aviso">Esta marca no tiene ninguna red que se pueda programar desde aquí.</span>')
    + '</div></div>'
    + '<div class="rs-fila"><label>Día<input type="date" data-red-in="fecha" value="' + esc(f.fecha) + '"></label><label>Hora<input type="time" data-red-in="hora" value="' + esc(f.hora) + '"></label></div>'
    + '<label>Imágenes o vídeos (un enlace https por línea, opcional)<textarea rows="2" data-red-in="media" placeholder="https://…">' + esc(f.media) + '</textarea></label>'
    + '<p class="rs-aviso">Instagram y TikTok necesitan imagen o vídeo. Se programa con la zona horaria de la marca y se publica solo a esa hora. YouTube y Pinterest se hacen en Metricool.</p>'
    + (f.error ? '<p class="rs-err" data-notr>' + esc(f.error) + '</p>' : '')
    + '<div class="hub-pie"><button type="submit" class="btn primary"' + (f.enviando ? ' disabled' : '') + '><i class="ph ph-paper-plane-tilt"></i> ' + (f.enviando ? 'Programando…' : 'Programar') + '</button><button type="button" class="btn" data-red="cancelar">Cancelar</button></div></form></div>';
}
function pintarDetalleRedes(){
  var p = RED.detalle, t = Date.parse(String(p.fecha).slice(0, 10) + 'T12:00:00');
  return '<div class="rs-velo" data-red="velo"><div class="rs-modal"><h3>' + esc(isFinite(t) ? redMayus(new Date(t).toLocaleDateString(BZ.loc, { weekday:'long', day:'numeric', month:'long' })) : 'Publicación') + ' · ' + esc(String(p.fecha).slice(11, 16)) + '</h3>'
    + '<div class="rs-chips">' + p.redes.map(function(r){ return '<span class="hub-chip on">' + esc(RED_NOMBRES[r.red] || r.red) + '</span>'; }).join('') + (p.borrador ? '<span class="hub-chip">Borrador</span>' : '') + (p.media ? '<span class="hub-chip"><i class="ph ph-image"></i> ' + esc(p.media) + '</span>' : '') + '</div>'
    + '<div class="rs-full" data-notr>' + esc(p.texto) + '</div>'
    + '<p class="rs-aviso">Para cambiar el texto, la hora o las imágenes de una publicación ya programada, ábrela en Metricool.</p>'
    + '<div class="hub-pie">' + (p.enlace ? '<a class="btn primary" href="' + esc(p.enlace) + '" target="_blank" rel="noopener"><i class="ph ph-arrow-square-out"></i> Abrir en Metricool</a>' : '')
    + (RED.modo === 'api' ? '<button type="button" class="btn" data-red="borrar" data-id="' + esc(p.id) + '"><i class="ph ph-trash"></i> Borrar</button>' : '') + '<button type="button" class="btn" data-red="cerrar">Cerrar</button></div></div></div>';
}
async function enviarRedes(){
  var f = RED.form, m = redMarca(); if(!f || !m || f.enviando) return;
  var media = f.media.split(/\s+/).filter(Boolean);
  if(!f.texto.trim()){ f.error = RED_ERR.texto; return pintarRedes(); }
  if(!f.redes.length){ f.error = RED_ERR.redes; return pintarRedes(); }
  if(!f.fecha || !f.hora){ f.error = RED_ERR.fecha; return pintarRedes(); }
  if(media.some(function(u){ return !/^https:\/\//.test(u); })){ f.error = RED_ERR.media; return pintarRedes(); }
  if((f.redes.indexOf('instagram') >= 0 || f.redes.indexOf('tiktok') >= 0) && !media.length){ f.error = RED_ERR['media-obligatoria']; return pintarRedes(); }
  var cuando = new Date(f.fecha + 'T' + f.hora).toLocaleString(BZ.loc, { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
  if(!window.confirm('¿Programar esta publicación en ' + f.redes.map(function(r){ return RED_NOMBRES[r] || r; }).join(', ') + ' de «' + m.nombre + '» para el ' + cuando + '?\n\nSe publicará sola a esa hora.')) return;
  f.enviando = true; f.error = ''; pintarRedes();
  try {
    var j = await hubPost({ accion:'mc-publicar', blogId:m.id, texto:f.texto, redes:f.redes, fecha:f.fecha + 'T' + f.hora, media:media, confirmado:true });
    if(!j.ok) throw new Error((RED_ERR[j.error] || 'No se pudo programar') + (j.detalle ? ' (' + j.detalle + ')' : ''));
    toast('Publicación programada'); RED.form = null; cargarPostsRedes();
  } catch(e){ f.enviando = false; f.error = String(e.message || e); pintarRedes(); }
}
function redCambiaVista(v){ RED.vista = v; try { localStorage.setItem('buzonero-red-vista', v); } catch(e){} RED.posts = null; cargarPostsRedes(); }
document.addEventListener('click', async function(e){
  if(st.folder !== 'REDES') return;
  if(e.target.closest('[data-ve="red"]')){ RED.marcas = null; RED.posts = null; if(window.HUB) HUB.j = null; cargarRedes(); return; }
  var t = e.target.closest('[data-red]');
  // pulsar un hueco libre del calendario = crear una publicación a esa hora
  if(!t){
    var col = e.target.closest('.rs-col'); if(!col || RED.form || RED.detalle) return;
    var y = e.clientY - col.getBoundingClientRect().top, min = Math.floor(y / RED_PXH * 2) * 30, hh = redZ(Math.min(23, Math.floor(min / 60))), mm = redZ(min % 60);
    if(Date.parse(col.dataset.dia + 'T' + hh + ':' + mm + ':00') < Date.now()){ toast('No se puede programar en el pasado'); return; }
    RED.form = redFormNuevo(col.dataset.dia, hh + ':' + mm); pintarRedes(); return;
  }
  var a = t.dataset.red;
  if(a === 'velo'){ if(e.target === t){ RED.form = null; RED.detalle = null; pintarRedes(); } return; }
  if(a === 'integ'){ hubIr('INTEGRACIONES'); return; }
  if(a === 'nueva'){ RED.form = redFormNuevo(); pintarRedes(); return; }
  if(a === 'cancelar'){ RED.form = null; pintarRedes(); return; }
  if(a === 'cerrar'){ RED.detalle = null; pintarRedes(); return; }
  if(a === 'ver'){ RED.detalle = (RED.posts || []).filter(function(p){ return p.id === t.dataset.id; })[0] || null; pintarRedes(); return; }
  if(a === 'hoy'){ RED.lunes = redLunes(new Date()); RED.posts = null; cargarPostsRedes(); return; }
  if(a === 'ant' || a === 'sig'){ RED.lunes = redSuma(RED.lunes, a === 'ant' ? -7 : 7); RED.posts = null; cargarPostsRedes(); return; }
  if(a === 'vista-cal'){ if(RED.vista !== 'cal') redCambiaVista('cal'); return; }
  if(a === 'vista-lista'){ if(RED.vista !== 'lista') redCambiaVista('lista'); return; }
  if(a === 'borrar'){
    if(!confirm('¿Borrar esta publicación programada de Metricool?')) return;
    try { var j = await hubPost({ accion:'mc-borrar', blogId:RED.marca, id:t.dataset.id }); toast(j.ok ? 'Publicación borrada' : (RED_ERR[j.error] || 'No se pudo borrar')); } catch(err){ toast('No se pudo borrar'); }
    RED.detalle = null; cargarPostsRedes(); return; }
});
document.addEventListener('submit', function(e){ if(e.target && e.target.id === 'rsForm'){ e.preventDefault(); enviarRedes(); } });
document.addEventListener('input', function(e){ var i = e.target; if(RED.form && i && i.dataset && i.dataset.redIn) RED.form[i.dataset.redIn] = i.value; });
document.addEventListener('change', function(e){
  var i = e.target; if(!i || !i.dataset || st.folder !== 'REDES') return;
  if(i.dataset.redSel === 'marca'){ RED.marca = i.value; try { localStorage.setItem('buzonero-red-marca', RED.marca); } catch(err){} RED.form = null; RED.posts = null; cargarPostsRedes(); }
  else if(i.dataset.redSel === 'dias'){ RED.dias = +i.value || 30; try { localStorage.setItem('buzonero-red-dias', String(RED.dias)); } catch(err){} RED.posts = null; cargarPostsRedes(); }
  else if(i.dataset.redChk && RED.form){ var r = i.dataset.redChk, k = RED.form.redes.indexOf(r); if(i.checked && k < 0) RED.form.redes.push(r); if(!i.checked && k >= 0) RED.form.redes.splice(k, 1); }
});
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && st.folder === 'REDES' && (RED.form || RED.detalle)){ RED.form = null; RED.detalle = null; pintarRedes(); } });
