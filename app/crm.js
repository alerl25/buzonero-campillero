/* Buzonero Campillero · la pestaña CRM (como HubSpot): Tablero por etapas, Clientes, Integraciones y Ajustes.
   Se abre con el botón «CRM» de la barra lateral y ocupa el sitio de la lista y la lectura; al tocar una carpeta, vuelve el correo.
   Usa lo del script principal (ACC, KEYS, st, gm, esc, toast, setAcc, openThread, openCompose, CRMS, crmCargar, crmDeK…). */
(function(){
'use strict';
var CV = { id:null, tab:'tablero', leads:null, clientes:null, bots:0, sel:null, q:'', cargando:{} };
var shell = document.querySelector('.shell');
var vista = document.createElement('section');
vista.className = 'crm-view'; vista.id = 'crmView'; vista.hidden = true; vista.setAttribute('aria-label', 'CRM');
shell.appendChild(vista);

function crmsLista(){ return Object.keys(CRMS || {}).map(function(i){ return CRMS[i]; }); }
function crmActual(){ return (CRMS || {})[CV.id] || null; }
function fecha(t){ if(!t) return ''; var d = new Date(t), hoy = new Date();
  return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString(BZ.loc, { hour:'2-digit', minute:'2-digit' }) : d.toLocaleDateString(BZ.loc, { day:'numeric', month:'short' }); }
function nombreDe(x){ return x.nombre || x.email || '—'; }
function iniciales(x){ var n = (x.nombre || x.email || '?').replace(/@.*/, '').trim().split(/[\s._-]+/); return ((n[0] || '?')[0] + ((n[1] || '')[0] || '')).toUpperCase(); }

window.abrirVistaCrm = async function(){
  shell.classList.add('crm-on'); vista.hidden = false; closeDrawer();
  if(!CRMS) { vista.innerHTML = '<div class="cv-vacio">Cargando…</div>'; try { await crmCargar(); } catch(e){ vista.innerHTML = '<div class="cv-vacio">No se pudieron leer los CRM. Prueba otra vez en un momento.</div>'; return; } }
  if(!CV.id || !CRMS[CV.id]){ var mio = crmDeK(st.acc, ''); CV.id = mio ? mio.id : ((crmsLista()[0] || {}).id || null); CV.leads = CV.clientes = null; }
  pintar(); cargar();
  drawSide();
};
window.cerrarVistaCrm = function(){ if(vista.hidden) return; shell.classList.remove('crm-on'); vista.hidden = true; drawSide(); };
window.vistaCrmAbierta = function(){ return !vista.hidden; };
// volver al correo al tocar una carpeta, una etiqueta, una cuenta o Redactar
document.addEventListener('click', function(e){ if(!vista.hidden && e.target.closest && e.target.closest('#side [data-f], #side [data-l], #tabs [data-k]')) cerrarVistaCrm(); }, true);
// tras guardar o borrar un CRM en su ventana
window.cvRefrescar = function(){ if(CRMS && CV.id && !CRMS[CV.id]) CV.id = null; CV.leads = CV.clientes = null; if(!vista.hidden) abrirVistaCrm(); };

async function cargar(force){
  var c = crmActual(); if(!c) return;
  var que = CV.tab === 'clientes' ? ['leads', 'clientes'] : (CV.tab === 'tablero' ? ['leads'] : []);
  for(var i = 0; i < que.length; i++){
    var r = que[i]; if(CV[r] && !force) continue; if(CV.cargando[r]) continue;
    CV.cargando[r] = true; pintar();
    try {
      var j = await (await fetch('/api/crm?r=' + r + '&id=' + encodeURIComponent(c.id), { cache:'no-store' })).json();
      if(!j.ok) throw new Error('crm');
      if(r === 'leads'){ CV.leads = j.leads || []; CV.bots = j.bots || 0; } else CV.clientes = j.clientes || [];
      if((j.fallos || []).length) toast('Una cuenta del CRM necesita reconectar');
    } catch(e){ toast('No se pudo leer el CRM'); }
    CV.cargando[r] = false;
  }
  pintar();
  if(CV.leads){ var n = CV.leads.filter(function(x){ return x.etapa === c.etapas[0]; }).length; c.cuentas.forEach(function(k){ if(ACC[k]) ACC[k].crmN = 0; }); var k0 = c.cuentas[0]; if(ACC[k0]) ACC[k0].crmN = n; drawSide(); }
}

function pintar(){
  var c = crmActual(), ls = crmsLista();
  var cab = '<div class="cv-head"><div class="cv-ttl"><i class="ph ph-kanban"></i>'
    + (ls.length > 1 ? '<select id="cvSel" aria-label="CRM" data-notr>' + ls.map(function(x){ return '<option value="' + esc(x.id) + '"' + (c && x.id === c.id ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') + '</select>'
       : '<b data-notr>' + esc(c ? c.nombre : 'CRM') + '</b>')
    + '</div><div class="cv-tabs" role="tablist">'
    + [['tablero', 'Tablero', 'ph-columns'], ['clientes', 'Clientes', 'ph-address-book'], ['integraciones', 'Integraciones', 'ph-plugs-connected'], ['ajustes', 'Ajustes', 'ph-gear-six']].map(function(t){
        return '<button type="button" role="tab" data-cvtab="' + t[0] + '" aria-selected="' + (CV.tab === t[0]) + '"><i class="ph ' + t[2] + '"></i><span>' + t[1] + '</span></button>'; }).join('')
    + '</div><button class="icon-btn" type="button" data-cv="recargar" aria-label="Actualizar" title="Actualizar"><i class="ph ph-arrows-clockwise"></i></button></div>';
  var cuerpo;
  if(!c) cuerpo = '<div class="cv-vacio"><p>Aún no tienes ningún CRM. Crea uno por negocio: eliges sus cuentas de correo y Buzonero aparta sus leads.</p><button class="btn primary" type="button" data-cv="crear"><i class="ph ph-plus"></i> Crear CRM</button></div>';
  else if(CV.tab === 'tablero') cuerpo = pintarTablero(c);
  else if(CV.tab === 'clientes') cuerpo = pintarClientes(c);
  else if(CV.tab === 'integraciones') cuerpo = pintarIntegraciones(c);
  else cuerpo = pintarAjustes(c);
  vista.innerHTML = cab + '<div class="cv-body">' + cuerpo + '</div>' + (CV.sel ? pintarFicha(c) : '');
}

/* ---------- Tablero ---------- */
function pintarTablero(c){
  if(!CV.leads) return '<div class="cv-vacio">' + (CV.cargando.leads ? 'Cargando…' : '') + '</div>';
  var cols = c.etapas.map(function(et, i){
    var ls = CV.leads.filter(function(x){ return x.etapa === et; }).sort(function(a, b){ return b.fecha - a.fecha; });
    return '<div class="cv-col" data-etapa="' + esc(et) + '"><div class="cv-col-h"><b data-notr>' + esc(et) + '</b><span class="cv-n">' + ls.length + '</span></div><div class="cv-cards">'
      + (ls.length ? ls.map(function(x){ return tarjeta(x); }).join('') : '<div class="cv-col-vacia">' + (i === 0 ? 'Sin leads nuevos' : 'Arrastra aquí') + '</div>') + '</div></div>';
  }).join('');
  return '<div class="cv-board">' + cols + '</div>'
    + (CV.bots ? '<p class="cv-nota"><i class="ph ph-robot"></i> <span>Posibles bots archivados:</span> ' + CV.bots + '</p>' : '');
}
function tarjeta(x){
  var i = CV.leads.indexOf(x);
  return '<button type="button" class="cv-card" draggable="true" data-lead="' + i + '"><span class="cv-card-top"><span class="cv-av">' + esc(iniciales(x)) + '</span><b data-notr>' + esc(nombreDe(x)) + '</b><time>' + esc(fecha(x.fecha)) + '</time></span>'
    + '<span class="cv-card-as" data-notr>' + esc(x.asunto || '') + '</span><span class="cv-card-tx" data-notr>' + esc((x.mensaje || '').slice(0, 140)) + '</span>'
    + '<span class="cv-card-meta" data-notr>' + esc(x.email || '') + (x.telefono ? ' · ' + esc(x.telefono) : '') + '</span></button>';
}

/* ---------- Clientes ---------- */
function etapaCliente(cl){
  var l = (CV.leads || []).filter(function(x){ return x.email === cl.email; })[0];
  if(l) return { etapa:l.etapa, lead:l };
  // misma empresa (dominio propio de la empresa, no gmail y compañía): hereda la etapa de su lead
  if(cl.empresa){ var e = (CV.leads || []).filter(function(x){ return (x.email || '').split('@')[1] === cl.empresa; }).sort(function(a, b){ return b.fecha - a.fecha; })[0]; if(e) return { etapa:e.etapa, lead:e, empresa:true }; }
  return { etapa:'', lead:null };
}
function pintarClientes(c){
  if(!CV.clientes || !CV.leads) return '<div class="cv-vacio">' + (CV.cargando.clientes || CV.cargando.leads ? 'Cargando…' : '') + '</div>';
  // los leads del formulario no te han escrito desde su correo: se suman a la lista
  var todos = CV.clientes.slice();
  CV.leads.forEach(function(l){ if(l.email && !todos.some(function(x){ return x.email === l.email; })) todos.push({ k:l.k, email:l.email, nombre:l.nombre, empresa:'', ultimo:l.fecha, asunto:l.asunto, hilo:l.hilo, hilos:1 }); });
  var q = CV.q.toLowerCase();
  if(q) todos = todos.filter(function(x){ return (x.nombre + ' ' + x.email + ' ' + x.empresa + ' ' + x.asunto).toLowerCase().indexOf(q) >= 0; });
  todos.sort(function(a, b){ return b.ultimo - a.ultimo; });
  var opts = function(sel){ return '<option value="">—</option>' + c.etapas.map(function(e){ return '<option value="' + esc(e) + '"' + (e === sel ? ' selected' : '') + ' data-notr>' + esc(e) + '</option>'; }).join(''); };
  return '<div class="cv-tools"><input type="search" id="cvQ" placeholder="Buscar cliente, empresa o correo" value="' + esc(CV.q) + '"><span class="cv-cuenta"><span>' + todos.length + ' clientes</span></span></div>'
    + '<div class="cv-tabla" role="table"><div class="cv-fila cv-th" role="row"><span>Cliente</span><span>Empresa</span><span>Etapa</span><span>Último contacto</span><span></span></div>'
    + todos.map(function(x){ var e = etapaCliente(x), i = (CV.clientesVista = CV.clientesVista || [], CV.clientesVista.push(x), CV.clientesVista.length - 1);
        return '<div class="cv-fila" role="row" data-cli="' + i + '"><span class="cv-cli"><span class="cv-av">' + esc(iniciales(x)) + '</span><span><b data-notr>' + esc(x.nombre || x.email) + '</b><small data-notr>' + esc(x.email) + '</small></span></span>'
          + '<span data-notr>' + esc(x.empresa || '') + '</span>'
          + '<span><select data-cli-etapa="' + i + '" aria-label="Etapa"' + (e.empresa ? ' title="Por su empresa"' : '') + '>' + opts(e.etapa) + '</select></span>'
          + '<span><span>' + esc(fecha(x.ultimo)) + '</span><small data-notr>' + esc((x.asunto || '').slice(0, 60)) + '</small></span>'
          + '<span><button type="button" class="btn sm" data-cli-abrir="' + i + '">Abrir</button></span></div>'; }).join('')
    + '</div>';
}

/* ---------- Integraciones ---------- */
var INTEG = [
  { id:'ga', nombre:'Google Analytics', icono:'ph-chart-line-up', que:'Visitas de tu web, de dónde vienen y qué páginas traen clientes.', pasos:'Falta activar la API de Google Analytics en tu proyecto de Google Cloud. Después, «Conectar» te pedirá entrar con la cuenta de Google que ve tu Analytics.', enlace:'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com' },
  { id:'gbp', nombre:'Google Business', icono:'ph-storefront', que:'Reseñas de Google (leer y contestar), llamadas y clics de tu ficha.', pasos:'Google pide solicitar el acceso a la API de Business Profile (un formulario; tarda unos días). Hasta que lo apruebe, no se puede conectar.', enlace:'https://developers.google.com/my-business/content/prereqs' },
  { id:'wa', nombre:'WhatsApp Business', icono:'ph-whatsapp-logo', que:'Los WhatsApp de tus números en una bandeja, como leads. Puedes conectar varios números.', pasos:'Se conecta con la API de WhatsApp de Meta (gratis al contestar en 24 h): crea una app de empresa en Meta for Developers, añade WhatsApp y pega aquí el identificador del número y el token.', enlace:'https://developers.facebook.com/apps' },
  { id:'nx', nombre:'Nexudus', icono:'ph-buildings', que:'Solo lectura: facturas pagadas o pendientes y reservas de cada cliente. Nunca cambia nada en Nexudus.', pasos:'Se conecta con un usuario de Nexudus con acceso a la API, de solo lectura.', enlace:'' },
];
function pintarIntegraciones(c){
  return '<p class="cv-intro">Conecta otras herramientas a este CRM. Cada una se conecta por separado y se puede quitar cuando quieras.</p><div class="cv-integ">'
    + INTEG.map(function(x){ return '<div class="cv-int"><div class="cv-int-h"><i class="ph ' + x.icono + '"></i><b>' + x.nombre + '</b><span class="cv-est">Sin conectar</span></div><p>' + x.que + '</p>'
      + '<button type="button" class="btn primary" data-int="' + x.id + '"><i class="ph ph-plug"></i> Conectar</button>'
      + (CV.int === x.id ? '<div class="cv-int-pasos"><p>' + x.pasos + '</p>' + (x.enlace ? '<a class="btn sm" href="' + x.enlace + '" target="_blank" rel="noopener">Abrir la página <i class="ph ph-arrow-square-out"></i></a>' : '') + '</div>' : '') + '</div>'; }).join('')
    + '</div>';
}

/* ---------- Ajustes ---------- */
function pintarAjustes(c){
  return '<div class="cv-aj"><p class="cv-intro">Tus negocios: cada CRM tiene sus cuentas de correo, sus etapas y cómo detecta los leads.</p>'
    + crmsLista().map(function(x){ return '<div class="crm-it"><div class="crm-tx"><b data-notr>' + esc(x.nombre) + '</b><small><span data-notr>' + esc(x.cuentas.map(function(k){ return ACC[k] ? ACC[k].name : k; }).join(' · ')) + '</span> · <span>' + x.etapas.length + ' etapas</span> · <span>' + (x.deteccion && x.deteccion.activa ? 'Detección activa' : 'Detección apagada') + '</span></small></div><button class="btn" type="button" data-cv-ed="' + esc(x.id) + '">Editar</button></div>'; }).join('')
    + '<div class="cv-aj-pie"><button class="btn primary" type="button" data-cv="crear"><i class="ph ph-plus"></i> Crear CRM</button></div></div>';
}

/* ---------- Ficha del cliente ---------- */
function pintarFicha(c){
  var x = CV.sel, e = x.lead ? x : etapaCliente(x);
  var etapa = x.lead ? x.etapa : e.etapa;
  return '<aside class="cv-ficha" aria-label="Ficha del cliente"><div class="cv-ficha-h"><span class="cv-av grande">' + esc(iniciales(x)) + '</span><div><b data-notr>' + esc(nombreDe(x)) + '</b><small data-notr>' + esc(x.empresa || (x.email || '').split('@')[1] || '') + '</small></div><button class="icon-btn" type="button" data-cv="cerrar-ficha" aria-label="Cerrar"><i class="ph ph-x"></i></button></div>'
    + '<label class="cv-ficha-et">Etapa <select data-ficha-etapa aria-label="Etapa"><option value="">—</option>' + c.etapas.map(function(et){ return '<option value="' + esc(et) + '"' + (et === etapa ? ' selected' : '') + ' data-notr>' + esc(et) + '</option>'; }).join('') + '</select></label>'
    + '<dl class="cv-dl">' + (x.email ? '<dt>Correo</dt><dd data-notr>' + esc(x.email) + '</dd>' : '') + (x.telefono ? '<dt>Teléfono</dt><dd data-notr>' + esc(x.telefono) + '</dd>' : '')
    + (x.origen ? '<dt>Origen</dt><dd>' + esc({ formulario:'Formulario de la web', correo:'Correo', 'a mano':'Añadido a mano' }[x.origen] || x.origen) + '</dd>' : '')
    + ((x.fecha || x.ultimo) ? '<dt>Último contacto</dt><dd>' + esc(fecha(x.fecha || x.ultimo)) + '</dd>' : '') + '</dl>'
    + (x.asunto || x.mensaje ? '<div class="cv-msg"><b data-notr>' + esc(x.asunto || '') + '</b><p data-notr>' + esc(x.mensaje || '') + '</p></div>' : '')
    + '<div class="cv-ficha-acc"><button class="btn" type="button" data-cv="abrir-correo"><i class="ph ph-envelope-open"></i> Abrir el correo</button>' + (x.email ? '<button class="btn primary" type="button" data-cv="escribir"><i class="ph ph-pencil-simple-line"></i> Escribir</button>' : '') + '</div></aside>';
}

/* ---------- acciones ---------- */
async function moverLead(l, etapa){
  var c = crmActual(); if(!c || !etapa || l.etapa === etapa) return;
  var antes = l.etapa; l.etapa = etapa; pintar();
  try { var r = await fetch('/api/crm', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'mover', id:c.id, k:l.k, ids:l.ids, etapa:etapa }) }); if(!r.ok) throw 0; toast('Movido a ' + etapa); }
  catch(e){ l.etapa = antes; pintar(); toast('No se pudo cambiar la etapa'); }
}
async function anadirCliente(cl, etapa){
  var c = crmActual(); if(!c || !cl.hilo) return;
  try { var r = await fetch('/api/crm', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'anadir', id:c.id, k:cl.k, hilo:cl.hilo, etapa:etapa }) }); if(!r.ok) throw 0; toast('Añadido al CRM'); CV.leads = null; cargar(true); }
  catch(e){ toast('No se pudo añadir al CRM'); }
}
function abrirCorreo(x){ cerrarVistaCrm(); if(x.k && x.k !== st.acc) setAcc(x.k); setTimeout(function(){ openThread(x.hilo); }, 60); }
function cambiarEtapa(x, etapa){
  var l = x.lead ? x : etapaCliente(x).lead;
  if(l && (l.email === x.email || x.lead)) return moverLead(l, etapa);
  if(etapa) return anadirCliente(x, etapa);
}

