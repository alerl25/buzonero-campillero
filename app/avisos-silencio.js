/* Buzonero Campillero · Qué te avisa este dispositivo
   En Ajustes → Avisos hay un interruptor por cada origen de aviso: cada cuenta de correo, WhatsApp, los leads del CRM externo, los leads que detecta el correo,
   «Avísame si no contesta» y los envíos programados; y dos atajos («Silenciar todo el correo» y «Avisar de todo»). Lo silenciado no suena ni se muestra: ni en el
   móvil con la app cerrada (el servidor ni lo manda, ver pushTodos y debeAvisar en api/_lib.js) ni como aviso animado dentro de la app. Vale para ESTE dispositivo
   (cada uno tiene los suyos). La lista vive en localStorage y se envía al servidor con cada alta del dispositivo y cada vez que se cambia (api/push.js, accion «silencio»). */
var SIL_KEY = 'buzonero-silencio';
function leerSilencio(){ try { var a = JSON.parse(localStorage.getItem(SIL_KEY) || '[]'); return Array.isArray(a) ? a.filter(function(x){ return typeof x === 'string'; }) : []; } catch(e){ return []; } }
// Una sesión «solo leads» (cuenta de BZ_AVISOS_LEADS, la marca el servidor) tiene silenciado todo menos los leads, elija lo que elija
function estaSilenciado(id){ return (window.BZ_SOLO_LEADS && id !== 'lx') || leerSilencio().indexOf(id) >= 0; }
// Los orígenes que existen en este momento: una entrada por cuenta de correo y las integraciones que estén conectadas
function silencioFuentes(){
  var f = [];
  if(typeof KEYS !== 'undefined' && typeof ACC !== 'undefined') KEYS.forEach(function(k){ if(ACC[k]) f.push({ id:'correo:' + k, nombre:'Correo · ' + ACC[k].name, icono:'ph-envelope-simple' }); });
  if(window.INTEG_ON && INTEG_ON.wa) f.push({ id:'wa', nombre:'WhatsApp', icono:'ph-whatsapp-logo' });
  if(window.INTEG_ON && INTEG_ON.lx) f.push({ id:'lx', nombre:'Leads' + (window.LX_NOMBRE ? ' · ' + window.LX_NOMBRE : ''), icono:'ph-handshake' });
  f.push({ id:'lead-correo', nombre:'Leads detectados en el correo', icono:'ph-user-plus' });
  f.push({ id:'seguimiento', nombre:'«Avísame si no contesta»', icono:'ph-alarm' });
  f.push({ id:'envio', nombre:'Envíos programados', icono:'ph-paper-plane-tilt' });
  return f;
}
// El bloque del menú de Ajustes: dos atajos y un interruptor por origen
function silencioHTML(){
  var sil = leerSilencio();
  // cuenta «solo leads»: nada que elegir, solo se avisa de los leads
  if(window.BZ_SOLO_LEADS) return '<div class="ttl">Qué te avisa</div><div class="mi-nota"><i class="ph ph-bell-ringing"></i> Esta cuenta solo recibe avisos de leads</div>';
  return '<div class="ttl">Qué te avisa</div>'
    + '<button data-mi="mute-@correo"><i class="ph ph-envelope-simple-open"></i> <span>Silenciar todo el correo</span></button>'
    + '<button data-mi="mute-@todo"><i class="ph ph-bell-ringing"></i> <span>Avisar de todo</span></button>'
    + silencioFuentes().map(function(x){
      var off = sil.indexOf(x.id) >= 0;
      return '<button data-mi="mute-' + esc(x.id) + '" aria-pressed="' + off + '"><i class="ph ' + (off ? 'ph-bell-slash' : 'ph-bell-ringing') + '"></i> <span>' + esc(x.nombre) + '</span><small class="mi-sub">' + (off ? 'Silenciado' : 'Avisa') + '</small></button>';
    }).join('');
}
// Repinta el estado de todos los interruptores del menú abierto a partir de la lista guardada
function silencioPintar(){
  var sil = leerSilencio();
  [].slice.call(document.querySelectorAll('#menu [data-mi^="mute-"]')).forEach(function(b){
    var id = b.dataset.mi.slice(5); if(id.charAt(0) === '@') return;
    var off = sil.indexOf(id) >= 0;
    b.setAttribute('aria-pressed', off);
    var ic = b.querySelector('i'); if(ic) ic.className = 'ph ' + (off ? 'ph-bell-slash' : 'ph-bell-ringing');
    var sb = b.querySelector('.mi-sub'); if(sb) sb.textContent = off ? 'Silenciado' : 'Avisa';
  });
}
// Un clic en un interruptor o en un atajo: cambia, lo guarda, lo manda al servidor y deja el menú abierto
async function silenciarAlternar(id){
  var sil = leerSilencio();
  if(id === '@correo'){ silencioFuentes().forEach(function(f){ if(/^correo:/.test(f.id) && sil.indexOf(f.id) < 0) sil.push(f.id); }); }
  else if(id === '@todo'){ sil = []; }
  else { var i = sil.indexOf(id); if(i >= 0) sil.splice(i, 1); else sil.push(id); }
  try { localStorage.setItem(SIL_KEY, JSON.stringify(sil)); } catch(e){}
  silencioPintar();
  try {
    var reg = await swListo(), s = reg && await reg.pushManager.getSubscription();
    if(s){
      var r = await fetch('/api/push', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ accion:'silencio', endpoint:s.endpoint, mute:sil }) });
      if(!r.ok) throw new Error('no');
    }
  } catch(e){ toast('Guardado en este navegador, pero no se pudo avisar al servidor: vuelve a intentarlo'); }
}
