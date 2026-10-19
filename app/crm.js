/* Buzonero Campillero · la pestaña CRM (como HubSpot): Tablero por etapas, Clientes, Integraciones y Ajustes.
   Se abre con el botón «CRM» de la barra lateral y ocupa el sitio de la lista y la lectura; al tocar una carpeta, vuelve el correo.
   Usa lo del script principal (ACC, KEYS, st, gm, esc, toast, setAcc, openThread, openCompose, CRMS, crmCargar, crmDeK…). */
(function(){
'use strict';
var CV = { id:null, tab:'tablero', leads:null, clientes:null, bots:0, sel:null, q:'', cargando:{}, wiz:null, wizDatos:{}, wizError:'', wizProbando:false };
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

/* ---------- Integraciones: cada una con sus pasos, la página exacta de cada paso y «Probar y guardar» ----------
   Ninguna mete otra cuenta de Google en Buzonero: Analytics va con la clave de una cuenta de servicio. */
var INTEG = [
  { id:'ga', nombre:'Google Analytics', icono:'ph-chart-line-up', que:'Visitas de tu web, de dónde vienen y qué páginas traen clientes.',
    pasos:[
      ['Abre Google Cloud con la cuenta de Google que quieras (no tiene que ser la de tu correo). Arriba, en el selector de proyecto, elige uno o crea uno nuevo (New project).', 'https://console.cloud.google.com/projectcreate', 'Abrir Google Cloud'],
      ['Activa la API: menú APIs y servicios → Biblioteca (Library) → busca «Google Analytics Data API» → Habilitar (Enable).', 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com', 'Abrir la API'],
      ['Crea la cuenta de servicio: Credenciales (Credentials) → + Crear credenciales (Create credentials). De las 4 opciones, elige Cuenta de servicio (Service account); NO «API key» ni «OAuth client ID», que no sirven para Analytics. Nombre: buzonero → Crear y continuar (Create and continue) → en Permisos no toques nada: Continuar (Continue) → Listo (Done).', 'https://console.cloud.google.com/apis/credentials', 'Abrir Credenciales'],
      ['Descarga la clave: en Credenciales, sección Cuentas de servicio (Service Accounts), pulsa buzonero@…iam.gserviceaccount.com → pestaña Claves (Keys) → Agregar clave (Add key) → Crear clave nueva (Create new key) → JSON → Crear. Se descarga un fichero .json: es la clave. Copia también ese correo que acaba en iam.gserviceaccount.com.', 'https://console.cloud.google.com/iam-admin/serviceaccounts', 'Abrir Cuentas de servicio'],
      ['Si al crear la clave sale «Service account key creation is disabled», tu organización bloquea las claves: repite los pasos 1 a 4 con un proyecto de una cuenta personal de Gmail. Analytics no necesita que sea la misma cuenta.', '', ''],
      ['Dale acceso en Analytics: Administrar (la rueda, abajo a la izquierda) → columna Propiedad → Gestión del acceso a la propiedad → + (arriba a la derecha) → Añadir usuarios. Pega el correo de la cuenta de servicio, rol Lector, quita «Notificar por correo» y pulsa Añadir.', 'https://analytics.google.com/analytics/web/', 'Abrir Google Analytics'],
      ['Copia el ID de la propiedad. Lo más fácil: con Analytics abierto, mira la dirección del navegador (…/#/p123456789/…): el número que va tras «/p» es el ID. También sale en gris bajo el nombre de la propiedad en el selector de arriba a la izquierda. No vale el «G-…» (es el ID de medición).', '', ''],
      ['Pega aquí el ID, sube el fichero .json y pulsa Probar y guardar.', '', ''],
    ],
    campos:[['propiedad', 'ID de la propiedad', 'text', '123456789'], ['clave', 'Clave de la cuenta de servicio (el fichero .json)', 'json', '']] },
  { id:'gbp', nombre:'Google Business', icono:'ph-storefront', que:'Reseñas de Google (leer y contestar), llamadas y clics de tu ficha.',
    pasos:[
      ['Google tiene que aprobar el acceso a su API: rellena la solicitud con la cuenta que gestiona tu ficha. Suele tardar unos días.', 'https://developers.google.com/my-business/content/prereqs', 'Pedir el acceso'],
      ['Cuando llegue el correo de aprobación, activa en tu proyecto de Google Cloud la «My Business Account Management API» y la «My Business Business Information API».', 'https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com', 'Activar las API'],
      ['Vuelve aquí y conecta: entrarás con la cuenta de la ficha solo para leer reseñas y estadísticas; no se añade como correo.', '', ''],
    ],
    espera:'Disponible cuando Google apruebe el acceso' },
  { id:'wa', nombre:'WhatsApp Business', icono:'ph-whatsapp-logo', que:'Los WhatsApp de tus números en una bandeja, como leads. Puedes conectar varios números.',
    pasos:[
      ['Entra en Meta for Developers con la cuenta de Facebook que administra tu Meta Business → Crear app → caso de uso «Conectarte con clientes por WhatsApp» → elige tu cuenta comercial.', 'https://developers.facebook.com/apps/creation/', 'Abrir Meta for Developers'],
      ['En la app: WhatsApp → Configuración de la API. Meta te da un número de prueba gratis. Para usar un número tuyo, «Añadir número de teléfono»: que no sea el del WhatsApp del móvil, o dejará de funcionar en la app.', '', ''],
      ['Copia el «Identificador del número de teléfono» (no el número en sí).', '', ''],
      ['Crea un token que no caduque: Meta Business → Usuarios del sistema → Añadir (Administrador) → Asignar activos: tu app → Generar token con los permisos whatsapp_business_messaging y whatsapp_business_management.', 'https://business.facebook.com/settings/system-users', 'Abrir usuarios del sistema'],
      ['Pega aquí un nombre para este número (Ventas, Eventos…), el identificador y el token. Para otro número, repite desde el paso 2.', '', ''],
    ],
    campos:[['nombre', 'Nombre del número', 'text', 'Ventas'], ['numeroId', 'Identificador del número de teléfono', 'text', '123456789012345'], ['token', 'Token', 'password', '']] },
  { id:'nx', nombre:'Nexudus', icono:'ph-buildings', que:'Solo lectura: facturas pagadas o pendientes y reservas de cada cliente. Nunca cambia nada en Nexudus.',
    pasos:[
      ['Usa un usuario de Nexudus que pueda ver facturas y reservas (mejor uno creado solo para esto). Buzonero solo lee: nunca cambia nada.', '', ''],
      ['La dirección de tu espacio es la de tu panel, algo como tuespacio.spaces.nexudus.com.', '', ''],
      ['Escribe el correo y la contraseña de ese usuario. Si tiene verificación en dos pasos, añade el código de 6 cifras de tu app.', '', ''],
      ['La contraseña no se guarda: Buzonero guarda un pase de solo lectura que dura unas semanas y te avisa para renovarlo.', '', ''],
    ],
    campos:[['espacio', 'Dirección de tu espacio', 'text', 'tuespacio.spaces.nexudus.com'], ['usuario', 'Correo del usuario', 'text', ''], ['clave', 'Contraseña', 'password', ''], ['codigo', 'Código de 6 cifras (si te lo pide)', 'text', '123456']] },
];
function integDe(c){ return ((window.CRM_INTEG || {})[c.id]) || {}; }
function estadoInteg(c, x){
  var e = integDe(c)[x.id];
  if(!e || (Array.isArray(e) && !e.length)) return '';
  if(x.id === 'ga') return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span><span>Propiedad</span> <span data-notr>' + esc(e.propiedad) + '</span></span><button type="button" class="btn sm" data-int-quitar="ga">Quitar</button></div>';
  if(x.id === 'nx') return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span data-notr>' + esc(e.espacio) + '</span><small><span>Caduca el</span> ' + esc(new Date(e.caduca).toLocaleDateString(BZ.loc)) + '</small><button type="button" class="btn sm" data-int-quitar="nx">Quitar</button></div>';
  if(x.id === 'wa') return e.map(function(n){ return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span data-notr>' + esc(n.nombre) + ' · ' + esc(n.numero || n.id) + '</span><button type="button" class="btn sm" data-int-quitar="wa" data-num="' + esc(n.id) + '">Quitar</button></div>'; }).join('');
  return '';
}
function pintarIntegraciones(c){
  if(CV.wiz) return pintarAsistente(c, INTEG.filter(function(x){ return x.id === CV.wiz; })[0]);
  return '<p class="cv-intro">Conecta otras herramientas a este CRM. Cada una se conecta por separado y se puede quitar cuando quieras.</p><div class="cv-integ">'
    + INTEG.map(function(x){ var ok = estadoInteg(c, x);
        return '<div class="cv-int"><div class="cv-int-h"><i class="ph ' + x.icono + '"></i><b>' + x.nombre + '</b><span class="cv-est' + (ok ? ' on' : '') + '">' + (ok ? 'Conectado' : 'Sin conectar') + '</span></div><p>' + x.que + '</p>' + ok
          + '<button type="button" class="btn ' + (ok ? '' : 'primary') + '" data-int="' + x.id + '"><i class="ph ph-plug"></i> <span>' + (ok ? (x.id === 'wa' ? 'Añadir otro número' : 'Volver a conectar') : 'Conectar') + '</span></button></div>'; }).join('')
    + '</div>';
}
function pintarAsistente(c, x){
  var campos = (x.campos || []).map(function(f){
    var v = esc((CV.wizDatos || {})[f[0]] || '');
    if(f[2] === 'json') return '<label class="crm-lb">' + f[1] + '<input type="file" accept=".json,application/json" data-wiz-fich="' + f[0] + '"><textarea rows="4" data-wiz="' + f[0] + '" placeholder="O pega aquí el contenido del fichero">' + v + '</textarea></label>';
    return '<label class="crm-lb">' + f[1] + '<input type="' + f[2] + '" data-wiz="' + f[0] + '" value="' + v + '" placeholder="' + esc(f[3]) + '" autocomplete="off"></label>';
  }).join('');
  return '<div class="cv-wiz"><button type="button" class="btn sm" data-wiz-volver><i class="ph ph-arrow-left"></i> <span>Volver a integraciones</span></button>'
    + '<h3><i class="ph ' + x.icono + '"></i> <span>' + x.nombre + '</span></h3><ol class="cv-pasos">'
    + x.pasos.map(function(p){ return '<li><span>' + p[0] + '</span>' + (p[1] ? '<a class="btn sm" href="' + p[1] + '" target="_blank" rel="noopener"><span>' + p[2] + '</span> <i class="ph ph-arrow-square-out"></i></a>' : '') + '</li>'; }).join('') + '</ol>'
    + (x.campos ? '<div class="cv-wiz-form">' + campos + (CV.wizError ? '<p class="cv-wiz-err" data-notr>' + esc(CV.wizError) + '</p>' : '') + '<button type="button" class="btn primary" data-wiz-probar' + (CV.wizProbando ? ' disabled' : '') + '><i class="ph ph-plug"></i> <span>' + (CV.wizProbando ? 'Probando…' : 'Probar y guardar') + '</span></button></div>'
       : '<div class="cv-wiz-form"><button type="button" class="btn" disabled><span>' + x.espera + '</span></button></div>')
    + '</div>';
}
async function probarInteg(){
  var c = crmActual(); if(!c) return;
  [].slice.call(vista.querySelectorAll('[data-wiz]')).forEach(function(el){ CV.wizDatos[el.dataset.wiz] = el.value; });
  CV.wizProbando = true; CV.wizError = ''; pintar();
  var j = {};
  try { var r = await fetch('/api/crm', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'integrar', id:c.id, svc:CV.wiz, datos:CV.wizDatos }) }); j = await r.json().catch(function(){ return {}; }); }
  catch(e){ j = { mensaje:'No se pudo contactar con Buzonero' }; }
  CV.wizProbando = false;
  if(!j.ok){ CV.wizError = j.mensaje || 'No se pudo conectar'; pintar(); return; }
  var nom = (INTEG.filter(function(x){ return x.id === CV.wiz; })[0] || {}).nombre || '';
  toast('Conectado: ' + nom + (j.estado && j.estado.resumen ? ' · ' + j.estado.resumen : ''));
  CV.wiz = null; CV.wizDatos = {}; await crmCargar().catch(function(){}); pintar();
}
async function quitarInteg(svc, num){
  var c = crmActual(); if(!c || !confirm('¿Quitar esta integración? Se borran su clave y su token de Buzonero.')) return;
  var r = await fetch('/api/crm', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'desintegrar', id:c.id, svc:svc, numero:num || '' }) }).catch(function(){ return { ok:false }; });
  if(!r.ok){ toast('No se pudo quitar'); return; }
  await crmCargar().catch(function(){}); pintar(); toast('Integración quitada');
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
  if(t.dataset.cvtab){ CV.tab = t.dataset.cvtab; CV.sel = null; CV.wiz = null; pintar(); cargar(); return; }
  var cv = t.dataset.cv;
  if(cv === 'recargar'){ CV.leads = CV.clientes = null; cargar(true); return; }
  if(cv === 'crear'){ crmEd = { id:'', nombre:'', cuentas:crmDeK(st.acc, '') ? [] : [st.acc], etapas:CRM_ETAPAS.slice(), deteccion:{ activa:true, directo:false, palabras:[], frasesBot:[], formularios:[{ de:'', asunto:'' }] } }; $('crmDlg').showModal(); pintarCrmForm(); return; }
  if(t.dataset.cvEd){ crmEd = JSON.parse(JSON.stringify(CRMS[t.dataset.cvEd])); crmEd.deteccion = crmEd.deteccion || { formularios:[] }; crmEd.deteccion.formularios = crmEd.deteccion.formularios || []; $('crmDlg').showModal(); pintarCrmForm(); return; }
  if(cv === 'cerrar-ficha'){ CV.sel = null; pintar(); return; }
  if(cv === 'abrir-correo' && CV.sel){ abrirCorreo(CV.sel); return; }
  if(cv === 'escribir' && CV.sel){ openCompose({ k:CV.sel.k, to:CV.sel.email }); return; }
  if(t.dataset.int){ CV.wiz = t.dataset.int; CV.wizDatos = {}; CV.wizError = ''; pintar(); vista.querySelector('.cv-body').scrollTop = 0; return; }
  if(t.hasAttribute('data-wiz-volver')){ CV.wiz = null; pintar(); return; }
  if(t.hasAttribute('data-wiz-probar')){ probarInteg(); return; }
  if(t.dataset.intQuitar){ quitarInteg(t.dataset.intQuitar, t.dataset.num); return; }
  if(t.dataset.lead){ CV.sel = CV.leads[+t.dataset.lead]; CV.sel.lead = true; pintar(); return; }
  if(t.dataset.cliAbrir){ CV.sel = CV.clientesVista[+t.dataset.cliAbrir]; pintar(); return; }
});
vista.addEventListener('change', function(e){
  var t = e.target;
  // la clave .json de Google: se lee en el navegador y se pega en su caja
  if(t.dataset.wizFich && t.files && t.files[0]){ var fr = new FileReader(), campo = t.dataset.wizFich; fr.onload = function(){ var ta = vista.querySelector('[data-wiz="' + campo + '"]'); if(ta) ta.value = String(fr.result || ''); CV.wizDatos[campo] = String(fr.result || ''); }; fr.readAsText(t.files[0]); return; }
  if(t.id === 'cvSel'){ CV.id = t.value; CV.leads = CV.clientes = null; CV.sel = null; pintar(); cargar(); return; }
  if(t.dataset.cliEtapa){ cambiarEtapa(CV.clientesVista[+t.dataset.cliEtapa], t.value); return; }
  if(t.hasAttribute('data-ficha-etapa') && CV.sel){ cambiarEtapa(CV.sel, t.value); return; }
});
vista.addEventListener('input', function(e){ if(e.target.dataset && e.target.dataset.wiz){ CV.wizDatos[e.target.dataset.wiz] = e.target.value; return; } if(e.target.id === 'cvQ'){ CV.q = e.target.value; var pos = e.target.selectionStart; CV.clientesVista = []; pintar(); var q = $('cvQ'); if(q){ q.focus(); try { q.setSelectionRange(pos, pos); } catch(err){} } } });
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
