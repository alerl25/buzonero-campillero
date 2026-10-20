/* Buzonero Campillero · Mensajes (bandeja unificada de Zernio)
   Vista «Mensajes» de la barra lateral: las conversaciones de WhatsApp, Instagram, Facebook, Telegram y X que tengas
   conectadas en Zernio, en una sola lista, con el chat al lado. Es de SOLO LECTURA: no se puede contestar desde aquí ni se marca nada como leído (en WhatsApp eso manda el doble check azul).
   Habla con /api/zernio (la clave de Zernio vive en el servidor). Se registra en VISTAS (MENSAJES → pintarMensajes). */
var MEN = { cuentas:null, convs:null, sel:null, msgs:null, cargando:false, error:null, at:0 };
var MEN_PLAT = { whatsapp:['WhatsApp', 'ph-whatsapp-logo'], instagram:['Instagram', 'ph-instagram-logo'], facebook:['Facebook', 'ph-facebook-logo'], telegram:['Telegram', 'ph-telegram-logo'], twitter:['X', 'ph-x-logo'], bluesky:['Bluesky', 'ph-butterfly'], reddit:['Reddit', 'ph-reddit-logo'], imessage:['iMessage', 'ph-chat-circle'] };

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    // con el CRM abierto no se toca la rejilla (ver el fallo de la v1.10.1)
    + '.shell:not(.crm-on):has(.men),.shell.reading:not(.crm-on):has(.men){grid-template-columns:236px minmax(0,1fr)}.shell:not(.crm-on):has(.men)>.read{display:none}'
    + '@media(max-width:1180px){.shell:not(.crm-on):has(.men),.shell.reading:not(.crm-on):has(.men){grid-template-columns:72px minmax(0,1fr)}}'
    + '@media(max-width:900px){.shell:not(.crm-on):has(.men),.shell.reading:not(.crm-on):has(.men){grid-template-columns:minmax(0,1fr)}}'
    + '.shell:not(.crm-on):has(.men)>.list{overflow:hidden;display:flex;flex-direction:column}.shell:has(.men) .rows{flex:1;min-height:0;overflow:hidden;padding-bottom:0}'
    + '.vista-esp.men{display:flex;flex-direction:column;height:100%;min-height:0;padding:0}'
    + '.men-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr)}'
    + '.men-lista{overflow-y:auto;border-right:1px solid var(--line)}'
    + '.men-it{display:flex;gap:10px;width:100%;text-align:left;padding:12px 14px;border:0;border-bottom:1px solid var(--line);background:none;color:inherit;font:inherit;cursor:pointer}'
    + '.men-it:hover,.men-it[aria-current=true]{background:var(--hover,rgba(0,0,0,.04))}'
    + '.men-av{width:38px;height:38px;border-radius:50%;flex:none;background:var(--line);display:grid;place-items:center;overflow:hidden;font-weight:600;font-size:13px}.men-av img{width:100%;height:100%;object-fit:cover}'
    + '.men-tx{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.men-top{display:flex;gap:8px;align-items:baseline}.men-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.men-top time{font-size:11.5px;color:var(--faint)}'
    + '.men-snip{font-size:13px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.men-meta{font-size:11.5px;color:var(--faint);display:flex;gap:6px;align-items:center}'
    + '.men-n{background:var(--acc);color:#fff;border-radius:999px;font-size:11px;padding:0 6px;line-height:17px;font-weight:600}'
    + '.men-chat{display:flex;flex-direction:column;min-width:0;min-height:0}.men-hilo{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:6px}'
    + '.men-m{max-width:min(520px,80%);padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--line);align-self:flex-start}'
    + '.men-m.yo{align-self:flex-end;background:var(--acc);color:#fff}.men-m small{display:block;opacity:.7;font-size:11px;margin-top:2px}'
    + '.men-cab{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line)}.men-cab .men-tx b{font-weight:600}.men-cab small{color:var(--faint);font-size:12px}.men-cab .btn{margin-left:auto}'
    + '.men-av .ph{font-size:18px;color:var(--faint)}.men-av.col{color:#fff}'
    + '.men-vacio{margin:auto;text-align:center;color:var(--faint);padding:24px;max-width:420px}.men-vacio a{color:var(--acc)}'
    + '@media(max-width:900px){.men-body{grid-template-columns:minmax(0,1fr)}.men-body.chat-on .men-lista{display:none}.men-body:not(.chat-on) .men-chat{display:none}}';
  document.head.appendChild(css);
})();