vista.addEventListener('click', function(e){
  var t = e.target.closest('button, a'); if(!t) return;
  if(t.dataset.cvtab){ CV.tab = t.dataset.cvtab; CV.sel = null; CV.int = null; pintar(); cargar(); return; }
  var cv = t.dataset.cv;
  if(cv === 'recargar'){ CV.leads = CV.clientes = null; cargar(true); return; }
  if(cv === 'crear'){ crmEd = { id:'', nombre:'', cuentas:crmDeK(st.acc, '') ? [] : [st.acc], etapas:CRM_ETAPAS.slice(), deteccion:{ activa:true, directo:false, palabras:[], frasesBot:[], formularios:[{ de:'', asunto:'' }] } }; $('crmDlg').showModal(); pintarCrmForm(); return; }
  if(t.dataset.cvEd){ crmEd = JSON.parse(JSON.stringify(CRMS[t.dataset.cvEd])); crmEd.deteccion = crmEd.deteccion || { formularios:[] }; crmEd.deteccion.formularios = crmEd.deteccion.formularios || []; $('crmDlg').showModal(); pintarCrmForm(); return; }
  if(cv === 'cerrar-ficha'){ CV.sel = null; pintar(); return; }
  if(cv === 'abrir-correo' && CV.sel){ abrirCorreo(CV.sel); return; }
  if(cv === 'escribir' && CV.sel){ openCompose({ k:CV.sel.k, to:CV.sel.email }); return; }
  if(t.dataset.int){ CV.int = CV.int === t.dataset.int ? null : t.dataset.int; pintar(); return; }
  if(t.dataset.lead){ CV.sel = CV.leads[+t.dataset.lead]; CV.sel.lead = true; pintar(); return; }
  if(t.dataset.cliAbrir){ CV.sel = CV.clientesVista[+t.dataset.cliAbrir]; pintar(); return; }
});
vista.addEventListener('change', function(e){
  var t = e.target;
  if(t.id === 'cvSel'){ CV.id = t.value; CV.leads = CV.clientes = null; CV.sel = null; pintar(); cargar(); return; }
  if(t.dataset.cliEtapa){ cambiarEtapa(CV.clientesVista[+t.dataset.cliEtapa], t.value); return; }
  if(t.hasAttribute('data-ficha-etapa') && CV.sel){ cambiarEtapa(CV.sel, t.value); return; }
});
vista.addEventListener('input', function(e){ if(e.target.id === 'cvQ'){ CV.q = e.target.value; var pos = e.target.selectionStart; CV.clientesVista = []; pintar(); var q = $('cvQ'); if(q){ q.focus(); try { q.setSelectionRange(pos, pos); } catch(err){} } } });
// arrastrar tarjetas entre etapas (ordenador)
vista.addEventListener('dragstart', function(e){ var t = e.target.closest && e.target.closest('[data-lead]'); if(!t) return; e.dataTransfer.setData('text/plain', t.dataset.lead); e.dataTransfer.effectAllowed = 'move'; t.classList.add('arr'); });
vista.addEventListener('dragend', function(e){ var t = e.target.closest && e.target.closest('[data-lead]'); if(t) t.classList.remove('arr'); [].slice.call(vista.querySelectorAll('.cv-col.sobre')).forEach(function(x){ x.classList.remove('sobre'); }); });
vista.addEventListener('dragover', function(e){ var col = e.target.closest && e.target.closest('.cv-col'); if(!col) return; e.preventDefault(); col.classList.add('sobre'); });
vista.addEventListener('dragleave', function(e){ var col = e.target.closest && e.target.closest('.cv-col'); if(col && !col.contains(e.relatedTarget)) col.classList.remove('sobre'); });
vista.addEventListener('drop', function(e){ var col = e.target.closest && e.target.closest('.cv-col'); if(!col) return; e.preventDefault(); var i = e.dataTransfer.getData('text/plain'); var l = CV.leads && CV.leads[+i]; if(l) moverLead(l, col.dataset.etapa); });
// pintar() reinicia la lista de clientes a la vista
var pintarBase = pintar; pintar = function(){ CV.clientesVista = []; pintarBase(); };

// «Añadir al CRM» desde un correo abierto
document.addEventListener('click', async function(e){
  var b = e.target.closest && e.target.closest('[data-crm-add]'); if(!b || !cur) return;
  if(!CRMS) { try { await crmCargar(); } catch(err){} }
  var c = crmDeK(cur.k, ''); if(!c){ toast('Esta cuenta no está en ningún CRM'); return; }
  try { var r = await fetch('/api/crm', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'anadir', id:c.id, k:cur.k, hilo:cur.id }) }); if(!r.ok) throw 0; toast('Añadido al CRM «' + c.nombre + '»'); CV.leads = null; }
  catch(err){ toast('No se pudo añadir al CRM'); }
});
})();
