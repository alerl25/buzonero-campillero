/* Buzonero Campillero · Calendario de Google
   Vista «Calendario» de la barra lateral: el mes de tus calendarios de Google con un panel «Mis calendarios», como el de
   Google Calendar: un check por cuenta y otro por cada calendario para ver u ocultar sus eventos. Lo que marques se
   recuerda en este navegador. Detalle del día, crear un evento y borrarlo.
   Habla directo con la API de Calendar con el mismo token de 1 h que ya usa Gmail (función api() de index.html): no
   necesita ninguna función nueva en el servidor. Si una cuenta se conectó antes de este permiso, sale un aviso para
   reconectarla (engranaje → Reconectar). Se carga con <script src="/app/calendario.js" defer> y se registra en VISTAS. */
var CAL = { mes:null, dia:null, cals:{}, errores:{}, cache:{}, on:{}, cargando:false, sel:null, nuevo:false, edit:null, gen:0 };
try { CAL.on = JSON.parse(localStorage.getItem('buzonero-cal-on') || '{}') || {}; } catch(e){ CAL.on = {}; }
var CAL_API = 'https://www.googleapis.com/calendar/v3/';
var CAL_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    + '.cal{padding:4px 2px 24px}.cal-wrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px;margin-top:10px}'
    + '@media(max-width:820px){.cal-wrap{grid-template-columns:1fr}}'
    + '.cal-lado{align-self:start;border:1px solid var(--line);border-radius:var(--r);background:var(--card);padding:10px 12px}.cal-lado h4{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--faint)}'
    + '.cal-cta{margin:10px 0 2px;font-weight:600;font-size:13px}.cal-cta:first-of-type{margin-top:0}'
    + '.cal-chk{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px;cursor:pointer;color:var(--text)}.cal-chk span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.cal-chk input{appearance:none;-webkit-appearance:none;width:16px;height:16px;border-radius:4px;border:2px solid var(--tc,var(--line-strong));background:transparent;display:grid;place-content:center;flex:none;margin:0;cursor:pointer}'
    + '.cal-chk input:checked{background:var(--tc,var(--acc))}.cal-chk input:checked::after{content:"";width:8px;height:4px;border:solid #fff;border-width:0 0 2px 2px;transform:rotate(-45deg) translate(1px,-1px)}'
    + '.cal-chk input:indeterminate{background:var(--tc,var(--acc));opacity:.55}.cal-chk.sub{padding-left:22px}'
    + '.cal-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}'
    + '.cal-chip{border:1px solid var(--line-strong);background:var(--surface);color:var(--text);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}'
    + '.cal-chip.acc{background:var(--acc);border-color:var(--acc);color:var(--acc-ink)}'
    + '.cal-nav{display:flex;align-items:center;gap:6px;margin-left:auto}.cal-mes{min-width:150px;text-align:center;font-weight:600;text-transform:capitalize}'
    + '.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--card)}'
    + '.cal-dow{padding:6px 4px;text-align:center;font-size:12px;color:var(--faint);background:var(--surface);border-bottom:1px solid var(--line)}'
    + '.cal-d{min-height:84px;padding:4px;border:0;border-right:1px solid var(--line);border-bottom:1px solid var(--line);cursor:pointer;overflow:hidden;text-align:left;background:transparent;color:var(--text);font:inherit}'
    + '.cal-d:nth-child(7n+1){border-right:0}.cal-d.fuera{opacity:.45}.cal-d.hoy .cal-n{background:var(--acc);color:var(--acc-ink)}.cal-d.sel{outline:2px solid var(--acc);outline-offset:-2px}'
    + '.cal-n{display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;font-size:12px}'
    + '.cal-ev{display:block;margin-top:2px;padding:1px 5px;border-radius:5px;font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;background:var(--tc,var(--spark-ink))}'
    + '.cal-mas{font-size:11px;color:var(--faint);margin-top:2px}'
    + '.cal-dia{margin-top:16px}.cal-dia h3{margin:0 0 8px;font-size:15px;text-transform:capitalize}'
    + '.cal-it{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border:1px solid var(--line);border-radius:var(--r-sm);margin-bottom:6px;background:var(--card);width:100%;text-align:left;color:var(--text);font:inherit;cursor:pointer}'
    + '.cal-it i.p{width:4px;align-self:stretch;border-radius:2px;background:var(--tc,var(--spark-ink));flex:none}.cal-it b{display:block}.cal-it small{color:var(--mute)}'
    + '.cal-det{margin-top:12px;padding:12px;border:1px solid var(--line-strong);border-radius:var(--r);background:var(--surface)}.cal-det p{margin:6px 0;white-space:pre-wrap}'
    + '.cal-form{display:grid;gap:8px;margin-top:12px;padding:12px;border:1px solid var(--line-strong);border-radius:var(--r);background:var(--surface)}'
    + '.cal-form label{display:grid;gap:3px;font-size:12px;color:var(--mute)}.cal-form input,.cal-form select,.cal-form textarea{font:inherit;padding:7px 9px;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--bg);color:var(--text)}'
    + '.cal-fila{display:flex;gap:8px;flex-wrap:wrap}.cal-fila>*{flex:1;min-width:120px}.cal-aviso{margin:8px 0;padding:8px 10px;border-radius:var(--r-sm);background:var(--warn-soft);color:var(--warn);font-size:13px}'
    + '.shell:has(.cal),.shell.reading:has(.cal){grid-template-columns:236px minmax(0,1fr)}.shell:has(.cal)>.read{display:none}'
    + '@media(max-width:1180px){.shell:has(.cal),.shell.reading:has(.cal){grid-template-columns:72px minmax(0,1fr)}}'
    + '@media(max-width:900px){.shell:has(.cal),.shell.reading:has(.cal){grid-template-columns:minmax(0,1fr)}}'
    + '.shell:has(.cal)>.list{overflow:auto}'
    + '@media(max-width:700px){.cal-d{min-height:62px}.cal-ev{font-size:10px}}';
  document.head.appendChild(css);
})();

