/* Buzonero Campillero · Leads de un CRM externo (solo lectura)
   Vista «Leads <nombre>» de la barra lateral: los contactos más recientes de un CRM propio, con los nuevos arriba y marcados. Solo sale si el
   servidor tiene el CRM conectado (CRM_EXT_URL y CRM_EXT_CLAVE en Vercel; ver api/_crmext.js). No escribe ni borra nada en el CRM.
   Habla con /api/zernio?r=leads-ext. Se registra en VISTAS (LEADSEXT → pintarLeadsExt). Los avisos al móvil los manda el vigía. */
var LX = { leads:null, total:0, nombre:'', panel:'', cargando:false, error:null, filtro:'todos' };
var LX_NUEVO_MS = 72 * 3600 * 1000;   // «sin ver» solo cuenta lo dado de alta en las últimas 72 h
var LX_SEMANA_MS = 7 * 86400 * 1000;
var LX_ORIGEN = { evento:'Evento', instagram:'Instagram', tiktok:'TikTok', anuncios:'Anuncios', prospeccion:'Prospección', conecta_t:'Conecta T', manual:'A mano' };
var LX_COL = ['#7c9a8e', '#b08968', '#8a8fb5', '#c27c7c', '#6f9fb0', '#a88fb0', '#9aa56f', '#c49a6c'];

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    // con el CRM abierto no se toca la rejilla (ver el fallo de la v1.10.1)
    + '.shell:not(.crm-on):has(.lx),.shell.reading:not(.crm-on):has(.lx){grid-template-columns:236px minmax(0,1fr)}.shell:not(.crm-on):has(.lx)>.read{display:none}'
    + '@media(max-width:1180px){.shell:not(.crm-on):has(.lx),.shell.reading:not(.crm-on):has(.lx){grid-template-columns:72px minmax(0,1fr)}}'
    + '@media(max-width:900px){.shell:not(.crm-on):has(.lx),.shell.reading:not(.crm-on):has(.lx){grid-template-columns:minmax(0,1fr)}}'
    + '.shell:not(.crm-on):has(.lx)>.list{overflow:hidden;display:flex;flex-direction:column}.shell:has(.lx) .rows{flex:1;min-height:0;overflow:hidden;padding-bottom:0}'
    + '.vista-esp.lx{display:flex;flex-direction:column;height:100%;min-height:0;padding:0}.lx-cuerpo{flex:1;min-height:0;overflow-y:auto;padding:4px clamp(14px,3vw,32px) 40px}'
    + '.lx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:8px 0 16px}'
    + '.lx-stat{border:1px solid var(--line);border-radius:14px;padding:12px 14px}.lx-stat small{display:block;color:var(--faint);font-size:11.5px;text-transform:uppercase;letter-spacing:.06em}.lx-stat b{font-size:26px;letter-spacing:-.02em}'
    + '.lx-stat.hot{border-color:var(--acc)}.lx-stat.hot b{color:var(--acc)}'
    + '.lx-barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.lx-barra .btn{margin-left:auto}'
    + '.lx-chip{border:1px solid var(--line-strong,var(--line));border-radius:999px;padding:4px 12px;font:inherit;font-size:13px;color:var(--mute);background:none;cursor:pointer}.lx-chip[aria-pressed=true]{background:var(--text);color:var(--bg);border-color:var(--text)}'
    + '.lx-dia{font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin:20px 2px 8px}'
    + '.lx-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:start;border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:10px;position:relative}'
    + '.lx-card.nuevo{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 14%,transparent)}'
    + '.lx-card.nuevo::before{content:"NUEVO";position:absolute;top:-9px;left:14px;background:var(--acc);color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;padding:1px 8px;border-radius:999px}'
    + '.lx-av{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:600}'
    + '.lx-nom{font-weight:600;font-size:15.5px;display:flex;gap:6px 8px;align-items:center;flex-wrap:wrap}'
    + '.lx-pill{font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 9px;background:var(--surface-2,var(--line));color:var(--mute)}.lx-pill.cafe{background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--acc)}.lx-pill.visto{background:color-mix(in srgb,#1a7f4b 16%,transparent);color:#1a7f4b}'
    + '.lx-dat{color:var(--mute);font-size:13.5px;margin-top:2px;display:flex;gap:4px 14px;flex-wrap:wrap;overflow-wrap:anywhere}'
    + '.lx-nota{margin-top:8px;font-size:13.5px;background:var(--surface,var(--line));border-radius:10px;padding:8px 12px;overflow-wrap:anywhere}'
    + '.lx-acc{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.lx-hora{color:var(--faint);font-size:12px;white-space:nowrap;text-align:right}'
    + '.lx-pie{margin:26px 0 0;border:1px dashed var(--line-strong,var(--line));border-radius:14px;padding:12px 15px;color:var(--faint);font-size:13px}'
    + '.lx-vacio{margin:40px auto;text-align:center;color:var(--faint);padding:24px;max-width:440px}'
    + '@media(max-width:900px){.lx-card{grid-template-columns:38px minmax(0,1fr)}.lx-hora{grid-column:2;text-align:left}.lx-stat b{font-size:21px}}';
  document.head.appendChild(css);
})();

