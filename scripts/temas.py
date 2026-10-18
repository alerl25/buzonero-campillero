# Genera los 12 temas de Buzonero y los coloca en la app: colores (con contraste WCAG comprobado) y PERSONALIDAD
# (letra, esquinas, textura de fondo y partículas). Paletas propias, inspiradas en lenguajes de la biblioteca design-md
# (solo la idea, sin marcas).
# Uso: python scripts/temas.py app      (reescribe el bloque de temas de app/tema.css y la línea «var TEMAS» de app/index.html)
import json, sys, re

def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def lum(h):
    def c(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(h); return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def mezcla(a, b, t):   # a hacia b, t = parte de b
    ra, rb = rgb(a), rgb(b); return '#' + ''.join('%02x' % round(x + (y - x) * t) for x, y in zip(ra, rb))

# id, nombre, base, inspiración, colores clave
T = [
  # ---------- claros ----------
  dict(id='papel', nombre='Papel', base='light', idea='editorial cálido, tinta y terracota',
       bg='#f8f5ee', surface='#efe9dd', surface2='#e6dfd0', text='#2a2420', mute='#5c534b', faint='#7a7066',
       acc='#b4532a', accInk='#ffffff', spark='#5f7f6b', vivo='#d0612f'),
  dict(id='menta', nombre='Menta', base='light', idea='verde fresco sobre blanco',
       bg='#f7fbf9', surface='#ecf5f0', surface2='#dfeee6', text='#0f1f18', mute='#3f5a4d', faint='#5d7468',
       acc='#0b7a52', accInk='#ffffff', spark='#2f7fbf', vivo='#12a06d'),
  dict(id='lavanda', nombre='Lavanda', base='light', idea='lila callado de producto',
       bg='#f9f8fe', surface='#f0eefb', surface2='#e5e2f7', text='#17152b', mute='#4b4868', faint='#69668a',
       acc='#5b4ed8', accInk='#ffffff', spark='#c2588f', vivo='#7468f0'),
  dict(id='cielo', nombre='Cielo', base='light', idea='azul institucional y limpio',
       bg='#f6f9fd', surface='#ebf2fa', surface2='#dde8f5', text='#0d1b2e', mute='#3d5068', faint='#5b6d84',
       acc='#0b5fc0', accInk='#ffffff', spark='#0f9d8a', vivo='#1f7ae0'),
  dict(id='limon', nombre='Limón', base='light', idea='amarillo de pizarra sobre blanco roto',
       bg='#fffdf6', surface='#f8f3e2', surface2='#efe7cc', text='#1f1b0e', mute='#544c33', faint='#716851',
       acc='#e8b100', accInk='#1f1b0e', accText='#8a6400', spark='#3a6fd8', vivo='#f5c400'),
  dict(id='rosa', nombre='Cerezo', base='light', idea='rosa cerezo, suave',
       bg='#fff8fa', surface='#fbedf1', surface2='#f5dfe6', text='#2a1219', mute='#5f4048', faint='#7e5f67',
       acc='#c9326b', accInk='#ffffff', spark='#7a5bd0', vivo='#e0457f'),
  # ---------- oscuros ----------
  dict(id='medianoche', nombre='Medianoche', base='dark', idea='casi negro con lavanda',
       bg='#08090f', surface='#10121b', surface2='#181b27', text='#eef0fa', mute='#b5b9cf', faint='#8a8fa8',
       acc='#5f55e6', accInk='#ffffff', accText='#a39dff', spark='#5ec8ff', vivo='#9a93ff'),
  dict(id='bosque', nombre='Bosque', base='dark', idea='esmeralda sobre verde muy oscuro',
       bg='#07110d', surface='#0d1a14', surface2='#14241c', text='#e9f5ee', mute='#aac4b6', faint='#7f9a8c',
       acc='#2fd08b', accInk='#05140d', accText='#4fe0a0', spark='#e8c46a', vivo='#3ee39a'),
  dict(id='grafito', nombre='Grafito', base='dark', idea='blanco y negro de precisión',
       bg='#0a0a0a', surface='#141414', surface2='#1d1d1d', text='#f2f2f2', mute='#b4b4b4', faint='#8a8a8a',
       acc='#ededed', accInk='#0a0a0a', accText='#ffffff', spark='#8a8a8a', vivo='#ffffff'),
  dict(id='ambar', nombre='Ámbar', base='dark', idea='oro de terminal sobre negro cálido',
       bg='#0e0c07', surface='#18140b', surface2='#221c10', text='#f7f0e1', mute='#c9bc9f', faint='#9a8e75',
       acc='#f2b01e', accInk='#140f02', accText='#f7c24a', spark='#e46a3a', vivo='#ffc433'),
  dict(id='neon', nombre='Neón', base='dark', idea='noche morada con rosa y cian',
       bg='#0f0a1a', surface='#171127', surface2='#211936', text='#f5effd', mute='#c4b6dc', faint='#9586b0',
       acc='#ff4fa3', accInk='#1a0410', accText='#ff7dbb', spark='#39d7e8', vivo='#ff5cae'),
  dict(id='abismo', nombre='Abismo', base='dark', idea='azul de fondo marino con turquesa',
       bg='#05111a', surface='#0a1b27', surface2='#112634', text='#e6f3fa', mute='#a3c0cf', faint='#7894a4',
       acc='#22b8cf', accInk='#03131a', accText='#4fd0e3', spark='#f08a5d', vivo='#33cde3'),
]

# ---------- personalidad de cada tema ----------
# f: familias de Google Fonts · cuerpo / titulo: font-family · r: esquinas [pequeña, normal, grande, botón]
# pt: partículas (forma pixel/punto/estrella/burbuja · mov sube/cae/lado/flota · vel · dens · tam · vaiven · brillo 0-1)
# nota: lo que se lee en el selector · css: reglas propias ({R} = el selector del tema)
def ruido(r, g, b, a, freq='.85'):
    return ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E"
            "%3CfeTurbulence type='fractalNoise' baseFrequency='" + freq + "' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 "
            + '%.3f 0 0 0 0 %.3f 0 0 0 0 %.3f 0 0 0 %s 0' % (r / 255, g / 255, b / 255, a) +
            "'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")")
SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace'
P = {
  'papel': dict(f='Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,500&family=Source+Sans+3:wght@400;500;600',
    cuerpo='"Source Sans 3", ' + SANS, titulo='"Newsreader", Georgia, serif', r=(3, 5, 8, 5),
    pt=dict(forma='punto', mov='sube', vel=.55, dens=.8, tam=1.25, vaiven=1.4, brillo=0), nota='Serif de periódico · grano de papel · motas de tinta',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:500; letter-spacing:-.012em; }
{R} .empty h2 em { font-style:italic; }
{R} body::before { background:''' + ruido(42, 36, 32, '.32') + ''', radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(120,90,60,.10)); }'''),
  'menta': dict(f='Nunito:wght@400;500;600;700;800', cuerpo='"Nunito", ' + SANS, titulo='"Nunito", ' + SANS, r=(12, 18, 26, 999),
    pt=dict(forma='punto', mov='lado', vel=1.3, dens=1, tam=1.3, vaiven=1.6, brillo=.2), nota='Redonda y amable · rayas de brisa · polvo que viaja de lado',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:800; letter-spacing:-.02em; }
{R} body::before { background:repeating-linear-gradient(-35deg, rgba(11,122,82,.035) 0 2px, transparent 2px 16px), radial-gradient(55% 45% at 85% 10%, rgba(47,127,191,.10), transparent 70%), radial-gradient(60% 50% at 5% 95%, rgba(11,122,82,.10), transparent 70%); }'''),
  'lavanda': dict(f='Plus+Jakarta+Sans:wght@400;500;600;700', cuerpo='"Plus Jakarta Sans", ' + SANS, titulo='"Plus Jakarta Sans", ' + SANS, r=(10, 14, 20, 999),
    pt=dict(forma='estrella', mov='sube', vel=.35, dens=.55, tam=2.4, vaiven=.6, brillo=.8), nota='Geométrica de producto · aurora · destellos',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:700; letter-spacing:-.03em; }
{R} body::before { background:radial-gradient(40% 35% at 12% 6%, rgba(91,78,216,.22), transparent 70%), radial-gradient(35% 30% at 92% 12%, rgba(194,88,143,.18), transparent 70%), radial-gradient(45% 35% at 60% 100%, rgba(116,104,240,.12), transparent 70%); filter:blur(30px); }'''),
  'cielo': dict(f='IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500', cuerpo='"IBM Plex Sans", ' + SANS, titulo='"IBM Plex Sans", ' + SANS,
    mono='"IBM Plex Mono", ' + MONO, label='"IBM Plex Mono", ' + MONO, r=(2, 4, 6, 4),
    pt=dict(forma='pixel', mov='sube', vel=1.5, dens=1.3, tam=1.2, vaiven=0, brillo=.3), nota='Plex de ingeniería · cuadrícula de plano · datos que suben',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:600; letter-spacing:-.015em; }
{R} body::before { background:linear-gradient(rgba(11,95,192,.09) 1px, transparent 1px) 0 0/120px 120px, linear-gradient(90deg, rgba(11,95,192,.09) 1px, transparent 1px) 0 0/120px 120px, linear-gradient(rgba(11,95,192,.045) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, rgba(11,95,192,.045) 1px, transparent 1px) 0 0/24px 24px; -webkit-mask-image:linear-gradient(to bottom, #000, rgba(0,0,0,.25)); mask-image:linear-gradient(to bottom, #000, rgba(0,0,0,.25)); }'''),
  'limon': dict(f='Space+Grotesk:wght@400;500;600;700', cuerpo='"Space Grotesk", ' + SANS, titulo='"Space Grotesk", ' + SANS, r=(0, 0, 0, 0),
    pt=dict(forma='pixel', mov='cae', vel=1.4, dens=.7, tam=1.9, vaiven=2.6, brillo=.2), nota='Grotesca rotunda · esquinas rectas y sombra dura · confeti',
    vars={'--shadow': '3px 3px 0 rgba(31,27,14,.9)', '--shadow-lg': '6px 6px 0 rgba(31,27,14,.92)', '--bloom': '3px 3px 0 #1f1b0e'},
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:700; letter-spacing:-.035em; }
{R} body::before { background:radial-gradient(rgba(31,27,14,.10) 1px, transparent 1.6px) 0 0/16px 16px; -webkit-mask-image:linear-gradient(120deg, #000, rgba(0,0,0,.2) 70%); mask-image:linear-gradient(120deg, #000, rgba(0,0,0,.2) 70%); }'''),
  'rosa': dict(f='DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Serif+Display:ital@0;1', cuerpo='"DM Sans", ' + SANS, titulo='"DM Serif Display", Georgia, serif',
    r=(14, 20, 28, 999), pt=dict(forma='punto', mov='cae', vel=.6, dens=.45, tam=2.2, vaiven=3.2, brillo=.1), nota='Serif de revista · rubor · pétalos que caen',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:400; letter-spacing:-.005em; }
{R} .empty h2 em { font-style:italic; }
{R} body::before { background:radial-gradient(50% 40% at 100% 100%, rgba(201,50,107,.13), transparent 70%), radial-gradient(40% 35% at 0% 0%, rgba(122,91,208,.09), transparent 70%), ''' + ruido(201, 50, 107, '.10') + '''; }'''),
  'medianoche': dict(f='Sora:wght@400;500;600', cuerpo='"Sora", ' + SANS, titulo='"Sora", ' + SANS, r=(12, 16, 22, 999),
    pt=dict(forma='estrella', mov='flota', vel=.4, dens=1.1, tam=2.2, vaiven=.4, brillo=.9), nota='Sora espacial · cielo estrellado · estrellas que titilan',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:600; letter-spacing:-.03em; }
{R} body::before { background:radial-gradient(1px 1px at 20px 30px, rgba(238,240,250,.55), transparent), radial-gradient(1px 1px at 140px 90px, rgba(238,240,250,.4), transparent), radial-gradient(1.5px 1.5px at 90px 170px, rgba(154,147,255,.6), transparent), radial-gradient(1px 1px at 200px 220px, rgba(94,200,255,.45), transparent) 0 0/260px 260px, radial-gradient(60% 50% at 75% 20%, rgba(95,85,230,.16), transparent 70%), radial-gradient(50% 40% at 10% 90%, rgba(94,200,255,.07), transparent 70%); }'''),
  'bosque': dict(f='Figtree:wght@400;500;600&family=Outfit:wght@500;600', cuerpo='"Figtree", ' + SANS, titulo='"Outfit", ' + SANS, r=(10, 14, 18, 999),
    pt=dict(forma='punto', mov='flota', vel=.7, dens=.35, tam=2.6, vaiven=1.8, brillo=1), nota='Outfit natural · niebla entre árboles · luciérnagas',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:600; letter-spacing:-.025em; }
{R} body::before { background:linear-gradient(to top, rgba(47,208,139,.10), transparent 45%), repeating-linear-gradient(100deg, transparent 0 140px, rgba(232,196,106,.025) 140px 190px, transparent 190px 320px), radial-gradient(70% 50% at 50% 0%, rgba(47,208,139,.07), transparent 70%); }'''),
  'grafito': dict(f='Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500', cuerpo='"Inter Tight", ' + SANS, titulo='"JetBrains Mono", ' + MONO,
    mono='"JetBrains Mono", ' + MONO, label='"JetBrains Mono", ' + MONO, r=(0, 2, 2, 2),
    pt=dict(forma='pixel', mov='sube', vel=.7, dens=1, tam=1, vaiven=0, brillo=0), nota='Mono de precisión · rejilla de puntos · píxeles',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:500; letter-spacing:-.045em; }
{R} body::before { background:radial-gradient(rgba(255,255,255,.075) 1px, transparent 1.2px) 0 0/22px 22px; -webkit-mask-image:radial-gradient(90% 80% at 50% 30%, #000, rgba(0,0,0,.3)); mask-image:radial-gradient(90% 80% at 50% 30%, #000, rgba(0,0,0,.3)); }'''),
  'ambar': dict(f='IBM+Plex+Sans:wght@400;500;600&family=Space+Mono:wght@400;700', cuerpo='"IBM Plex Sans", ' + SANS, titulo='"Space Mono", ' + MONO,
    mono='"Space Mono", ' + MONO, label='"Space Mono", ' + MONO, r=(2, 3, 4, 3),
    pt=dict(forma='pixel', mov='sube', vel=2.2, dens=1.1, tam=1.1, vaiven=1.6, brillo=.7), nota='Terminal antigua · líneas de monitor · chispas',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:700; letter-spacing:-.03em; text-shadow:0 0 18px rgba(242,176,30,.35); }
{R} body::before { background:repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px), radial-gradient(120% 90% at 50% 45%, rgba(242,176,30,.05), rgba(0,0,0,.45)); }'''),
  'neon': dict(f='Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600', cuerpo='"Manrope", ' + SANS, titulo='"Unbounded", ' + SANS, r=(14, 18, 24, 999),
    pt=dict(forma='punto', mov='sube', vel=1.6, dens=1.2, tam=1.6, vaiven=1.2, brillo=.6), nota='Unbounded de neón · rejilla retro en el horizonte · luces',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:600; letter-spacing:-.035em; text-shadow:0 0 22px rgba(255,79,163,.35); }
{R} body::before { top:58%; bottom:-30%; left:-40%; right:-40%; background:linear-gradient(rgba(255,79,163,.45) 1px, transparent 1px) 0 0/100% 46px, linear-gradient(90deg, rgba(57,215,232,.32) 1px, transparent 1px) 0 0/64px 100%; transform:perspective(420px) rotateX(64deg); transform-origin:50% 0; -webkit-mask-image:linear-gradient(to bottom, rgba(0,0,0,.05), #000 60%); mask-image:linear-gradient(to bottom, rgba(0,0,0,.05), #000 60%); opacity:.5; }
{R} body::after { content:""; position:fixed; left:0; right:0; top:44%; height:30%; z-index:-2; pointer-events:none; background:radial-gradient(50% 60% at 50% 100%, rgba(255,79,163,.22), transparent 70%); }'''),
  'abismo': dict(f='Lexend:wght@400;500;600', cuerpo='"Lexend", ' + SANS, titulo='"Lexend", ' + SANS, r=(16, 22, 30, 999),
    pt=dict(forma='burbuja', mov='sube', vel=.9, dens=.4, tam=2.8, vaiven=1.6, brillo=.3), nota='Lexend serena · rayos de luz bajo el agua · burbujas',
    css='''{R} .read-head h1, {R} .empty h2, {R} .ve-head h2 { font-weight:500; letter-spacing:-.025em; }
{R} body::before { background:repeating-conic-gradient(from 180deg at 50% -20%, rgba(51,205,227,.07) 0deg 3deg, transparent 3deg 11deg), radial-gradient(70% 55% at 50% 0%, rgba(51,205,227,.14), transparent 70%); -webkit-mask-image:linear-gradient(to bottom, #000, transparent 75%); mask-image:linear-gradient(to bottom, #000, transparent 75%); }'''),
}