// ---------- nombres y fotos ----------
// WhatsApp no da la foto de perfil a las empresas, y el nombre solo si la persona lo puso en su perfil. El servidor da el mejor nombre:
// el que TÚ pones a mano («Poner nombre»), el de WhatsApp o, si no hay, el número bien escrito. NO se mira ninguna agenda ni Contactos de Google
// (decisión del dueño, 20-oct-2026: para ver el WhatsApp no se toca nada más).
function menClave(t){ var d = String(t || '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : ''; }
var MEN_COL = ['#7c9a8e', '#b08968', '#8a8fb5', '#c27c7c', '#6f9fb0', '#a88fb0', '#9aa56f', '#c49a6c'];
function menInfo(c){
  return { nombre: c.participantName || 'Sin nombre', real: !c.sinNombre, foto: c.participantPicture || '' };
}
function menAvatar(c){
  var i = menInfo(c), h = 0, s = String(c.telefono || c.id); for(var k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) % 997;
  if(i.foto) return '<span class="men-av"><img src="' + esc(i.foto) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()"></span>';
  if(!i.real) return '<span class="men-av"><i class="ph ph-user"></i></span>';
  return '<span class="men-av col" style="background:' + MEN_COL[h % MEN_COL.length] + '">' + esc(i.nombre.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?') + '</span>';
}
function menCabecera(c){
  if(!c) return '';
  var i = menInfo(c);
  return '<div class="men-cab">' + menAvatar(c) + '<span class="men-tx"><b>' + esc(i.nombre) + '</b><small>' + esc(c.telefono ? '+' + String(c.telefono).replace(/\D/g, '') : '') + '</small></span>'
    + '<button type="button" class="btn sm" data-men-nombre="' + esc(c.id) + '"><i class="ph ph-pencil-simple"></i> ' + (i.real ? 'Cambiar nombre' : 'Poner nombre') + '</button></div>';
}
async function menPonerNombre(id){
  var c = (MEN.convs || []).filter(function(x){ return x.id === id; })[0]; if(!c || !c.telefono) return;
  var n = window.prompt('Nombre para ' + c.telefono + ' (déjalo vacío para quitarlo):', c.sinNombre ? '' : c.participantName);
  if(n === null) return;
  try {
    var j = await menApi('/api/zernio', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'nombre', numero:c.telefono, nombre:n }) });
    if(!j.ok) throw new Error('no');
    toast(n.trim() ? 'Nombre guardado' : 'Nombre quitado');
    var l = await menApi('/api/zernio?r=conversaciones'); if(l.ok) MEN.convs = l.conversaciones;
  } catch(e){ toast('No se pudo guardar el nombre'); }
  pintarMensajes();
}
function menNoLeidos(){ return (MEN.convs || []).filter(menNuevo).length; }
function menPlat(p){ return MEN_PLAT[p] || [p || '', 'ph-chat-circle']; }
function menFecha(t){ if(!t) return ''; var d = new Date(t), h = new Date(); return d.toDateString() === h.toDateString() ? d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : d.toLocaleDateString([], { day:'numeric', month:'short' }); }
async function menApi(url, opt){
  var r = await fetch(url, Object.assign({ cache:'no-store', credentials:'same-origin' }, opt || {}));
  var j = await r.json().catch(function(){ return {}; });
  if(r.status === 401) throw new Error('sesion');
  return j;
}
async function cargarMensajes(){
  if(MEN.cargando) return; MEN.cargando = true; MEN.error = null; if(st.folder === 'MENSAJES') pintarMensajes();
  try {
    var e = await menApi('/api/zernio?r=estado');
    if(!e.ok){ MEN.error = e.error === 'sin_clave' ? 'sin_clave' : 'fallo'; MEN.cuentas = []; MEN.convs = []; }
    else {
      MEN.cuentas = e.cuentas;
      MEN.convs = e.cuentas.length ? ((await menApi('/api/zernio?r=conversaciones')).conversaciones || []) : [];
    }
    MEN.at = Date.now();
  } catch(err){ MEN.error = 'fallo'; if(!MEN.convs) MEN.convs = []; }
  finally { MEN.cargando = false; drawSide(); if(st.folder === 'MENSAJES') pintarMensajes(); }
}
async function abrirConversacion(id, cuenta){
  MEN.sel = { id:id, cuenta:cuenta }; MEN.msgs = null; pintarMensajes();
  try {
    var j = await menApi('/api/zernio?r=mensajes&id=' + encodeURIComponent(id) + '&cuenta=' + encodeURIComponent(cuenta));
    if(!MEN.sel || MEN.sel.id !== id) return;
    MEN.msgs = j.ok ? j.mensajes : []; if(!j.ok) toast('No se pudieron leer los mensajes');
    menVisto(id);
  } catch(e){ MEN.msgs = []; toast('No se pudieron leer los mensajes'); }
  pintarMensajes();
  var h = document.getElementById('menHilo'); if(h) h.scrollTop = h.scrollHeight;
}
// «visto» se guarda solo en este navegador: la lista marca lo que ha cambiado desde la última vez que lo abriste
var MEN_V = (function(){ try { return JSON.parse(localStorage.getItem('buzonero-men-vistos') || '{}') || {}; } catch(e){ return {}; } })();
function menVisto(id){ var c = (MEN.convs || []).filter(function(x){ return x.id === id; })[0]; MEN_V[id] = c ? c.updatedTime : new Date().toISOString(); try { localStorage.setItem('buzonero-men-vistos', JSON.stringify(MEN_V)); } catch(e){} drawSide(); }
function menNuevo(c){ return !!c.updatedTime && (!MEN_V[c.id] || Date.parse(c.updatedTime) > Date.parse(MEN_V[c.id])); }
function pintarMensajes(){
  var el = $('rows'); if(!el) return;
  if(!MEN.convs && !MEN.cargando){ cargarMensajes(); return; }
  var sub = MEN.cargando ? 'Cargando…' : (MEN.cuentas && MEN.cuentas.length ? MEN.cuentas.length + ' cuenta' + (MEN.cuentas.length > 1 ? 's' : '') + ' conectada' + (MEN.cuentas.length > 1 ? 's' : '') + ' en Zernio' : 'Ninguna cuenta conectada todavía');
  var h = '<div class="vista-esp men">' + cabezaVista('Mensajes', sub, 'men', MEN.cargando);
  if(!MEN.convs){ h += '<div class="men-vacio">Cargando tus conversaciones…</div>'; }
  else if(MEN.error === 'sin_clave'){ h += '<div class="men-vacio"><h3>Falta la clave de Zernio</h3><p>Hay que añadir <code>ZERNIO_API_KEY</code> en las variables de entorno de Vercel.</p></div>'; }
  else if(MEN.error){ h += '<div class="men-vacio"><h3>No se pudo conectar con Zernio</h3><p>Prueba otra vez en un momento.</p></div>'; }
  else if(!MEN.cuentas.length){ h += '<div class="men-vacio"><h3>Conecta tu primera cuenta</h3><p>Entra en <a href="https://zernio.com" target="_blank" rel="noopener">zernio.com</a> y conecta WhatsApp, Instagram, Facebook… Cuando lo hagas, sus conversaciones aparecerán aquí.</p></div>'; }
  else {
    h += '<div class="men-body' + (MEN.sel ? ' chat-on' : '') + '"><div class="men-lista">';
    if(!MEN.convs.length) h += '<div class="men-vacio">No hay conversaciones todavía.</div>';
    MEN.convs.forEach(function(c){
      var p = menPlat(c.platform), nom = menInfo(c).nombre, cur = MEN.sel && MEN.sel.id === c.id;
      h += '<button type="button" class="men-it" data-men="' + esc(c.id) + '|' + esc(c.accountId) + '" aria-current="' + !!cur + '">' + menAvatar(c)
        + '<span class="men-tx"><span class="men-top"><b>' + esc(nom) + '</b><time>' + esc(menFecha(c.updatedTime)) + '</time></span><span class="men-snip">' + esc(c.lastMessage || '') + '</span>'
        + '<span class="men-meta"><i class="ph ' + p[1] + '"></i>' + esc(p[0]) + (c.accountUsername ? ' · ' + esc(c.accountUsername) : '') + (menNuevo(c) ? ' <span class="men-n">nuevo</span>' : '') + '</span></span></button>';
    });
    h += '</div><div class="men-chat">';
    if(!MEN.sel) h += '<div class="men-vacio">Elige una conversación.</div>';
    else {
      h += menCabecera((MEN.convs || []).filter(function(x){ return x.id === MEN.sel.id; })[0]);
      h += '<div class="men-hilo" id="menHilo">';
      if(!MEN.msgs) h += '<div class="men-vacio">Cargando…</div>';
      else MEN.msgs.forEach(function(m){ h += '<div class="men-m' + (m.direction === 'outgoing' ? ' yo' : '') + '">' + esc(m.message || (m.attachments && m.attachments.length ? '[adjunto]' : '')) + '<small>' + esc(menFecha(m.createdAt)) + '</small></div>'; });
      h += '</div>';
    }
    h += '</div></div>';
  }
  el.innerHTML = h + '</div>';
}
document.addEventListener('click', function(e){
  if(st.folder !== 'MENSAJES') return; var t;
  if((t = e.target.closest('[data-men-nombre]'))){ menPonerNombre(t.dataset.menNombre); return; }
  if((t = e.target.closest('[data-men]'))){ var p = t.dataset.men.split('|'); abrirConversacion(p[0], p[1]); return; }
  if(e.target.closest('[data-ve="men"]')){ MEN.convs = null; MEN.sel = null; cargarMensajes(); }
});
// se refresca solo cada minuto mientras la vista está abierta (sin pisar lo que se escribe)
setInterval(function(){ if(st.folder === 'MENSAJES' && !MEN.cargando && document.visibilityState === 'visible'){ menApi('/api/zernio?r=conversaciones').then(function(j){ if(j.ok){ MEN.convs = j.conversaciones; drawSide(); pintarMensajes(); } }).catch(function(){}); } }, 60000);
