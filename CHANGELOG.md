# Cambios

Todas las versiones de Buzonero Campillero. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.5.1] · 2026-10-19

### App web
- Aviso en el paso de la cuenta de servicio: elegir «Service account», no «API key» ni «OAuth client ID».
- Pasos de Google Analytics más claros: cada botón con su nombre en español y en inglés (como sale en Google Cloud), dónde está la clave, qué hacer si la organización bloquea las claves y el enlace directo a Credenciales.

## [1.5] · 2026-10-19

### App web
- **Integraciones paso a paso:** cada una (Google Analytics, Google Business, WhatsApp, Nexudus) abre un asistente con los pasos numerados, un botón a la página exacta de cada paso, los campos para pegar la clave y **Probar y guardar**: se prueba de verdad antes de guardarse y, si falla, dice por qué.
- **Google Analytics sin meter otra cuenta de Google:** con la clave de una cuenta de servicio (fichero .json) y el ID de la propiedad.
- **WhatsApp con varios números:** cada uno con su nombre, identificador y token; se pueden añadir y quitar.
- **Nexudus de solo lectura:** con usuario, contraseña y, si lo pide, el código de 6 cifras; la contraseña no se guarda, solo un pase de solo lectura que caduca.
- Google Business explica cómo pedir el acceso a Google; se conecta cuando lo aprueben.

### Servidor
- `api/_integ.js`: prueba y guarda cada integración, cifrada en `buzonero-crm.enc` (campo `integ`). La app solo recibe el estado, nunca claves ni tokens.

## [1.4] · 2026-10-19

### App web
- **Pestaña CRM** (botón «CRM» en la barra lateral, en el sitio de las categorías, que ya están encima de la lista): **Tablero** con una columna por etapa (arrastra las tarjetas para cambiar de etapa), **Clientes** (toda persona de fuera que te ha escrito, con su empresa y su etapa; si no tiene, hereda la de su empresa), **Integraciones** (Google Analytics, Google Business, WhatsApp con varios números y Nexudus de solo lectura; por ahora explican qué falta para conectarlas) y **Ajustes** (tus CRM).
- **Ficha del cliente:** etapa, datos, su mensaje y botones para abrir el correo o escribirle.
- **Añadir al CRM** desde cualquier correo abierto (botón con la persona y el «+»), para los leads que llegan por otro lado.
- Las etiquetas del CRM («Leads/…») ya no salen en la barra ni en la lista: se crean solo cuando hace falta y ocultas, también en Gmail.
- Los posibles bots, además, se archivan.

### Servidor
- `api/crm.js`: `?r=leads` (tablero), `?r=clientes`, acciones `mover` y `anadir`.

## [1.3] · 2026-10-19

### App web
- **Mis CRM** (Ajustes → Mis CRM): crea un CRM por negocio, elige qué cuentas de correo son suyas (una cuenta, un solo CRM), sus etapas (por defecto Nuevo → Respondido → Propuesta → Reserva → Ganado / Perdido) y cómo se detectan sus leads.
- **Detección de leads:** los formularios de tu web (quién envía el aviso y qué dice el asunto) y, si quieres, los correos de gente nueva que escribe por primera vez con palabras como «presupuesto» o «reserva». Cada lead lleva una etiqueta de Gmail con su etapa («Leads/Nuevo»…), así que se ve también desde Gmail y en la barra lateral.
- **Buscar leads de los últimos 30 días**, para no empezar con el CRM vacío.

### Servidor
- `api/crm.js` y un fichero cifrado propio en Drive (`buzonero-crm.enc`) con la definición de cada CRM. Nunca guarda correos.
- El vigía (cada minuto) marca los leads nuevos y avisa al móvil «Nuevo lead»; cuando contestas a un lead (en su hilo o en un correo nuevo a su dirección), pasa solo a la segunda etapa.
- **Bots fuera:** un envío va a «Leads/Posible bot», sin aviso y marcado como leído, si trae texto sin sentido, una dirección de tu propio dominio, publicidad típica (SEO, «free shipping»…), una frase de bot que tú indiques o el mismo correo con otro nombre en otro envío.
- Gmail junta en un hilo envíos distintos del mismo formulario: cada envío es un lead aparte (la etiqueta va en el mensaje, no en el hilo).
- «Cerrar sesión» y «Quitar cuenta» pasan a `api/session.js` (`?r=salir`, `?r=cuenta`), para caber en las 12 funciones del plan gratuito de Vercel; `/api/logout` y `/api/cuenta` siguen funcionando por `vercel.json`.