def tokens(t):
    dark = t['base'] == 'dark'
    bg, acc = t['bg'], t['acc']
    line = mezcla(bg, t['text'], 0.10 if dark else 0.09)
    line_s = mezcla(bg, t['text'], 0.20 if dark else 0.17)
    acc_text = t.get('accText') or acc
    acc_soft = 'rgba(%d,%d,%d,%s)' % (rgb(acc) + (('.16' if dark else '.10'),)) if dark else mezcla(bg, acc, 0.10)
    spark = t['spark']
    v = {
      '--bg': bg, '--surface': t['surface'], '--surface-2': t['surface2'], '--line': line, '--line-strong': line_s,
      '--text': t['text'], '--mute': t['mute'], '--faint': t['faint'],
      '--acc': acc, '--acc-hover': mezcla(acc, '#ffffff' if not dark else '#ffffff', 0.14), '--acc-press': mezcla(acc, '#000000', 0.16),
      '--acc-ink': t['accInk'], '--acc-soft': acc_soft, '--acc-text': acc_text, '--acc-rgb': '%d,%d,%d' % rgb(acc), '--acc-vivo': t['vivo'],
      '--spark': spark, '--spark-soft': ('rgba(%d,%d,%d,.13)' % rgb(spark)) if dark else mezcla(bg, spark, 0.10), '--spark-ink': mezcla(spark, '#ffffff', 0.25) if dark else mezcla(spark, '#000000', 0.18),
      '--unread-bg': t['surface'] if dark else bg, '--read-bg': bg if dark else mezcla(bg, t['surface'], 0.75),
      '--open-bg': mezcla(bg, acc, 0.14 if dark else 0.12),
      '--card': ('rgba(%d,%d,%d,.88)' % rgb(t['surface'])) if dark else mezcla(bg, '#ffffff', 0.6), '--card-line': line,
      '--panel': mezcla(bg, t['surface'], 0.5) if dark else bg,
      '--glow-red': 'rgba(%d,%d,%d,%s)' % (rgb(acc) + (('.14' if dark else '.07'),)), '--glow-blue': 'rgba(%d,%d,%d,%s)' % (rgb(spark) + (('.06' if dark else '.08'),)),
      '--toast-acc': mezcla(t['vivo'], '#ffffff', 0.35) if not dark else acc_text,
      '--pt-a': '%d,%d,%d' % rgb(t['vivo'] if dark else acc), '--pt-b': '%d,%d,%d' % rgb(spark),
      '--sel': 'rgba(%d,%d,%d,.24)' % rgb(acc),
    }
    if not dark:
        v['--shadow'] = '0 1px 2px rgba(%d,%d,%d,.06), 0 8px 24px rgba(%d,%d,%d,.08)' % (rgb(t['text']) * 2)
        v['--shadow-lg'] = '0 2px 6px rgba(%d,%d,%d,.07), 0 24px 64px rgba(%d,%d,%d,.17)' % (rgb(t['text']) * 2)
        v['--bloom'] = '0 8px 22px rgba(%d,%d,%d,.24)' % rgb(acc)
    else:
        v['--bloom'] = '0 10px 34px rgba(%d,%d,%d,.34)' % rgb(acc)
    # personalidad
    p = P[t['id']]
    v['--font'] = p['cuerpo']; v['--font-titulo'] = p['titulo']; v['--label'] = p.get('label', 'var(--font)')
    if p.get('mono'): v['--mono'] = p['mono']
    v['--r-sm'], v['--r'], v['--r-lg'], v['--pill'] = ['%dpx' % x for x in p['r']]
    for k, x in p['pt'].items(): v['--pt-' + k] = str(x)
    v.update(p.get('vars', {}))
    return v

