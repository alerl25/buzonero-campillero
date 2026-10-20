/* Buzonero Campillero · Redes sociales (Metricool)
   Vista «Redes sociales» de la barra lateral. Solo existe mientras Metricool esté conectado (Integraciones), por MCP o por API:
   - Elegir marca y ver sus publicaciones programadas (7, 30 o 90 días), agrupadas por día.
   - Crear una publicación: texto, redes de esa marca, día y hora, y enlaces https de imagen o vídeo. Pide confirmación y
     solo se programa cuando la persona la pulsa; nunca se publica nada por su cuenta.
   - Borrar una programada (solo con la vía API: el MCP de Metricool no tiene herramienta de borrar).
   Habla con /api/zernio (?r=mc-posts, mc-publicar, mc-borrar). Se registra en VISTAS (REDES → pintarRedes). */
var RED_NOMBRES = { facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn', tiktok:'TikTok', twitter:'X', youtube:'YouTube', pinterest:'Pinterest', threads:'Threads', bluesky:'Bluesky', gmb:'Google Business' };
var RED_FORM = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'bluesky', 'threads', 'gmb'];   // las que se programan con el formulario sencillo
var RED = { marcas:null, marca:'', dias:30, posts:null, cargando:false, error:'', modo:'', form:null };
try { RED.marca = localStorage.getItem('buzonero-red-marca') || ''; RED.dias = +localStorage.getItem('buzonero-red-dias') || 30; } catch(e){}

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    + '.rs-barra{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 16px 14px}.rs-barra select{font:inherit;border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:7px 10px;background:var(--bg);color:var(--text);max-width:260px}.rs-barra .btn{margin-left:auto}'
    + '.rs-dia{padding:0 16px 8px}.rs-dia h3{font-size:13px;color:var(--mute);font-weight:600;margin:14px 0 8px}'
    + '.rs-post{display:flex;gap:12px;border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;margin-bottom:8px;background:var(--bg)}.rs-hora{font-variant-numeric:tabular-nums;font-weight:600;min-width:44px}'
    + '.rs-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}.rs-texto{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}.rs-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
    + '.rs-form{margin:0 16px 16px;border:1px solid var(--line);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--bg)}.rs-form label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px}'
    + '.rs-form textarea,.rs-form input[type=date],.rs-form input[type=time]{font:inherit;font-weight:400;border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:8px 10px;background:var(--bg);color:var(--text);min-width:0}'
    + '.rs-checks{display:flex;gap:8px;flex-wrap:wrap}.rs-checks label{flex-direction:row;align-items:center;gap:6px;font-weight:500;border:1px solid var(--line);border-radius:999px;padding:4px 12px;cursor:pointer}.rs-fila{display:flex;gap:12px;flex-wrap:wrap}'
    + '.rs-aviso{color:var(--mute);font-size:13px;margin:0}.rs-err{color:var(--acc);font-size:13px;margin:0}';
  document.head.appendChild(css);
})();