// «visto» se guarda solo en este navegador
var LX_V = (function(){ try { return JSON.parse(localStorage.getItem('buzonero-lx-vistos') || '{}') || {}; } catch(e){ return {}; } })();
function lxGuardarVistos(){ try { localStorage.setItem('buzonero-lx-vistos', JSON.stringify(LX_V)); } catch(e){} drawSide(); }
function lxAlta(l){ return Date.parse(l.creado) || 0; }
function lxNuevo(l){ var t = lxAlta(l); return !!t && Date.now() - t < LX_NUEVO_MS && !LX_V[l.id]; }
function lxNoVistos(){ return (LX.leads || []).filter(lxNuevo).length; }
function lxEsCafe(l){ return l.estado === 'cafe' || /caf[eé]/i.test(l.nota || ''); }
function lxEsRedes(l){ return /^(instagram|tiktok|anuncios)$/.test(l.origen); }
function lxFiltrados(){
  var f = LX.filtro, a = LX.leads || [];
  if(f === 'nuevos') return a.filter(lxNuevo);
  if(f === 'cafe') return a.filter(lxEsCafe);
  if(f === 'redes') return a.filter(lxEsRedes);
  if(f === 'evento') return a.filter(function(l){ return l.origen === 'evento'; });
  return a;
}
function lxOrigen(l){ if(!l.origen) return ''; if(/^personal/.test(l.origen)) return 'Personal'; return LX_ORIGEN[l.origen] || (l.origen.charAt(0).toUpperCase() + l.origen.slice(1).replace(/_/g, ' ')); }
function lxEstado(l){ return l.estado ? l.estado.charAt(0).toUpperCase() + l.estado.slice(1).replace(/_/g, ' ') : ''; }
function lxColor(l){ var h = 0, s = String(l.id); for(var k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) % 997; return LX_COL[h % LX_COL.length]; }
function lxDia(l){
  var t = lxAlta(l); if(!t) return 'Sin fecha'; var d = new Date(t), h = new Date(), ayer = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1);
  if(d.toDateString() === h.toDateString()) return 'Hoy'; if(d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString([], { weekday:'long', day:'numeric', month:'long' });
}
function lxHora(l){
  var t = lxAlta(l); if(!t) return ''; var min = Math.round((Date.now() - t) / 60000);
  if(min < 1) return 'ahora'; if(min < 60) return 'hace ' + min + ' min'; if(min < 360) return 'hace ' + Math.floor(min / 60) + ' h';
  var d = new Date(t); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : d.toLocaleDateString([], { day:'numeric', month:'short' }) + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
// WhatsApp solo si el número parece de móvil (España: 6 o 7 y nueve cifras; con 34 delante también); si trae otro prefijo, se usa tal cual
function lxWa(tel){
  var d = String(tel || '').replace(/\D/g, ''); if(d.indexOf('00') === 0) d = d.slice(2);
  if(d.length === 9 && /^[67]/.test(d)) return '34' + d; if(d.length === 11 && d.indexOf('34') === 0 && /^[67]/.test(d.slice(2))) return d;
  return d.length >= 10 && d.length <= 15 && String(tel).trim().charAt(0) === '+' ? d : '';
}
function lxCard(l){
  var nu = lxNuevo(l), cafe = lxEsCafe(l), wa = lxWa(l.telefono), tel = String(l.telefono || '').replace(/[^\d+]/g, '');
  return '<article class="lx-card' + (nu ? ' nuevo' : '') + '" data-lx-id="' + esc(l.id) + '"><span class="lx-av" style="background:' + lxColor(l) + '">' + esc(l.nombre.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?') + '</span><div>'
    + '<div class="lx-nom"><span>' + esc(l.nombre) + '</span>' + (cafe ? '<span class="lx-pill cafe">Café</span>' : (l.estado ? '<span class="lx-pill">' + esc(lxEstado(l)) + '</span>' : '')) + (l.origen ? '<span class="lx-pill">' + esc(lxOrigen(l)) + '</span>' : '') + (LX_V[l.id] && lxAlta(l) && Date.now() - lxAlta(l) < LX_NUEVO_MS ? '<span class="lx-pill visto">Visto</span>' : '') + '</div>'
    + '<div class="lx-dat">' + (l.telefono ? '<span>' + esc(l.telefono) + '</span>' : '') + (l.email ? '<span>' + esc(l.email) + '</span>' : '') + (l.empresa ? '<span>' + esc(l.empresa) + (l.cargo ? ' · ' + esc(l.cargo) : '') + '</span>' : '') + '</div>'
    + (l.nota ? '<div class="lx-nota">' + esc(l.nota) + '</div>' : '')
    + '<div class="lx-acc">' + (tel ? '<a class="btn sm" data-lx-visto="' + esc(l.id) + '" href="tel:' + esc(tel) + '">Llamar</a>' : '') + (wa ? '<a class="btn sm" data-lx-visto="' + esc(l.id) + '" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' : '')
    + (LX.panel && /^https:\/\//.test(LX.panel) ? '<a class="btn sm" data-lx-visto="' + esc(l.id) + '" href="' + esc(LX.panel) + '" target="_blank" rel="noopener noreferrer">Abrir en el CRM</a>' : '') + '</div></div>'
    + '<span class="lx-hora">' + esc(lxHora(l)) + '</span></article>';
}
function pintarLeadsExt(){
  var el = $('rows'); if(!el) return;
  var ant = el.querySelector('.lx-cuerpo'), y = ant ? ant.scrollTop : 0;
  if(!LX.leads && !LX.cargando){ cargarLeadsExt(); return; }
  var rot = LX.nombre ? 'Leads ' + LX.nombre : 'Leads';
  var sub = LX.cargando ? 'Cargando…' : (LX.error ? 'Sin conexión con el CRM' : 'Conectado al CRM · se actualiza solo');
  var h = '<div class="vista-esp lx">' + cabezaVista(esc(rot), sub, 'lx', LX.cargando) + '<div class="lx-cuerpo">';
  if(!LX.leads){ h += '<div class="lx-vacio">Cargando los leads…</div>'; }
  else if(LX.error){ h += '<div class="lx-vacio"><h3>No se pudo leer el CRM</h3><p>Se vuelve a intentar solo en un momento.</p></div>'; }
  else {
    var sem = LX.leads.filter(function(l){ return lxAlta(l) && Date.now() - lxAlta(l) < LX_SEMANA_MS; }).length, n = lxNoVistos();
    h += '<div class="lx-stats"><div class="lx-stat' + (n ? ' hot' : '') + '"><small>Sin ver</small><b>' + n + '</b></div><div class="lx-stat"><small>Esta semana</small><b>' + sem + '</b></div><div class="lx-stat"><small>En el CRM</small><b>' + esc(LX.total) + '</b></div></div>';
    h += '<div class="lx-barra">' + [['todos', 'Todos'], ['nuevos', 'Sin ver'], ['cafe', 'Café'], ['redes', 'Redes'], ['evento', 'Eventos']].map(function(f){ return '<button type="button" class="lx-chip" data-lx-f="' + f[0] + '" aria-pressed="' + (LX.filtro === f[0]) + '">' + f[1] + '</button>'; }).join('')
      + '<button type="button" class="btn sm" data-lx-todos' + (n ? '' : ' disabled') + '>Marcar todos como vistos</button></div>';
    var lista = lxFiltrados(), dia = '';
    if(!lista.length) h += '<div class="lx-vacio">No hay leads con este filtro.</div>';
    lista.forEach(function(l){ var d = lxDia(l); if(d !== dia){ dia = d; h += '<div class="lx-dia">' + esc(d) + '</div>'; } h += lxCard(l); });
    h += '<div class="lx-pie">Solo lectura: Buzonero lee el CRM y te avisa, nunca escribe ni borra nada en él. Se muestran los 150 más recientes.</div>';
  }
  el.innerHTML = h + '</div></div>';
  var c = el.querySelector('.lx-cuerpo'); if(c) c.scrollTop = y;
}
async function cargarLeadsExt(){
  if(LX.cargando) return; var primera = !LX.leads; LX.cargando = true; if(primera){ LX.error = null; if(st.folder === 'LEADSEXT') pintarLeadsExt(); }
  try {
    var r = await fetch('/api/zernio?r=leads-ext', { cache:'no-store', credentials:'same-origin' });
    if(r.status === 401) throw new Error('sesion');
    var j = await r.json().catch(function(){ return {}; });
    if(j.ok){ LX.leads = j.leads || []; LX.total = j.total || 0; LX.nombre = j.nombre || LX.nombre; LX.panel = j.panel || ''; LX.error = null; if(j.nombre && window.LX_NOMBRE !== j.nombre){ window.LX_NOMBRE = j.nombre; } }
    else if(primera){ LX.error = j.error || 'crm'; LX.leads = []; }   // un fallo suelto del refresco no borra lo que ya se ve
  } catch(e){ if(primera){ LX.error = 'red'; LX.leads = []; } }
  finally { LX.cargando = false; drawSide(); if(st.folder === 'LEADSEXT') pintarLeadsExt(); }
}
document.addEventListener('click', function(e){
  var t;
  if(st.folder !== 'LEADSEXT') return;
  if((t = e.target.closest('[data-lx-f]'))){ LX.filtro = t.dataset.lxF; pintarLeadsExt(); return; }
  if(e.target.closest('[data-lx-todos]')){ (LX.leads || []).forEach(function(l){ if(lxNuevo(l)) LX_V[l.id] = 1; }); lxGuardarVistos(); pintarLeadsExt(); return; }
  if((t = e.target.closest('[data-lx-visto]'))){ LX_V[t.dataset.lxVisto] = 1; lxGuardarVistos(); setTimeout(function(){ if(st.folder === 'LEADSEXT') pintarLeadsExt(); }, 60); return; }
  if(e.target.closest('[data-ve="lx"]')){ LX.leads = null; cargarLeadsExt(); }
});
// Se actualiza SOLO: cada 60 s con la vista abierta y cada 5 min desde otra vista (para el globo de la barra). El servidor guarda la respuesta 55 s.
var lxTic = 0;
setInterval(function(){
  if(document.visibilityState !== 'visible' || !window.INTEG_ON || !INTEG_ON.lx) return;
  lxTic++; if(st.folder === 'LEADSEXT' ? true : lxTic % 5 === 0) cargarLeadsExt();
}, 60000);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible' && window.INTEG_ON && INTEG_ON.lx && !LX.cargando && LX.leads) cargarLeadsExt(); });