function calIso(d){ return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function calHora(s){ return s && s.length > 10 ? new Date(s).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : ''; }
function calRango(){
  var p = new Date(CAL.mes.getFullYear(), CAL.mes.getMonth(), 1), off = (p.getDay() + 6) % 7;
  var ini = new Date(p); ini.setDate(1 - off);
  var fin = new Date(ini); fin.setDate(fin.getDate() + 42);
  return [ini, fin];
}
function calGuardar(){ try { localStorage.setItem('buzonero-cal-on', JSON.stringify(CAL.on)); } catch(e){} }
// ¿está marcado este calendario? Lo que tú marques manda; si no, el que Google tiene visible
function calActivo(k, c){ var v = CAL.on[k + '|' + c.id]; return v === undefined ? c.selected !== false : !!v; }
function calClave(k, c, ini){ return k + '|' + c.id + '|' + calIso(ini); }
// día (AAAA-MM-DD) en que cae un evento; los de todo el día ocupan desde su fecha hasta el día anterior a «end»
function calDiasDe(e){
  var s = e.start.date || e.start.dateTime.slice(0, 10), f = e.end ? (e.end.date || e.end.dateTime.slice(0, 10)) : s, out = [];
  var a = new Date(s + 'T12:00:00'), b = new Date(f + 'T12:00:00');
  if(e.start.date){ b.setDate(b.getDate() - 1); }
  if(b < a) b = a;
  for(var d = new Date(a); d <= b && out.length < 42; d.setDate(d.getDate() + 1)) out.push(calIso(d));
  return out;
}

// carga las listas de calendarios (una vez) y los eventos del mes de los calendarios marcados que aún no se han traído
async function cargarCalendario(forzar){
  var gen = ++CAL.gen, r = calRango(), tMin = r[0].toISOString(), tMax = r[1].toISOString();
  if(forzar){ CAL.cals = {}; CAL.cache = {}; }
  CAL.cargando = true; CAL.errores = {}; pintarCalendario();
  await pool(KEYS, 2, async function(k){
    try {
      if(!CAL.cals[k]){ var l = await api(k, CAL_API + 'users/me/calendarList?maxResults=250'); CAL.cals[k] = l.items || []; }
      var faltan = CAL.cals[k].filter(function(c){ return calActivo(k, c) && !CAL.cache[calClave(k, c, r[0])]; });
      await pool(faltan, 3, async function(c){
        var q = 'calendars/' + encodeURIComponent(c.id) + '/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=' + encodeURIComponent(tMin) + '&timeMax=' + encodeURIComponent(tMax);
        var x = await api(k, CAL_API + q);
        CAL.cache[calClave(k, c, r[0])] = (x.items || []).filter(function(e){ return e.status !== 'cancelled' && e.start; }).map(function(e){ e._k = k; e._cal = c.id; e._calNombre = c.summaryOverride || c.summary; e._color = c.backgroundColor || ''; e._rol = c.accessRole; return e; });
      });
    } catch(err){
      var m = String(err.message || err);
      // «la API no está activada en el proyecto» no se arregla reconectando: se dice tal cual
      CAL.errores[k] = /accessNotConfigured|has not been used|is disabled/i.test(m) ? 'api' : ((err.status === 403 || /insufficient|scope|permission/i.test(m)) ? 'permiso' : m);
    }
  });
  if(gen !== CAL.gen) return;
  CAL.cargando = false; if(st.folder === 'CALENDARIO') pintarCalendario();
}
function calEventos(){
  var r = calRango(), out = [];
  KEYS.forEach(function(k){ (CAL.cals[k] || []).forEach(function(c){ if(calActivo(k, c)) (CAL.cache[calClave(k, c, r[0])] || []).forEach(function(e){ out.push(e); }); }); });
  return out;
}

function calPanel(){
  var h = '<aside class="cal-lado"><h4>Mis calendarios</h4>';
  KEYS.forEach(function(k){
    var cs = CAL.cals[k] || [], on = cs.filter(function(c){ return calActivo(k, c); }).length;
    h += '<label class="cal-chk cal-cta" style="--tc:' + esc(ACC[k].color || 'var(--acc)') + '"><input type="checkbox" data-cal-cuenta="' + esc(k) + '"' + (cs.length && on === cs.length ? ' checked' : '') + (on && on < cs.length ? ' data-parcial="1"' : '') + (CAL.errores[k] || !cs.length ? ' disabled' : '') + '><span>' + esc(ACC[k].name) + '</span></label>';
    if(CAL.errores[k]) h += '<div class="cal-mas">' + (CAL.errores[k] === 'api' ? 'Falta activar la API de Calendar' : CAL.errores[k] === 'permiso' ? 'Sin permiso de Calendario' : 'No se pudo cargar') + '</div>';
    else if(!cs.length && CAL.cargando) h += '<div class="cal-mas">Cargando…</div>';
    cs.forEach(function(c){ h += '<label class="cal-chk sub" style="--tc:' + esc(c.backgroundColor || 'var(--acc)') + '"><input type="checkbox" data-cal-cal="' + esc(k + '|' + c.id) + '"' + (calActivo(k, c) ? ' checked' : '') + '><span title="' + esc(c.summaryOverride || c.summary) + '">' + esc(c.summaryOverride || c.summary) + '</span></label>'; });
  });
  return h + '</aside>';
}

function pintarCalendario(){
  var el = $('rows'); if(!el) return;
  if(!CAL.mes){ var h0 = new Date(); CAL.mes = new Date(h0.getFullYear(), h0.getMonth(), 1); CAL.dia = calIso(h0); cargarCalendario(); return; }
  var hoy = calIso(new Date()), r = calRango(), porDia = {};
  calEventos().forEach(function(e){ calDiasDe(e).forEach(function(d){ (porDia[d] = porDia[d] || []).push(e); }); });
  Object.keys(porDia).forEach(function(d){ porDia[d].sort(function(a, b){ return (a.start.dateTime || a.start.date + 'T00:00').localeCompare(b.start.dateTime || b.start.date + 'T00:00'); }); });
  var h = '<div class="vista-esp cal">' + cabezaVista('Calendario', CAL.cargando ? 'Cargando tus calendarios…' : 'Tus calendarios de Google', 'cal', CAL.cargando) + '<div class="cal-wrap">' + calPanel() + '<div>';
  h += '<div class="cal-bar"><span class="cal-nav" style="margin-left:0"><button type="button" class="icon-btn" data-cal-nav="-1" aria-label="Mes anterior"><i class="ph ph-caret-left"></i></button>'
    + '<span class="cal-mes">' + esc(CAL.mes.toLocaleDateString('es-ES', { month:'long', year:'numeric' })) + '</span>'
    + '<button type="button" class="icon-btn" data-cal-nav="1" aria-label="Mes siguiente"><i class="ph ph-caret-right"></i></button></span>'
    + '<button type="button" class="cal-chip" data-cal-hoy="1">Hoy</button><span class="cal-nav"><button type="button" class="cal-chip acc" data-cal-nuevo="1"><i class="ph ph-plus"></i> Nuevo evento</button></span></div>';
  KEYS.forEach(function(k){ if(CAL.errores[k]) h += '<div class="cal-aviso">' + esc(ACC[k].name) + ': ' + (CAL.errores[k] === 'api' ? 'Falta activar la «Google Calendar API» en el proyecto de Google Cloud de Buzonero (APIs y servicios → Biblioteca → Google Calendar API → Habilitar). No hace falta reconectar la cuenta.' : CAL.errores[k] === 'permiso' ? 'esta cuenta aún no da permiso de Calendario. Reconéctala (engranaje → Reconectar) y comprueba que «Google Calendar API» está activada en tu proyecto de Google Cloud.' : esc(CAL.errores[k])) + '</div>'; });
  h += '<div class="cal-grid">' + CAL_DIAS.map(function(d){ return '<div class="cal-dow">' + d + '</div>'; }).join('');
  for(var i = 0; i < 42; i++){
    var d = new Date(r[0]); d.setDate(d.getDate() + i); var iso = calIso(d), evs = porDia[iso] || [];
    h += '<button type="button" class="cal-d' + (d.getMonth() !== CAL.mes.getMonth() ? ' fuera' : '') + (iso === hoy ? ' hoy' : '') + (iso === CAL.dia ? ' sel' : '') + '" data-cal-dia="' + iso + '"><span class="cal-n">' + d.getDate() + '</span>'
      + evs.slice(0, 3).map(function(e){ return '<span class="cal-ev" style="--tc:' + esc(e._color || '') + '">' + esc((e.start.dateTime ? calHora(e.start.dateTime) + ' ' : '') + (e.summary || '(sin título)')) + '</span>'; }).join('')
      + (evs.length > 3 ? '<div class="cal-mas">+' + (evs.length - 3) + ' más</div>' : '') + '</button>';
  }
  h += '</div>';
  var delDia = porDia[CAL.dia] || [], fd = new Date(CAL.dia + 'T12:00:00');
  h += '<section class="cal-dia"><h3>' + esc(fd.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })) + '</h3>'
    + (delDia.length ? delDia.map(function(e){ return '<button type="button" class="cal-it" data-cal-ev="' + esc(e._k + '|' + e._cal + '|' + e.id) + '" style="--tc:' + esc(e._color || '') + '"><i class="p"></i><span><b>' + esc(e.summary || '(sin título)') + '</b><small>'
      + (e.start.dateTime ? esc(calHora(e.start.dateTime) + ' – ' + calHora(e.end.dateTime)) : 'Todo el día') + ' · ' + esc(e._calNombre || '') + (KEYS.length > 1 ? ' · ' + esc(ACC[e._k].name) : '') + (e.location ? ' · ' + esc(e.location) : '') + '</small></span></button>'; }).join('')
      : '<p style="color:var(--mute)">' + (CAL.cargando ? 'Cargando…' : 'Nada este día.') + '</p>') + '</section>';
  if(CAL.sel) h += calDetalle(CAL.sel);
  if(CAL.edit) h += calFormulario(calBuscar(CAL.edit)); else if(CAL.nuevo) h += calFormulario();
  el.innerHTML = h + '</div></div></div>';
  [].slice.call(el.querySelectorAll('input[data-parcial]')).forEach(function(i){ i.indeterminate = true; });
}