fallos, css = [], ['/* ===== Temas (18-oct-2026): 6 claros y 6 oscuros, se eligen en Ajustes → Temas. Los genera scripts/temas.py',
                   '   (no editar a mano): colores con contraste comprobado y personalidad propia de cada uno (letra, esquinas,',
                   '   textura del fondo en body::before y partículas con las variables --pt-*, que lee particulas.js). ===== */',
                   ':root { --font-titulo:var(--font); }',
                   '.read-head h1, .empty h2, .ve-head h2, .login h1 { font-family:var(--font-titulo); }',
                   'body::before { content:""; position:fixed; inset:0; z-index:-2; pointer-events:none; }   /* textura: debajo de las partículas (-1) */']
for t in T:
    v = tokens(t)
    chk = [('texto/fondo', v['--text'], v['--bg'], 7), ('texto/superficie', v['--text'], v['--surface'], 7), ('apagado/fondo', v['--mute'], v['--bg'], 4.5),
           ('tenue/fondo', v['--faint'], v['--bg'], 3.0), ('acento texto/fondo', v['--acc-text'], v['--bg'], 4.5), ('tinta/acento', v['--acc-ink'], v['--acc'], 4.5),
           ('chispa/fondo', v['--spark-ink'], v['--bg'], 3.0), ('tenue/superficie', v['--faint'], v['--surface'], 3.0)]
    res = []
    for n, a, b, mn in chk:
        r = ratio(a, b); res.append('%s %.1f' % (n, r))
        if r < mn: fallos.append('%s: %s %.2f < %s' % (t['id'], n, r, mn))
    print('%-11s %s' % (t['id'], ' | '.join(res)))
    R = ':root[data-paleta="%s"]' % t['id']
    css.append(R + ' {')
    css.append('  ' + ' '.join('%s:%s;' % kv for kv in v.items()))
    css.append('}')
    css.append(P[t['id']]['css'].replace('{R}', R))
