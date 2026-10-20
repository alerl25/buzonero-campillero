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
// las pastillas de una tarjeta: de quién es el turno y lo que dice Nexudus
function diasDesde(t){ return Math.max(0, Math.round((Date.now() - t) / 86400000)); }
function pastillas(x){
  var h = '';
  if(x.turno === 'tuyo') h += '<span class="cv-chip te">Te toca</span>';
  else if(x.ultimo) h += '<span class="cv-chip">Esperando · ' + diasDesde(x.ultimo) + ' d</span>';
  var n = x.nexudus;
  if(n){
    var prox = (n.reservas || []).filter(function(b){ return Date.parse(b.desde) > Date.now(); })[0];
    if((n.facturas || []).some(function(f){ return !f.pagada; })) h += '<span class="cv-chip mal">Factura pendiente</span>';
    else if((n.facturas || []).length) h += '<span class="cv-chip bien">Pagado</span>';
    if(prox) h += '<span class="cv-chip"><span>Reserva</span> ' + esc(fecha(Date.parse(prox.desde))) + '</span>';
  }
  return h ? '<span class="cv-chips">' + h + '</span>' : '';
}
function tarjeta(x){
  var i = CV.leads.indexOf(x);
  return '<button type="button" class="cv-card" draggable="true" data-lead="' + i + '"><span class="cv-card-top"><span class="cv-av">' + esc(iniciales(x)) + '</span><b data-notr>' + esc(nombreDe(x)) + '</b><time>' + esc(fecha(x.fecha)) + '</time></span>'
    + '<span class="cv-card-as" data-notr>' + esc(x.asunto || '') + '</span><span class="cv-card-tx" data-notr>' + esc((x.mensaje || '').slice(0, 140)) + '</span>'
    + pastillas(x) + '<span class="cv-card-meta" data-notr>' + esc(x.email || '') + (x.telefono ? ' · ' + esc(x.telefono) : '') + '</span></button>';
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
      ['Abre Google Cloud con la cuenta de Google que quieras (no tiene que ser la de tu correo). Arriba a la izquierda, en el selector de proyecto, elige uno o crea uno nuevo (New project). Fíjate en su nombre: todos los pasos de Google Cloud se hacen en ESE proyecto, míralo arriba cada vez.', 'https://console.cloud.google.com/projectcreate', 'Abrir Google Cloud'],
      ['Activa la API «Google Analytics Data API»: comprueba arriba que está elegido tu proyecto y pulsa Habilitar (Enable). Si pone Administrar (Manage), ya estaba activada.', 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com', 'Abrir la API'],
      ['Crea la cuenta de servicio: Credenciales (Credentials) → + Crear credenciales (Create credentials). De las 4 opciones, elige Cuenta de servicio (Service account); NO «API key» ni «OAuth client ID», que no sirven para Analytics. Nombre: buzonero → Crear y continuar (Create and continue) → en Permisos no toques nada: Continuar (Continue) → Listo (Done).', 'https://console.cloud.google.com/apis/credentials', 'Abrir Credenciales'],
      ['Descarga la clave: en Credenciales, abajo del todo, sección Cuentas de servicio (Service Accounts), pulsa el correo buzonero@…iam.gserviceaccount.com → pestaña Claves (Keys) → Agregar clave (Add key) → Crear clave nueva (Create new key) → JSON → Crear (Create). Se descarga un fichero .json en Descargas: es la clave, no la compartas. Copia también ese correo.', 'https://console.cloud.google.com/iam-admin/serviceaccounts', 'Abrir Cuentas de servicio'],
      ['Si al crear la clave sale «Service account key creation is disabled», tu organización bloquea las claves: repite los pasos 1 a 4 con un proyecto de una cuenta personal de Gmail. Analytics no necesita que sea la misma cuenta.', '', ''],
      ['Busca la propiedad buena (puede haber varias): en Analytics, Administrar (la rueda, abajo a la izquierda) → Flujos de datos (Data streams). La buena es la que NO dice «No data received in past 48 hours» y cuyo ID de medición (pulsa el flujo; empieza por G-) es el mismo que lleva tu web (búscalo en el código de la página: «G-…»). Si ninguna coincide, las visitas van a otra cuenta de Analytics: pide a quien la tenga (la central, la agencia de la web) que dé acceso de Lector al correo de la cuenta de servicio.', 'https://analytics.google.com/analytics/web/', 'Abrir Google Analytics'],
      ['Dale acceso: Administrar → Gestión del acceso a la cuenta (así vale para todas sus propiedades; o Gestión del acceso a la propiedad, solo para una) → + (arriba a la derecha) → Añadir usuarios. Pega el correo de la cuenta de servicio, quita «Notificar a los usuarios nuevos por correo», rol Lector → Añadir.', '', ''],
      ['Copia el ID de esa propiedad. Lo más fácil: con ella abierta en Analytics, mira la dirección del navegador (…/#/a230301515p317267533/…): el ID es el número que va tras la «p» (aquí 317267533), no el de la «a». También sale en gris bajo el nombre de la propiedad en el selector de arriba a la izquierda. No vale el «G-…» (es el ID de medición).', '', ''],
      ['Pega aquí el ID, sube el fichero .json y pulsa Probar y guardar. Si dice «0 usuarios», esa propiedad no recibe visitas: vuelve al paso 6 y prueba con otra.', '', ''],
    ],
    campos:[['propiedad', 'ID de la propiedad', 'text', '123456789'], ['clave', 'Clave de la cuenta de servicio (el fichero .json)', 'json', '']] },
  { id:'gbp', nombre:'Google Business', icono:'ph-storefront', que:'Reseñas de Google (leer y contestar), llamadas y clics de tu ficha.',
    pasos:[
      ['Antes de pedirlo: tu ficha de Google tiene que estar verificada y activa desde hace más de 60 días, con la web del negocio puesta. Y hazlo con una cuenta propietaria o administradora de la ficha (en la ficha: Configuración → Personas y acceso). Si la ficha la lleva otra persona o la central, tiene que hacerlo ella.', '', ''],
      ['Copia el número de tu proyecto de Google Cloud (vale el mismo de Analytics): Panel (Dashboard) → tarjeta Información del proyecto (Project info) → Número del proyecto (Project number), solo cifras. El nombre del proyecto (por ejemplo, «Claude») y su ID con letras son el mismo proyecto, pero lo que se pide es el número.', 'https://console.cloud.google.com/home/dashboard', 'Abrir el panel del proyecto'],
      ['Rellena la solicitud: número del proyecto, web del negocio (la misma de la ficha), «¿Cómo te enteraste?»: «Documentación oficial para desarrolladores de Google Business Profile», y «Motivo principal»: «Gestionar nuestra propia ficha desde una herramienta interna: leer y responder reseñas y ver sus estadísticas». Después, Continuar.', 'https://support.google.com/business/contact/api_default', 'Abrir la solicitud'],
      ['Espera el correo de Google (suele tardar unos días). Para saber si ya está aprobado sin esperar al correo: en Cuotas del proyecto, las API de Business Profile pasan de 0 a 300 consultas por minuto.', 'https://console.cloud.google.com/iam-admin/quotas', 'Abrir Cuotas'],
      ['Cuando esté aprobado, activa en ese mismo proyecto la «My Business Account Management API» y la «My Business Business Information API».', 'https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com', 'Activar las API'],
      ['Vuelve aquí y conecta: entrarás con la cuenta de la ficha solo para leer reseñas y estadísticas; no se añade como correo.', '', ''],
    ],
    espera:'Disponible cuando Google apruebe el acceso' },
  { id:'wa', nombre:'WhatsApp Business', icono:'ph-whatsapp-logo', que:'Los WhatsApp de tus números en una bandeja, como leads. Puedes conectar varios números.',
    pasos:[
      ['Antes de nada, elige el número. Un número NUEVO o libre (SIM, fijo o virtual sin WhatsApp) se conecta con estos pasos, gratis. Si es el número del WhatsApp del móvil y no quieres perder la app (coexistencia), Meta solo lo permite con el negocio verificado y siendo proveedor de tecnología: Buzonero aún no tiene ese botón. Y ojo: si das de alta aquí el número del móvil, deja de funcionar en la app.', '', ''],
      ['Crea la app: Meta for Developers → Crear app → nombre (por ejemplo, Buzonero) y tu correo → caso de uso «Conectarte con los clientes a través de WhatsApp» (solo ese) → elige el portfolio comercial de tu negocio → Crear app. Si es tu primera vez, antes te pedirá registrarte como desarrollador.', 'https://developers.facebook.com/apps/creation/', 'Abrir Meta for Developers'],
      ['En el panel de la app: «Personalizar el caso de uso Conectarte con los clientes a través de WhatsApp» → arriba, Aceptar Condiciones del servicio (no cobra nada) → comprueba que sale tu portfolio → Continuar. No pulses «Conviértete en proveedor de tecnología» ni «Publicar»: no hacen falta.', '', ''],
      ['Añade tu número real: menú izquierdo → «Paso 2: Configuración de producción» → Añadir número de teléfono. Nombre visible: el de tu negocio (Meta lo revisa). Número con prefijo (+34…) y el código que llega por SMS o llamada. El +1 555… de «Paso 1. Pruébalo» es un número de prueba de Meta: no lo uses para lo real.', '', ''],
      ['Si Meta te pide verificar el negocio («Paso 3: Verificación del negocio»), pon el nombre legal y la dirección fiscal tal como salen en Hacienda (no la del local). Tiene que hacerlo quien administre la empresa.', '', ''],
      ['Copia el «Identificador del número de teléfono» (Phone Number ID) de tu número: un número largo. No es el número de teléfono ni el «Identificador de la cuenta de WhatsApp Business».', '', ''],
      ['Crea un token que no caduque (el de «Generar token» dura 24 h): Meta Business → Usuarios del sistema → Añadir (Administrador) → Asignar activos: tu app → Generar token con los permisos whatsapp_business_messaging y whatsapp_business_management.', 'https://business.facebook.com/settings/system-users', 'Abrir usuarios del sistema'],
      ['Pega aquí un nombre para el número (Ventas, Eventos…), el identificador y el token, y pulsa Probar y guardar. Para otro número, repite desde el paso 4.', '', ''],
    ],
    campos:[['nombre', 'Nombre del número', 'text', 'Ventas'], ['numeroId', 'Identificador del número de teléfono', 'text', '123456789012345'], ['token', 'Token', 'password', '']] },
  { id:'nx', nombre:'Nexudus', icono:'ph-buildings', que:'Solo lectura: facturas pagadas o pendientes y reservas de cada cliente. Nunca cambia nada en Nexudus.',
    pasos:[
      ['Usa un usuario de Nexudus que pueda ver facturas y reservas (mejor uno creado solo para esto). Buzonero solo lee: nunca cambia nada.', '', ''],
      ['La dirección de tu espacio es la de tu panel, algo como tuespacio.spaces.nexudus.com.', '', ''],
      ['Lo más fácil: si ya tienes un token de la API de Nexudus (por ejemplo, el que usa otra herramienta tuya), pega la dirección y el token y pulsa Probar y guardar. Si no lo tienes, sigue con el correo y la contraseña.', '', ''],
      ['Escribe el correo y la contraseña de ese usuario. Si tiene verificación en dos pasos, añade el código de 6 cifras de tu app.', '', ''],
      ['La contraseña no se guarda: Buzonero guarda un pase de solo lectura que dura unas semanas y te avisa para renovarlo.', '', ''],
    ],
    campos:[['espacio', 'Dirección de tu espacio', 'text', 'tuespacio.spaces.nexudus.com'], ['token', 'Token de la API (si ya lo tienes: entonces no hace falta nada más)', 'password', ''], ['usuario', 'Correo del usuario', 'text', ''], ['clave', 'Contraseña', 'password', ''], ['codigo', 'Código de 6 cifras (si te lo pide)', 'text', '123456']] },
  { id:'zr', nombre:'WhatsApp (Zernio)', icono:'ph-whatsapp-logo', que:'Todo lo que llega por WhatsApp entra como lead en el tablero, sin filtrar. Solo lectura: nunca contesta ni marca como leído.',
    pasos:[
      ['Entra en zernio.com y conecta tu número de WhatsApp (una sola vez).', 'https://zernio.com', 'Abrir Zernio'],
      ['Pulsa Probar y guardar: Buzonero comprueba que Zernio tiene un WhatsApp conectado y, desde ese momento, sus conversaciones aparecen en el tablero de este CRM. Puedes moverlas de etapa o apartarlas con «No es lead».', '', ''],
    ],
    campos:[] },
  { id:'mc', nombre:'Metricool', icono:'ph-chart-line-up', que:'Conecta tu cuenta de Metricool con su token de la API (hace falta un plan Advanced o Custom).',
    pasos:[
      ['En Metricool: Ajustes → pestaña API → copia el token de acceso. Si no ves esa pestaña, tu plan no incluye la API.', 'https://app.metricool.com/', 'Abrir Metricool'],
      ['Tu userId es el número que sale en la dirección de Metricool después de «userId=».', '', ''],
      ['Pega el token y el userId y pulsa Probar y guardar. El token se guarda cifrado en tu Buzonero; nunca va en el código.', '', ''],
    ],
    campos:[['token', 'Token de la API', 'password', ''], ['userId', 'userId', 'text', '1234567']] },
];
function integDe(c){ return ((window.CRM_INTEG || {})[c.id]) || {}; }
function estadoInteg(c, x){
  var e = integDe(c)[x.id];
  if(!e || (Array.isArray(e) && !e.length)) return '';
  if(x.id === 'ga') return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span><span>Propiedad</span> <span data-notr>' + esc(e.propiedad) + '</span></span><button type="button" class="btn sm" data-int-quitar="ga">Quitar</button></div>';
  if(x.id === 'nx') return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span data-notr>' + esc(e.espacio) + '</span><small><span>Caduca el</span> ' + esc(new Date(e.caduca).toLocaleDateString(BZ.loc)) + '</small><button type="button" class="btn sm" data-int-quitar="nx">Quitar</button></div>';
  if(x.id === 'zr') return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span data-notr>' + esc((e.cuentas || []).join(', ') || 'WhatsApp') + '</span><button type="button" class="btn sm" data-int-quitar="zr">Quitar</button></div>';
  if(x.id === 'mc') return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span><span data-notr>' + esc(String((e.marcas || []).length)) + '</span> <span>marcas</span></span><button type="button" class="btn sm" data-int-quitar="mc">Quitar</button></div>';
  if(x.id === 'wa') return e.map(function(n){ return '<div class="cv-int-ok"><i class="ph-fill ph-check-circle"></i><span data-notr>' + esc(n.nombre) + ' · ' + esc(n.numero || n.id) + '</span><button type="button" class="btn sm" data-int-quitar="wa" data-num="' + esc(n.id) + '">Quitar</button></div>'; }).join('');
  return '';
}
function pintarIntegraciones(c){
  if(CV.wiz) return pintarAsistente(c, INTEG.filter(function(x){ return x.id === CV.wiz; })[0]);
  // cada CRM elige qué integraciones ve («Ocultar»): las que no use no estorban
  var oc = c.integOcultas || [], vis = INTEG.filter(function(x){ return oc.indexOf(x.id) < 0; }), esc2 = INTEG.filter(function(x){ return oc.indexOf(x.id) >= 0; });
  return '<p class="cv-intro">Conecta otras herramientas a este CRM. Cada una se conecta por separado y se puede quitar cuando quieras.</p><div class="cv-integ">'
    + vis.map(function(x){ var ok = estadoInteg(c, x);
        return '<div class="cv-int"><div class="cv-int-h"><i class="ph ' + x.icono + '"></i><b>' + x.nombre + '</b><span class="cv-est' + (ok ? ' on' : '') + '">' + (ok ? 'Conectado' : 'Sin conectar') + '</span></div><p>' + x.que + '</p>' + ok
          + '<div class="cv-int-pie"><button type="button" class="btn ' + (ok ? '' : 'primary') + '" data-int="' + x.id + '"><i class="ph ph-plug"></i> <span>' + (ok ? (x.id === 'wa' ? 'Añadir otro número' : 'Volver a conectar') : 'Conectar') + '</span></button>' + (ok ? '' : '<button type="button" class="btn sm cv-ocultar" data-int-ocultar="' + x.id + '">Ocultar</button>') + '</div></div>'; }).join('')
    + '</div>'
    + (esc2.length ? '<p class="cv-ocultas"><span>Ocultas:</span> ' + esc2.map(function(x){ return '<button type="button" class="btn sm" data-int-mostrar="' + x.id + '"><i class="ph ph-eye"></i> ' + x.nombre + '</button>'; }).join(' ') + '</p>' : '');
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
  if(j.estado && j.estado.sinDatos) setTimeout(function(){ alert('Esa propiedad no ha tenido visitas en 7 días: seguramente no es la de tu web. Mira el paso 6 y prueba con otra.'); }, 400);
  CV.wiz = null; CV.wizDatos = {}; await crmCargar().catch(function(){}); pintar();
}
async function ocultarInteg(svc, ocultar){
  var c = crmActual(); if(!c) return;
  var r = await fetch('/api/crm', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'ocultar', id:c.id, svc:svc, ocultar:ocultar }) }).catch(function(){ return { ok:false }; });
  if(!r.ok){ toast('No se pudo cambiar'); return; }
  await crmCargar().catch(function(){}); pintar();
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
    + (x.lead ? pastillas(x) : '')
    + (x.asunto || x.mensaje ? '<div class="cv-msg"><b data-notr>' + esc(x.asunto || '') + '</b><p data-notr>' + esc(x.mensaje || '') + '</p></div>' : '')
    + (x.nexudus ? '<div class="cv-nx"><b>En Nexudus</b>'
        + (x.nexudus.facturas || []).map(function(f){ return '<div class="cv-nx-f"><span data-notr>' + esc(f.numero) + '</span><span>' + esc(fecha(Date.parse(f.fecha))) + '</span><span data-notr>' + esc(Number(f.total || 0).toLocaleString(BZ.loc, { style:'currency', currency:'EUR' })) + '</span><span class="cv-chip ' + (f.pagada ? 'bien' : 'mal') + '">' + (f.pagada ? 'Pagada' : 'Pendiente') + '</span></div>'; }).join('')
        + (x.nexudus.reservas || []).map(function(b){ return '<div class="cv-nx-f"><span data-notr>' + esc(String(b.sala || '').replace(/^\[[^\]]*\]\s*/, '')) + '</span><span>' + esc(fecha(Date.parse(b.desde))) + '</span><span></span><span class="cv-chip">' + (b.tentativa ? 'Provisional' : 'Reserva') + '</span></div>'; }).join('')
        + '</div>' : '')
    + '<div class="cv-ficha-acc">' + (x.lead ? '<button class="btn" type="button" data-cv="nolead" title="Lo quita del tablero (propuestas de colaboración, proveedores…)"><i class="ph ph-prohibit"></i> No es lead</button>' : '') + (x.k === 'wa' ? '<button class="btn primary" type="button" data-cv="abrir-wa"><i class="ph ph-whatsapp-logo"></i> Ver la conversación</button>' : '<button class="btn" type="button" data-cv="abrir-correo"><i class="ph ph-envelope-open"></i> Abrir el correo</button>') + (x.email ? '<button class="btn primary" type="button" data-cv="escribir"><i class="ph ph-pencil-simple-line"></i> Escribir</button>' : '') + '</div></aside>';
}