function calBuscar(clave){ var p = clave.split('|'); return calEventos().filter(function(e){ return e._k === p[0] && e._cal === p[1] && e.id === p[2]; })[0]; }
function calDetalle(clave){
  var e = calBuscar(clave); if(!e) return '';
  var hora = e.start.dateTime ? esc(new Date(e.start.dateTime).toLocaleString('es-ES', { dateStyle:'full', timeStyle:'short' }) + ' – ' + calHora(e.end.dateTime)) : 'Todo el día';
  return '<div class="cal-det"><b>' + esc(e.summary || '(sin título)') + '</b><p>' + hora + '</p>' + (e.location ? '<p>' + esc(e.location) + '</p>' : '')
    + (e.description ? '<p>' + esc(String(e.description).replace(/<[^>]+>/g, ' ').slice(0, 800)) + '</p>' : '')
    + '<p style="color:var(--mute)">' + esc(e._calNombre || '') + ' · ' + esc(ACC[e._k].name) + '</p>'
    + '<div class="cal-fila"><a class="sub-btn" href="' + esc(e.htmlLink || '#') + '" target="_blank" rel="noopener">Abrir en Google Calendar</a>'
    + (e._rol === 'owner' || e._rol === 'writer' ? '<button type="button" class="sub-btn" data-cal-editar="' + esc(clave) + '">Editar</button><button type="button" class="sub-btn" data-cal-borrar="' + esc(clave) + '">Borrar</button>' : '') + '<button type="button" class="sub-btn" data-cal-cerrar="1">Cerrar</button></div></div>';
}
function calEscribibles(k){ return (CAL.cals[k] || []).filter(function(c){ return c.accessRole === 'owner' || c.accessRole === 'writer'; }); }
function calOpciones(k){ return calEscribibles(k).map(function(c){ return '<option value="' + esc(c.id) + '"' + (c.primary ? ' selected' : '') + '>' + esc(c.summaryOverride || c.summary) + '</option>'; }).join(''); }
function calHHMM(s){ return s && s.length > 10 ? new Date(s).toTimeString().slice(0, 5) : ''; }
function calFormulario(ed){
  var ks = KEYS.filter(function(k){ return !CAL.errores[k] && calEscribibles(k).length; });
  if(!ed && !ks.length) return '<div class="cal-aviso">Ninguna cuenta tiene un calendario donde se pueda escribir (o aún falta reconectarlas).</div>';
  var dia = ed ? (ed.start.date || calIso(new Date(ed.start.dateTime))) : CAL.dia, td = ed && !!ed.start.date;
  var desc = ed ? String(ed.description || '').replace(/<[^>]+>/g, ' ') : '';
  return '<form class="cal-form" id="calForm"' + (ed ? ' data-k="' + esc(ed._k) + '" data-cal="' + esc(ed._cal) + '" data-id="' + esc(ed.id) + '"' : '') + '><b>' + (ed ? 'Editar evento' : 'Nuevo evento') + '</b>'
    + (ed ? '<small style="color:var(--mute)">' + esc(ed._calNombre || '') + ' · ' + esc(ACC[ed._k].name) + '</small>'
      : '<div class="cal-fila"><label>Cuenta<select name="k">' + ks.map(function(k){ return '<option value="' + esc(k) + '">' + esc(ACC[k].name) + '</option>'; }).join('') + '</select></label>'
        + '<label>Calendario<select name="cal">' + calOpciones(ks[0]) + '</select></label></div>')
    + '<label>Título<input name="t" required maxlength="200" value="' + esc(ed ? ed.summary || '' : '') + '"></label>'
    + '<div class="cal-fila"><label>Día<input type="date" name="d" required value="' + esc(dia) + '"></label><label>Empieza<input type="time" name="i" value="' + esc(ed && !td ? calHHMM(ed.start.dateTime) : '10:00') + '"></label><label>Termina<input type="time" name="f" value="' + esc(ed && !td ? calHHMM(ed.end.dateTime) : '11:00') + '"></label></div>'
    + '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="td"' + (td ? ' checked' : '') + '> Todo el día</label>'
    + '<label>Lugar<input name="l" maxlength="200" value="' + esc(ed ? ed.location || '' : '') + '"></label><label>Descripción<textarea name="n" rows="3">' + esc(desc) + '</textarea></label>'
    + '<div class="cal-fila"><button type="submit" class="cal-chip acc">' + (ed ? 'Guardar cambios' : 'Crear evento') + '</button><button type="button" class="cal-chip" data-cal-cerrar="1">Cancelar</button></div></form>';
}

