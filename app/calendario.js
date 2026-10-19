/* Buzonero Campillero · Calendario de Google
   Vista «Calendario» de la barra lateral, hecha como Google Calendar:
   - Día, Semana y Mes (se recuerda la última), «Hoy» y flechas, y un minicalendario en el lateral.
   - «Mis calendarios»: un check por cuenta y otro por calendario. Lo que marques se guarda en tu propio Google Calendar
     (la casilla «visible» de cada calendario), así se recuerda en cualquier ordenador o móvil y también en Google.
   - Pulsar un evento abre su tarjeta (editar, borrar, abrir en Google); pulsar un hueco crea uno a esa hora;
     arrastrar un evento lo mueve (también a otro día) y estirar su borde de abajo cambia cuándo acaba.
   Habla directo con la API de Calendar con el mismo token de 1 h que ya usa Gmail (función api() de index.html).
   Se carga con <script src="/app/calendario.js"> y se registra en VISTAS (CALENDARIO → pintarCalendario). */
var CAL = { vista:'semana', fecha:null, mini:null, cals:{}, errores:{}, cache:{}, on:{}, cargando:false, gen:0, pop:null, scroll:null, ladoMovil:false };
try { CAL.on = JSON.parse(localStorage.getItem('buzonero-cal-on') || '{}') || {}; } catch(e){ CAL.on = {}; }
try { var v0 = localStorage.getItem('buzonero-cal-vista'); if(v0 === 'dia' || v0 === 'semana' || v0 === 'mes') CAL.vista = v0; } catch(e){}
var CAL_API = 'https://www.googleapis.com/calendar/v3/';
var CAL_PXH = 48;   // alto de una hora en Día y Semana
var CAL_ZONA = (function(){ try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'; } catch(e){ return 'Europe/Madrid'; } })();

(function(){
  var css = document.createElement('style');
  css.textContent = ''
    + '.shell:has(.cal),.shell.reading:has(.cal){grid-template-columns:236px minmax(0,1fr)}.shell:has(.cal)>.read{display:none}'
    + '@media(max-width:1180px){.shell:has(.cal),.shell.reading:has(.cal){grid-template-columns:72px minmax(0,1fr)}}'
    + '@media(max-width:900px){.shell:has(.cal),.shell.reading:has(.cal){grid-template-columns:minmax(0,1fr)}}'
    + '.shell:has(.cal)>.list{overflow:hidden;display:flex;flex-direction:column}.shell:has(.cal) .rows{flex:1;min-height:0;overflow:hidden}'
    + '.vista-esp.cal{display:flex;flex-direction:column;height:100%;min-height:0;position:relative;padding:0}.shell:has(.cal) .rows{padding-bottom:0}'
    + '.cal-top{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}'
    + '.cal-top h2{margin:0 6px;font-size:19px;font-weight:600;white-space:nowrap}.cal-top h2::first-letter,.cal-mini-h span:first-child::first-letter{text-transform:uppercase}'
    + '.cal-btn{border:1px solid var(--line-strong);background:var(--bg);color:var(--text);border-radius:999px;padding:6px 14px;font:inherit;font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}'
    + '.cal-btn:hover{background:var(--surface)}.cal-btn.acc{background:var(--acc);border-color:var(--acc);color:var(--acc-ink,#fff);font-weight:600}'
    + '.cal-seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:999px;overflow:hidden;margin-left:auto}'
    + '.cal-seg button{border:0;background:transparent;color:var(--text);padding:6px 14px;font:inherit;font-size:13.5px;cursor:pointer}.cal-seg button+button{border-left:1px solid var(--line-strong)}'
    + '.cal-seg button[aria-pressed="true"]{background:var(--acc-soft);color:var(--acc);font-weight:600}'
    + '.cal-cuerpo{flex:1;min-height:0;display:grid;grid-template-columns:232px minmax(0,1fr)}'
    + '.cal-lado{border-right:1px solid var(--line);padding:12px 12px 20px;overflow:auto}'
    + '.cal-lado h4{margin:16px 0 6px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}'
    + '.cal-mini-h{display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px}.cal-mini-h span:first-child{display:inline-block}'
    + '.cal-mini-h .icon-btn{width:26px;height:26px}'
    + '.cal-mini{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;font-size:11px}'
    + '.cal-mini span{color:var(--faint);padding:3px 0}.cal-mini button{border:0;background:transparent;color:var(--text);font:inherit;font-size:11.5px;height:26px;border-radius:13px;cursor:pointer}'
    + '.cal-mini button:hover{background:var(--surface)}.cal-mini button.fuera{color:var(--faint)}.cal-mini button.hoy{background:var(--acc);color:var(--acc-ink,#fff);font-weight:700}.cal-mini button.sel:not(.hoy){background:var(--acc-soft);color:var(--acc);font-weight:600}'
    + '.cal-chk{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer;color:var(--text)}.cal-chk span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.cal-chk input{appearance:none;-webkit-appearance:none;width:16px;height:16px;border-radius:4px;border:2px solid var(--tc,var(--line-strong));background:transparent;display:grid;place-content:center;flex:none;margin:0;cursor:pointer}'
    + '.cal-chk input:checked{background:var(--tc,var(--acc))}.cal-chk input:checked::after{content:"";width:8px;height:4px;border:solid #fff;border-width:0 0 2px 2px;transform:rotate(-45deg) translate(1px,-1px)}'
    + '.cal-chk input:indeterminate{background:var(--tc,var(--acc));opacity:.55}.cal-chk.cta{font-weight:600;margin-top:6px}.cal-chk.sub{padding-left:22px}'
    + '.cal-nota{font-size:11.5px;color:var(--faint);padding-left:24px}'
    + '.cal-aviso{margin:8px 16px 0;padding:8px 10px;border-radius:var(--r-sm);background:var(--warn-soft);color:var(--warn);font-size:13px}'
    + '.cal-main{min-width:0;min-height:0;display:flex;flex-direction:column}'
    /* Día y Semana */
    + '.cal-dias{display:grid;border-bottom:1px solid var(--line);padding-right:var(--sbw,0px)}'
    + '.cal-dias>div{text-align:center;padding:6px 2px 4px;font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em}'
    + '.cal-dias b{display:block;margin:2px auto 0;width:36px;height:36px;line-height:36px;border-radius:18px;font-size:20px;font-weight:500;color:var(--text);cursor:pointer;letter-spacing:0}'
    + '.cal-dias b:hover{background:var(--surface)}.cal-dias .hoy{color:var(--acc)}.cal-dias .hoy b{background:var(--acc);color:var(--acc-ink,#fff)}'
    + '.cal-todo{display:grid;border-bottom:1px solid var(--line);padding-right:var(--sbw,0px);min-height:24px}'
    + '.cal-todo>div{border-left:1px solid var(--line);padding:2px;display:flex;flex-direction:column;gap:2px;min-width:0}.cal-todo>div:first-child{border-left:0;font-size:10.5px;color:var(--faint);display:flex;align-items:center;justify-content:flex-end;padding-right:6px}'
    + '.cal-scroll{flex:1;min-height:0;overflow-y:auto;position:relative}'
    + '.cal-rej{display:grid;position:relative}'
    + '.cal-horas{position:relative}.cal-horas span{position:absolute;right:8px;font-size:10.5px;color:var(--faint);transform:translateY(-50%)}'
    + '.cal-col{position:relative;border-left:1px solid var(--line);background-image:repeating-linear-gradient(to bottom,transparent 0,transparent ' + (CAL_PXH - 1) + 'px,var(--line) ' + (CAL_PXH - 1) + 'px,var(--line) ' + CAL_PXH + 'px);cursor:cell}'
    + '.cal-col.hoy{background-color:color-mix(in srgb,var(--acc) 4%,transparent)}'
    + '.cal-ahora{position:absolute;left:-1px;right:0;height:2px;background:#ea4335;z-index:3;pointer-events:none}.cal-ahora::before{content:"";position:absolute;left:-6px;top:-5px;width:12px;height:12px;border-radius:50%;background:#ea4335}'
    + '.cal-evt{position:absolute;border-radius:6px;padding:2px 6px;font-size:12px;line-height:1.25;color:#fff;background:var(--tc,#039be5);overflow:hidden;cursor:pointer;border:1px solid var(--bg);box-sizing:border-box;z-index:2;touch-action:none;user-select:none}'
    + '.cal-evt b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cal-evt small{display:block;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.cal-evt .tirador{position:absolute;left:0;right:0;bottom:0;height:7px;cursor:ns-resize}'
    + '.cal-evt.arr{opacity:.85;box-shadow:0 6px 18px rgba(0,0,0,.25);z-index:5}'
    + '.cal-evt.nuevo{background:color-mix(in srgb,var(--acc) 70%,transparent);pointer-events:none}'
    + '.cal-chip{display:block;width:100%;text-align:left;border:0;border-radius:4px;padding:1px 6px;font:inherit;font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;background:var(--tc,#039be5);cursor:pointer;touch-action:none;user-select:none}'
    + '.cal-chip.hora{background:transparent;color:var(--text)}.cal-chip.hora::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--tc,#039be5);margin-right:5px;vertical-align:0}'
    + '.cal-chip:hover{filter:brightness(.95)}.cal-chip.hora:hover{background:var(--surface)}'
    /* Mes */
    + '.cal-mes{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:auto;grid-auto-rows:minmax(0,1fr)}'
    + '.cal-mes>.dow{text-align:center;font-size:11px;color:var(--mute);text-transform:uppercase;padding:6px 0;border-bottom:1px solid var(--line);letter-spacing:.04em}'
    + '.cal-cel{border-left:1px solid var(--line);border-bottom:1px solid var(--line);padding:2px 3px;min-width:0;overflow:hidden;display:flex;flex-direction:column;gap:1px;cursor:cell}'
    + '.cal-cel:nth-child(7n+1){border-left:0}.cal-cel.sobre{background:var(--acc-soft)}'
    + '.cal-cel .n{align-self:center;font-size:12px;width:24px;height:24px;line-height:24px;text-align:center;border-radius:12px;cursor:pointer;margin:2px 0}'
    + '.cal-cel .n:hover{background:var(--surface)}.cal-cel.fuera .n{color:var(--faint)}.cal-cel.hoy .n{background:var(--acc);color:var(--acc-ink,#fff);font-weight:700}'
    + '.cal-mas{font-size:11.5px;color:var(--mute);border:0;background:transparent;text-align:left;padding:1px 6px;cursor:pointer;font:inherit;border-radius:4px}.cal-mas:hover{background:var(--surface)}'
    /* tarjeta del evento */
    + '.cal-pop{position:fixed;z-index:60;width:min(380px,calc(100vw - 24px));background:var(--bg);border:1px solid var(--line);border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.22);padding:10px 14px 14px}'
    + '.cal-pop-acc{display:flex;justify-content:flex-end;gap:2px}.cal-pop h3{display:flex;gap:10px;align-items:flex-start;margin:4px 0 6px;font-size:19px;font-weight:500;line-height:1.3}'
    + '.cal-pop h3 i.c{width:14px;height:14px;border-radius:4px;background:var(--tc);flex:none;margin-top:6px}'
    + '.cal-pop p{margin:6px 0 0 24px;font-size:13.5px;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}.cal-pop p.t{color:var(--mute);margin-top:0}'
    + '.cal-pop p i{color:var(--mute);margin-left:-24px;width:18px;display:inline-block}'
    /* ventana de crear o editar */
    + 'dialog.cal-dlg{width:min(560px,calc(100vw - 24px))}'
    + '.cal-form{display:grid;gap:12px;padding:6px 22px 18px}.cal-form .tit{font-size:20px;border:0;border-bottom:2px solid var(--line-strong);padding:6px 2px;background:transparent;color:var(--text);font-family:inherit}.cal-form .tit:focus{outline:none;border-color:var(--acc)}'
    + '.cal-form label{display:grid;gap:4px;font-size:12px;color:var(--mute)}.cal-form input:not([type=checkbox]),.cal-form select,.cal-form textarea{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--bg);color:var(--text)}'
    + '.cal-fila{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.cal-fila>*{flex:1;min-width:110px}.cal-fila .chk{flex:none;display:flex;flex-direction:row;align-items:center;gap:6px;font-size:13.5px;color:var(--text)}'
    + '.cal-pie{display:flex;gap:8px;align-items:center}.cal-pie .push{margin-left:auto}'
    + '.cal-movil-cals{display:none}'
    + '@media(max-width:820px){.cal-cuerpo{grid-template-columns:1fr}.cal-lado{display:none;border-right:0;border-bottom:1px solid var(--line)}.cal.lado-on .cal-lado{display:block;max-height:45vh}.cal-movil-cals{display:inline-flex}'
    + '.cal-top h2{font-size:16px}.cal-seg{margin-left:0}.cal-chip{font-size:10.5px;padding:0 4px}.cal-evt{font-size:10.5px;padding:1px 3px}.cal-dias b{width:30px;height:30px;line-height:30px;font-size:16px}}';
  document.head.appendChild(css);
})();

/* ---------- fechas ---------- */
function calIso(d){ return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function calDiaDe(iso){ var p = String(iso).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function calSuma(d, n){ var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function calLunes(d){ var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function calHora(d){ return d.toLocaleTimeString(BZ.loc, { hour:'2-digit', minute:'2-digit' }); }
function calLocal(d){ return calIso(d) + 'T' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':00'; }
function calIni(e){ return e.start.dateTime ? new Date(e.start.dateTime) : calDiaDe(e.start.date); }
function calFin(e){ return e.end ? (e.end.dateTime ? new Date(e.end.dateTime) : calDiaDe(e.end.date)) : calIni(e); }
// va arriba, en la fila «todo el día»: los de todo el día y los que duran 24 h o más (como hace Google)
function calArriba(e){ return !!e.start.date || (calFin(e) - calIni(e)) >= 86400000; }
function calRango(){
  var f = CAL.fecha;
  if(CAL.vista === 'dia'){ var a = new Date(f.getFullYear(), f.getMonth(), f.getDate()); return [a, calSuma(a, 1)]; }
  if(CAL.vista === 'semana'){ var l = calLunes(f); return [l, calSuma(l, 7)]; }
  var ini = calLunes(new Date(f.getFullYear(), f.getMonth(), 1)); return [ini, calSuma(ini, 42)];
}
function calTitulo(){
  var r = calRango(), f = CAL.fecha;
  if(CAL.vista === 'mes') return f.toLocaleDateString(BZ.loc, { month:'long', year:'numeric' });
  if(CAL.vista === 'dia') return f.toLocaleDateString(BZ.loc, { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  var b = calSuma(r[1], -1);
  return r[0].getMonth() === b.getMonth() ? r[0].getDate() + ' – ' + b.toLocaleDateString(BZ.loc, { day:'numeric', month:'long', year:'numeric' })
    : r[0].toLocaleDateString(BZ.loc, { day:'numeric', month:'short' }) + ' – ' + b.toLocaleDateString(BZ.loc, { day:'numeric', month:'short', year:'numeric' });
}

/* ---------- calendarios marcados (se guardan también en Google: casilla «visible» del calendario) ---------- */
function calGuardar(){ try { localStorage.setItem('buzonero-cal-on', JSON.stringify(CAL.on)); } catch(e){} }
function calActivo(k, c){ var v = CAL.on[k + '|' + c.id]; return v === undefined ? c.selected === true : !!v; }
function calMarcar(k, c, on){
  CAL.on[k + '|' + c.id] = on; c.selected = on; calGuardar();
  api(k, CAL_API + 'users/me/calendarList/' + encodeURIComponent(c.id), { method:'PATCH', json:{ selected:on } }).catch(function(){});
}
function calEscribible(k, calId){ var c = (CAL.cals[k] || []).filter(function(x){ return x.id === calId; })[0]; return !!c && (c.accessRole === 'owner' || c.accessRole === 'writer'); }

/* ---------- carga ---------- */
function calClave(k, c){ var r = calRango(); return k + '|' + c.id + '|' + calIso(r[0]) + '|' + calIso(r[1]); }
async function cargarCalendario(forzar){
  if(!CAL.fecha){ CAL.fecha = new Date(); CAL.mini = new Date(CAL.fecha.getFullYear(), CAL.fecha.getMonth(), 1); }
  var gen = ++CAL.gen, r = calRango(), tMin = r[0].toISOString(), tMax = r[1].toISOString();
  if(forzar){ CAL.cals = {}; CAL.cache = {}; }
  CAL.cargando = true; CAL.errores = {}; pintarCalendario();
  await pool(KEYS, 2, async function(k){
    try {
      if(!CAL.cals[k]){
        var l = await api(k, CAL_API + 'users/me/calendarList?maxResults=250'); CAL.cals[k] = l.items || [];
        // lo que viene de Google manda: así lo marcado en otro ordenador o en Google Calendar se respeta aquí
        CAL.cals[k].forEach(function(c){ CAL.on[k + '|' + c.id] = c.selected === true; }); calGuardar();
      }
      var faltan = CAL.cals[k].filter(function(c){ return calActivo(k, c) && !CAL.cache[calClave(k, c)]; });
      await pool(faltan, 3, async function(c){
        var q = 'calendars/' + encodeURIComponent(c.id) + '/events?singleEvents=true&orderBy=startTime&maxResults=500&timeMin=' + encodeURIComponent(tMin) + '&timeMax=' + encodeURIComponent(tMax);
        var x = await api(k, CAL_API + q);
        CAL.cache[calClave(k, c)] = (x.items || []).filter(function(e){ return e.status !== 'cancelled' && e.start; }).map(function(e){ e._k = k; e._cal = c.id; e._calNombre = c.summaryOverride || c.summary; e._color = c.backgroundColor || ''; e._rol = c.accessRole; return e; });
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
  // un mismo calendario puede estar en varias cuentas (uno compartido): cada evento sale una vez, del calendario donde se puede editar
  var por = {};
  KEYS.forEach(function(k){ (CAL.cals[k] || []).forEach(function(c){ if(calActivo(k, c)) (CAL.cache[calClave(k, c)] || []).forEach(function(e){
    var cl = (e.iCalUID || e.id) + '|' + (e.start.dateTime || e.start.date), ya = por[cl];
    if(!ya || (!calEscribible(ya._k, ya._cal) && calEscribible(e._k, e._cal))) por[cl] = e;
  }); }); });
  var out = Object.keys(por).map(function(x){ return por[x]; });
  return out.sort(function(a, b){ return calIni(a) - calIni(b) || (calFin(b) - calFin(a)); });
}
function calBuscar(clave){ var p = String(clave).split('|'); return calEventos().filter(function(e){ return e._k === p[0] && e._cal === p[1] && e.id === p[2]; })[0]; }
function calClaveEv(e){ return e._k + '|' + e._cal + '|' + e.id; }

/* ---------- pintar ---------- */
function calLado(){
  var m = CAL.mini, ini = calLunes(new Date(m.getFullYear(), m.getMonth(), 1)), hoy = calIso(new Date()), sel = calIso(CAL.fecha);
  var h = '<aside class="cal-lado"><div class="cal-mini-h"><span>' + esc(m.toLocaleDateString(BZ.loc, { month:'long', year:'numeric' })) + '</span><span>'
    + '<button type="button" class="icon-btn" data-cal-mini="-1" aria-label="Mes anterior"><i class="ph ph-caret-left"></i></button><button type="button" class="icon-btn" data-cal-mini="1" aria-label="Mes siguiente"><i class="ph ph-caret-right"></i></button></span></div><div class="cal-mini">';
  for(var i = 0; i < 7; i++) h += '<span>' + esc(calSuma(ini, i).toLocaleDateString(BZ.loc, { weekday:'narrow' })) + '</span>';
  for(var j = 0; j < 42; j++){ var d = calSuma(ini, j), iso = calIso(d); h += '<button type="button" data-cal-ir="' + iso + '" class="' + (d.getMonth() !== m.getMonth() ? 'fuera ' : '') + (iso === hoy ? 'hoy ' : '') + (iso === sel ? 'sel' : '') + '">' + d.getDate() + '</button>'; }
  h += '</div><h4>Mis calendarios</h4>';
  KEYS.forEach(function(k){
    var cs = CAL.cals[k] || [], on = cs.filter(function(c){ return calActivo(k, c); }).length;
    h += '<label class="cal-chk cta" style="--tc:' + esc(ACC[k].color || 'var(--acc)') + '"><input type="checkbox" data-cal-cuenta="' + esc(k) + '"' + (cs.length && on === cs.length ? ' checked' : '') + (on && on < cs.length ? ' data-parcial="1"' : '') + (CAL.errores[k] || !cs.length ? ' disabled' : '') + '><span>' + esc(ACC[k].name) + '</span></label>';
    if(CAL.errores[k]) h += '<div class="cal-nota">' + (CAL.errores[k] === 'api' ? 'Falta activar la API de Calendar' : CAL.errores[k] === 'permiso' ? 'Sin permiso de Calendario' : 'No se pudo cargar') + '</div>';
    else if(!cs.length && CAL.cargando) h += '<div class="cal-nota">Cargando…</div>';
    cs.forEach(function(c){ h += '<label class="cal-chk sub" style="--tc:' + esc(c.backgroundColor || 'var(--acc)') + '"><input type="checkbox" data-cal-cal="' + esc(k + '|' + c.id) + '"' + (calActivo(k, c) ? ' checked' : '') + '><span title="' + esc(c.summaryOverride || c.summary) + '" data-notr>' + esc(c.summaryOverride || c.summary) + '</span></label>'; });
  });
  return h + '</aside>';
}
function calAvisos(){
  var h = '';
  KEYS.forEach(function(k){ if(CAL.errores[k]) h += '<div class="cal-aviso">' + esc(ACC[k].name) + ': ' + (CAL.errores[k] === 'api' ? 'Falta activar la «Google Calendar API» en el proyecto de Google Cloud de Buzonero (APIs y servicios → Biblioteca → Google Calendar API → Habilitar). No hace falta reconectar la cuenta.' : CAL.errores[k] === 'permiso' ? 'esta cuenta aún no da permiso de Calendario. Reconéctala (engranaje → Reconectar) y comprueba que «Google Calendar API» está activada en tu proyecto de Google Cloud.' : esc(CAL.errores[k])) + '</div>'; });
  return h;
}
function calChip(e, conHora){
  var hora = !calArriba(e) && conHora;
  return '<button type="button" class="cal-chip' + (hora ? ' hora' : '') + '" data-cal-ev="' + esc(calClaveEv(e)) + '" style="--tc:' + esc(e._color || '') + '" data-notr>' + (hora ? esc(calHora(calIni(e))) + ' ' : '') + esc(e.summary || '(sin título)') + '</button>';
}
// en una columna de día, los eventos que se solapan se reparten en columnas, como en Google
function calColumnas(evs){
  var grupos = [], g = null, fin = 0;
  evs.forEach(function(e){ if(!g || e._a >= fin){ g = []; grupos.push(g); fin = 0; } g.push(e); fin = Math.max(fin, e._b); });
  grupos.forEach(function(gr){ var cols = []; gr.forEach(function(e){ var i = 0; while(cols[i] !== undefined && cols[i] > e._a) i++; cols[i] = e._b; e._col = i; }); gr.forEach(function(e){ e._ncol = cols.length; }); });
}
function calRejilla(dias){
  var hoy = calIso(new Date()), evs = calEventos(), cols = '56px repeat(' + dias.length + ',minmax(0,1fr))';
  var h = '<div class="cal-dias" style="grid-template-columns:' + cols + '"><div></div>' + dias.map(function(d){ var iso = calIso(d); return '<div class="' + (iso === hoy ? 'hoy' : '') + '">' + esc(d.toLocaleDateString(BZ.loc, { weekday:'short' })) + '<b data-cal-dia="' + iso + '">' + d.getDate() + '</b></div>'; }).join('') + '</div>';
  h += '<div class="cal-todo" style="grid-template-columns:' + cols + '"><div>' + (dias.length ? 'todo el día' : '') + '</div>' + dias.map(function(d){
    var a = d, b = calSuma(d, 1), lo = evs.filter(function(e){ return calArriba(e) && calIni(e) < b && calFin(e) > a; });
    return '<div data-cal-hueco-dia="' + calIso(d) + '">' + lo.map(function(e){ return calChip(e, false); }).join('') + '</div>'; }).join('') + '</div>';
  h += '<div class="cal-scroll" id="calScroll"><div class="cal-rej" style="grid-template-columns:' + cols + ';height:' + (24 * CAL_PXH) + 'px"><div class="cal-horas">';
  for(var i = 1; i < 24; i++) h += '<span style="top:' + (i * CAL_PXH) + 'px">' + esc(calHora(new Date(2026, 0, 1, i))) + '</span>';
  h += '</div>';
  var ahora = new Date();
  dias.forEach(function(d){
    var a = +d, b = +calSuma(d, 1), iso = calIso(d);
    var lo = evs.filter(function(e){ return !calArriba(e) && calIni(e) < b && calFin(e) > a; }).map(function(e){ e._a = Math.max(+calIni(e), a); e._b = Math.min(Math.max(+calFin(e), +calIni(e) + 15 * 60000), b); return e; });
    lo.sort(function(x, y){ return x._a - y._a || y._b - x._b; }); calColumnas(lo);
    h += '<div class="cal-col' + (iso === hoy ? ' hoy' : '') + '" data-cal-col="' + iso + '">';
    lo.forEach(function(e){
      var top = (e._a - a) / 3600000 * CAL_PXH, alto = Math.max((e._b - e._a) / 3600000 * CAL_PXH - 2, 18), w = 100 / e._ncol, corto = alto < 34;
      var esc2 = calEscribible(e._k, e._cal);
      h += '<div class="cal-evt" data-cal-ev="' + esc(calClaveEv(e)) + '"' + (esc2 ? ' data-mov="1"' : '') + ' style="--tc:' + esc(e._color || '') + ';top:' + top + 'px;height:' + alto + 'px;left:calc(' + (e._col * w) + '% + 1px);width:calc(' + w + '% - 3px)"><b data-notr>' + esc(e.summary || '(sin título)') + (corto ? ', ' + esc(calHora(calIni(e))) : '') + '</b>'
        + (corto ? '' : '<small>' + esc(calHora(calIni(e)) + ' – ' + calHora(calFin(e))) + '</small>' + (e.location ? '<small data-notr>' + esc(e.location) + '</small>' : '')) + (esc2 ? '<span class="tirador" data-tirador="1"></span>' : '') + '</div>';
    });
    if(iso === calIso(ahora)) h += '<div class="cal-ahora" style="top:' + ((ahora.getHours() + ahora.getMinutes() / 60) * CAL_PXH) + 'px"></div>';
    h += '</div>';
  });
  return h + '</div></div>';
}
function calMes(){
  var r = calRango(), hoy = calIso(new Date()), evs = calEventos(), mes = CAL.fecha.getMonth();
  var h = '<div class="cal-mes" style="grid-template-rows:auto repeat(6,minmax(0,1fr))">';
  for(var i = 0; i < 7; i++) h += '<div class="dow">' + esc(calSuma(r[0], i).toLocaleDateString(BZ.loc, { weekday:'short' })) + '</div>';
  for(var j = 0; j < 42; j++){
    var d = calSuma(r[0], j), iso = calIso(d), a = d, b = calSuma(d, 1);
    var lo = evs.filter(function(e){ return calIni(e) < b && calFin(e) > a && !(calArriba(e) && +calFin(e) === +a); });
    lo.sort(function(x, y){ return (calArriba(y) - calArriba(x)) || (calIni(x) - calIni(y)); });
    var cab = 4;
    h += '<div class="cal-cel' + (d.getMonth() !== mes ? ' fuera' : '') + (iso === hoy ? ' hoy' : '') + '" data-cal-cel="' + iso + '"><span class="n" data-cal-dia="' + iso + '">' + d.getDate() + '</span>'
      + lo.slice(0, lo.length > cab ? cab - 1 : cab).map(function(e){ return calChip(e, true); }).join('')
      + (lo.length > cab ? '<button type="button" class="cal-mas" data-cal-dia="' + iso + '">' + (lo.length - cab + 1) + ' más</button>' : '') + '</div>';
  }
  return h + '</div>';
}
function calPop(){
  var p = CAL.pop, e = p && calBuscar(p.clave); if(!e) return '';
  var ini = calIni(e), fin = calFin(e), arriba = calArriba(e), w = calEscribible(e._k, e._cal);
  var cuando = arriba
    ? ini.toLocaleDateString(BZ.loc, { weekday:'long', day:'numeric', month:'long' }) + (e.start.date && (fin - ini) > 86400000 ? ' – ' + calSuma(fin, -1).toLocaleDateString(BZ.loc, { day:'numeric', month:'long' }) : (!e.start.date ? ' – ' + fin.toLocaleDateString(BZ.loc, { day:'numeric', month:'long' }) + ', ' + calHora(fin) : ''))
    : ini.toLocaleDateString(BZ.loc, { weekday:'long', day:'numeric', month:'long' }) + ' · ' + calHora(ini) + ' – ' + calHora(fin);
  var desc = String(e.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  return '<div class="cal-pop" role="dialog" aria-label="Evento" style="left:' + p.x + 'px;top:' + p.y + 'px"><div class="cal-pop-acc">'
    + (w ? '<button type="button" class="icon-btn" data-cal-editar="' + esc(p.clave) + '" aria-label="Editar evento" title="Editar evento"><i class="ph ph-pencil-simple"></i></button><button type="button" class="icon-btn" data-cal-borrar="' + esc(p.clave) + '" aria-label="Borrar evento" title="Borrar evento"><i class="ph ph-trash"></i></button>' : '')
    + (e.htmlLink ? '<a class="icon-btn" href="' + esc(e.htmlLink) + '" target="_blank" rel="noopener" aria-label="Abrir en Google Calendar" title="Abrir en Google Calendar"><i class="ph ph-arrow-square-out"></i></a>' : '')
    + '<button type="button" class="icon-btn" data-cal-cerrar="1" aria-label="Cerrar"><i class="ph ph-x"></i></button></div>'
    + '<h3 style="--tc:' + esc(e._color || '#039be5') + '"><i class="c"></i><span data-notr>' + esc(e.summary || '(sin título)') + '</span></h3><p class="t" data-notr>' + esc(cuando) + '</p>'
    + (e.location ? '<p data-notr><i class="ph ph-map-pin"></i>' + esc(e.location) + '</p>' : '')
    + (e.hangoutLink ? '<p><i class="ph ph-video-camera"></i><a href="' + esc(e.hangoutLink) + '" target="_blank" rel="noopener">Google Meet</a></p>' : '')
    + (desc ? '<p data-notr><i class="ph ph-text-align-left"></i>' + esc(desc.slice(0, 600)) + '</p>' : '')
    + ((e.attendees || []).length ? '<p data-notr><i class="ph ph-users"></i>' + esc(e.attendees.slice(0, 6).map(function(x){ return x.displayName || x.email; }).join(', ') + (e.attendees.length > 6 ? '…' : '')) + '</p>' : '')
    + '<p><i class="ph ph-calendar-blank"></i><span data-notr>' + esc(e._calNombre || '') + (KEYS.length > 1 ? ' · ' + esc(ACC[e._k].name) : '') + '</span></p>'
    + (!w ? '<p class="t">Solo lectura: no puedes cambiar este calendario.</p>' : '') + '</div>';
}
function pintarCalendario(){
  var el = $('rows'); if(!el) return;
  if(!CAL.fecha){ cargarCalendario(); return; }
  var prevScroll = $('calScroll') ? $('calScroll').scrollTop : null, vista = CAL.vista, dias = [];
  if(vista !== 'mes'){ var r = calRango(); for(var d = new Date(r[0]); d < r[1]; d = calSuma(d, 1)) dias.push(new Date(d)); }
  var h = '<div class="vista-esp cal' + (CAL.ladoMovil ? ' lado-on' : '') + '"><div class="cal-top">'
    + '<button type="button" class="cal-btn cal-movil-cals" data-cal-lado="1"><i class="ph ph-list"></i></button>'
    + '<button type="button" class="cal-btn" data-cal-hoy="1">Hoy</button>'
    + '<button type="button" class="icon-btn" data-cal-nav="-1" aria-label="Anterior"><i class="ph ph-caret-left"></i></button><button type="button" class="icon-btn" data-cal-nav="1" aria-label="Siguiente"><i class="ph ph-caret-right"></i></button>'
    + '<h2>' + esc(calTitulo()) + '</h2>'
    + '<span class="cal-seg" role="group" aria-label="Vista"><button type="button" data-cal-vista="dia" aria-pressed="' + (vista === 'dia') + '">Día</button><button type="button" data-cal-vista="semana" aria-pressed="' + (vista === 'semana') + '">Semana</button><button type="button" data-cal-vista="mes" aria-pressed="' + (vista === 'mes') + '">Mes</button></span>'
    + '<button type="button" class="icon-btn" data-cal-recargar="1" aria-label="Actualizar" title="Actualizar"' + (CAL.cargando ? ' disabled' : '') + '><i class="ph ph-arrows-clockwise' + (CAL.cargando ? ' gira' : '') + '"></i></button>'
    + '<button type="button" class="cal-btn acc" data-cal-nuevo="1"><i class="ph ph-plus"></i> Crear</button></div>'
    + calAvisos() + '<div class="cal-cuerpo">' + calLado() + '<div class="cal-main">' + (vista === 'mes' ? calMes() : calRejilla(dias)) + '</div></div>' + calPop() + '</div>';
  el.innerHTML = h;
  [].slice.call(el.querySelectorAll('input[data-parcial]')).forEach(function(i){ i.indeterminate = true; });
  var sc = $('calScroll');
  if(sc){
    sc.parentNode.style.setProperty('--sbw', (sc.offsetWidth - sc.clientWidth) + 'px');
    // al entrar, a las 7:00 (o a la hora actual si es más tarde); al repintar, donde estaba
    sc.scrollTop = prevScroll != null && CAL.scroll === vista + calIso(CAL.fecha) ? prevScroll : Math.max(0, Math.min(7, new Date().getHours() - 1) * CAL_PXH - 12);
    CAL.scroll = vista + calIso(CAL.fecha);
  }
  var pop = el.querySelector('.cal-pop');
  if(pop){ var rr = pop.getBoundingClientRect(); if(rr.bottom > innerHeight - 8) pop.style.top = Math.max(8, innerHeight - rr.height - 8) + 'px'; if(rr.right > innerWidth - 8) pop.style.left = Math.max(8, innerWidth - rr.width - 8) + 'px'; }
}

/* ---------- crear y editar (ventana) ---------- */
var calDlg = document.createElement('dialog');
calDlg.className = 'compose-dlg sig-dlg cal-dlg'; calDlg.id = 'calDlg';
document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(calDlg); });
if(document.body) document.body.appendChild(calDlg);
function calEscribibles(k){ return (CAL.cals[k] || []).filter(function(c){ return c.accessRole === 'owner' || c.accessRole === 'writer'; }); }
function calOpciones(k, sel){ return calEscribibles(k).map(function(c){ return '<option value="' + esc(c.id) + '"' + ((sel ? c.id === sel : c.primary) ? ' selected' : '') + '>' + esc(c.summaryOverride || c.summary) + '</option>'; }).join(''); }
function calHHMM(d){ return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function calAbrirEditor(e, ini, fin, todoDia){
  CAL.pop = null;
  var ks = KEYS.filter(function(k){ return !CAL.errores[k] && calEscribibles(k).length; });
  if(!e && !ks.length){ toast('Ninguna cuenta tiene un calendario donde se pueda escribir'); return; }
  var a = e ? calIni(e) : ini, b = e ? calFin(e) : fin, td = e ? !!e.start.date : !!todoDia;
  if(td && e) b = calSuma(b, -1);   // en Google «end» de un día completo es el día siguiente
  var desc = e ? String(e.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') : '';
  var kSel = e ? e._k : (ks.indexOf(st.acc) >= 0 ? st.acc : ks[0]);
  calDlg.innerHTML = '<div class="dlg-head"><span>' + (e ? 'Editar evento' : 'Nuevo evento') + '</span><div class="push"><button class="icon-btn" type="button" data-cal-dlg-x="1" aria-label="Cerrar"><i class="ph ph-x"></i></button></div></div>'
    + '<form class="cal-form" id="calForm"' + (e ? ' data-k="' + esc(e._k) + '" data-cal="' + esc(e._cal) + '" data-id="' + esc(e.id) + '"' : '') + '>'
    + '<input class="tit" name="t" required maxlength="200" placeholder="Añade un título" value="' + esc(e ? e.summary || '' : '') + '">'
    + '<div class="cal-fila"><label>Empieza<input type="date" name="d1" required value="' + esc(calIso(a)) + '"></label><label class="hh">&nbsp;<input type="time" name="h1" value="' + esc(calHHMM(a)) + '"' + (td ? ' disabled' : '') + '></label>'
    + '<label>Termina<input type="date" name="d2" required value="' + esc(calIso(b)) + '"></label><label class="hh">&nbsp;<input type="time" name="h2" value="' + esc(calHHMM(b)) + '"' + (td ? ' disabled' : '') + '></label></div>'
    + '<label class="chk" style="display:flex;flex-direction:row;align-items:center;gap:6px;font-size:13.5px;color:var(--text)"><input type="checkbox" name="td"' + (td ? ' checked' : '') + '> Todo el día</label>'
    + (e ? '<small style="color:var(--mute)" data-notr>' + esc(e._calNombre || '') + ' · ' + esc(ACC[e._k].name) + '</small>'
      : '<div class="cal-fila"><label>Cuenta<select name="k">' + ks.map(function(k){ return '<option value="' + esc(k) + '"' + (k === kSel ? ' selected' : '') + '>' + esc(ACC[k].name) + '</option>'; }).join('') + '</select></label>'
        + '<label>Calendario<select name="cal">' + calOpciones(kSel) + '</select></label></div>')
    + '<label>Lugar<input name="l" maxlength="300" placeholder="Añade una ubicación" value="' + esc(e ? e.location || '' : '') + '"></label>'
    + '<label>Descripción<textarea name="n" rows="4" placeholder="Añade una descripción">' + esc(desc) + '</textarea></label>'
    + '<div class="cal-pie">' + (e ? '<button type="button" class="cal-btn" data-cal-borrar="' + esc(calClaveEv(e)) + '"><i class="ph ph-trash"></i> Borrar</button>' : '')
    + '<span class="push"></span><button type="button" class="cal-btn" data-cal-dlg-x="1">Cancelar</button><button type="submit" class="cal-btn acc">Guardar</button></div></form>';
  if(!calDlg.isConnected) document.body.appendChild(calDlg);
  if(!calDlg.open) calDlg.showModal();
  var t = calDlg.querySelector('[name=t]'); if(t){ t.focus(); t.select(); }
  pintarCalendario();
}
function calCuerpoFechas(ini, fin, td){
  if(td) return { start:{ date:calIso(ini), dateTime:null }, end:{ date:calIso(fin), dateTime:null } };
  return { start:{ dateTime:calLocal(ini), timeZone:CAL_ZONA, date:null }, end:{ dateTime:calLocal(fin), timeZone:CAL_ZONA, date:null } };
}
async function calGuardarForm(f){
  var edit = !!f.dataset.id, v = function(n){ return (f.elements[n] || {}).value || ''; }, td = f.elements.td.checked;
  var k = edit ? f.dataset.k : v('k'), calId = edit ? f.dataset.cal : v('cal');
  var ini = td ? calDiaDe(v('d1')) : new Date(v('d1') + 'T' + (v('h1') || '00:00') + ':00');
  var fin = td ? calSuma(calDiaDe(v('d2')), 1) : new Date(v('d2') + 'T' + (v('h2') || v('h1') || '00:00') + ':00');
  if(!(fin > ini)){ toast('El final tiene que ser después del principio'); return; }
  var cuerpo = Object.assign({ summary:v('t').trim(), location:v('l'), description:v('n') }, calCuerpoFechas(ini, fin, td));
  if(!edit){ ['start', 'end'].forEach(function(x){ Object.keys(cuerpo[x]).forEach(function(y){ if(cuerpo[x][y] === null) delete cuerpo[x][y]; }); }); }
  try {
    var base = CAL_API + 'calendars/' + encodeURIComponent(calId) + '/events';
    if(edit) await api(k, base + '/' + encodeURIComponent(f.dataset.id) + '?sendUpdates=none', { method:'PATCH', json:cuerpo });
    else await api(k, base + '?sendUpdates=none', { method:'POST', json:cuerpo });
    calDlg.close(); toast(edit ? 'Cambios guardados en Google Calendar' : 'Evento creado en Google Calendar');
    CAL.fecha = ini; CAL.cache = {}; cargarCalendario();
  } catch(e){ toast('No se pudo guardar: ' + e.message); }
}
async function calBorrar(clave){
  var e = calBuscar(clave); if(!e) return;
  if(!window.confirm('¿Borrar «' + (e.summary || 'este evento') + '» del calendario de Google?')) return;
  try {
    await api(e._k, CAL_API + 'calendars/' + encodeURIComponent(e._cal) + '/events/' + encodeURIComponent(e.id) + '?sendUpdates=none', { method:'DELETE' });
    toast('Evento borrado'); CAL.pop = null; if(calDlg.open) calDlg.close(); CAL.cache = {}; cargarCalendario();
  } catch(err){ toast('No se pudo borrar: ' + err.message); }
}
// mover o estirar un evento: se cambia ya en pantalla y se guarda en Google; si falla, se vuelve a cargar
async function calMover(e, ini, fin){
  var td = !!e.start.date, antes = { s:e.start, e:e.end }, c = calCuerpoFechas(ini, fin, td);
  e.start = td ? { date:c.start.date } : { dateTime:c.start.dateTime, timeZone:CAL_ZONA }; e.end = td ? { date:c.end.date } : { dateTime:c.end.dateTime, timeZone:CAL_ZONA };
  pintarCalendario();
  try { await api(e._k, CAL_API + 'calendars/' + encodeURIComponent(e._cal) + '/events/' + encodeURIComponent(e.id) + '?sendUpdates=none', { method:'PATCH', json:c }); toast('Evento movido'); }
  catch(err){ e.start = antes.s; e.end = antes.e; pintarCalendario(); toast('No se pudo mover: ' + err.message); }
}

/* ---------- ratón y dedo ---------- */
var calArr = null;
function calMinutosEn(col, clientY){ var r = col.getBoundingClientRect(); return Math.max(0, Math.min(24 * 60, (clientY - r.top) / CAL_PXH * 60)); }
document.addEventListener('pointerdown', function(ev){
  if(st.folder !== 'CALENDARIO' || ev.button > 0) return;
  var t = ev.target;
  var evt = t.closest && t.closest('.cal-evt[data-mov], .cal-mes .cal-chip, .cal-todo .cal-chip');
  if(evt){
    var e = calBuscar(evt.dataset.calEv); if(!e || !calEscribible(e._k, e._cal)) return;
    calArr = { el:evt, e:e, x0:ev.clientX, y0:ev.clientY, modo:t.dataset.tirador ? 'fin' : 'mover', movido:false, mes:!evt.classList.contains('cal-evt') };
    return;
  }
  var col = t.closest && t.closest('.cal-col');
  if(col && !t.closest('.cal-evt')){
    // arrastrar en un hueco marca la duración del evento nuevo (o un clic: una hora)
    var m0 = Math.floor(calMinutosEn(col, ev.clientY) / 30) * 30;
    calArr = { nuevo:true, col:col, m0:m0, m1:m0 + 60, y0:ev.clientY, movido:false };
  }
});
document.addEventListener('pointermove', function(ev){
  var a = calArr; if(!a) return;
  if(!a.movido && Math.abs(ev.clientY - a.y0) < 5 && Math.abs(ev.clientX - (a.x0 || ev.clientX)) < 5) return;
  a.movido = true; ev.preventDefault();
  if(a.nuevo){
    var m = Math.ceil(calMinutosEn(a.col, ev.clientY) / 15) * 15; a.m1 = Math.max(a.m0 + 15, m);
    if(!a.fant){ a.fant = document.createElement('div'); a.fant.className = 'cal-evt nuevo'; a.col.appendChild(a.fant); }
    a.fant.style.cssText = 'top:' + (a.m0 / 60 * CAL_PXH) + 'px;height:' + ((a.m1 - a.m0) / 60 * CAL_PXH) + 'px;left:1px;width:calc(100% - 3px)';
    a.fant.textContent = calHHMM(new Date(2026, 0, 1, 0, a.m0)) + ' – ' + calHHMM(new Date(2026, 0, 1, 0, a.m1));
    return;
  }
  if(a.mes){
    [].slice.call(document.querySelectorAll('.cal-cel.sobre, .cal-todo .sobre')).forEach(function(x){ x.classList.remove('sobre'); });
    var deb = document.elementFromPoint(ev.clientX, ev.clientY), cel = deb && deb.closest('[data-cal-cel],[data-cal-hueco-dia]');
    if(cel){ cel.classList.add('sobre'); a.dia = cel.dataset.calCel || cel.dataset.calHuecoDia; }
    a.el.style.opacity = '.5';
    return;
  }
  a.el.classList.add('arr');
  var ini = calIni(a.e), fin = calFin(a.e), dur = fin - ini, delta = Math.round((ev.clientY - a.y0) / CAL_PXH * 4) * 15;
  if(a.modo === 'fin'){
    a.fin = new Date(Math.max(+ini + 15 * 60000, +fin + delta * 60000)); a.ini = ini;
    a.el.style.height = Math.max(18, (a.fin - Math.max(+ini, +calDiaDe(calIso(ini)))) / 3600000 * CAL_PXH - 2) + 'px';
  } else {
    var deb2 = document.elementFromPoint(ev.clientX, ev.clientY), col = deb2 && deb2.closest('.cal-col');
    var diaIso = col ? col.dataset.calCol : calIso(ini), base = calDiaDe(diaIso);
    var mins = ini.getHours() * 60 + ini.getMinutes() + delta;
    a.ini = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, mins); a.fin = new Date(+a.ini + dur);
    if(col && a.el.parentNode !== col) col.appendChild(a.el);
    a.el.style.top = (Math.max(0, mins) / 60 * CAL_PXH) + 'px'; a.el.style.left = '1px'; a.el.style.width = 'calc(100% - 3px)';
  }
  var sm = a.el.querySelector('small'); if(sm) sm.textContent = calHora(a.ini) + ' – ' + calHora(a.fin);
}, { passive:false });
// en el móvil, si el dedo pasa a desplazar la página, el navegador cancela: se deja todo como estaba
document.addEventListener('pointercancel', function(){ var a = calArr; calArr = null; if(!a) return; if(a.fant) a.fant.remove(); if(a.movido) pintarCalendario(); });
document.addEventListener('pointerup', function(ev){
  var a = calArr; calArr = null; if(!a) return;
  if(a.nuevo){
    if(a.fant) a.fant.remove();
    var d = calDiaDe(a.col.dataset.calCol), m1 = a.movido ? a.m1 : a.m0 + 60;
    calAbrirEditor(null, new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, a.m0), new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m1));
    return;
  }
  if(!a.movido) return;   // un clic sin mover: lo trata el «click» (abre la tarjeta)
  a.el.dataset.recienMovido = '1';
  if(a.mes){
    [].slice.call(document.querySelectorAll('.sobre')).forEach(function(x){ x.classList.remove('sobre'); });
    if(!a.dia){ pintarCalendario(); return; }
    var ini = calIni(a.e), fin = calFin(a.e), dias = Math.round((calDiaDe(a.dia) - calDiaDe(calIso(ini))) / 86400000);
    if(!dias){ pintarCalendario(); return; }
    calMover(a.e, calSuma(ini, dias), calSuma(fin, dias)); return;
  }
  if(a.ini && a.fin && (+a.ini !== +calIni(a.e) || +a.fin !== +calFin(a.e))) calMover(a.e, a.ini, a.fin); else pintarCalendario();
});

document.addEventListener('click', function(ev){
  if(st.folder !== 'CALENDARIO') return;
  var t = ev.target.closest('[data-cal-nav],[data-cal-hoy],[data-cal-vista],[data-cal-dia],[data-cal-ir],[data-cal-mini],[data-cal-ev],[data-cal-nuevo],[data-cal-cerrar],[data-cal-editar],[data-cal-borrar],[data-cal-recargar],[data-cal-lado],[data-cal-dlg-x],[data-cal-cel],[data-cal-hueco-dia]');
  if(!t){ if(CAL.pop && !ev.target.closest('.cal-pop')){ CAL.pop = null; pintarCalendario(); } return; }
  if(t.dataset.recienMovido){ delete t.dataset.recienMovido; return; }
  var paso = { dia:1, semana:7, mes:0 }[CAL.vista];
  if(t.dataset.calNav){ var n = +t.dataset.calNav; CAL.fecha = paso ? calSuma(CAL.fecha, n * paso) : new Date(CAL.fecha.getFullYear(), CAL.fecha.getMonth() + n, 1); CAL.mini = new Date(CAL.fecha.getFullYear(), CAL.fecha.getMonth(), 1); CAL.pop = null; cargarCalendario(); }
  else if(t.dataset.calHoy){ CAL.fecha = new Date(); CAL.mini = new Date(CAL.fecha.getFullYear(), CAL.fecha.getMonth(), 1); CAL.pop = null; cargarCalendario(); }
  else if(t.dataset.calVista){ CAL.vista = t.dataset.calVista; try { localStorage.setItem('buzonero-cal-vista', CAL.vista); } catch(e){} CAL.pop = null; cargarCalendario(); }
  else if(t.dataset.calDia){ CAL.fecha = calDiaDe(t.dataset.calDia); CAL.vista = 'dia'; try { localStorage.setItem('buzonero-cal-vista', 'dia'); } catch(e){} CAL.pop = null; cargarCalendario(); }
  else if(t.dataset.calIr){ CAL.fecha = calDiaDe(t.dataset.calIr); CAL.pop = null; cargarCalendario(); }
  else if(t.dataset.calMini){ CAL.mini = new Date(CAL.mini.getFullYear(), CAL.mini.getMonth() + (+t.dataset.calMini), 1); pintarCalendario(); }
  else if(t.dataset.calEv){ var r = t.getBoundingClientRect(); CAL.pop = { clave:t.dataset.calEv, x:Math.max(8, Math.min(r.right + 8, innerWidth - 392)), y:Math.max(8, r.top) }; if(r.right + 400 > innerWidth) CAL.pop.x = Math.max(8, r.left - 388); pintarCalendario(); }
  else if(t.dataset.calNuevo){ var a = new Date(); a.setMinutes(a.getMinutes() < 30 ? 30 : 60, 0, 0); if(calIso(CAL.fecha) !== calIso(new Date())) a = new Date(CAL.fecha.getFullYear(), CAL.fecha.getMonth(), CAL.fecha.getDate(), 10); calAbrirEditor(null, a, new Date(+a + 3600000)); }
  else if(t.dataset.calCerrar){ CAL.pop = null; pintarCalendario(); }
  else if(t.dataset.calEditar){ calAbrirEditor(calBuscar(t.dataset.calEditar)); }
  else if(t.dataset.calBorrar){ calBorrar(t.dataset.calBorrar); }
  else if(t.dataset.calRecargar){ cargarCalendario(true); }
  else if(t.dataset.calLado){ CAL.ladoMovil = !CAL.ladoMovil; pintarCalendario(); }
  else if(t.dataset.calDlgX){ calDlg.close(); }
  else if(t.dataset.calCel || t.dataset.calHuecoDia){ var d = calDiaDe(t.dataset.calCel || t.dataset.calHuecoDia); calAbrirEditor(null, d, d, true); }
});
calDlg.addEventListener('click', function(ev){
  var t = ev.target.closest('[data-cal-dlg-x],[data-cal-borrar]'); if(!t) return;
  if(t.dataset.calDlgX) calDlg.close(); else calBorrar(t.dataset.calBorrar);
});
calDlg.addEventListener('submit', function(ev){ if(ev.target && ev.target.id === 'calForm'){ ev.preventDefault(); calGuardarForm(ev.target); } });
calDlg.addEventListener('change', function(ev){
  var i = ev.target, f = i.form; if(!f) return;
  if(i.name === 'k') f.elements.cal.innerHTML = calOpciones(i.value);
  if(i.name === 'td'){ f.elements.h1.disabled = f.elements.h2.disabled = i.checked; }
  if(i.name === 'd1' && f.elements.d2.value < i.value) f.elements.d2.value = i.value;
});
document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && CAL.pop && st.folder === 'CALENDARIO'){ CAL.pop = null; pintarCalendario(); } });
document.addEventListener('change', function(ev){
  var i = ev.target; if(!i || st.folder !== 'CALENDARIO' || !i.dataset) return;
  if(i.dataset.calCuenta){ var k = i.dataset.calCuenta; (CAL.cals[k] || []).forEach(function(c){ calMarcar(k, c, i.checked); }); cargarCalendario(); }
  else if(i.dataset.calCal){ var p = i.dataset.calCal.split('|'), k2 = p.shift(), id = p.join('|'), c = (CAL.cals[k2] || []).filter(function(x){ return x.id === id; })[0]; if(c){ calMarcar(k2, c, i.checked); cargarCalendario(); } }
});
// la línea de «ahora» se mueve sola
setInterval(function(){ if(st.folder === 'CALENDARIO' && CAL.vista !== 'mes' && !calArr && !(calDlg && calDlg.open)) { var l = document.querySelector('.cal-ahora'); if(l){ var n = new Date(); l.style.top = ((n.getHours() + n.getMinutes() / 60) * CAL_PXH) + 'px'; } } }, 60000);
