<p align="center">
  <img src="docs/portada.jpg" alt="Buzonero Campillero: todas tus cuentas de Gmail en tu agente de IA" width="100%">
</p>

<h1 align="center">Buzonero Campillero</h1>

<p align="center">
  <strong>Todas tus cuentas de Gmail, controladas desde tu agente de IA.</strong><br>
  Servidor MCP + app web · lo instalas tú, gratis, en tu propio Vercel
</p>

<p align="center">
  <a href="https://github.com/alerl25/buzonero-campillero/releases"><img alt="Versión" src="https://img.shields.io/github/v/release/alerl25/buzonero-campillero?style=flat-square&label=versi%C3%B3n&color=dc0a06"></a>
  <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/github/license/alerl25/buzonero-campillero?style=flat-square&label=licencia"></a>
  <img alt="Servidor MCP" src="https://img.shields.io/badge/MCP-servidor-0098FF?style=flat-square">
  <img alt="Gratis en Vercel" src="https://img.shields.io/badge/Vercel-gratis-black?style=flat-square&logo=vercel">
  <img alt="Node 20 o superior" src="https://img.shields.io/badge/Node-%E2%89%A520-339933?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Sin dependencias" src="https://img.shields.io/badge/dependencias-0-2da2bb?style=flat-square">
  <a href="https://github.com/alerl25/buzonero-campillero/stargazers"><img alt="Estrellas" src="https://img.shields.io/github/stars/alerl25/buzonero-campillero?style=flat-square&label=estrellas"></a>
</p>

<p align="center">
  <a href="#instalar-en-1-paso">Instalar</a> ·
  <a href="#el-mcp-28-herramientas-para-tu-agente">El MCP</a> ·
  <a href="#la-app">La app</a> ·
  <a href="#cómo-funciona">Cómo funciona</a> ·
  <a href="#preguntas-frecuentes">Preguntas</a> ·
  <a href="README.en.md">English</a>
</p>

---

**Buzonero es un servidor MCP** que da a **Claude Code, Cursor, Codex, Windsurf o Claude Desktop** acceso a **varias cuentas de Gmail y Google Workspace a la vez**. Puedes buscar en todas de una vez, leer, dejar borradores, responder y reenviar, archivar, poner etiquetas de color, darte de baja de boletines, seguir tus paquetes o pedir que te avise si alguien no contesta.

Y trae su **app web** para ti, en el ordenador y en el móvil.

Cada persona se lo instala **gratis, en su propio Vercel y con su propio proyecto de Google**. Tu correo no pasa por ningún servidor ajeno, tampoco por el de quien escribió esto.

## Instalar en 1 paso

Copia esto en tu agente de IA:

```text
Instálame Buzonero Campillero: https://github.com/alerl25/buzonero-campillero
Sigue su AGENTS.md y guíame paso a paso.
```

Tu agente lo clona, lo publica en tu Vercel, genera las claves y se conecta el MCP. A ti solo te pide unos clics en Google Cloud, Vercel y cron-job.org, y te dice exactamente qué poner. Calcula **20-30 minutos**.

¿Prefieres hacerlo a mano? Tienes la guía completa en **[INSTALAR.md](INSTALAR.md)**.

## El MCP: 33 herramientas para tu agente

<p align="center"><img src="docs/mcp-demo.png" alt="Un agente buscando en todas las cuentas y dejando un borrador" width="88%"></p>

| Para… | Herramientas |
|---|---|
| **Calendario de Google** | `calendarios`, `eventos`, `crear_evento`, `modificar_evento`, `borrar_evento` |
| **Ver todas las cuentas a la vez** | `cuentas`, `buscar_en_todas` (bandeja unificada o búsqueda en todas), `paquetes`, `suscripciones`, `basura_parada`, `avisos_pendientes`, `buscar_contacto` |
| **Leer** | `buscar`, `leer_hilo`, `descargar_adjunto` |
| **Escribir** | `crear_borrador` (nuevo, respuesta o reenvío con adjuntos), `enviar`, `enviar_borrador`, `listar_borradores`, `borrar_borrador` |
| **Ordenar** | `modificar_hilos` (archivar, leído, destacar, spam, papelera, etiquetas; por ids o por una búsqueda), `etiquetas`, `crear_etiqueta`, `color_etiqueta` |
| **Seguimiento** | `avisame_si_no_contesta`, `quitar_aviso` |
| **Limpiar** | `darse_de_baja`, `bloquear_remitente`, `filtros`, `crear_filtro`, `borrar_filtro` |
| **Cuenta** | `firma`, `cambiar_firma` |

**Prueba a pedirle a tu agente:**
- «¿Qué tengo sin leer en todas mis cuentas?»
- «Responde a Laura desde la cuenta del trabajo diciendo que el jueves me va bien» (deja un borrador).
- «Date de baja de los boletines que nunca abro.»
- «¿Qué paquetes tengo de camino?»
- «Avísame si el proveedor no contesta en 3 días.»
- «Archiva todo lo de LinkedIn de más de una semana en las tres cuentas.»