async function calCrear(f){
  var edit = !!f.dataset.id, v = function(n){ return (f.elements[n] || {}).value || ''; }, td = f.elements.td.checked, k = edit ? f.dataset.k : v('k'), calId = edit ? f.dataset.cal : v('cal');
  var cuerpo = { summary: v('t').trim(), location: edit ? v('l') : (v('l') || undefined), description: edit ? v('n') : (v('n') || undefined) };
  if(td){ var x = new Date(v('d') + 'T12:00:00'); x.setDate(x.getDate() + 1); cuerpo.start = { date:v('d') }; cuerpo.end = { date:calIso(x) }; }
  else { var z = 'Europe/Madrid'; cuerpo.start = { dateTime:v('d') + 'T' + v('i') + ':00', timeZone:z }; cuerpo.end = { dateTime:v('d') + 'T' + (v('f') || v('i')) + ':00', timeZone:z }; if(cuerpo.end.dateTime <= cuerpo.start.dateTime){ toast('La hora de fin tiene que ser posterior a la de inicio'); return; } }
  if(edit){   // al pasar de «todo el día» a con hora (o al revés), Google exige quitar el campo que ya no vale
    if(td){ cuerpo.start.dateTime = null; cuerpo.end.dateTime = null; } else { cuerpo.start.date = null; cuerpo.end.date = null; }
  }
  try {
    var base = CAL_API + 'calendars/' + encodeURIComponent(calId) + '/events';
    if(edit) await api(k, base + '/' + encodeURIComponent(f.dataset.id) + '?sendUpdates=none', { method:'PATCH', json:cuerpo });
    else await api(k, base + '?sendUpdates=none', { method:'POST', json:cuerpo });
    toast(edit ? 'Cambios guardados en Google Calendar' : 'Evento creado en Google Calendar'); CAL.nuevo = false; CAL.edit = null; CAL.sel = null; CAL.dia = v('d'); CAL.cache = {}; cargarCalendario();
  } catch(e){ toast('No se pudo ' + (edit ? 'guardar: ' : 'crear: ') + e.message); }
}
async function calBorrar(clave){
  var e = calBuscar(clave); if(!e) return;
  if(!window.confirm('¿Borrar «' + (e.summary || 'este evento') + '» del calendario de Google?')) return;
  try { await api(e._k, CAL_API + 'calendars/' + encodeURIComponent(e._cal) + '/events/' + encodeURIComponent(e.id) + '?sendUpdates=none', { method:'DELETE' }); toast('Evento borrado'); CAL.sel = null; CAL.cache = {}; cargarCalendario(); }
  catch(err){ toast('No se pudo borrar: ' + err.message); }
}

