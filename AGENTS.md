# Instrucciones para el agente de IA: instalar Buzonero Campillero

Estás leyendo esto porque alguien te ha pasado este repositorio y te ha pedido que se lo instales. Eres su guía. Al terminar tendrá:

1. **Su propia app de correo** en su Vercel, con todas sus cuentas de Gmail.
2. **El MCP de Buzonero conectado a ti**, para que puedas leer, buscar, ordenar y redactar en todas sus cuentas a la vez.

Todo es gratis: Vercel Hobby, Google Cloud sin facturación y cron-job.org. Si en algún paso piden tarjeta o un plan de pago, para y avisa: alguien se ha equivocado de opción.

## Cómo trabajar con la persona

- **Habla en su idioma**, sin jerga, y un paso cada vez. Antes de cada paso dile qué vas a hacer y para qué, en una frase.
- **Lo que se puede hacer con comandos, lo haces tú.** A la persona solo le pides clics en el navegador (Google Cloud, Vercel, cron-job.org). Dale siempre el enlace exacto y los valores exactos que tiene que copiar.
- **Comprueba cada paso antes de seguir**: el comando dio bien, la página responde, la variable está.
- **Nunca enseñes ni pegues en el chat** el contenido de `configuracion.env`, `clave-mcp.txt` ni `contrasena.txt`. Tampoco los subas a git: ya están en `.gitignore`. La contraseña de la web está en `contrasena.txt`: dile que la abra él y la guarde en su gestor de contraseñas.
- **Si algo falla**, mira «Problemas frecuentes» en [INSTALAR.md](INSTALAR.md) antes de improvisar.

## Paso 0 · Comprobar el ordenador (tú)

```bash
node --version   # tiene que ser 20 o superior; si no, que instale Node LTS desde https://nodejs.org
git --version
```

Si la persona solo ha pegado el enlace, clona el repositorio en una carpeta que vaya a conservar: el MCP se ejecutará desde ahí.

```bash
git clone https://github.com/alerl25/buzonero-campillero.git
cd buzonero-campillero
```

## Paso 1 · Publicar en Vercel (tú, con un clic suyo para entrar)

```bash
npx --yes vercel@latest login          # le abre el navegador para entrar o crear la cuenta gratis
npx --yes vercel@latest deploy --prod --yes
```

- Del resultado, apunta la **dirección de producción**. Es del estilo `https://buzonero-campillero-xxxx.vercel.app`, o la de «Aliased». A partir de aquí la llamamos `URL`. La app aún no funciona: faltan las claves.
- Si quiere otra dirección, se cambia en Vercel → el proyecto → Settings → Domains. Tiene que ser la definitiva antes del paso 2.

## Paso 2 · Proyecto de Google Cloud (la persona, guiada por ti)

Que entre con su cuenta de Gmail **principal** y vaya haciendo esto (dale cada enlace en su momento):

1. **Crear el proyecto**: https://console.cloud.google.com/projectcreate → nombre `buzonero` → Crear. Que se asegure de que queda seleccionado arriba.
2. **Activar las cuatro APIs de una vez**: https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com,drive.googleapis.com,people.googleapis.com,calendar-json.googleapis.com → Siguiente → Habilitar.
3. **Marca de la app**: https://console.cloud.google.com/auth/branding.
   - Si pide empezar, «Comenzar».
   - Nombre: `Buzonero`. Correo de asistencia: el suyo.
   - Tipo de usuario: **Externo**. Correo de contacto: el suyo.
   - Página principal: `URL`. Política de privacidad: `URL/privacidad`. Dominio autorizado: `vercel.app`.
4. **Publicarla (importante)**: https://console.cloud.google.com/auth/audience → **Publicar aplicación** → Confirmar. Debe quedar **«En producción»**.
   - Si se queda «En prueba», Google caduca los permisos a los 7 días.
   - No hace falta pedir verificación. Avísale de que al conectar verá «Google no ha verificado esta aplicación»: es su propia app, y se sigue con **Configuración avanzada → Ir a Buzonero (no seguro)**.
5. **Cliente OAuth**: https://console.cloud.google.com/auth/clients/create.
   - Tipo: **Aplicación web**. Nombre: `Buzonero web`.
   - **URIs de redireccionamiento autorizados**, los dos exactamente así:
     - `URL/api/auth/callback`
     - `http://localhost:53682/callback`
   - Crear.
   - Que te pase el **ID de cliente** y el **secreto de cliente**. Son datos de su propio proyecto y los necesitas para el paso 3.