> [!IMPORTANT]
> **Seguro por defecto:**
> - Escribe **borradores**. Enviar, darse de baja y bloquear piden `confirmado: true`, así que tu agente tiene que preguntarte antes.
> - El MCP no guarda tus permisos de Google: pide a tu instalación tokens de una hora con su propia clave.

<details>
<summary><strong>Configuración del MCP para cada agente</strong> (si no lo hizo tu agente al instalar)</summary>

<br>

Guarda la clave del MCP (el contenido de `clave-mcp.txt`) en `~/.config/buzonero/mcp-key.txt`. `RUTA` es la carpeta donde clonaste el repositorio y `TU-APP` es tu dirección de Vercel.

**Claude Code**

```bash
claude mcp add buzonero --scope user -e BUZONERO_URL=https://TU-APP.vercel.app -- node "RUTA/mcp/buzonero-mcp.mjs"
```

**Cursor** (`~/.cursor/mcp.json`), **Windsurf** y **Claude Desktop**

```json
{
  "mcpServers": {
    "buzonero": {
      "command": "node",
      "args": ["RUTA/mcp/buzonero-mcp.mjs"],
      "env": { "BUZONERO_URL": "https://TU-APP.vercel.app" }
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "buzonero": {
      "type": "stdio",
      "command": "node",
      "args": ["RUTA/mcp/buzonero-mcp.mjs"],
      "env": { "BUZONERO_URL": "https://TU-APP.vercel.app" }
    }
  }
}
```

**Codex** (`~/.codex/config.toml`)

```toml
[mcp_servers.buzonero]
command = "node"
args = ["RUTA/mcp/buzonero-mcp.mjs"]
env = { BUZONERO_URL = "https://TU-APP.vercel.app" }
```

</details>

## La app

<p align="center">
  <img src="docs/capturas/app-oscuro.png" alt="La app en modo oscuro con un correo abierto" width="100%">
</p>

<p align="center">
  <img src="docs/capturas/movil-lista.png" alt="Bandeja en el móvil" width="24%">
  <img src="docs/capturas/movil-correo.png" alt="Un correo en el móvil, con los botones de calendario y teléfono" width="24%">
  <img src="docs/capturas/tema-neon.png" alt="Tema Neón" width="49%">
</p>

<sub>Las capturas usan una persona y unos correos inventados (`scripts/capturas-demo.mjs`).</sub>

**Correo**
- Varias cuentas en pestañas, cada una con su color y su contador de sin leer.
- Categorías de Gmail (Principal, Promociones, Social, Notificaciones), carpetas y etiquetas de color. El color lo eliges al crear la etiqueta o tocando su cuadradito.
- Bandeja agrupada por meses y búsqueda con la sintaxis de Gmail.
- Acciones en bloque, y deslizar para archivar en el móvil.
- El correo se ve con tu tema, también en oscuro. La parte citada sale plegada y los adjuntos tienen visor (PDF, imágenes y documentos).
- Redactar y responder con adjuntos (los grandes van a Drive), una firma por cuenta y borradores que se guardan solos.
- **Deshacer el envío** durante 10 segundos.
- **Dictado por voz**: limpia muletillas y entiende «punto y aparte», «coma», «interrogación»…
- **«Avísame si no contesta»**: si nadie responde en el plazo que elijas, el hilo vuelve a tu bandeja con la etiqueta «Sin respuesta» y te llega un aviso.

**Lo que encuentra por ti**
- **Añadir al calendario**: detecta fechas y horas en el correo y crea el evento en Google Calendar.
- **Teléfonos y direcciones**: los convierte en botones de llamada, WhatsApp y mapa.
- **Calendario de Google**: el mes de todos tus calendarios en una pestaña, con un check por cuenta y por calendario como en Google Calendar, y crear, editar y borrar eventos desde aquí.
- **Paquetes**: reúne en una pestaña los pedidos y envíos de todas las cuentas, con su estado.
- **Suscripciones**: lista los boletines y te deja darte de baja en un clic o filtrarlos. Te señala los que nunca abres.
- **Basura parada**: cuenta lo que tus filtros apartan cada semana.

**Avisos y móvil**
- Avisos de correo nuevo en el móvil y en el ordenador (Web Push, también en iPhone). La publicidad no avisa.
- Globo con el número de sin leer en el icono de la app.
- Se instala como app en iPhone, Android y escritorio.

**A tu gusto**
- Claro, oscuro y **12 temas** con personalidad propia: letra, esquinas, textura de fondo y partículas animadas (nieve, burbujas, luciérnagas, estrellas, píxeles, confeti…).

<p align="center"><img src="docs/capturas/temas.png" alt="Selector de temas" width="80%"></p>

## Cómo funciona