/* ---------- acciones ---------- */
async function moverLead(l, etapa){
  var c = crmActual(); if(!c || !etapa || l.etapa === etapa) return;
  // «No es lead» no es una etapa: la tarjeta sale del tablero
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
  if(cv === 'abrir-wa' && CV.sel){ var w = CV.sel; cerrarVistaCrm(); var bf = document.querySelector('#folders [data-f="MENSAJES"]'); if(bf) bf.click(); setTimeout(function(){ if(window.abrirConversacion) abrirConversacion(w.hilo, w.cuenta); }, 700); return; }
  if(cv === 'nolead' && CV.sel && CV.sel.lead){ var l0 = CV.sel; CV.sel = null; moverLead(l0, 'No es lead'); return; }
  if(cv === 'escribir' && CV.sel){ openCompose({ k:CV.sel.k, to:CV.sel.email }); return; }
  if(t.dataset.int){ CV.wiz = t.dataset.int; CV.wizDatos = {}; CV.wizError = ''; pintar(); vista.querySelector('.cv-body').scrollTop = 0; return; }
  if(t.hasAttribute('data-wiz-volver')){ CV.wiz = null; pintar(); return; }
  if(t.hasAttribute('data-wiz-probar')){ probarInteg(); return; }
  if(t.dataset.intQuitar){ quitarInteg(t.dataset.intQuitar, t.dataset.num); return; }
  if(t.dataset.intOcultar || t.dataset.intMostrar){ ocultarInteg(t.dataset.intOcultar || t.dataset.intMostrar, !!t.dataset.intOcultar); return; }
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