print('FALLOS:', fallos or 'ninguno')
if fallos: raise SystemExit('contraste insuficiente: no se escribe nada')
lista = [{'id': t['id'], 'nombre': t['nombre'], 'base': t['base'], 'idea': t['idea'], 'm': [t['bg'], t['surface'], t['acc'], t['text'], t['spark']],
          'f': P[t['id']]['f'], 'ft': P[t['id']]['titulo'], 'r': P[t['id']]['r'][2], 'nota': P[t['id']]['nota']} for t in T]

# ---------- colocar en la app (respeta el fin de línea de cada fichero) ----------
app = sys.argv[1]
def reescribir(nombre, fn):
    p = app + '/' + nombre; b = open(p, 'rb').read(); crlf = b.count(b'\r\n') > 0
    s = fn(b.decode('utf-8').replace('\r\n', '\n'))
    if crlf: s = s.replace('\n', '\r\n')
    open(p, 'wb').write(s.encode('utf-8'))
def bloque(s):
    i, j = s.index('/* ===== Temas (18-oct-2026)'), s.index('/* ===== selector de temas')
    return s[:i] + '\n'.join(css) + '\n\n' + s[j:]
def linea(s):
    n = len(re.findall(r'^var TEMAS = \[.*\];$', s, re.M))
    if n != 1: raise SystemExit('var TEMAS: %d líneas' % n)
    return re.sub(r'^var TEMAS = \[.*\];$', lambda m: 'var TEMAS = ' + json.dumps(lista, ensure_ascii=False) + ';', s, flags=re.M)
reescribir('tema.css', bloque)
reescribir('index.html', linea)
print('colocado en', app)