## Paso 3 · Generar las claves y conectar su cuenta principal (tú, con un clic suyo)

```bash
node scripts/configurar.mjs --client-id "ID" --client-secret "SECRETO" --url "URL" --nombre "Personal"
```

- Se abre el navegador. Que elija su cuenta **principal** de Gmail y marque **todas** las casillas de permisos.
  - Si no se abre, el script imprime el enlace: pásaselo.
  - Esa cuenta es la «ancla»: guarda en su Drive, cifrado, el almacén de permisos, y recibe los avisos.
- El script deja `configuracion.env`, `clave-mcp.txt` y `contrasena.txt`. **Súbelo y despliega:**

```bash
node scripts/subir-a-vercel.mjs
```

- **Comprueba:** abre `URL/app` (o pídele que la abra). Tiene que salir la pantalla de entrada. Si sale un error 500, falta alguna variable: vuelve a lanzar el script anterior.

## Paso 4 · El aviso de cada minuto (la persona, guiada por ti)

Vercel Hobby no ejecuta tareas cada minuto. Por eso lo hace cron-job.org, que solo hace de timbre y no ve el correo.

1. Que cree una cuenta gratis en https://console.cron-job.org/signup (tiene captcha: lo hace ella).
2. **Create cronjob**:
   - Title: `buzonero`.
   - URL: `URL/api/vigia`.
   - Execution schedule: **Every 1 minute**.
3. En **Advanced → Headers**, añadir la cabecera `x-vigia` con el valor de `VIGIA_KEY`.
   - Ese valor está en `configuracion.env`. Puedes ponérselo en el portapapeles en vez de enseñarlo:
     - Windows: `powershell -c "(Select-String -Path configuracion.env -Pattern '^VIGIA_KEY=').Line.Substring(10) | Set-Clipboard"`
     - Mac: `grep ^VIGIA_KEY= configuracion.env | cut -d= -f2- | pbcopy`
4. Guardar. En el historial deben salir respuestas `200` al minuto.

## Paso 5 · Entrar y añadir el resto de cuentas (la persona)

1. Abrir `URL/app` y entrar con su cuenta principal de Google, o con la contraseña de `contrasena.txt`.
2. Para cada cuenta más: engranaje → **Añadir cuenta** → elegirla en Google → marcar todas las casillas.

## Paso 6 · Conectarte el MCP (tú)

Guarda la clave del MCP donde el MCP la busca por defecto y borra la copia de la carpeta:

```bash
mkdir -p ~/.config/buzonero && cp clave-mcp.txt ~/.config/buzonero/mcp-key.txt && rm clave-mcp.txt
# Windows PowerShell:
#   New-Item -ItemType Directory -Force "$HOME\.config\buzonero"; Move-Item clave-mcp.txt "$HOME\.config\buzonero\mcp-key.txt"
```

Regístralo en el agente que estés usando. `RUTA` es la ruta absoluta de esta carpeta.

- **Claude Code:**

  ```bash
  claude mcp add buzonero --scope user -e BUZONERO_URL=URL -- node "RUTA/mcp/buzonero-mcp.mjs"
  ```

- **Cursor** (`~/.cursor/mcp.json`), **Windsurf**, **Claude Desktop** y cualquiera que use el formato JSON de MCP:

  ```json
  { "mcpServers": { "buzonero": { "command": "node", "args": ["RUTA/mcp/buzonero-mcp.mjs"], "env": { "BUZONERO_URL": "URL" } } } }
  ```

- **Codex** (`~/.codex/config.toml`):

  ```toml
  [mcp_servers.buzonero]
  command = "node"
  args = ["RUTA/mcp/buzonero-mcp.mjs"]
  env = { BUZONERO_URL = "URL" }
  ```

Para que el MCP aparezca, la persona tiene que reiniciar el agente (o recargar los MCP). **Compruébalo:** llama a la herramienta `cuentas`. Tienen que salir sus cuentas con `conectada: true`.

## Paso 7 · El móvil (la persona)

- **iPhone (iOS 16.4 o superior):** abrir `URL/app` en **Safari** → Compartir → **Añadir a pantalla de inicio**. Abrirla desde el icono → engranaje → **Avisos en este dispositivo** → Permitir.
- **Android:** Chrome → menú → **Instalar aplicación**, y lo mismo para los avisos.

## Paso 8 · Opcional: WhatsApp, Contactos de Google y Metricool (la persona, guiada por ti)

