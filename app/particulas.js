/* =====================================================================
   Buzonero Campillero · partículas de fondo
   Un solo canvas fijo, detrás de todo (z-index -1) y sin eventos de ratón.
   - Acceso (#login): un sobre hecho de partículas que gira despacio y recibe
     tres corrientes (las tres cuentas) que entran en él. Polvo tenue alrededor.
   - App: polvo tenue por toda la pantalla (se mueve con el ratón y destella a
     ratos) y, con el panel de lectura VACÍO, el sobre en lugar del icono. El
     correo abierto queda libre de partículas para leerlo bien.
   - Vuelos (canvas aparte, encima de todo, solo mientras duran): al enviar, el
     correo sale en una estela hacia arriba; al llegar uno, va del aviso a la
     pestaña de su cuenta. window.__particulas.vuelo(desde, hacia, tipo).
   - Rendimiento: requestAnimationFrame limitado a ~60 fps; se para con la
     pestaña oculta, con el redactar abierto y con prefers-reduced-motion
     (entonces se dibuja un único fotograma quieto). Densidad según el área.
   - Color: rojo y blanco en oscuro (mezcla aditiva), rojo y gris en claro.
     Escucha data-theme en <html> con un MutationObserver.
   Sin dependencias. Expone window.__particulas.estado() para las pruebas.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__particulas) return;
  var doc = document, root = doc.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');

  var canvas = doc.createElement('canvas');
  canvas.className = 'particulas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block;visibility:hidden';
  /* Dibujo por GPU (WebGL): cada fotograma sube a la tarjeta gráfica las posiciones de todos los puntos y los pinta
     de UNA vez (gl.POINTS), con el redondeo y la mezcla hechos en la GPU. Se pide la GPU potente (powerPreference).
     Si el navegador no tiene WebGL, se dibuja como antes con canvas 2D. */
  var GL = (function () {
    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false, depth: false, stencil: false }); } catch (e) {}
    if (!gl) return null;
    var prog, loc = {}, buf, datos = new Float32Array(7 * 4096);
    function sombreador(tipo, src) { var s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function montar() {
      prog = gl.createProgram();
      gl.attachShader(prog, sombreador(gl.VERTEX_SHADER,
        'attribute vec2 p; attribute float s; attribute vec4 c; uniform vec2 res; uniform float dpr; varying vec4 vc; varying float vs; varying float ve;' +
        'void main(){ vec2 z = p / res * 2.0 - 1.0; gl_Position = vec4(z.x, -z.y, 0.0, 1.0); ve = s < 0.0 ? 1.0 : 0.0; vs = max(1.0, abs(s) * dpr); gl_PointSize = vs; vc = c; }'));
      // forma del polvo según el tema (tamaño negativo = punto de polvo): 1 píxel, 2 punto suave, 3 estrella, 4 burbuja
      gl.attachShader(prog, sombreador(gl.FRAGMENT_SHADER,
        'precision mediump float; varying vec4 vc; varying float vs; varying float ve; uniform float forma;' +
        'void main(){ float a = vc.a; vec2 d = gl_PointCoord - 0.5; float f = ve > 0.5 ? forma : 0.0;' +
        ' if (f > 0.5 && f < 1.5) { } ' +
        ' else if (f > 1.5 && f < 2.5) { float r = dot(d, d); if (r > 0.25) discard; a *= smoothstep(0.25, 0.0, r); }' +
        ' else if (f > 2.5 && f < 3.5) { vec2 q = abs(d); float cr = max(smoothstep(0.07, 0.0, q.x) * smoothstep(0.5, 0.0, q.y), smoothstep(0.07, 0.0, q.y) * smoothstep(0.5, 0.0, q.x)); a *= max(cr, smoothstep(0.14, 0.0, length(d))); if (a < 0.01) discard; }' +
        ' else if (f > 3.5) { float r = length(d); a *= smoothstep(0.07, 0.0, abs(r - 0.38)) + 0.18 * smoothstep(0.38, 0.0, r); if (r > 0.5 || a < 0.01) discard; }' +
        ' else if (vs > 2.5) { float r = dot(d, d); if (r > 0.25) discard; a *= smoothstep(0.25, 0.14, r); }' +
        ' gl_FragColor = vec4(vc.rgb * a, a); }'));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('enlace');
      ['p', 's', 'c'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
      loc.res = gl.getUniformLocation(prog, 'res'); loc.dpr = gl.getUniformLocation(prog, 'dpr'); loc.forma = gl.getUniformLocation(prog, 'forma');
      buf = gl.createBuffer();
    }
    try { montar(); } catch (e) { return null; }
    var perdido = false;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); perdido = true; });
    canvas.addEventListener('webglcontextrestored', function () { try { montar(); perdido = false; } catch (e) {} });
    return {
      limpiar: function () { if (perdido) return; gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
      reservar: function (n) { if (datos.length < n * 7) datos = new Float32Array(n * 7 * 1.5 | 0); return datos; },
      pintar: function (n, aditivo, w, h, dpr, forma) {
        if (perdido || !n) return;
        gl.useProgram(prog); gl.uniform2f(loc.res, w, h); gl.uniform1f(loc.dpr, dpr); gl.uniform1f(loc.forma, forma || 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, datos.subarray(0, n * 7), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 28, 0);
        gl.enableVertexAttribArray(loc.s); gl.vertexAttribPointer(loc.s, 1, gl.FLOAT, false, 28, 8);
        gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 4, gl.FLOAT, false, 28, 12);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, aditivo ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.POINTS, 0, n);
      }
    };
  })();
  var ctx = GL ? null : canvas.getContext('2d');

  /* ---------- la figura: un sobre, muestreado de un dibujo 2D ---------- */
  var SOBRE = (function () {
    var S = 240, c = doc.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d');
    g.strokeStyle = '#000'; g.lineWidth = 17; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    if (g.roundRect) g.roundRect(32, 58, 176, 124, 16); else g.rect(32, 58, 176, 124);
    g.stroke();
    g.beginPath(); g.moveTo(40, 66); g.lineTo(120, 128); g.lineTo(200, 66); g.stroke();
    var d = g.getImageData(0, 0, S, S).data, pts = [];
    for (var i = 0; i < S * S; i++) if (d[i * 4 + 3] > 120) pts.push((i % S) / S * 2 - 1, Math.floor(i / S) / S * 2 - 1 - 0.0);
    return pts;   // pares x,y en -1..1 (y hacia abajo, como la pantalla)
  })();

  /* ---------- la figura de Mensajes: una burbuja de chat con un auricular dentro (como el icono de WhatsApp) ---------- */
  var TELEFONO = (function () {
    var S = 240, c = doc.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), cx = 122, cy = 112, r = 76, rad = Math.PI / 180;
    g.strokeStyle = '#000'; g.fillStyle = '#000'; g.lineWidth = 16; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, r, 160 * rad, 468 * rad, false); g.lineTo(42, 200); g.closePath(); g.stroke();   // burbuja con cola abajo a la izquierda
    g.lineWidth = 17; g.beginPath(); g.moveTo(98, 86); g.bezierCurveTo(94, 118, 118, 146, 152, 152); g.stroke();   // el auricular
    g.beginPath(); g.arc(98, 84, 11, 0, 6.2832); g.fill(); g.beginPath(); g.arc(154, 152, 11, 0, 6.2832); g.fill();
    var d = g.getImageData(0, 0, S, S).data, pts = [];
    for (var i = 0; i < S * S; i++) if (d[i * 4 + 3] > 120) pts.push((i % S) / S * 2 - 1, Math.floor(i / S) / S * 2 - 1);
    return pts;
  })();
  var PANEL = null, FIG = 'sobre', FIGN = 'sobre';   // el panel vacío que lleva la figura y cuál es (sobre = correo, telefono = Mensajes)

  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(x) { return x * x * (3 - 2 * x); }

  /* tres corrientes (las tres cuentas) que llegan al sobre desde el lado del texto:
     abanico de ±26° alrededor del ángulo de origen */
  function abanico(grados) {
    return [-26, 0, 26].map(function (d) { var a = (grados + d) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; });
  }

  /* ---------- estado ---------- */
  var W = 0, H = 0, DPR = 1;
  var modo = 'none', tema = 'light', dlgAbierto = false;
  var L = null;           // disposición actual: centro, escala, región, huecos
  var N = 0, ND = 0;      // partículas de la figura y de polvo
  var A = {};             // arrays por partícula
  var raf = 0, ultimo = 0, t0 = 0, tForma = 0;
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  var frames = 0, dibujoMs = 0, dibujos = 0;
  var IDX = [], CNT = new Int32Array(6);

  function leerTema() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  // con un tema de Ajustes (data-paleta), los dos colores salen de sus variables --pt-a y --pt-b
  /* cada tema dice cómo es su polvo con variables CSS (tema.css): --pt-forma (pixel/punto/estrella/burbuja),
     --pt-mov (sube/cae/lado/flota), --pt-vel, --pt-dens, --pt-tam, --pt-vaiven y --pt-brillo (cuánto destella, 0-1) */
  var FORMAS = { pixel: 1, punto: 2, estrella: 3, burbuja: 4 };
  var ESTILO0 = { forma: 0, mov: 'sube', vel: 1, dens: 1, tam: 1, vaiven: 1, brillo: 0.94 };
  function leerEstilo(cs) {
    var v = function (n) { return cs.getPropertyValue(n).trim(); }, num = function (n, d) { var x = parseFloat(v(n)); return isFinite(x) ? x : d; };
    var br = num('--pt-brillo', -1);
    return { forma: FORMAS[v('--pt-forma')] || 0, mov: v('--pt-mov') || 'sube', vel: num('--pt-vel', 1), dens: num('--pt-dens', 1), tam: num('--pt-tam', 1),
             vaiven: num('--pt-vaiven', 1), brillo: br < 0 ? 0.94 : 1 - br * 0.8 };
  }
  function claveTema() {
    var base = leerTema(), p = root.getAttribute('data-paleta') || '';
    if (!p) { PAL[base].e = ESTILO0; return base; }
    var k = base + '|' + p;
    if (!PAL[k]) { var cs = getComputedStyle(root), a = cs.getPropertyValue('--pt-a').trim(), b = cs.getPropertyValue('--pt-b').trim(), B = PAL[base];
      PAL[k] = { mezcla: B.mezcla, c: [a || B.c[0], b || B.c[1]], a: B.a, tam: B.tam, e: leerEstilo(cs) }; RGB[k] = PAL[k].c.map(function (s) { return s.split(',').map(function (v) { return +v / 255; }); }); }
    return k;
  }
  function visible(el) { return !!el && !el.hidden && el.getClientRects().length > 0; }
  function rectAmp(r, m) { return { l: r.left - m, t: r.top - m, r: r.right + m, b: r.bottom + m }; }

  function calcularModo() {
    var login = doc.getElementById('login'), app = doc.getElementById('app');
    if (visible(login)) return 'login';
    if (!visible(app)) return 'none';
    // Mensajes: su panel vacío (a la derecha de la lista) lleva el teléfono; el panel de lectura del correo no se ve
    PANEL = null; FIGN = 'sobre';
    var men = doc.querySelector('.men-chat > .empty.tel');
    if (men && visible(men)) { var mp = men.parentNode.getBoundingClientRect(); if (mp.width >= 260 && mp.left < W - 4 && mp.right > 4) { PANEL = men.parentNode; FIGN = 'telefono'; return 'read'; } }
    var read = doc.getElementById('read');
    if (!read) return 'app';
    var empty = read.querySelector(':scope > .empty');
    var icono = empty && empty.querySelector('.halo .ph-envelope-simple-open');
    if (!icono) return 'app';
    var r = read.getBoundingClientRect();
    if (r.width < 260 || r.left >= W - 4 || r.right <= 4) return 'app';
    PANEL = read;
    return 'read';
  }

  function disponer() {
    var movil = W < 900, huecos = [], cx, cy, S, reg, largo, alfa = 1, dens, origen = 180;
    if (modo === 'login') {
      reg = { l: 0, t: 0, r: W, b: H };
      var f = doc.getElementById('loginForm'), fr = f ? f.getBoundingClientRect() : { left: W / 2, right: W / 2, top: H / 2, bottom: H / 2 };
      huecos.push(rectAmp(fr, 14));
      var libreDcha = W - fr.right, libreAbajo = H - fr.bottom;
      if (!movil && libreDcha >= 340) { cx = fr.right + libreDcha * 0.52; cy = H * 0.5; S = Math.min(libreDcha * 0.33, H * 0.3, 260); }
      else if (libreAbajo >= 170) { cx = W / 2; cy = fr.bottom + libreAbajo * 0.55; S = Math.min(W * 0.3, libreAbajo * 0.34, 150); origen = 205; }
      else { cx = W / 2; cy = H - 90; S = 70; alfa = 0.5; origen = 205; }
      largo = 2.2;
      dens = movil ? Math.min(760, Math.max(420, W * H / 440)) : Math.min(2600, Math.max(1000, W * H / 420));
    } else if (modo === 'read') {
      var read = PANEL || doc.getElementById('read'), rr = read.getBoundingClientRect();
      reg = { l: Math.max(0, rr.left), t: Math.max(0, rr.top), r: Math.min(W, rr.right), b: Math.min(H, rr.bottom) };
      var halo = read.querySelector(':scope > .empty .halo'), hr = halo.getBoundingClientRect();
      cx = hr.left + hr.width / 2; cy = hr.top + hr.height / 2;
      S = Math.min((reg.r - reg.l) * 0.16, 92);
      read.querySelectorAll(':scope > .empty h2, :scope > .empty p, :scope > .empty .btn, :scope > .empty .eyebrow').forEach(function (e) { huecos.push(rectAmp(e.getBoundingClientRect(), 10)); });
      largo = 1.6; alfa = 0.85; origen = 180;
      dens = movil ? 420 : Math.min(1300, Math.max(600, (reg.r - reg.l) * (reg.b - reg.t) / 340));
    } else if (modo === 'app') {
      // solo polvo ambiental: el correo abierto queda limpio para leerlo
      var rd = doc.getElementById('read'), rq = rd && rd.getBoundingClientRect();
      if (rq && rq.width > 0 && rq.left < W && rq.right > 0) huecos.push(rectAmp(rq, 0));
      reg = { l: 0, t: 0, r: W, b: H }; cx = W / 2; cy = H / 2; S = 1; largo = 1; dens = 0;
      // en el móvil el panel de lectura vacío no existe: el sobre de partículas va en la cabecera, en el sitio del logo
      if (movil) {
        var lg = [].slice.call(doc.querySelectorAll('.brand .logo-mark')).map(function (e) { return e.getBoundingClientRect(); }).filter(function (r) { return r.width > 0; })[0];
        if (lg) { cx = lg.left + lg.width / 2; cy = lg.top + lg.height / 2 + 1; S = Math.max(16, lg.width * 0.86); largo = 1.25; alfa = 1; origen = 0; dens = 380; }
      }
    } else { L = null; return; }
    // el polvo ocupa toda la pantalla en la app; en el móvil la lista tapa casi todo, así que va a la cabecera, que es donde se ve
    var regD = modo === 'login' ? reg : { l: 0, t: 0, r: W, b: H };
    var nd = modo === 'login' ? dens * 0.12 : (movil ? 110 : Math.min(520, Math.max(220, W * H / 2600)));
    if (modo !== 'login' && movil) {
      var cab = doc.querySelector('.accounts'), cb = cab ? cab.getBoundingClientRect().bottom : 0;
      if (cb > 60 && cb < H * 0.5) { regD = { l: 0, t: 0, r: W, b: cb }; nd = Math.round(Math.min(150, W * cb / 520)); }
    }
    if (modo !== 'login' && movil) nd = Math.max(nd, 120);
    var es = PAL[tema] && PAL[tema].e; if (es && modo !== 'login') nd = Math.min(1600, nd * es.dens);   // cada tema, su densidad de polvo
    L = { cx: cx, cy: cy, S: S, reg: reg, regD: regD, huecos: huecos, largo: largo, alfa: alfa, dirs: abanico(origen), movil: movil && modo !== 'login' };
    var firma = modo + '|' + FIG + '|' + Math.round(dens) + '|' + Math.round(nd) + '|' + (movil ? 1 : 0);
    if (firma !== disponer.firma) { disponer.firma = firma; crear(Math.round(dens), Math.round(nd), movil); }
  }

  function crear(n, nd, movil) {
    N = n; ND = nd; var T = n + nd, r = rng(7 + n);
    A = { tx: new Float32Array(T), ty: new Float32Array(T), tz: new Float32Array(T), sx: new Float32Array(T), sy: new Float32Array(T), sz: new Float32Array(T),
          del: new Float32Array(T), n1: new Float32Array(T), n2: new Float32Array(T), n3: new Float32Array(T), ph: new Float32Array(T), siz: new Float32Array(T),
          kind: new Uint8Array(T), col: new Uint8Array(T), lvl: new Uint8Array(T), str: new Uint8Array(T),
          px: new Float32Array(T), py: new Float32Array(T), ps: new Float32Array(T) };
    var FORMA = FIG === 'telefono' ? TELEFONO : SOBRE, npts = FORMA.length / 2, base = movil ? 1.15 : 1.1;
    for (var i = 0; i < T; i++) {
      var k = i >= n ? 2 : (i % 5 === 0 ? 1 : 0);
      A.kind[i] = k; A.del[i] = r() * 0.35;
      A.n1[i] = r() - 0.5; A.n2[i] = r() - 0.5; A.n3[i] = r() - 0.5; A.ph[i] = r();
      var u = r() * 6.2832, v = Math.acos(r() * 2 - 1), rad = 1.6 + r() * 1.6;
      A.sx[i] = Math.sin(v) * Math.cos(u) * rad; A.sy[i] = Math.cos(v) * rad; A.sz[i] = Math.sin(v) * Math.sin(u) * rad * 0.6;
      A.siz[i] = base + r() * 1.3;
      if (L && L.movil && modo === 'app' && k !== 2) A.siz[i] = 0.75 + r() * 0.8;   // sobre pequeño del logo del móvil: puntos finos
      if (k === 0) {
        var p = Math.floor(r() * npts);
        A.tx[i] = FORMA[p * 2] + (r() - 0.5) / 120; A.ty[i] = FORMA[p * 2 + 1] + (r() - 0.5) / 120; A.tz[i] = (r() - 0.5) * 0.22;
        A.col[i] = r() < 0.86 ? 0 : 1; A.lvl[i] = i % 7 === 0 ? 2 : (r() < 0.55 ? 1 : 2);
      } else if (k === 1) {
        A.str[i] = Math.floor(r() * 3); A.col[i] = r() < 0.68 ? 1 : 0; A.lvl[i] = 1;
      } else {
        A.tx[i] = r(); A.ty[i] = r(); A.ph[i] = 0.004 + r() * 0.01;   // polvo: posición relativa a la región y velocidad
        A.col[i] = r() < 0.5 ? 0 : 1; A.lvl[i] = 0; A.siz[i] = 0.9 + r() * 0.9;
        if (movil && modo !== 'login') {   // móvil: pocos puntos en la cabecera, más visibles y con movimiento real (en px/s, no relativo a la zona)
          A.siz[i] = 1.3 + r() * 1.5; A.lvl[i] = r() < 0.4 ? 1 : 0;
          var alto = L && L.regD ? Math.max(40, L.regD.b - L.regD.t) : 120; A.ph[i] = (7 + r() * 16) / alto;
        }
        A.tz[i] = 0.25 + r() * 0.75;   // profundidad: lo cercano se mueve más con el ratón
        A.n3[i] = 0.25 + r() * 0.5;    // ritmo del destello
      }
    }
    if (!IDX.length || IDX[0].length < T) for (var b = 0; b < 6; b++) IDX[b] = new Int32Array(T);
    else for (var c = 0; c < 6; c++) if (IDX[c].length < T) IDX[c] = new Int32Array(T);
    tForma = performance.now();
  }

  function enHueco(x, y) {
    var h = L.huecos;
    for (var j = 0; j < h.length; j++) if (x > h[j].l && x < h[j].r && y > h[j].t && y < h[j].b) return true;
    return false;
  }

  /* niveles de brillo por color: [rojo, claro] x [tenue, medio, vivo] */
  var PAL = {
    // rojo de marca + azul claro
    dark: { mezcla: 'lighter', c: ['255,40,28', '143,208,255'], a: [[0.22, 0.55, 0.95], [0.18, 0.46, 0.85]] },
    // en claro no hay mezcla aditiva que haga brillar: más opacidad y punto un poco mayor para que el polvo
    // se vea con el mismo detalle que en oscuro
    light: { mezcla: 'source-over', c: ['220,10,6', '43,134,197'], a: [[0.34, 0.58, 0.86], [0.32, 0.52, 0.8]], tam: 1.2 }
  };

  // los mismos colores en 0..1 para la GPU
  var RGB = {}; Object.keys(PAL).forEach(function (k) { RGB[k] = PAL[k].c.map(function (s) { return s.split(',').map(function (v) { return +v / 255; }); }); });
  function dibujar(now, quieto) {
    var t0d = performance.now();
    if (GL) GL.limpiar(); else { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); }
    if (!L) return;
    var t = quieto ? 0 : (now - t0) / 1000;
    var forma = quieto ? 99 : (now - tForma) / 1000 / (modo === 'read' ? 1.1 : 1.6);
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
    var ry = (quieto ? 0 : Math.sin(t * 0.35) * 0.24) + mx * 0.45;
    var rx = (quieto ? 0 : Math.sin(t * 0.27) * 0.08) + my * 0.22;
    var cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx);
    var D = 4.2, S = L.S, cx = L.cx, cy = L.cy, reg = L.reg, largo = L.largo, rd = L.regD, w = rd.r - rd.l, hh = rd.b - rd.t;
    var T = N + ND, b, i, E = (PAL[tema] && PAL[tema].e) || ESTILO0;
    for (b = 0; b < 6; b++) CNT[b] = 0;
    for (i = 0; i < T; i++) {
      var k = A.kind[i], X, Y, s, lvl = A.lvl[i];
      if (k === 2) {
        var tt = (mqReduce.matches ? t * 0.4 : t) * E.vel;   // con «reducir movimiento», el polvo flota más despacio (no se para)
        var sw = Math.sin(tt * (L.movil ? 0.7 : 0.2) + i) * (L.movil ? 0.03 : 0.01) * E.vaiven, fx, fy;
        if (E.mov === 'cae') { fx = A.tx[i] + sw; fy = (A.ty[i] + tt * A.ph[i]) % 1; }
        else if (E.mov === 'lado') { fx = (A.tx[i] + tt * A.ph[i] * 1.4) % 1; fy = A.ty[i] + Math.sin(tt * 0.5 + i * 1.3) * 0.012 * E.vaiven; }
        else if (E.mov === 'flota') { fx = A.tx[i] + Math.sin(tt * 0.31 + i) * 0.02 * E.vaiven; fy = A.ty[i] + Math.cos(tt * 0.23 + i * 1.7) * 0.02 * E.vaiven; }
        else { fx = A.tx[i] + sw; fy = (A.ty[i] - tt * A.ph[i]) % 1; }
        if ((E.mov === 'sube' || E.mov === 'cae' || !E.mov) && fy < 0) fy += 1;   // solo dan la vuelta los que recorren la pantalla; los que flotan se quedan en su sitio
        X = rd.l + fx * w - mx * 36 * A.tz[i]; Y = rd.t + fy * hh - my * 24 * A.tz[i]; s = A.siz[i] * (0.8 + A.tz[i] * 0.4) * E.tam;
        if (!quieto) { var sv = Math.sin(t * A.n3[i] * 2.4 + i * 1.7); if (sv > E.brillo) lvl = E.brillo < 0.9 && sv > 1 - (1 - E.brillo) * 0.35 ? 2 : 1; }   // destello de vez en cuando
        if (X < rd.l || X > rd.r || Y < rd.t || Y > rd.b || enHueco(X, Y)) continue;
        A.px[i] = X; A.py[i] = Y; A.ps[i] = s / 2;
        b = A.col[i] * 3 + lvl; IDX[b][CNT[b]++] = i;
        continue;
      } else {
        var x, y, z;
        if (k === 1) {
          var q = quieto ? A.ph[i] : 1 - ((t * 0.2 + A.ph[i]) % 1), d = L.dirs[A.str[i]];
          var dist = 0.15 + q * largo, lat = A.n1[i] * 0.22 * (0.25 + q);
          x = d[0] * dist - d[1] * lat; y = d[1] * dist + d[0] * lat; z = A.n2[i] * 0.35 * q;
          lvl = q > 0.7 ? 0 : (q > 0.35 ? 1 : 2);
        } else {
          x = A.tx[i] + (quieto ? 0 : Math.sin(t * 1.3 + i) * 0.01); y = A.ty[i] + (quieto ? 0 : Math.cos(t * 1.1 + i * 0.7) * 0.01); z = A.tz[i];
        }
        if (forma < 1.6) {
          var e = smooth(clamp((forma - A.del[i]) / 0.65, 0, 1)), rem = Math.sin(Math.PI * e) * 0.9;
          x = A.sx[i] + (x - A.sx[i]) * e + A.n1[i] * rem; y = A.sy[i] + (y - A.sy[i]) * e + A.n2[i] * rem; z = A.sz[i] + (z - A.sz[i]) * e + A.n3[i] * rem;
        }
        var x1 = x * cyr - z * syr, z1 = x * syr + z * cyr, y1 = y * cxr - z1 * sxr, z2 = y * sxr + z1 * cxr;
        var f = D / (D - z2);
        X = cx + x1 * S * f; Y = cy + y1 * S * f; s = A.siz[i] * f;
      }
      if (X < reg.l || X > reg.r || Y < reg.t || Y > reg.b) continue;
      if (enHueco(X, Y)) continue;
      A.px[i] = X; A.py[i] = Y; A.ps[i] = s / 2;
      b = A.col[i] * 3 + lvl; IDX[b][CNT[b]++] = i;
    }
    var pal = PAL[tema];
    if (GL) {   // GPU: todos los puntos en un único envío y una única orden de dibujo
      var total = 0; for (b = 0; b < 6; b++) total += CNT[b];
      var D7 = GL.reservar(total), o = 0, tm = 2.3 * (pal.tam || 1);
      for (b = 0; b < 6; b++) {
        var nb = CNT[b]; if (!nb) continue;
        var cb = b < 3 ? 0 : 1, rgb = RGB[tema][cb], al = pal.a[cb][b % 3] * L.alfa, ixb = IDX[b];
        for (var jj = 0; jj < nb; jj++) { var pp = ixb[jj]; D7[o++] = A.px[pp]; D7[o++] = A.py[pp]; D7[o++] = A.ps[pp] * tm * (E.forma && A.kind[pp] === 2 ? -1 : 1); D7[o++] = rgb[0]; D7[o++] = rgb[1]; D7[o++] = rgb[2]; D7[o++] = al; }
      }
      GL.pintar(total, pal.mezcla === 'lighter', BW || W, BH || H, DPR, E.forma);
      var msg = performance.now() - t0d; dibujoMs = dibujos ? dibujoMs * 0.9 + msg * 0.1 : msg; dibujos++;
      return;
    }
    ctx.globalCompositeOperation = pal.mezcla;
    for (b = 0; b < 6; b++) {
      var n = CNT[b]; if (!n) continue;
      var col = b < 3 ? 0 : 1, lv = b % 3;
      ctx.fillStyle = 'rgba(' + pal.c[col] + ',' + (pal.a[col][lv] * L.alfa).toFixed(3) + ')';
      ctx.beginPath();
      var ix = IDX[b];
      // puntos pequeños como cuadraditos (a este tamaño no se distinguen de un círculo y cuestan mucho menos); los grandes, círculo
      for (var j = 0; j < n; j++) { var p = ix[j], rr = A.ps[p] * (pal.tam || 1); if (rr < 1.05 || (E.forma === 1 && A.kind[p] === 2)) ctx.rect(A.px[p] - rr, A.py[p] - rr, rr * 2, rr * 2); else { ctx.moveTo(A.px[p] + rr, A.py[p]); ctx.arc(A.px[p], A.py[p], rr, 0, 6.2832); } }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    var ms = performance.now() - t0d;
    dibujoMs = dibujos ? dibujoMs * 0.9 + ms * 0.1 : ms; dibujos++;
  }

  /* ---------- bucle ---------- */
  // con «reducir movimiento» solo sigue el polvo de la app (lento); el sobre y los vuelos se quedan quietos
  function corriendo() { return modo !== 'none' && (!mqReduce.matches || modo === 'app') && !doc.hidden && !dlgAbierto; }
  var pausaHasta = 0;   // (sin uso: la animación ya no se pausa nunca)
  // solo en el móvil (con el dedo): al desplazar o tocar, las partículas ceden el paso un instante. Con ratón no se paran
  // (se notaba como un parón en cada clic sobre el sobre del panel derecho)
  // (antes se paraba al desplazar y al tocar: se notaba «pillada». Ya no)
  function tick(now) {
    raf = 0;
    if (!corriendo()) return;
    raf = requestAnimationFrame(tick);
    // ~60 fps siempre y SIN pausas: la animación nunca se para por lo que hagas (clics, desplazar, avisos, cambios de pantalla)
    if (now - ultimo < 14) return;
    ultimo = now; frames++;
    dibujar(now, false);
  }
  function arrancar() { if (!raf) { ultimo = 0; raf = requestAnimationFrame(tick); } }
  function parar() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function medir() {
    W = window.innerWidth; H = window.innerHeight;
    // puntos de 1-2 px: no hace falta la resolución completa de la pantalla, y así cada fotograma mueve muchos menos píxeles
    DPR = Math.min(window.devicePixelRatio || 1, W < 900 ? 1.5 : 1.25);
  }
  // El lienzo solo mide lo que se dibuja: en el móvil (solo polvo en la cabecera) es la franja de arriba, no la pantalla entera
  var BW = 0, BH = 0;
  function ajustarLienzo() {
    BW = W; BH = (L && L.movil && modo === 'app') ? Math.max(1, Math.ceil(L.regD.b)) : H;
    var cw = Math.round(BW * DPR), ch = Math.round(BH * DPR);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    canvas.style.width = BW + 'px'; canvas.style.height = BH + 'px';
  }

  var pendiente = 0;
  function actualizar(rehacer) {
    pendiente = 0;
    if (!canvas.isConnected) doc.body.insertBefore(canvas, doc.body.firstChild);
    medir();
    tema = claveTema();
    var dlg = doc.getElementById('dlg'); dlgAbierto = !!(dlg && dlg.open && dlg.matches(':modal'));
    var m = calcularModo();
    if (m === 'read') { if (FIGN !== FIG) { FIG = FIGN; rehacer = true; } } else if (FIG !== 'sobre') { FIG = 'sobre'; rehacer = true; }
    if (m !== modo || rehacer) { modo = m; disponer(); }
    ajustarLienzo();
    var hay = modo !== 'none';
    canvas.style.visibility = hay ? 'visible' : 'hidden';
    root.classList.toggle('particulas-sobre', modo === 'read');
    root.classList.toggle('particulas-logo', modo === 'app' && !!(L && L.movil && N > 0));   // móvil: el logo pasa a ser el sobre de partículas
    if (!hay) { parar(); if (GL) GL.limpiar(); else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } return; }
    if (corriendo()) arrancar();
    else { parar(); if (!dlgAbierto) dibujar(performance.now(), true); }
  }
  function programar(rehacer) {
    if (rehacer) programar.rehacer = true;
    if (pendiente) return;
    pendiente = requestAnimationFrame(function () { var r = programar.rehacer; programar.rehacer = false; actualizar(r); });
    // con la pestaña oculta rAF no corre: el siguiente visibilitychange lo pondrá al día
  }

  /* barra del navegador del móvil a juego con el tema */
  function colorBarra() {
    var m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || (leerTema() === 'dark' ? '#07080b' : '#ffffff'));
  }

  function iniciar() {
    t0 = performance.now();
    var mo = new MutationObserver(function (lista) {
      var rehacer = false;
      for (var i = 0; i < lista.length; i++) {
        var r = lista[i];
        if (r.target === root && (r.attributeName === 'data-theme' || r.attributeName === 'data-paleta')) { colorBarra(); rehacer = true; }   // otro tema = otra densidad de polvo
        if (r.type === 'childList' || r.attributeName === 'hidden') rehacer = true;
      }
      programar(rehacer);
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-paleta'] });
    ['login', 'app'].forEach(function (id) { var e = doc.getElementById(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['hidden'] }); });
    var dlg = doc.getElementById('dlg'); if (dlg) mo.observe(dlg, { attributes: true, attributeFilter: ['open'] });
    var read = doc.getElementById('read'); if (read) mo.observe(read, { childList: true, attributes: true, attributeFilter: ['class'] });
    var pwBox = doc.getElementById('pwBox'); if (pwBox) mo.observe(pwBox, { attributes: true, attributeFilter: ['hidden'] });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { programar(true); });
      ['read', 'loginForm'].forEach(function (id) { var e = doc.getElementById(id); if (e) ro.observe(e); });
    }
    window.addEventListener('resize', function () { programar(true); }, { passive: true });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) parar(); else actualizar(false); });
    var cambioMov = function () { programar(true); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', cambioMov); else if (mqReduce.addListener) mqReduce.addListener(cambioMov);
    // la animación no reacciona al ratón: va sola, siempre igual
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { programar(true); });
    colorBarra();
    actualizar(true);
  }

  /* ---------- vuelos: estelas de partículas cuando pasa algo (enviar, correo nuevo) ---------- */
  var fx = null, fctx = null, FX = [], fxRaf = 0, fxD = 1, vuelos = 0;
  /* El lienzo del vuelo mide solo la caja por donde pasan las partículas (no la pantalla entera):
     pocos píxeles que limpiar y componer en cada fotograma = fluido también en móviles y portátiles flojos. */
  var fxBox = null;   // { l, t, r, b } en px de pantalla
  function fxPreparar(caja) {
    if (!fx) {
      fx = doc.createElement('canvas'); fx.setAttribute('aria-hidden', 'true');
      fx.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;display:block;will-change:transform';
      fctx = fx.getContext('2d');
    }
    if (!fx.isConnected) doc.body.appendChild(fx);
    var W0 = window.innerWidth, H0 = window.innerHeight;
    var b = FX.length && fxBox ? { l: Math.min(fxBox.l, caja.l), t: Math.min(fxBox.t, caja.t), r: Math.max(fxBox.r, caja.r), b: Math.max(fxBox.b, caja.b) } : caja;
    b = { l: Math.max(0, Math.floor(b.l)), t: Math.max(0, Math.floor(b.t)), r: Math.min(W0, Math.ceil(b.r)), b: Math.min(H0, Math.ceil(b.b)) };
    fxBox = b;
    fxD = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, b.r - b.l), h = Math.max(1, b.b - b.t), cw = Math.round(w * fxD), ch = Math.round(h * fxD);
    if (fx.width !== cw || fx.height !== ch) { fx.width = cw; fx.height = ch; }
    fx.style.width = w + 'px'; fx.style.height = h + 'px'; fx.style.transform = 'translate(' + b.l + 'px,' + b.t + 'px)';
  }
  function centro(r) { return r && r.width !== undefined ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : r; }
  function bez(a, b, c, d, t) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function vuelo(desde, hacia, tipo) {
    if (mqReduce.matches || doc.hidden || !desde) return;
    var a = centro(desde), z = centro(hacia), r = rng(Date.now() & 0xffff), ahora = performance.now(), nuevos = [];
    var FX0 = FX; FX = nuevos;   // se generan aparte para medir su caja
    var W2 = window.innerWidth, llegada = tipo === 'llegada' && z, movil = W2 < 900;
    var archivo = /^archivo/.test(tipo);   // al archivar deslizando: chispas que salen hacia el lado del gesto
    var n = archivo ? (movil ? 70 : 110) : llegada ? (movil ? 160 : 280) : (movil ? 150 : 240), dur = archivo ? 650 : llegada ? 1150 : 1000;
    for (var i = 0; i < n; i++) {
      var sx = a.x + (r() - 0.5) * (a.w || 40) * 0.9, sy = a.y + (r() - 0.5) * (a.h || 30) * 0.8;
      var ang = r() * 6.2832, emp = 30 + r() * 120, ex, ey, c2x, c2y;
      if (archivo) { var dir = tipo === 'archivo-izq' ? -1 : 1; ex = a.x + dir * (a.w * 0.55 + 60 + r() * 180); ey = sy + (r() - 0.5) * 120; c2x = a.x + dir * (a.w * 0.35 + r() * 80); c2y = sy + (r() - 0.5) * 60; }
      else if (llegada) { ex = z.x + (r() - 0.5) * 8; ey = z.y + (r() - 0.5) * 8; c2x = ex + (r() - 0.5) * 220; c2y = ey + 70 + r() * 140; }
      else { ex = W2 + 40 + r() * 160; ey = -40 - r() * 220; c2x = ex - 260 - r() * 200; c2y = ey + 180 + r() * 160; }
      FX.push({ x0: sx, y0: sy, x1: sx + Math.cos(ang) * emp, y1: sy + Math.sin(ang) * emp * 0.7, x2: c2x, y2: c2y, x3: ex, y3: ey,
                t0: ahora + r() * dur * 0.3, d: dur * (0.72 + r() * 0.42), s: 0.9 + r() * 1.6, c: r() < 0.62 ? 0 : 1, fin: llegada,
                giro: llegada ? (r() < 0.5 ? -1 : 1) * (2 + r() * 3) : 0, radio: llegada ? 6 + r() * 22 : 0 });   // remolino suave al acercarse
    }
    if (llegada) { FX.push({ anillo: true, x: z.x, y: z.y, t0: ahora + dur * 0.9, d: 560, c: 0, r: 26 }); FX.push({ anillo: true, x: z.x, y: z.y, t0: ahora + dur * 1.02, d: 620, c: 1, r: 38 }); }
    // caja: todos los puntos de control (la curva no sale de ellos) + remolino, anillos y brillo
    var cj = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
    nuevos.forEach(function (p) {
      var xs = p.anillo ? [p.x - 70, p.x + 70] : [p.x0, p.x1, p.x2, p.x3], ys = p.anillo ? [p.y - 70, p.y + 70] : [p.y0, p.y1, p.y2, p.y3], m = p.anillo ? 0 : 20 + (p.radio || 0);
      xs.forEach(function (v) { cj.l = Math.min(cj.l, v - m); cj.r = Math.max(cj.r, v + m); });
      ys.forEach(function (v) { cj.t = Math.min(cj.t, v - m); cj.b = Math.max(cj.b, v + m); });
    });
    FX = FX0;
    fxPreparar(cj);
    FX = FX0.concat(nuevos);
    vuelos++;
    if (!fxRaf) fxRaf = requestAnimationFrame(fxTick);
  }
  /* Rendimiento: cada partícula es un «sello» con brillo ya pintado (un canvas pequeño por color),
     así cada fotograma solo hace drawImage con globalAlpha: sin rutas, sin cadenas de color, sin degradados. */
  var SELLOS = null, sellosTema = '';
  function sellos(pal, tema) {
    if (SELLOS && sellosTema === tema) return SELLOS;
    SELLOS = pal.c.map(function (rgb) {
      var c = doc.createElement('canvas'), R = 16; c.width = c.height = R * 2; var g = c.getContext('2d');
      var gr = g.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.22, 'rgba(' + rgb + ',0.95)'); gr.addColorStop(0.45, 'rgba(' + rgb + ',0.32)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2); return c;
    });
    sellosTema = tema; return SELLOS;
  }
  var fxMs = 0, fxFrames = 0;
  function fxTick(now) {
    fxRaf = 0; var tq = performance.now(); fxFrames++;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, fx.width, fx.height);
    fctx.setTransform(fxD, 0, 0, fxD, -fxBox.l * fxD, -fxBox.t * fxD);   // se dibuja en coordenadas de pantalla
    var tema = claveTema(), pal = PAL[tema], S = sellos(pal, tema), vivos = [];
    fctx.globalCompositeOperation = pal.mezcla;
    for (var i = 0; i < FX.length; i++) {
      var p = FX[i], q = (now - p.t0) / p.d;
      if (q >= 1) continue;
      vivos.push(p);
      if (q < 0) continue;
      if (p.anillo) {   // al llegar, un anillo se abre en la foto de la cuenta
        var e = 1 - Math.pow(1 - q, 3);
        fctx.globalAlpha = 0.8 * (1 - q); fctx.strokeStyle = 'rgb(' + pal.c[p.c || 0] + ')'; fctx.lineWidth = 2 * (1 - q) + 0.5;
        fctx.beginPath(); fctx.arc(p.x, p.y, 10 + e * (p.r || 26), 0, 6.2832); fctx.stroke();
        continue;
      }
      var al = Math.min(1, q * 6) * (1 - smooth(clamp((q - (p.fin ? 0.84 : 0.6)) / (p.fin ? 0.16 : 0.4), 0, 1)));
      var sz = p.s * 2.6 * (p.fin ? 1 - q * 0.4 : 1), sp = S[p.c];
      // cola: tres sellos detrás, cada vez más pequeños y tenues (estela suave, no raya)
      for (var k = 3; k >= 0; k--) {
        var ek = inOut(Math.max(0, q - k * 0.012));
        var x = bez(p.x0, p.x1, p.x2, p.x3, ek), y = bez(p.y0, p.y1, p.y2, p.y3, ek);
        if (p.giro) { var ang = (1 - ek) * p.giro, rr = Math.sin(ek * Math.PI) * p.radio; x += Math.cos(ang) * rr; y += Math.sin(ang) * rr; }
        var f = 1 - k * 0.24, s2 = sz * f;
        fctx.globalAlpha = al * (k ? 0.28 * f : 0.95);
        fctx.drawImage(sp, x - s2 / 2, y - s2 / 2, s2, s2);
      }
    }
    fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
    fxMs = fxMs * 0.9 + (performance.now() - tq) * 0.1;
    FX = vivos;
    if (FX.length) fxRaf = requestAnimationFrame(fxTick);
    else { fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fx.width, fx.height); fx.width = fx.height = 1; fxBox = null; }
  }

  window.__particulas = {
    vuelo: vuelo,
    refrescar: function () { programar(true); },
    pausa: function () {},   // ya no pausa nada (se mantiene para no romper a quien la llame)
    estado: function () { return { modo: modo, tema: tema, figura: N, polvo: ND, total: N + ND, corriendo: !!raf, frames: frames, dibujoMs: +dibujoMs.toFixed(2), reducido: mqReduce.matches, dpr: DPR, vuelos: vuelos, vivos: FX.length, gpu: !!GL, vueloMs: +fxMs.toFixed(2), vueloFrames: fxFrames }; }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
