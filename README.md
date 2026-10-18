# Buzonero Campillero

**Versión 1.0**

**Todas tus cuentas de Gmail, controladas desde tu agente de IA.** Buzonero es un servidor **MCP** que da a Claude Code, Cursor, Codex, Windsurf o Claude Desktop acceso a varias cuentas de Gmail y Google Workspace a la vez, desde un solo sitio.

- Buscar en todas tus cuentas de una vez.
- Leer, redactar borradores, responder y reenviar.
- Archivar y ordenar con etiquetas de color.
- Darse de baja de boletines y bloquear remitentes.
- Seguir pedidos y paquetes.
- Poner «avísame si no contesta».

Y además trae su **app web** (PWA) para ti, en el ordenador y en el móvil.

Cada persona se lo instala gratis, en su propio Vercel y con su propio proyecto de Google. Tu correo no pasa por ningún servidor ajeno.

> *English: a self-hosted MCP server + PWA that lets any AI coding agent (Claude Code, Cursor, Codex…) manage several Gmail accounts at once. Free on Vercel Hobby + your own Google Cloud project. UI and docs in Spanish. Quick start: paste this repo's URL into your agent and ask it to install it (it follows [AGENTS.md](AGENTS.md)).*

## Instalar en 1 paso

Copia esto en tu agente de IA (Claude Code, Cursor, Codex…):

> Instálame Buzonero Campillero: https://github.com/alerl25/buzonero-campillero — sigue su AGENTS.md y guíame paso a paso.

Tu agente lo clona, lo publica en tu Vercel, genera las claves y se conecta el MCP. A ti solo te pide unos clics en Google Cloud, Vercel y cron-job.org, y te dice exactamente qué poner. Calcula unos 20-30 minutos.

¿Prefieres hacerlo a mano? Tienes la guía completa en **[INSTALAR.md](INSTALAR.md)**.

## El MCP: 28 herramientas para tu agente

| Para… | Herramientas |
|---|---|
| Ver todas las cuentas a la vez | `cuentas`, `buscar_en_todas` (bandeja unificada o búsqueda en todas), `paquetes`, `suscripciones`, `basura_parada`, `avisos_pendientes`, `buscar_contacto` |
| Leer | `buscar`, `leer_hilo`, `descargar_adjunto` |
| Escribir | `crear_borrador` (nuevo, respuesta o reenvío con adjuntos), `enviar`, `enviar_borrador`, `listar_borradores`, `borrar_borrador` |
| Ordenar | `modificar_hilos` (archivar, leído, destacar, spam, papelera, etiquetas; por ids o por una búsqueda), `etiquetas`, `crear_etiqueta`, `color_etiqueta` |
| Seguimiento | `avisame_si_no_contesta`, `quitar_aviso` |
| Limpiar | `darse_de_baja`, `bloquear_remitente`, `filtros`, `crear_filtro`, `borrar_filtro` |
| Cuenta | `firma`, `cambiar_firma` |

Algunos ejemplos que puedes pedirle a tu agente:
- «¿Qué tengo sin leer en todas mis cuentas?»
- «Responde a Laura desde la cuenta del trabajo diciendo que el jueves me va bien»: deja un borrador.
- «Date de baja de los boletines que nunca abro.»
- «¿Qué paquetes tengo de camino?»
- «Avísame si el proveedor no contesta en 3 días.»

**Seguro por defecto:**
- Escribe **borradores**. Enviar, darse de baja y bloquear piden `confirmado: true`, así que tu agente tiene que preguntarte primero.
- El MCP no guarda permisos de Google: pide a tu instalación tokens de una hora con su propia clave.

## La app

**Correo**
- Varias cuentas en pestañas, con su color y su contador de sin leer.
- Categorías de Gmail (Principal, Promociones, Social, Notificaciones), carpetas y etiquetas con su color (lo eliges al crearlas o tocando su cuadradito).
- Bandeja agrupada por meses y búsqueda con la sintaxis de Gmail.
- Acciones en bloque y deslizar para archivar en el móvil.
- Lectura cómoda: el correo se ve a tu tema (también en oscuro), con la parte citada plegada y los adjuntos con visor (PDF, imágenes y documentos).
- Redactar y responder con adjuntos (los grandes van a Drive), firmas por cuenta y borradores que se guardan solos.
- **Deshacer el envío** durante 10 segundos.
- **Dictado por voz**: limpia muletillas y entiende «punto y aparte», «coma», «interrogación»…
- **«Avísame si no contesta»**: si nadie responde en el plazo que elijas, el hilo vuelve a tu bandeja con la etiqueta «Sin respuesta» y te llega un aviso.

**Lo que encuentra por ti**
- **Añadir al calendario**: detecta fechas y horas en el correo y crea el evento en Google Calendar.
- **Teléfonos y direcciones**: los convierte en botones de llamada, WhatsApp y mapa.
- **Paquetes**: reúne en una pestaña los pedidos y envíos de todas las cuentas, con su estado.
- **Suscripciones**: lista los boletines y te deja darte de baja en un clic, o filtrarlos. Elige solos los que nunca abres.
- **Basura parada**: cuenta lo que tus filtros apartan cada semana.

**Avisos y móvil**
- Avisos al móvil y al ordenador de correo nuevo (Web Push, también en iPhone). La publicidad no avisa.
- Globo con el número de sin leer en el icono de la app.
- Se instala como app en iPhone, Android y escritorio.

**A tu gusto**
- Claro, oscuro y **12 temas** con personalidad propia: letra, esquinas, textura de fondo y partículas animadas (nieve, burbujas, luciérnagas, estrellas, píxeles, confeti…).

**Privacidad y seguridad**
- **El contenido de tus correos no se guarda** en el servidor: tu navegador habla directamente con Google con tokens de una hora.
- **Los permisos de Google** se guardan cifrados (AES-256-GCM) en tu propio Drive.
- **Entrada** con tu cuenta de Google o con contraseña, y sesión con cookie segura.
- **Sin dependencias en el servidor** y sin base de datos.

## Coste

0 €. Vercel Hobby, Google Cloud sin facturación y cron-job.org son gratuitos para este uso.

## Cómo está hecho

| Ruta | Qué es |
|---|---|
| `app/index.html` | La app entera: un único fichero HTML con su JavaScript, sin compilación |
| `app/tema.css` | Diseño y temas, que se generan con `scripts/temas.py` |
| `app/particulas.js` | Fondo de partículas en WebGL |
| `sw.js` | Service worker: avisos y globo del icono |
| `api/` | Funciones de Vercel (Node 20, sin dependencias): sesión, acceso con Google, tokens, avisos, almacén cifrado |
| `mcp/buzonero-mcp.mjs` | El servidor MCP: un solo fichero, sin dependencias, habla MCP por stdio |
| `AGENTS.md` | Las instrucciones que sigue tu agente para instalártelo |
| `scripts/configurar.mjs` | Genera la configuración de una instalación nueva (también sin preguntas, para el agente) |
| `scripts/subir-a-vercel.mjs` | Sube esa configuración a Vercel y despliega |

## Licencia

[MIT](LICENSE). Úsala, cámbiala y compártela libremente.

Buzonero Campillero no está afiliado a Google. Gmail, Google Drive y Google Calendar son marcas de Google LLC.
