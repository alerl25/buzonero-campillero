# Cambios

Todas las versiones de Buzonero Campillero. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
