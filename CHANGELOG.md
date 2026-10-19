# Cambios

Todas las versiones de Buzonero Campillero. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.9] · 2026-10-19

### MCP para agentes de IA (37 herramientas)
- **CRM en el MCP:** `crm` (tus CRM), `leads` (cada lead con su etapa, de quién es el turno, su mensaje y sus facturas y reservas de Nexudus; filtra por etapa o «solo los que te toca contestar»), `mover_lead` (cambiar de etapa o «No es lead») y `anadir_al_crm` (meter un hilo en el CRM). Así tu agente puede preparar borradores para los leads que esperan respuesta; nunca se envían solos.

### Documentación
- README (español e inglés) y AGENTS con las 37 herramientas, la fila del CRM y la del calendario en inglés; el enlace al apartado del MCP vuelve a funcionar.
- `scripts/conectar_cuenta.py` y `scripts/iconos.mjs` pasan al repositorio.

## [1.8.1] · 2026-10-19

### Documentación
- `INSTALAR.md`: son cuatro API (también Google Calendar) y qué hacer si ya tenías Buzonero instalado: activar la Google Calendar API en tu proyecto y reconectar cada cuenta marcando todas las casillas.

## [1.8] · 2026-10-19

### App web
- **Calendario de Google dentro de Buzonero:** nueva entrada «Calendario» en la barra lateral, con el mes de todos tus calendarios de Google. A la izquierda, el panel «Mis calendarios», como en Google Calendar: un check por cuenta y otro por cada calendario para ver u ocultar sus eventos (se recuerda en el navegador). Detalle del día, y **crear, editar y borrar eventos** desde aquí: los cambios se hacen de verdad en Google Calendar.
- Sin funciones nuevas en el servidor: la web habla con la API de Calendar con el mismo token de 1 h que ya usa Gmail.
- Las cuentas conectadas antes de esta versión no tienen el permiso de Calendario: la vista lo avisa y basta con **reconectarlas** (engranaje → Reconectar). Además hay que activar «Google Calendar API» en el proyecto de Google Cloud.

### MCP
- **5 herramientas nuevas (33 en total):** `calendarios`, `eventos`, `crear_evento`, `modificar_evento` y `borrar_evento`. Borrar, o crear con invitados, exige `confirmado: true`. Los agentes pueden mirar la agenda antes de contestar un correo con fechas.

### Permisos
- Nuevo permiso de Google: `calendar` (ver y editar tus calendarios). Está en el acceso con Google (`api/auth/start.js`) y en `scripts/conectar_cuenta.py`.

## [1.7] · 2026-10-19

### App web
- **Estado real de cada lead en el tablero:** «Te toca» si el último correo con esa persona es suyo, o «Esperando · N d» si es tuyo (mira toda la correspondencia con su dirección, no solo el hilo del formulario).
- **Nexudus en el tablero y en la ficha:** facturas (pagadas o pendientes) y reservas de cada lead, por su correo. Con reserva o factura después de su consulta pasa solo a «Reserva», y con la factura pagada a «Ganado» (nunca hacia atrás).
- **«No es lead»** en la ficha: lo quita del tablero (propuestas de colaboración, proveedores…), con su etiqueta propia.

### Servidor
- `nexudusCliente` en `api/_integ.js` (solo lectura; `Coworker_Email` filtra y `Coworker_Email_Exact` no, comprobado con un valor imposible).
- Etiquetas creadas a la vez por dos peticiones: si Gmail da 409, se usa la que ya existe.

## [1.6] · 2026-10-19

### App web
- **Ocultar integraciones por CRM:** cada integración sin conectar tiene «Ocultar», y las ocultas salen abajo para volver a mostrarlas. Útil cuando una depende de otra persona (la central, la agencia de la web).
- **WhatsApp, pasos reescritos tras una conexión real:** elegir antes el número (uno nuevo se conecta gratis; el del móvil sin perder la app exige negocio verificado y ser proveedor de tecnología, y si se da de alta aquí deja de funcionar en el móvil), aceptar condiciones, no usar el número de prueba +1 555, verificación del negocio con los datos fiscales y token permanente.
- **Google Business:** quién puede pedirlo (propietario o administrador de la ficha), número del proyecto frente a su nombre e ID, y qué contestar en la solicitud.
- **Google Analytics:** cómo saber qué propiedad recibe las visitas (el ID de medición G-… de la web) y a quién pedir acceso si es de otra cuenta.
- **Nexudus acepta un token ya hecho:** si tienes el de otra herramienta, lo pegas y no hace falta usuario, contraseña ni código.

## [1.5.2] · 2026-10-19

### App web
- **Google Analytics, pasos reescritos con lo que costó en la primera conexión real:** trabajar siempre en el mismo proyecto de Google Cloud, dónde está la clave (pulsar el correo de la cuenta de servicio → Keys), cómo elegir la propiedad buena (Flujos de datos: la que no dice «No data received»), dar acceso a nivel de cuenta, el ID tras la «p» de la dirección (no el de la «a») y qué hacer si sale «0 usuarios» (ahora la app avisa).
- **Google Business:** requisitos (ficha verificada con más de 60 días y web), dónde está el número del proyecto, la solicitud («Application for Basic API Access») y cómo saber si ya está aprobado (cuota de 0 a 300).

## [1.5.1] · 2026-10-19

### App web
- El ID de la propiedad de Analytics se explica por la dirección del navegador (el número tras «/p»), mucho más fácil de encontrar.
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
