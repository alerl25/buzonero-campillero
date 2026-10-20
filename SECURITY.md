# Seguridad

Buzonero Campillero tiene acceso completo a tu Gmail. Cada instalación es tuya y la gestionas tú: lee esto antes de usarla.

## Cómo protege tus datos

- **Tus correos no se guardan en el servidor.** El navegador los pide directamente a Google con tokens que caducan en una hora.
- **Los permisos de Google** (refresh tokens) se guardan cifrados con AES-256-GCM (`TOKEN_KEY`) en un fichero del Drive de tu cuenta ancla al que solo accede esta app (`drive.file`).
- **La sesión** va en una cookie `HttpOnly`, `Secure` y `SameSite=Strict` firmada con HMAC.
  - Para cerrar todas las sesiones abiertas, cambia `BZ_SESION_VER` en Vercel y vuelve a desplegar.
- **La contraseña** se guarda como hash scrypt.
  - Tras 10 fallos en una hora, el acceso por contraseña se bloquea durante esa hora.
- **El HTML de los correos** se pinta en un iframe aislado (`sandbox` sin scripts y con su propia CSP).
  - Los enlaces se abren aparte, con `noopener`. Los esquemas peligrosos (`javascript:` y similares) se eliminan.
- **Las librerías de CDN** cargadas con `<script>` llevan huella SRI.
- **Cabeceras de seguridad:** CSP en `/app`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin` y HSTS.
- **La baja de suscripciones** en un clic solo llama a direcciones `https` públicas: nunca a IPs internas.

## Integraciones opcionales (WhatsApp, Contactos de Google y Metricool)

- **WhatsApp (Zernio) es solo lectura por diseño.** El servidor no tiene ningún camino que envíe mensajes ni que los marque como leídos. Los mensajes no se guardan: se leen de Zernio en cada petición. La clave `ZERNIO_API_KEY` vive solo en las variables de entorno de Vercel; el navegador nunca la ve.
- **Metricool**: el permiso (conexión por MCP, con OAuth y PKCE) o el token (conexión por API) se guardan **cifrados** en el almacén de tu Drive, igual que los permisos de Google, y nunca llegan al navegador. Las acciones de Metricool (`mc-*`) solo se aceptan con la sesión de la app y se **rechazan con la clave del MCP**, así que un agente de IA no puede publicar por ti. Programar exige una confirmación explícita en pantalla.
- **Contactos de Google** es una conexión **aparte** con solo el permiso `contacts.readonly` (no añade una cuenta de correo). Se guarda cifrado el permiso, no los contactos: el cruce por teléfono se hace en el servidor y a la pantalla solo llegan el nombre y la foto de quien escribió.
- **Nombres y etapas del CRM** (los nombres que pones a los números de WhatsApp y la etapa de cada lead de WhatsApp) se guardan cifrados en el almacén del CRM.

## Límites conocidos

- **Imágenes remotas:** se cargan directamente desde el remitente, como en muchos clientes de correo. El remitente puede saber cuándo abres un correo y tu IP.
- **Scripts en línea:** la CSP permite `'unsafe-inline'` porque la app es un único HTML con su JavaScript dentro.
- **Librerías sin huella SRI:** algunas se cargan bajo demanda como módulos ES desde jsDelivr (detección de fechas y teléfonos, visor de PDF). Llevan versión fija, pero sin SRI.
- **Clave del asistente:** la clave opcional del asistente de IA (`MCP_KEY_HASH`) da acceso a todas las cuentas. Guárdala como una contraseña.
- **Permiso de Metricool amplio:** el permiso que da Metricool a Buzonero permite ver y gestionar tus marcas y métricas y publicar. Revísalo en la pantalla de permiso (que avisa de «Aplicación no verificada» porque es tu propia app) y quítalo desde Integraciones cuando no lo uses.
- **Zernio ve tus conversaciones de WhatsApp:** es el servicio que se conecta a tu número. Lee su política antes de conectarlo.

## Buenas prácticas

- Usa una contraseña larga y única: una frase de 4 o 5 palabras. Mejor aún, entra con Google.
- No compartas `configuracion.env` ni `clave-mcp.txt`, y no los subas a ningún repositorio.
- Si sospechas de una filtración:
  1. Cambia `SESSION_SECRET`, `TOKEN_KEY` (tendrás que reconectar las cuentas), `APP_PASSWORD_HASH` y `VIGIA_KEY`.
  2. Vuelve a desplegar.
  3. Retira los permisos en [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Avisar de una vulnerabilidad

No abras un issue público. Usa **Security → Report a vulnerability** en este repositorio (aviso privado de GitHub).
