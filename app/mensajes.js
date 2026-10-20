/* Buzonero Campillero · Mensajes (bandeja unificada de Zernio)
   Vista «Mensajes» de la barra lateral: las conversaciones de WhatsApp, Instagram, Facebook, Telegram y X que tengas
   conectadas en Zernio, en una sola lista, con el chat al lado. Solo se envía al pulsar «Enviar».
   Habla con /api/zernio (la clave de Zernio vive en el servidor). Se registra en VISTAS (MENSAJES → pintarMensajes). */
var MEN = { cuentas:null, convs:null, sel:null, msgs:null, cargando:false, error:null, enviando:false, at:0, borrador:'' };
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
    + '.men-form{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line)}.men-form textarea{flex:1;font:inherit;border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:8px 10px;background:var(--bg);color:var(--text);resize:none;min-height:40px;max-height:140px}'
    + '.men-vacio{margin:auto;text-align:center;color:var(--faint);padding:24px;max-width:420px}.men-vacio a{color:var(--acc)}'
    + '@media(max-width:900px){.men-body{grid-template-columns:minmax(0,1fr)}.men-body.chat-on .men-lista{display:none}.men-body:not(.chat-on) .men-chat{display:none}}';
  document.head.appendChild(css);
})();

function menNoLeidos(){ return (MEN.convs || []).reduce(function(t, c){ return t + (c.unreadCount || 0); }, 0); }
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
  MEN.sel = { id:id, cuenta:cuenta }; MEN.msgs = null; MEN.borrador = ''; pintarMensajes();
  try {
    var j = await menApi('/api/zernio?r=mensajes&id=' + encodeURIComponent(id) + '&cuenta=' + encodeURIComponent(cuenta));
    if(!MEN.sel || MEN.sel.id !== id) return;
    MEN.msgs = j.ok ? j.mensajes : []; if(!j.ok) toast('No se pudieron leer los mensajes');
    var c = (MEN.convs || []).filter(function(x){ return x.id === id; })[0];
    if(c && c.unreadCount){ c.unreadCount = 0; drawSide(); menApi('/api/zernio', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'leido', id:id, cuenta:cuenta }) }).catch(function(){}); }
  } catch(e){ MEN.msgs = []; toast('No se pudieron leer los mensajes'); }
  pintarMensajes();
  var h = document.getElementById('menHilo'); if(h) h.scrollTop = h.scrollHeight;
}
async function enviarMensaje(){
  var ta = document.getElementById('menTexto'), t = ta ? ta.value.trim() : ''; if(!t || !MEN.sel || MEN.enviando) return;
  MEN.enviando = true; pintarMensajes();
  try {
    var j = await menApi('/api/zernio', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'enviar', id:MEN.sel.id, cuenta:MEN.sel.cuenta, texto:t }) });
    if(!j.ok) throw new Error(j.detalle || 'no enviado');
    MEN.borrador = ''; toast('Mensaje enviado');
    var s = MEN.sel, j2 = await menApi('/api/zernio?r=mensajes&id=' + encodeURIComponent(s.id) + '&cuenta=' + encodeURIComponent(s.cuenta));
    if(j2.ok) MEN.msgs = j2.mensajes;
  } catch(e){ MEN.borrador = t; toast('No se pudo enviar: ' + e.message); }
  MEN.enviando = false; pintarMensajes();
  var h = document.getElementById('menHilo'); if(h) h.scrollTop = h.scrollHeight;
}
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
      var p = menPlat(c.platform), nom = c.participantName || c.whatsappUsername || 'Sin nombre', cur = MEN.sel && MEN.sel.id === c.id;
      h += '<button type="button" class="men-it" data-men="' + esc(c.id) + '|' + esc(c.accountId) + '" aria-current="' + !!cur + '"><span class="men-av">' + (c.participantPicture ? '<img src="' + esc(c.participantPicture) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : esc(nom.charAt(0).toUpperCase())) + '</span>'
        + '<span class="men-tx"><span class="men-top"><b>' + esc(nom) + '</b><time>' + esc(menFecha(c.updatedTime)) + '</time></span><span class="men-snip">' + esc(c.lastMessage || '') + '</span>'
        + '<span class="men-meta"><i class="ph ' + p[1] + '"></i>' + esc(p[0]) + (c.accountUsername ? ' · ' + esc(c.accountUsername) : '') + (c.unreadCount ? ' <span class="men-n">' + c.unreadCount + '</span>' : '') + '</span></span></button>';
    });
    h += '</div><div class="men-chat">';
    if(!MEN.sel) h += '<div class="men-vacio">Elige una conversación.</div>';
    else {
      h += '<div class="men-hilo" id="menHilo">';
      if(!MEN.msgs) h += '<div class="men-vacio">Cargando…</div>';
      else MEN.msgs.forEach(function(m){ h += '<div class="men-m' + (m.direction === 'outgoing' ? ' yo' : '') + '">' + esc(m.message || (m.attachments && m.attachments.length ? '[adjunto]' : '')) + '<small>' + esc(menFecha(m.createdAt)) + '</small></div>'; });
      h += '</div><form class="men-form" id="menForm"><textarea id="menTexto" rows="1" placeholder="Escribe un mensaje…"' + (MEN.enviando ? ' disabled' : '') + '>' + esc(MEN.borrador) + '</textarea><button class="btn primary" type="submit"' + (MEN.enviando ? ' disabled' : '') + '>Enviar</button></form>';
    }
    h += '</div></div>';
  }
  el.innerHTML = h + '</div>';
}
document.addEventListener('click', function(e){
  if(st.folder !== 'MENSAJES') return; var t;
  if((t = e.target.closest('[data-men]'))){ var p = t.dataset.men.split('|'); abrirConversacion(p[0], p[1]); return; }
  if(e.target.closest('[data-ve="men"]')){ MEN.convs = null; MEN.sel = null; cargarMensajes(); }
});
document.addEventListener('submit', function(e){ if(e.target && e.target.id === 'menForm'){ e.preventDefault(); enviarMensaje(); } });
document.addEventListener('keydown', function(e){ if(e.target && e.target.id === 'menTexto' && e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); enviarMensaje(); } });
document.addEventListener('input', function(e){ if(e.target && e.target.id === 'menTexto') MEN.borrador = e.target.value; });
// se refresca solo cada minuto mientras la vista está abierta (sin pisar lo que se escribe)
setInterval(function(){ if(st.folder === 'MENSAJES' && !MEN.cargando && !MEN.enviando && !MEN.borrador && document.visibilityState === 'visible'){ var s = MEN.sel; menApi('/api/zernio?r=conversaciones').then(function(j){ if(j.ok){ MEN.convs = j.conversaciones; drawSide(); if(!MEN.borrador) pintarMensajes(); } }).catch(function(){}); } }, 60000);