No lo hagas si no lo pide. Es todo opcional y se gestiona desde el botón **Integraciones** de la app. La guía detallada está en [INSTALAR.md](INSTALAR.md) («Opcional: WhatsApp, Contactos de Google y Metricool»). Lo esencial:

- **WhatsApp (Zernio), solo lectura**: la persona crea su cuenta en zernio.com y conecta su número; tú pones `ZERNIO_API_KEY` en las variables de Vercel y vuelves a desplegar. Avísale de que conectar un número a la API de WhatsApp Business puede dejar de funcionar en la app del móvil. Para que cada conversación sea un lead: CRM → Integraciones → WhatsApp (Zernio).
- **Contactos de Google**: Integraciones → Contactos de Google → Conectar (solo lectura, aparte, no es una cuenta de correo). **Nunca lo conectes por tu cuenta**: es un clic de la persona.
- **Metricool**: Integraciones → Metricool → por MCP (su cuenta, cualquier plan) o por API (token + userId, planes Advanced o Custom). El permiso lo da la persona en Metricool.

**Reglas que no se rompen:** WhatsApp es solo lectura (no contestes ni marques como leído); tú no tienes herramientas de redes sociales y no publicas por la persona; cualquier programación la confirma ella en pantalla.

## Al terminar

Resume a la persona lo que tiene, en pocas líneas:
- la dirección de su app;
- cómo entrar;
- que ya puedes manejar su correo desde aquí;
- un ejemplo para probarlo: «busca en todas mis cuentas las facturas de este mes».

Recuérdale tres normas del MCP:
- por defecto deja borradores;
- enviar, darse de baja y bloquear piden su confirmación;
- su correo no sale de su Google, su Vercel y su ordenador.

## Lo que hace el MCP (39 herramientas)

| Grupo | Herramientas |
|---|---|
| CRM | `crm`, `leads` (etapa, turno y Nexudus de cada lead), `mover_lead`, `anadir_al_crm` |
| WhatsApp (solo lectura) | `whatsapp` (conversaciones recientes), `whatsapp_leer` (los mensajes de una conversación) |
| Calendario de Google | `calendarios`, `eventos`, `crear_evento`, `modificar_evento`, `borrar_evento` |
| Varias cuentas a la vez | `cuentas`, `buscar_en_todas` (bandeja unificada o búsqueda en todas), `paquetes`, `suscripciones`, `basura_parada`, `avisos_pendientes`, `buscar_contacto` |
| Leer y buscar | `buscar`, `leer_hilo`, `descargar_adjunto` |
| Escribir | `crear_borrador` (nuevo, respuesta o reenvío con adjuntos), `enviar`, `enviar_borrador`, `listar_borradores`, `borrar_borrador` |
| Ordenar | `modificar_hilos` (archivar, leído, destacar, spam, papelera, etiquetas; por ids o por búsqueda), `etiquetas`, `crear_etiqueta`, `color_etiqueta` |
| Seguimiento | `avisame_si_no_contesta`, `quitar_aviso` |
| Limpieza | `darse_de_baja`, `bloquear_remitente`, `filtros`, `crear_filtro`, `borrar_filtro` |
| Cuenta | `firma`, `cambiar_firma` |

## Si vas a tocar el código (no para instalar)

- **Sin compilación ni dependencias.**
  - `app/index.html` es la app; las vistas grandes van aparte: el CRM en `app/crm.js`, el calendario en `app/calendario.js`, WhatsApp en `app/mensajes.js`, el panel de Integraciones en `app/integraciones.js` y Redes sociales (Metricool) en `app/redes.js`.
  - **Vercel Hobby admite 12 funciones y ya están usadas.** Una ruta nueva va dentro de una existente: `api/zernio.js` es el enrutador de integraciones (WhatsApp, Contactos y Metricool, con `?r=` y `accion`). Las ayudas `api/_*.js` no cuentan como función.
  - Las rutas `mc-*` (Metricool) solo se aceptan con sesión de la app, nunca con la clave del MCP; y no hay ningún camino de escritura hacia WhatsApp.
  - `app/tema.css` se genera en parte con `python scripts/temas.py app`.
  - `api/` son funciones de Vercel en Node 20.
  - `mcp/buzonero-mcp.mjs` es el MCP.
- **Seguridad, antes de cambiar nada:** lee [SECURITY.md](SECURITY.md). Hay dos reglas que no se rompen:
  - nunca convertir HTML de un correo con `createElement(...).innerHTML` (usa `htmlATexto`);
  - nunca pintar datos de un correo sin `esc()`.