function redMarca(){ return (RED.marcas || []).filter(function(m){ return m.id === RED.marca; })[0] || null; }
function redIso(d){ var z = function(n){ return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
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
    var hoy = new Date(), fin = new Date(hoy.getTime() + RED.dias * 86400000);
    var j = await hubFetch('/api/zernio?r=mc-posts&blogId=' + encodeURIComponent(m.id) + '&desde=' + redIso(hoy) + '&hasta=' + redIso(fin));
    if(j.ok){ RED.posts = j.posts; } else { RED.posts = []; RED.error = j.error === 'permiso' ? 'permiso' : (j.error || 'metricool'); }
  } catch(e){ RED.posts = []; RED.error = 'red'; }
  RED.cargando = false; if(st.folder === 'REDES') pintarRedes();
}
function redFormNuevo(){
  var man = new Date(Date.now() + 86400000), m = redMarca();
  return { texto:'', redes:[], fecha:redIso(man), hora:'10:00', media:'', enviando:false, error:'', redesOk:(m ? m.redes : []).filter(function(r){ return RED_FORM.indexOf(r) >= 0; }) };
}
var RED_ERR = {
  permiso:'Metricool ya no reconoce el permiso: vuelve a conectarlo en Integraciones.', 'no-conectado':'Metricool no está conectado.', red:'No se pudo hablar con Buzonero.', fechas:'Fechas no válidas.',
  texto:'Escribe el texto de la publicación.', redes:'Elige al menos una red.', fecha:'Pon un día y una hora.', media:'Los enlaces de imagen o vídeo tienen que empezar por https://', 'media-obligatoria':'Instagram y TikTok necesitan una imagen o un vídeo (enlace público https).',
  marca:'Marca no válida.', confirmado:'Falta confirmar.', mcp:'Metricool no respondió bien. Prueba otra vez.', herramienta:'Metricool rechazó la publicación.', metricool:'Metricool no aceptó la petición.', 'sin-borrar-mcp':'Con la conexión por MCP no se puede borrar desde aquí: bórrala en Metricool.'
};
function pintarRedes(){
  var el = $('rows'); if(!el) return;
  if(!RED.marcas && !RED.cargando && !RED.error){ cargarRedes(); }
  var m = redMarca();
  var h = '<div class="vista-esp vancha">' + cabezaVista('Redes sociales', 'Metricool · ' + (RED.modo === 'mcp' ? 'conectado con tu cuenta' : RED.modo === 'api' ? 'conectado por API' : '…'), 'red', RED.cargando);
  if(RED.error === 'no-conectado' || (RED.marcas && !RED.marcas.length && !RED.cargando)){
    h += '<div class="empty"><h2>Metricool <em>sin conectar.</em></h2><p>Conéctalo en Integraciones para ver y programar tus publicaciones.</p><button type="button" class="btn primary" data-red="integ">Ir a Integraciones</button></div>';
    el.innerHTML = h + '</div>'; return;
  }
  if(!RED.marcas){ el.innerHTML = h + '<div class="empty"><p>Cargando tus marcas…</p></div></div>'; return; }
  h += '<div class="rs-barra"><select data-red-sel="marca" aria-label="Marca">' + RED.marcas.map(function(b){ return '<option value="' + esc(b.id) + '"' + (b.id === RED.marca ? ' selected' : '') + ' data-notr>' + esc(b.nombre) + '</option>'; }).join('') + '</select>'
    + '<select data-red-sel="dias" aria-label="Periodo">' + [7, 30, 90].map(function(d){ return '<option value="' + d + '"' + (d === RED.dias ? ' selected' : '') + '>Próximos ' + d + ' días</option>'; }).join('') + '</select>'
    + (m ? (m.redes || []).map(function(r){ return '<span class="hub-chip on">' + esc(RED_NOMBRES[r] || r) + '</span>'; }).join('') : '')
    + '<button type="button" class="btn primary" data-red="nueva"><i class="ph ph-plus"></i> Crear publicación</button></div>';
  if(RED.form) h += pintarFormRedes(m);
  if(RED.error && RED.error !== 'no-conectado') h += '<p class="rs-err" style="padding:0 16px">' + esc(RED_ERR[RED.error] || ('Error: ' + RED.error)) + '</p>';
  if(RED.posts){
    if(!RED.posts.length && !RED.error) h += '<div class="empty"><div class="halo"><i class="ph ph-calendar-blank"></i></div><h2>Nada <em>programado.</em></h2><p>No hay publicaciones programadas en estos días.</p></div>';
    var por = {}; RED.posts.slice().sort(function(a, b){ return String(a.fecha).localeCompare(String(b.fecha)); }).forEach(function(p){ var d = String(p.fecha).slice(0, 10) || 's/f'; (por[d] = por[d] || []).push(p); });
    Object.keys(por).sort().forEach(function(d){
      var t = Date.parse(d + 'T12:00:00'), tit = isFinite(t) ? new Date(t).toLocaleDateString(BZ.loc, { weekday:'long', day:'numeric', month:'long' }) : 'Sin fecha'; tit = tit.charAt(0).toUpperCase() + tit.slice(1);
      h += '<div class="rs-dia"><h3>' + esc(tit) + '</h3>' + por[d].map(function(p){
        return '<div class="rs-post"><span class="rs-hora">' + esc(String(p.fecha).slice(11, 16)) + '</span><div class="rs-tx"><span class="rs-chips">'
          + p.redes.map(function(r){ return '<span class="hub-chip on">' + esc(RED_NOMBRES[r.red] || r.red) + '</span>'; }).join('') + (p.borrador ? '<span class="hub-chip">Borrador</span>' : '') + (p.media ? '<span class="hub-chip"><i class="ph ph-image"></i> ' + esc(p.media) + '</span>' : '') + '</span>'
          + '<span class="rs-texto" data-notr>' + esc(p.texto) + '</span><span class="rs-chips">'
          + (p.enlace ? '<a class="btn sm" href="' + esc(p.enlace) + '" target="_blank" rel="noopener"><i class="ph ph-arrow-square-out"></i> Abrir en Metricool</a>' : '')
          + (RED.modo === 'api' ? '<button type="button" class="btn sm" data-red="borrar" data-id="' + esc(p.id) + '"><i class="ph ph-trash"></i> Borrar</button>' : '') + '</span></div></div>'; }).join('') + '</div>';
    });
  }
  el.innerHTML = h + '</div>';
}
function pintarFormRedes(m){
  var f = RED.form, ok = (m ? m.redes : []).filter(function(r){ return RED_FORM.indexOf(r) >= 0; });
  return '<form class="rs-form" id="rsForm"><label>Texto de la publicación<textarea rows="5" data-red-in="texto" placeholder="Escribe aquí…">' + esc(f.texto) + '</textarea></label>'
    + '<div><b style="font-size:13px">Redes de «' + esc(m ? m.nombre : '') + '»</b><div class="rs-checks" style="margin-top:6px">'
    + (ok.length ? ok.map(function(r){ return '<label><input type="checkbox" data-red-chk="' + r + '"' + (f.redes.indexOf(r) >= 0 ? ' checked' : '') + '> ' + esc(RED_NOMBRES[r] || r) + '</label>'; }).join('') : '<span class="rs-aviso">Esta marca no tiene ninguna red que se pueda programar desde aquí.</span>')
    + '</div></div>'
    + '<div class="rs-fila"><label>Día<input type="date" data-red-in="fecha" value="' + esc(f.fecha) + '"></label><label>Hora<input type="time" data-red-in="hora" value="' + esc(f.hora) + '"></label></div>'
    + '<label>Imágenes o vídeos (un enlace https por línea, opcional)<textarea rows="2" data-red-in="media" placeholder="https://…">' + esc(f.media) + '</textarea></label>'
    + '<p class="rs-aviso">Instagram y TikTok necesitan imagen o vídeo. Se programa con la zona horaria de la marca y se publica solo a esa hora. YouTube y Pinterest se hacen en Metricool.</p>'
    + (f.error ? '<p class="rs-err" data-notr>' + esc(f.error) + '</p>' : '')
    + '<div class="hub-pie"><button type="submit" class="btn primary"' + (f.enviando ? ' disabled' : '') + '><i class="ph ph-paper-plane-tilt"></i> ' + (f.enviando ? 'Programando…' : 'Programar') + '</button><button type="button" class="btn" data-red="cancelar">Cancelar</button></div></form>';
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
document.addEventListener('click', async function(e){
  if(st.folder !== 'REDES') return;
  if(e.target.closest('[data-ve="red"]')){ RED.marcas = null; RED.posts = null; if(window.HUB) HUB.j = null; cargarRedes(); return; }
  var t = e.target.closest('[data-red]'); if(!t) return;
  var a = t.dataset.red;
  if(a === 'integ'){ hubIr('INTEGRACIONES'); return; }
  if(a === 'nueva'){ RED.form = RED.form ? null : redFormNuevo(); pintarRedes(); return; }
  if(a === 'cancelar'){ RED.form = null; pintarRedes(); return; }
  if(a === 'borrar'){
    if(!confirm('¿Borrar esta publicación programada de Metricool?')) return;
    try { var j = await hubPost({ accion:'mc-borrar', blogId:RED.marca, id:t.dataset.id }); toast(j.ok ? 'Publicación borrada' : (RED_ERR[j.error] || 'No se pudo borrar')); } catch(err){ toast('No se pudo borrar'); }
    cargarPostsRedes(); return; }
});
document.addEventListener('submit', function(e){ if(e.target && e.target.id === 'rsForm'){ e.preventDefault(); enviarRedes(); } });
document.addEventListener('input', function(e){ var i = e.target; if(RED.form && i && i.dataset && i.dataset.redIn) RED.form[i.dataset.redIn] = i.value; });
document.addEventListener('change', function(e){
  var i = e.target; if(!i || !i.dataset || st.folder !== 'REDES') return;
  if(i.dataset.redSel === 'marca'){ RED.marca = i.value; try { localStorage.setItem('buzonero-red-marca', RED.marca); } catch(err){} if(RED.form) RED.form = redFormNuevo(); RED.posts = null; cargarPostsRedes(); }
  else if(i.dataset.redSel === 'dias'){ RED.dias = +i.value || 30; try { localStorage.setItem('buzonero-red-dias', String(RED.dias)); } catch(err){} cargarPostsRedes(); }
  else if(i.dataset.redChk && RED.form){ var r = i.dataset.redChk, k = RED.form.redes.indexOf(r); if(i.checked && k < 0) RED.form.redes.push(r); if(!i.checked && k >= 0) RED.form.redes.splice(k, 1); }
});
