# Buzonero Campillero

**Versión 1.0**

Todos tus correos de Gmail en un solo sitio: una app web (PWA) rápida, bonita y privada para leer y gestionar varias cuentas de Gmail y Google Workspace a la vez, en el ordenador y en el móvil.

Cada persona se instala la suya, gratis, en su propio Vercel y con su propio proyecto de Google. Tu correo no pasa por ningún servidor ajeno.

> *English: a self-hosted, multi-account Gmail web client (PWA). Free to run on Vercel Hobby + your own Google Cloud project. UI in Spanish. Setup guide: [INSTALAR.md](INSTALAR.md).*

## Qué hace

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

## Instalar

Sigue **[INSTALAR.md](INSTALAR.md)**: Google Cloud, Vercel y el aviso de cada minuto, con un script que genera todas las claves (`node scripts/configurar.mjs`).

Coste: 0 €. Vercel Hobby, Google Cloud sin facturación y cron-job.org son gratuitos para este uso.

## Cómo está hecho

| Ruta | Qué es |
|---|---|
| `app/index.html` | La app entera: un único fichero HTML con su JavaScript, sin compilación |
| `app/tema.css` | Diseño y temas, que se generan con `scripts/temas.py` |
| `app/particulas.js` | Fondo de partículas en WebGL |
| `sw.js` | Service worker: avisos y globo del icono |
| `api/` | Funciones de Vercel (Node 20, sin dependencias): sesión, acceso con Google, tokens, avisos, almacén cifrado |
| `scripts/configurar.mjs` | Genera la configuración de una instalación nueva |

## Licencia

[MIT](LICENSE). Úsala, cámbiala y compártela libremente.

Buzonero Campillero no está afiliado a Google. Gmail, Google Drive y Google Calendar son marcas de Google LLC.