document.addEventListener('click', function(ev){
  if(st.folder !== 'CALENDARIO') return;
  var t = ev.target.closest('[data-cal-nav],[data-cal-hoy],[data-cal-dia],[data-cal-ev],[data-cal-nuevo],[data-cal-cerrar],[data-cal-editar],[data-cal-borrar],[data-ve="cal"]'); if(!t) return;
  if(t.hasAttribute('data-ve')){ cargarCalendario(true); return; }
  if(t.dataset.calNav){ CAL.mes = new Date(CAL.mes.getFullYear(), CAL.mes.getMonth() + (+t.dataset.calNav), 1); CAL.dia = calIso(CAL.mes); CAL.sel = null; cargarCalendario(); }
  else if(t.dataset.calHoy){ var h = new Date(); CAL.mes = new Date(h.getFullYear(), h.getMonth(), 1); CAL.dia = calIso(h); CAL.sel = null; cargarCalendario(); }
  else if(t.dataset.calDia){ CAL.dia = t.dataset.calDia; CAL.sel = null; pintarCalendario(); }
  else if(t.dataset.calEv){ CAL.sel = t.dataset.calEv; pintarCalendario(); }
  else if(t.dataset.calNuevo){ CAL.nuevo = !CAL.nuevo; CAL.edit = null; pintarCalendario(); }
  else if(t.dataset.calEditar){ CAL.edit = t.dataset.calEditar; CAL.nuevo = false; pintarCalendario(); }
  else if(t.dataset.calCerrar){ CAL.sel = null; CAL.nuevo = false; CAL.edit = null; pintarCalendario(); }
  else if(t.dataset.calBorrar){ calBorrar(t.dataset.calBorrar); }
});
document.addEventListener('submit', function(ev){ if(ev.target && ev.target.id === 'calForm'){ ev.preventDefault(); calCrear(ev.target); } });
document.addEventListener('change', function(ev){
  var i = ev.target; if(!i) return;
  if(i.form && i.form.id === 'calForm' && i.name === 'k'){ i.form.elements.cal.innerHTML = calOpciones(i.value); return; }
  if(st.folder !== 'CALENDARIO') return;
  if(i.dataset && i.dataset.calCuenta){ var k = i.dataset.calCuenta; (CAL.cals[k] || []).forEach(function(c){ CAL.on[k + '|' + c.id] = i.checked; }); calGuardar(); cargarCalendario(); }
  else if(i.dataset && i.dataset.calCal){ CAL.on[i.dataset.calCal] = i.checked; calGuardar(); cargarCalendario(); }
});