## [1.2] · 2026-10-19

### App web
- **Enviar en 5 s** (antes 10) para echarse atrás.
- **Enviar aunque cierres la app:** al pulsar Enviar, el correo final se guarda como borrador en Gmail y se apunta en el servidor. Si cierras la app o apagas el ordenador antes de que salga, lo envía el vigía en el siguiente minuto y te avisa al móvil («Enviado · …»). Gmail no deja enviar dos veces el mismo borrador, así que nunca sale repetido. Los adjuntos de más de 25 MB (que van por Drive) siguen necesitando la app abierta.

### Servidor
- `api/envio.js` y un fichero cifrado propio en Drive (`buzonero-envios.enc`) con los envíos pendientes; el vigía los manda con `drafts/send`.

## [1.1] · 2026-10-19

### App web
- **Idiomas:** español (por defecto), inglés y francés. Se eligen en la pantalla de entrada y al final de Ajustes; se recuerda por navegador.
- **Correos en cualquier idioma:** si un correo declara una codificación y manda otra, se lee bien (UTF-8 estricto, `<meta charset>`, cirílico, chino, japonés, coreano, árabe) y se resuelven las palabras codificadas de las cabeceras. Se acabaron los «Ã¡».
- **Borradores:** botón «Borrar borrador» visible en el hilo y en el pie del mensaje; dos borradores en un mismo hilo se ven y se abren por separado y la lista dice cuántos hay; al borrar o enviar, la lista y el hilo se actualizan solos y desaparece «Seguir escribiendo».
- **Barra de formato** en una sola línea y pie del mensaje que ya no se sale de la pantalla.
- **Modo oscuro:** los correos leídos y no leídos se distinguen mucho más (fondo, negrita y barra de color).

## [1.0] · 2026-10-18

Primera versión pública.

### MCP para agentes de IA
- 28 herramientas para manejar varias cuentas de Gmail a la vez desde Claude Code, Cursor, Codex, Windsurf o Claude Desktop:
  - buscar en todas las cuentas a la vez (bandeja unificada);
  - leer, borradores, responder y reenviar con adjuntos;
  - archivar y ordenar por búsqueda;
  - etiquetas con color;
  - «avísame si no contesta»;
  - paquetes;
  - suscripciones con baja en un clic;
  - bloquear remitentes y filtros;
  - firmas, contactos y basura parada.
- Seguro por defecto: deja borradores; enviar, darse de baja y bloquear piden confirmación.
- Instalación guiada por tu propio agente (`AGENTS.md`), con scripts sin preguntas (`configurar.mjs`, `subir-a-vercel.mjs`).

### App web (PWA)
- Varias cuentas en pestañas, categorías, etiquetas de color y bandeja por meses.
- Deshacer el envío, dictado por voz y «avísame si no contesta».
- Añadir al calendario, teléfonos y direcciones que se pueden tocar, paquetes, suscripciones y basura parada.
- Avisos al móvil (también en iPhone) y globo de sin leer en el icono.
- Modo oscuro también dentro de los correos y 12 temas con letra, textura y partículas propias.

### Seguridad
- Permisos de Google cifrados (AES-256-GCM) en tu propio Drive; los correos no se guardan en el servidor.
- Auditoría antes de publicar: HTML de los correos convertido a texto sin ejecutar nada, enlaces peligrosos fuera, COOP, SRI en las librerías, límite de intentos de contraseña y cierre de todas las sesiones con `BZ_SESION_VER`.