```mermaid
flowchart LR
  A["Tu agente de IA<br/>(Claude Code, Cursor, Codex…)"] -- "MCP · stdio" --> M["mcp/buzonero-mcp.mjs<br/>en tu ordenador"]
  M -- "token de 1 h<br/>(clave del MCP)" --> V["Tu Vercel<br/>api/ (sin base de datos)"]
  W["App web / PWA<br/>en tu móvil y PC"] -- "token de 1 h<br/>(sesión)" --> V
  V -- "permisos cifrados<br/>AES-256-GCM" --> D[("Tu Google Drive")]
  M -- "API de Gmail" --> G["Gmail · Drive · Contactos"]
  W -- "API de Gmail" --> G
  C["cron-job.org<br/>cada minuto"] -- "x-vigia" --> V
  V -- "Web Push" --> W
```

- **Tus correos nunca se guardan en el servidor.** La app y el MCP los piden directamente a Google con tokens que caducan en una hora.
- **Los permisos de Google** (refresh tokens) viven cifrados en un fichero de tu Drive que solo ve esta app.
- **Sin dependencias** en el servidor ni en el MCP: es Node 20 puro, y por tanto hay menos que auditar.

| Ruta | Qué es |
|---|---|
| `mcp/buzonero-mcp.mjs` | El servidor MCP: un solo fichero, sin dependencias, habla MCP por stdio |
| `app/index.html` | La app entera: un único HTML con su JavaScript, sin compilación |
| `app/tema.css` · `app/particulas.js` | Diseño, temas (`scripts/temas.py`) y fondo de partículas en WebGL |
| `api/` | Funciones de Vercel: sesión, acceso con Google, tokens, avisos y almacén cifrado |
| `sw.js` | Service worker: avisos y globo del icono |
| `AGENTS.md` | Las instrucciones que sigue tu agente para instalártelo |
| `scripts/` | `configurar.mjs` (claves), `subir-a-vercel.mjs`, `capturas-demo.mjs` e `imagenes-readme.mjs` |

## Preguntas frecuentes

<details><summary><strong>¿Cuánto cuesta?</strong></summary><br>0 €. Vercel Hobby, Google Cloud sin facturación y cron-job.org son gratuitos para este uso. Si algún paso te pide tarjeta, te has equivocado de opción.</details>

<details><summary><strong>¿Alguien más puede leer mi correo?</strong></summary><br>No. Es tu instalación: tu proyecto de Google, tu Vercel y tu ordenador. Quien escribió Buzonero no tiene ningún acceso. Los permisos se guardan cifrados en tu Drive y los correos no se guardan en ningún servidor.</details>

<details><summary><strong>¿Por qué Google dice «aplicación no verificada»?</strong></summary><br>Porque es tu propia app y no ha pasado la auditoría de Google, que es de pago y está pensada para apps públicas. Para uso personal basta con publicarla «En producción» sin verificar (así no caduca a los 7 días) y pulsar <em>Configuración avanzada → Ir a Buzonero</em>.</details>

<details><summary><strong>¿Funciona con Google Workspace (correo de empresa)?</strong></summary><br>Sí, siempre que el administrador de tu dominio permita apps de terceros. Puedes mezclar cuentas de Gmail y de Workspace.</details>

<details><summary><strong>¿Puede mi agente enviar correos sin preguntarme?</strong></summary><br>No. <code>enviar</code>, <code>enviar_borrador</code>, <code>darse_de_baja</code> y <code>bloquear_remitente</code> no hacen nada sin <code>confirmado: true</code>, y las instrucciones del MCP le dicen al agente que te pregunte. Por defecto deja borradores.</details>

<details><summary><strong>¿Cuántas cuentas puedo conectar?</strong></summary><br>Las que quieras: la principal al instalar y el resto desde la app (engranaje → Añadir cuenta).</details>

<details><summary><strong>¿Y si pierdo el móvil o se filtra una clave?</strong></summary><br>Cambia <code>BZ_SESION_VER</code> en Vercel para cerrar todas las sesiones, cambia la clave que corresponda y retira permisos en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. Lo tienes en <a href="SECURITY.md">SECURITY.md</a>.</details>

## Contribuir

Los fallos, las ideas y las mejoras son bienvenidos: lee [CONTRIBUTING.md](CONTRIBUTING.md). Para un problema de seguridad, usa el aviso privado que explica [SECURITY.md](SECURITY.md).

## Historial de estrellas

<a href="https://star-history.com/#alerl25/buzonero-campillero&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=alerl25/buzonero-campillero&type=Date&theme=dark">
    <img alt="Historial de estrellas" src="https://api.star-history.com/svg?repos=alerl25/buzonero-campillero&type=Date" width="600">
  </picture>
</a>

## Licencia

[MIT](LICENSE). Úsalo, cámbialo y compártelo libremente.

<sub>Buzonero Campillero no está afiliado a Google. Gmail, Google Drive y Google Calendar son marcas de Google LLC.</sub>
