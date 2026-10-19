# Instalar Buzonero Campillero

Guía completa para tener tu propia instalación, gratis, en unos 30 minutos. Cada persona monta la suya: tu correo solo pasa entre tu navegador, tu Vercel y Google. Nadie más (tampoco quien escribió la app) tiene acceso.

**Qué necesitas**
- Una o varias cuentas de Gmail o Google Workspace.
- Una cuenta gratuita de [GitHub](https://github.com), de [Vercel](https://vercel.com) (plan Hobby) y de [cron-job.org](https://cron-job.org).
- [Node.js 20 o superior](https://nodejs.org) en tu ordenador, solo para el paso 4.

Ningún paso pide tarjeta ni plan de pago. Si algo te lo pide, para: te has equivocado de opción.

> **La forma fácil: que lo haga tu agente.** Copia esto en Claude Code, Cursor, Codex o el agente que uses:
>
> *Instálame Buzonero Campillero: https://github.com/alerl25/buzonero-campillero — sigue su AGENTS.md y guíame paso a paso.*
>
> El agente sigue [AGENTS.md](AGENTS.md). Hace él todos los comandos, te pide solo los clics en el navegador con los valores exactos, y al final se conecta el MCP. Lo de abajo es la misma instalación hecha a mano.

---

## 1. Copia el código y publícalo en Vercel

1. En GitHub, pulsa **Fork** en este repositorio (o **Use this template**) para tener tu copia.
2. En Vercel: **Add New → Project → Import** tu copia. No cambies nada y pulsa **Deploy**.
3. Cuando termine, apunta tu dirección, algo como `https://mi-buzonero.vercel.app`. La app todavía no funciona: faltan las claves.

> Si quieres otro nombre en la dirección, cámbialo en Vercel en **Settings → Domains** antes de seguir. La dirección tiene que ser la definitiva para el paso 2.

## 2. Crea tu proyecto de Google Cloud

Todo en [console.cloud.google.com](https://console.cloud.google.com), con tu cuenta principal.

1. **Proyecto nuevo**: arriba, selector de proyectos → **Proyecto nuevo** → nombre `buzonero` → Crear. Selecciónalo.
2. **Activa las APIs**: menú → **APIs y servicios → Biblioteca**. Busca y pulsa **Habilitar** en las cuatro:
   - Gmail API
   - Google Drive API
   - People API
   - Google Calendar API (para la pestaña Calendario y sus herramientas del MCP)
3. **Pantalla de consentimiento**: **APIs y servicios → Pantalla de consentimiento de OAuth** (o «Google Auth Platform»).
   - Tipo de usuario: **Externo**. Nombre de la app: `Buzonero`. Correo de asistencia: el tuyo.
   - Página principal: `https://TU-APP.vercel.app` · Política de privacidad: `https://TU-APP.vercel.app/privacidad`.
   - Dominios autorizados: `vercel.app`.
   - **Permisos (scopes)**: no hace falta añadirlos aquí. La app los pide al conectar.
   - En **Audiencia / Usuarios de prueba**, añade todas las cuentas de Gmail que vayas a usar.
4. **Publica la app (importante)**: en **Audiencia**, pulsa **Publicar aplicación → Confirmar**. Debe quedar **En producción**.
   - Si se queda «En prueba», Google caduca los permisos **a los 7 días** y tendrías que reconectar cada semana.
   - No hace falta pedir la verificación. Al conectar verás «Google no ha verificado esta aplicación»: es tu propia app, pulsa **Configuración avanzada → Ir a Buzonero (no seguro)**.
5. **Credenciales**: **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
   - Tipo: **Aplicación web**. Nombre: `Buzonero web`.
   - **URIs de redireccionamiento autorizados**, añade los dos:
     - `https://TU-APP.vercel.app/api/auth/callback`
     - `http://localhost:53682/callback` (solo para el paso 4; luego puedes quitarlo)
   - Crear. Copia el **ID de cliente** y el **Secreto de cliente**.

> **¿Ya tenías Buzonero instalado de antes (versión anterior a la 1.8)?** Para el calendario solo hacen falta dos cosas:
> 1. En tu proyecto de Google Cloud (el de Buzonero, no otro): **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**. Comprueba arriba que está elegido el proyecto bueno.
> 2. En Buzonero: **Ajustes** (rueda) → **Reconectar con Google** → cada cuenta, y en la pantalla de Google **marca todas las casillas**, también la de Google Calendar. Las cuentas que no reconectes siguen con el correo igual, pero no enseñan su calendario.

## 3. Descarga el código en tu ordenador

```bash
git clone https://github.com/TU-USUARIO/TU-COPIA.git
cd TU-COPIA
```

(O descarga el ZIP desde GitHub con **Code → Download ZIP** y descomprímelo.)

## 4. Genera tus claves

```bash
node scripts/configurar.mjs --client-id "TU-ID" --client-secret "TU-SECRETO" --url "https://TU-APP.vercel.app" --nombre "Personal"
```

(Sin parámetros, te los pregunta.) La contraseña de la web se genera sola, larga y aleatoria, y queda en `contrasena.txt`. También puedes entrar siempre con tu cuenta de Google.

Luego abre el navegador para que elijas tu **cuenta principal** de Gmail y **marques todas las casillas**. Esa cuenta es la «ancla»: guarda en su Drive, cifrado, el almacén de permisos, y recibe los avisos si otra cuenta se desconecta.

Al terminar tendrás un fichero `configuracion.env` con todo:

| Variable | Qué es |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | tu cliente OAuth |
| `BZ_URL` | la dirección de tu app |
| `BZ_CUENTAS`, `BZ_ANCLA`, `RT_ANCLA` | tu cuenta principal y su permiso |
| `SESSION_SECRET`, `TOKEN_KEY` | firman la sesión y cifran el almacén |
| `APP_PASSWORD_HASH` | tu contraseña, cifrada (scrypt) |
| `VAPID_PUBLIC`, `VAPID_PRIVATE` | avisos al móvil |
| `VIGIA_KEY` | protege el aviso de cada minuto |
| `MCP_KEY_HASH` | la huella de la clave del MCP (la clave está en `clave-mcp.txt`) |

**Súbelas a Vercel**, con el script (sube cada variable y vuelve a desplegar; la primera vez enlaza la carpeta con `npx vercel link`):

```bash
node scripts/subir-a-vercel.mjs
```

O a mano: tu proyecto → **Settings → Environment Variables** → pega el contenido de `configuracion.env` (Vercel separa las variables solo) → entorno **Production** → Save. Después, en **Deployments**, pulsa los tres puntos del último → **Redeploy**.

> `configuracion.env`, `clave-mcp.txt` y `contrasena.txt` contienen claves privadas. Están en `.gitignore`: no los subas a GitHub ni los envíes a nadie. Cuando estén en Vercel (y la contraseña en tu gestor), puedes borrarlos; la clave del MCP la necesitas en el paso 8.

## 5. El aviso de cada minuto (correo nuevo y «Avísame si no contesta»)

Vercel Hobby no ejecuta tareas cada minuto, así que lo hace [cron-job.org](https://cron-job.org) (gratis):

1. **Create cronjob**:
   - Title: `buzonero`.
   - URL: `https://TU-APP.vercel.app/api/vigia`.
   - Execution schedule: **Every minute**.
2. En **Advanced → Headers**, añade:
   - Key: `x-vigia`.
   - Value: el valor de `VIGIA_KEY` de tu `configuracion.env`.
3. Método **GET**, Save. En el historial deberías ver respuestas `200`.

## 6. Entra y añade el resto de cuentas

1. Abre `https://TU-APP.vercel.app/app` y entra con tu cuenta de Google principal o con la contraseña.
2. Para cada cuenta más: engranaje → **Añadir cuenta** → elige la cuenta en Google → marca todas las casillas. Tiene que estar en la lista de usuarios de prueba del paso 2.3, o el proyecto publicado.
3. Las cuentas añadidas así pueden quitarse luego desde el mismo menú.

## 7. En el móvil

- **iPhone (iOS 16.4 o superior)**: abre la app en **Safari** → Compartir → **Añadir a pantalla de inicio**. Ábrela desde el icono, engranaje → **Avisos en este dispositivo** → Permitir.
- **Android**: Chrome → menú → **Instalar aplicación**, y activa los avisos igual.

## 8. Conecta el MCP a tu agente de IA

Guarda la clave donde el MCP la busca: `~/.config/buzonero/mcp-key.txt` (en Windows, `C:\Users\TU-USUARIO\.config\buzonero\mcp-key.txt`) con el contenido de `clave-mcp.txt`. Luego regístralo (`RUTA` = la carpeta donde clonaste el repositorio; no la muevas después):

- **Claude Code**: `claude mcp add buzonero --scope user -e BUZONERO_URL=https://TU-APP.vercel.app -- node "RUTA/mcp/buzonero-mcp.mjs"`
- **Cursor, Windsurf, Claude Desktop** (JSON de MCP): `{ "mcpServers": { "buzonero": { "command": "node", "args": ["RUTA/mcp/buzonero-mcp.mjs"], "env": { "BUZONERO_URL": "https://TU-APP.vercel.app" } } } }`
- **Codex** (`~/.codex/config.toml`): `[mcp_servers.buzonero]` con `command = "node"`, `args = ["RUTA/mcp/buzonero-mcp.mjs"]` y `env = { BUZONERO_URL = "https://TU-APP.vercel.app" }`

Reinicia el agente y pídele: «¿qué cuentas de correo tengo?». La lista de las 33 herramientas está en el [README](README.md). Quien tenga la clave del MCP puede leer tu correo: guárdala como una contraseña. Para cambiarla, vuelve a lanzar `configurar.mjs` o pon en Vercel un `MCP_KEY_HASH` nuevo (el SHA-256 en hexadecimal de la clave).

---

## Opcional

- **Que también puedan entrar otras cuentas con Google**: por defecto solo entra la cuenta ancla (y la contraseña). Para permitir más, añade la variable `BZ_ENTRAR` con los correos separados por comas.
- **Cuentas fijas en la configuración**: `BZ_CUENTAS` admite varias cuentas, cada una con su permiso en su propia variable:

  ```json
  [{"k":"yo","email":"tu@gmail.com","nombre":"Personal","ini":"TU","env":"RT_ANCLA","entrar":true},
   {"k":"tr","email":"tu@empresa.com","nombre":"Trabajo","ini":"TR","entrar":true}]
  ```

  Sin `env`, el permiso se guarda en el almacén cifrado al pulsar «Reconectar» desde la app.
- **Usar la API sin el MCP**: `GET /api/token?acc=CLAVE` con la cabecera `Authorization: Bearer <clave del MCP>` devuelve un token de Gmail de una hora para esa cuenta, y `?lista=1` devuelve las cuentas.

## Problemas frecuentes

| Síntoma | Causa y arreglo |
|---|---|
| `redirect_uri_mismatch` al entrar con Google | La dirección de `BZ_URL` y la del paso 2.5 no coinciden exactamente (https, sin barra final). |
| «Esa cuenta de Google no tiene acceso» | Solo entran la cuenta ancla y las de `BZ_ENTRAR`. Usa la contraseña o añade el correo. |
| Una cuenta se desconecta cada 7 días | La app de Google sigue «En prueba». Publícala (paso 2.4) y reconecta. |
| No llegan avisos al móvil | En el iPhone, la app tiene que abrirse desde el icono de la pantalla de inicio. Revisa también que cron-job.org dé `200`. |
| Error 500 en todo | Falta alguna variable o no volviste a desplegar después de añadirlas (paso 4). |
| «Faltan permisos» al conectar | Marca todas las casillas en la pantalla de Google. |

## Seguridad, en corto

- **La sesión** va en una cookie `HttpOnly`, `Secure` y `SameSite=Strict`, firmada con `SESSION_SECRET`.
- **Los permisos de Google** se guardan cifrados (AES-256-GCM, `TOKEN_KEY`) en un fichero del Drive de tu cuenta ancla que solo ve esta app.
- **El contenido de tus correos no se guarda** en el servidor. Tu navegador lo pide directamente a Google con tokens de una hora.
- **Si crees que alguna clave se ha filtrado**: cambia la variable en Vercel, vuelve a desplegar y retira los permisos en [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
