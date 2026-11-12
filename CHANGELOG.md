# Cambios

Todas las versiones de Buzonero Campillero. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.23.2] · 2026-11-12

### Corregido
- **Avisos de tu propio correo.** Al escribir desde una de tus cuentas con copia a otra persona cuya cuenta también está en Buzonero, ese correo llegaba a la bandeja de la otra persona y avisaba en tu móvil como si fuera de fuera. Ahora no avisa (ni el aviso al móvil ni el de la app abierta) cuando el remitente es otra de tus cuentas fijas (`BZ_CUENTAS`). Las cuentas añadidas con «Añadir cuenta» cuentan como de otra persona: si te escribe, sí avisa.

## [1.23.1] · 2026-11-11

### Corregido
- **El número rojo del icono enseñaba 56 sin haber nada nuevo.** Era «correos sin leer de Principal del último mes», sumados en todas las cuentas. Ahora cuenta los avisos recibidos desde la última vez que abriste la app, arranca en 0 y se pone a 0 al abrirla (o volver a ella). Lo suma el service worker en el dispositivo, así que el servidor ya no hace 5 consultas a Gmail por cada aviso. Con la app a la vista no suma. `pruebas/badge-sw.mjs` lo comprueba sin navegador.
- Filtro de basura de TikTok por dominio (`from:tiktok.com`) en las cuentas de correo propias: se escapaban los boletines de TikTok («X está en tus contactos»).

## [1.23.0] · 2026-11-11

Servidor más firme y el pie de «Redactar» arreglado al responder dentro del hilo.

### Corregido
- **Pie de redactar al responder en el hilo (ordenador):** con el hilo abierto el hueco de la respuesta es estrecho aunque la pantalla sea ancha, y «Borrar borrador» se salía por la derecha y sacaba una barra horizontal. El pie ahora se adapta al ancho que tiene (no al de la pantalla): primero «Borrar borrador» pasa a papelera, luego el aviso «Borrador guardado» pasa a un punto y, en el hueco más estrecho, los botones se aprietan. Medido de 920 a 1920 px, con y sin micrófono: sin desbordes.

### Servidor
- **Tiempo límite en toda llamada de fuera** (25 s; 10 s en los avisos al móvil): un Google, un Drive o un CRM que no contesta ya no deja la función colgada.
- **El freno de contraseñas no se apaga si Drive cae:** cuenta los fallos de la instancia (5 por hora) y sigue frenando a quien prueba claves; quien sabe la contraseña entra igual.
- **Los puntos del vigía tienen su fichero** (`buzonero-hist.enc`): el vigía ya no reescribe cada minuto el almacén de permisos, así que no puede pisarlos con una copia vieja. La primera vez parte del historial que había y vacía el del almacén. El vigía tampoco se pisa a sí mismo si una pasada tarda más de un minuto (`maxDuration` 60 s).
- **Lecturas del almacén compartidas:** las lecturas simultáneas (el arranque pide una por cuenta) hacen una sola ida a Drive, y con el archivo ya localizado se lee directo (una ida en vez de dos). Una lectura «fresca» nunca se une a una normal, para que quien va a escribir no parta de una copia vieja si Drive falla.
- **Permisos de acceso reutilizados** hasta 10 min (y mientras queden más de 5 de vida y el permiso largo no cambie): el vigía los pedía a Google cada minuto y el arranque, uno por cuenta. Si Gmail da 401, la app pide uno nuevo con `&nuevo=1` y no se queda con el caído; reconectar una cuenta también invalida el guardado.

### Para quien mantiene
- `pruebas/servidor.mjs`: prueba sin red (Drive y Google simulados) de todo lo anterior. `node pruebas/servidor.mjs`.
- Queda tal cual, a propósito: los dispositivos «solo leads» (`BZ_AVISOS_LEADS`) limitan los AVISOS, no el acceso; esas cuentas usan la app completa y por eso piden cualquier `/api/token`.

## [1.22.0] · 2026-11-11

Repaso completo de la app: velocidad de apertura, fluidez, adaptación a móvil y tablet, y errores encontrados por el camino. Medido antes y después con `pruebas/rendimiento.mjs` (mediana de 3, Chromium; móvil = 393 px con la CPU frenada ×4).

### Velocidad
- **La bandeja sale al instante al abrir la app.** La primera página de Recibidos, los contadores y las etiquetas de cada cuenta se guardan en el dispositivo y se enseñan nada más abrir; se ponen al día por detrás sin repintar si no ha cambiado nada. Caduca a los 3 días y se borra al cerrar sesión.
- **Arranque adelantado:** la sesión y el permiso de la cuenta abierta se piden desde el `<head>`, mientras baja el resto de la página.
- **Un permiso por cuenta, no cuatro.** Al abrir se pedían 20 permisos (`/api/token`) para 5 cuentas; ahora 5. Las peticiones a Google van sin caché del navegador (`cache:'no-store'`): con caché, Chrome ponía en fila las que comparten dirección entre cuentas (perfil, etiquetas, contadores).
- **La lista ya no espera a las etiquetas:** se piden a la vez.
- **Los primeros correos de la lista se traen por detrás** (de dos en dos, sin «ahorro de datos» ni en segundo plano): al tocarlos se abren al momento. Un correo ya traído vale mientras Gmail diga que no ha cambiado (hasta 10 min).
- **Iconos:** solo los dos estilos que usa la app (antes el script del paquete cargaba los seis, unos 500 kB de CSS, bloqueando la página). La letra se pide en el `<head>` (antes con un `@import` encadenado) y con `display=optional`: no hay cambio de letra a mitad de carga.
- **Servidor en Europa:** las funciones estaban en Washington (`iad1`); ahora en París (`cdg1`). `integraciones`, `estado` y `conversaciones` piden sus datos a la vez en lugar de en fila; la agenda y las cuentas de Zernio se recuerdan un rato; los avisos no releen el almacén por cada envío; la comprobación de versión usa una ruta ligera (`/api/session?r=version`).

### Fluidez
- Fechas y números: los formateadores se crean una vez (crearlos por fila era lo más caro de pintar la lista).
- Las pestañas de cuenta no se vuelven a crear si no cambian, y lo que hay que medir en pantalla se mide una vez por fotograma.
- Sin saltos al cargar: las primeras filas ya no pasan un fotograma con la altura estimada (CLS 0).
- Sin fogonazo blanco al abrir con un tema oscuro: el tema se pone antes del primer pintado.
- Partículas: se paran cuando en el móvil se está leyendo un correo y con cualquier ventana abierta; `low-power`; «reducir movimiento» se respeta entero.
- CRM: no pierde la posición al abrir una ficha o cambiar una etapa; el buscador ya no repinta en cada tecla. Leads: no repinta si no hay novedades.

### Adaptación a móvil y tablet
- Zona segura también en la cabecera de las ventanas (redactar, evento, firma, temas) y en el pie de las vistas con desplazamiento propio.
- «Borrar borrador» ya no se sale ni pisa el botón de la firma en el móvil.
- «Redactar» flotante no tapa las vistas que no son correo.
- Calendario: con el dedo ya no se arrastran eventos por accidente; el formulario se desplaza con el teclado abierto; la tarjeta del evento es una hoja inferior; en el móvil se entra por «Día». WhatsApp: botón de volver del chat a la lista. Controles pequeños más grandes al tacto.

### Corregido
- **CRM: al cambiar de CRM se mezclaban filas del anterior**, y cambiar una etapa podía escribirla en el CRM equivocado.
- Calendario: al pasar rápido de semana, los eventos de una se guardaban como de otra; doble toque en «Guardar» creaba dos eventos; tocar fuera de la tarjeta abría «Nuevo evento».
- Redes: una respuesta atrasada podía pintar la semana que no era. Avisos: varios interruptores seguidos podían dejar en el servidor una lista vieja.

### Para quien mantiene
- `pruebas/rendimiento.mjs` (tiempos) y `pruebas/humo-vistas.mjs` (todas las vistas en cinco tamaños: errores, desbordes, zona segura).
- Variables nuevas: ninguna. `vercel.json` lleva `regions: ["cdg1"]`: cámbiala a la región más cercana a ti.

## [1.21.0] · 2026-11-11

### iPhone
- **La app ya no queda cortada bajo la isla dinámica ni el notch.** La app dibuja a pantalla completa (`viewport-fit=cover`) y la barra de estado del iPhone se pintaba encima de la cabecera. Ahora la cabecera, la barra del lector de correo, el cajón del menú, el aviso rojo, los avisos animados, el visor de adjuntos y la pantalla de acceso cuentan con el margen de seguridad de arriba (`env(safe-area-inset-top)`), y la app con los márgenes laterales en horizontal. En ordenador y en móviles sin muesca el margen vale 0 y no cambia nada.

### Avisos
- **Aviso instantáneo desde el CRM externo.** Además del vigía de cada minuto, el CRM puede dar un «toque» a `/api/zernio?r=crm-aviso&t=<CRM_EXT_HOOK>` cuando entra un contacto o una nota de entrada; Buzonero no usa nada del cuerpo, consulta él el CRM y avisa con la misma lógica (`api/_crmaviso.js`, `detectarCrmExt` compartida con el vigía). Sin sesión, con clave comparada en tiempo constante y un freno de 15 s. Medido: ~3 s desde la entrada hasta el aviso. El vigía sigue de red de seguridad y enseña `crmToqueUltimo`.
- Variable nueva: `CRM_EXT_HOOK` (clave del toque).

## [1.20.1] · 2026-11-11

### Avisos
- **Las cuentas «solo leads» (`BZ_AVISOS_LEADS`) ya no ven ni oyen nada que no sea de leads, tampoco dentro de la app.** Hasta ahora el límite solo filtraba el aviso al móvil; el aviso animado, el sonido y el número rojo del icono (correos sin leer) seguían saliendo en esas sesiones. Ahora el servidor dice a la app que la sesión es «solo leads» (`/api/session` → `soloLeads`), la app silencia todo menos los leads y Ajustes enseña «Esta cuenta solo recibe avisos de leads» en vez de los interruptores.
- **Los dispositivos guardan quién los registró (`quien`).** Antes, un dispositivo dado de alta desde una sesión sin correo (anterior a 1.19.3) quedaba sin limitar y seguía recibiendo todo.
- **Purga de una sola vez de dispositivos sin identificar:** `BZ_PURGA_PUSH_DESDE` (fecha ISO) quita los dispositivos dados de alta desde esa fecha sin `quien`; cada uno se vuelve a registrar solo al abrir la app, ya etiquetado. Se ejecuta una vez por valor.
- Cambiar `BZ_SESION_VER` cierra todas las sesiones: así ninguna sesión antigua (sin correo) puede saltarse el límite.
- El resultado del vigía incluye `purgados`.

## [1.20.0] · 2026-11-11

### Avisos
- **Silenciar cada origen de aviso, a tu gusto.** En Ajustes → «Qué te avisa» hay un interruptor por cada cuenta de correo, WhatsApp, los leads del CRM externo, los leads que detecta el correo, «Avísame si no contesta» y los envíos programados, más dos atajos: «Silenciar todo el correo» y «Avisar de todo». Lo silenciado no se manda al móvil (el servidor ni lo envía) ni sale como aviso animado ni suena dentro de la app. Se configura por dispositivo: el móvil puede avisar solo de leads y WhatsApp mientras el ordenador sigue avisando de todo.
- Cada aviso del vigía lleva ahora su origen (`fuente`) y cada dispositivo guarda lo que silencia; la lista viaja con cada alta del dispositivo y se mantiene igual en servidor y dispositivo. Los dispositivos «solo leads» (`BZ_AVISOS_LEADS`) siguen limitados por encima de lo que cada uno elija.
- La regla de quién recibe qué vive en una función pura (`debeAvisar`) con sus casos probados.

## [1.19.4] · 2026-11-10

### Avisos
- **Menos retraso en los avisos del CRM externo.** El vigía mira el CRM en cada pasada (cada minuto) en vez de en los minutos pares, y se salta la memoria intermedia: antes un aviso podía tardar hasta 2 minutos, ahora como máximo lo que tarde el despertador externo (un minuto) más unos 4 s de proceso. La vista de la app se refresca cada 30 s con la vista abierta (la memoria del servidor baja a 25 s). Coste: unos 1,3 GB al mes de salida del CRM, dentro del límite gratuito.

## [1.19.3] · 2026-11-10

### Avisos
- **Dispositivos «solo leads».** Nueva variable `BZ_AVISOS_LEADS` (correos separados por comas): los dispositivos de quien entra con una de esas cuentas solo reciben los avisos del CRM externo; ni correo, ni WhatsApp, ni seguimientos, ni el número rojo del icono (que cuenta correos sin leer). La sesión de Google ahora guarda, firmado, el correo con el que se entró; al registrar un dispositivo (la app lo repite cada vez que se abre) se etiqueta según quien lo usa en ese momento. La sesión por contraseña no lleva correo y queda sin limitar. El acceso a la app sigue siendo completo: esto solo filtra los avisos al móvil.
- El resultado del vigía enseña `movilesSoloLeads` (dispositivos limitados).

## [1.19.2] · 2026-11-10

### Avisos
- **Avisa también de quien ya estaba en el CRM y vuelve a entrar.** Un contacto repetido (mismo teléfono o correo) no crea ficha nueva: el CRM solo apunta una nota automática. Hasta ahora esos no avisaban. Ahora el vigía mira las fichas actualizadas desde su último paso y avisa «Vuelve a entrar · …» solo si traen una nota de entrada (formulario, reserva de llamada, QR, inscripción o diagnóstico). Las ediciones («Datos cambiados…»), los cambios de estado y las notas del equipo siguen sin avisar.
- Segundo comando de solo lectura del CRM externo: `ver` (las notas de una ficha), junto a `listar`. Nada de lo que llega de la app o del conector puede escribir ni borrar.
- El resultado del vigía enseña `crmVuelven`, `llamadasInstancia` e `instanciaMin` (cuántas veces han llamado a la instancia y desde cuándo vive): sirve para comprobar de un vistazo que el despertador externo está llamando cada minuto.

## [1.19.1] · 2026-11-10

### App web
- **Leads externos: «nuevo» ya no se inunda con las importaciones.** El globo de la barra y la marca «Nuevo» de las tarjetas cuentan solo lo que se da de alta después de abrir la vista por primera vez en cada navegador (como ya hacía WhatsApp), así que una importación de cientos de contactos no sale como cientos de «nuevos».
- **Solo cuenta lo que entra.** Un cambio de datos en una ficha del CRM no avisa ni se muestra: la vista oculta la nota automática «Datos cambiados…» y el aviso salta únicamente cuando entra un contacto nuevo.
- **Pestañas por fecha.** La vista abre en «Todos» (la primera pestaña): todo lo que entra de fuera, con lo más reciente arriba y agrupado por día. Después van «Nuevos» (últimos 7 días), «Anteriores», «Café», «Redes», «Eventos» y «Personal» (los contactos importados del círculo del equipo, aparte para que una importación grande no tape los leads). Los tres cuadros de arriba (Nuevos · 7 días, Anteriores, Personal) son atajos: al pulsar uno, la vista salta a su pestaña. Desaparecen el filtro y el contador «Sin ver». La vista trae hasta 500 contactos (antes 150, que una importación grande llenaba). Los avisos al móvil siguen cubriendo todo.
- Botones de las tarjetas (Llamar, WhatsApp, abrir el CRM) con el estilo de la app, no como enlaces subrayados.

## [1.19.0] · 2026-11-10

### App web
- **Leads de un CRM externo, solo lectura.** Nueva vista «Leads <nombre>» en la barra lateral, con tarjetas de los 150 contactos más recientes de tu CRM, los nuevos marcados («Nuevo», globo con el número de sin ver), contadores, filtros (Todos, Sin ver, Café, Redes, Eventos), «Marcar todos como vistos» y botones de Llamar, WhatsApp y abrir tu panel. Solo sale si el servidor tiene el CRM conectado. Se actualiza sola (cada 60 s con la vista abierta, cada 5 min desde otra vista).
- **Aviso al móvil por cada contacto nuevo.** El vigía consulta el CRM cada 2 minutos y avisa de cada contacto con un id mayor que el último visto; si entran más de 5 a la vez (una importación), un solo aviso de resumen. La primera pasada solo apunta el punto de partida: no avisa de lo que ya había.
- **Buzonero nunca escribe en ese CRM.** El único comando que el código puede enviar es `listar`; el nombre de la acción está escrito en el servidor y no sale de ningún parámetro. La clave vive solo en variables de entorno (`CRM_EXT_URL`, `CRM_EXT_CLAVE`, `CRM_EXT_NOMBRE`, `CRM_EXT_PANEL`).
- El resultado del vigía incluye ahora `moviles` (dispositivos con avisos) y `crmPunto`, para comprobar de un vistazo que los avisos tienen a quién llegar.

### Servidor
- Sin función nueva (el plan gratis admite 12): la ruta va dentro de `api/zernio.js` (`?r=leads-ext`) y el módulo es `api/_crmext.js`. Respuesta de unos 30 KB comprimida y memoria de 55 s por instancia, para no gastar la cuota gratuita del CRM.

## [1.18.2] · 2026-10-26

### App web
- **Correos con maqueta propia legibles en tema oscuro.** `html` y `body` del correo también se pintan con los colores del tema y pierden fondo e imagen de fondo (antes un fondo crema o blanco dejaba el texto claro ilegible, o el texto oscuro sobre oscuro). Red de seguridad: si más de una cuarta parte del texto queda sin contraste con su fondo, se le aplican los colores del tema.
- **Sin aviso de reseñas, encuestas y recomendaciones** aunque el asunto hable de «pedido» o «entrega», ni de remitentes tipo `novedades@`, `marketing@` o `@msg.` (vigía y app).

## [1.18.1] · 2026-10-21

### App web
- **CRM, «Por meses»: borrar filas y Perdido en rojo.** Cada fila lleva una papelera: borra la fila de la hoja del almacén, o aparta de CRM («No es lead») un lead vivo (el correo no se toca). Perdido sale en rojo en la tabla y en el tablero, Ganado en verde.

## [1.18.0] · 2026-10-21

### App web
- **CRM: pestaña «Por meses», como la hoja HOT LEADS.** Tabla agrupada por mes (cabecera con «Ganados · En negociación · Perdidos» y total ganado en €), filas en verde (Ganado), ámbar (En negociación) y gris (Perdido), con línea (COW, EVE, SALA), espacio, observaciones y presupuesto; al final, «Total ganado por mes». Junta las filas guardadas de la hoja con los leads vivos de Gmail y WhatsApp (las salas incluidas; su importe sale de las facturas de Nexudus). Etapas por defecto: En negociación, Ganado y Perdido. El tablero sigue como segunda pestaña.
- API `/api/crm`: `?r=hot`, `hot-guardar` (filas por fuente) y `migrar` (las etapas viejas Nuevo/Respondido/Propuesta/Reserva pasan a la primera etapa del CRM). Sin una etapa «Respondido», contestar a un lead ya no lo mueve.

## [1.17.3] · 2026-10-20

### App web
- **WhatsApp: se acabó el «nuevo» en todo.** Solo sale «nuevo» (y el globo de la barra lateral) en las conversaciones que cambian después de empezar a usar la vista; lo anterior cuenta como visto.
- **CRM: las conversaciones de WhatsApp viejas y cerradas ya no engordan el tablero.** Solo entran como lead las que han tenido movimiento en los últimos 7 días (`DIAS_WA` en `api/_zernio.js`); si una antigua vuelve a escribir, vuelve al tablero.

## [1.17.2] · 2026-10-20

### App web
- **WhatsApp se actualiza solo**, como el correo: cada 10 segundos con la vista abierta (la lista y también la conversación que estás leyendo) y cada 30 desde otra vista, para que el globo de la barra lateral esté al día. Solo repinta si algo ha cambiado y no te mueve la pantalla: si estabas leyendo más arriba, te deja donde estabas; si estabas abajo, se queda abajo y ves lo nuevo. Se actualiza también al volver a la pestaña.

## [1.17.1] · 2026-10-20

### Documentación
- README (español e inglés), INSTALAR, AGENTS, SECURITY y CONTRIBUTING al día: WhatsApp de solo lectura, CRM con leads de WhatsApp, Contactos de Google, panel de Integraciones, Redes sociales con Metricool (por MCP o por API), 39 herramientas del MCP, límite de 12 funciones de Vercel y reglas de seguridad nuevas.
- Capturas nuevas hechas con la app real y datos inventados (`scripts/capturas-demo.mjs`): WhatsApp, CRM con leads de WhatsApp, Integraciones y Redes sociales.
- `.env.example` con `ZERNIO_API_KEY`.

### App web
- Las tarjetas del CRM sin correo ya no empiezan con un «·» suelto.

## [1.17] · 2026-10-20

### App web
- **«Redes sociales» ahora es un planificador como el de Metricool:** calendario semanal (lunes a domingo, 24 horas) con cada publicación programada en su día y su hora, color por red y la línea de la hora actual; «Esta semana», flechas y selector de marca. Pulsar un hueco libre crea una publicación a esa hora; pulsar una publicación la abre. Las que se pisan se reparten en columnas. Hay también vista «Listado».
- Crear publicación y ver una publicación se abren en una ventana.
- Comprobado con una cuenta real por MCP: lee las programadas de las 5 marcas (15 en una de ellas).

## [1.16] · 2026-10-20

### App web
- **Botón «Integraciones» en la barra lateral:** todo lo que se puede conectar, en un solo sitio: cuentas de Google (correo y calendario), Contactos de Google, WhatsApp (Zernio), el CRM con sus integraciones (Analytics, WhatsApp, Nexudus…) y Metricool.
- **«Redes sociales» (Metricool):** vista nueva con las publicaciones programadas de cada marca (7, 30 o 90 días) y un formulario para programar (texto, redes de la marca, día y hora, imágenes o vídeos por enlace). Pide confirmación y nunca publica nada por su cuenta. Solo sale en la barra lateral cuando Metricool está conectado.
- **Metricool se conecta de dos maneras:** con tu cuenta de Metricool por su MCP (OAuth con PKCE, vale en cualquier plan, sin token) o con el token de la API (planes Advanced o Custom). El permiso o el token se guardan cifrados.
- **«WhatsApp» solo sale en la barra lateral si hay un WhatsApp conectado.**
- Metricool ya no está entre las integraciones del CRM.

## [1.15.1] · 2026-10-20

### App web
- **Corregido:** el icono de partículas del panel vacío de WhatsApp no se veía (el panel de la vista, opaco, tapaba el lienzo que va por detrás). Ahora solo la lista de conversaciones queda opaca.
- La barra de contactos de Google dice cuántos teléfonos ha leído y si Google falla; el estado se lee siempre fresco al volver de conectar.
- Frase del panel vacío más corta.

## [1.15] · 2026-10-20

### App web
- **Botón «Conectar contactos de Google» en WhatsApp.** Es una conexión aparte, solo de lectura de Contactos (no es una cuenta de correo: no aparece como pestaña ni se lee su correo). Con ella, los números que no traen nombre sacan su nombre y su foto de esa agenda. El permiso queda guardado cifrado (nunca los contactos) y se quita con un botón.
- Los teléfonos se cruzan en el servidor y a la pantalla solo llegan el nombre y la foto de quien ha escrito por WhatsApp.

## [1.14] · 2026-10-20

### App web
- **«Mensajes» pasa a llamarse «WhatsApp»** (barra lateral, título de la vista y herramientas del conector: `whatsapp` y `whatsapp_leer`).
- **Panel vacío de WhatsApp con partículas:** igual que el sobre del correo, pero con una burbuja de chat con auricular.
- **Metricool sale de las integraciones del CRM:** no es una integración del CRM. Irá en su propio sitio.

## [1.13] · 2026-10-20

### App web
- **WhatsApp: nombres legibles.** Cada conversación muestra el nombre que TÚ le pongas («Poner nombre», se guarda en tu almacén cifrado y lo ven también el CRM, los avisos y el MCP), el que traiga WhatsApp o, si no hay, el número bien escrito (+34 600 55 05 78) en vez de una fila de dígitos. Sin foto de WhatsApp: iniciales con color (WhatsApp no da las fotos de perfil a las empresas).
- **Avisos al móvil de WhatsApp nuevo:** el vigía mira también las conversaciones y avisa solo de lo que escribe el cliente (no de vuestras respuestas). Al tocar el aviso se abre «Mensajes».
- No se consulta ninguna agenda ni los Contactos de Google para sacar nombres.

## [1.12] · 2026-10-20

### App web
- **«Mensajes» vuelve a verse y es de solo lectura:** las conversaciones de WhatsApp (por Zernio) en una lista con el chat al lado. No se puede contestar desde ahí ni se marca nada como leído (en WhatsApp eso enviaría el doble check azul al cliente); «nuevo» se recuerda solo en tu navegador.
- **El WhatsApp entra al CRM:** nueva integración «WhatsApp (Zernio)» en el CRM (Integraciones). Cada conversación es un lead del tablero, sin filtrar; se mueve de etapa o se aparta con «No es lead», y la ficha lleva a su conversación. Si el último mensaje es vuestro, entra en la 2.ª etapa y no sale «Te toca».
- **Integración «Metricool»** (token de la API + userId de cada persona, guardado cifrado).

### MCP (1.2.0)
- Herramientas nuevas, solo lectura: `mensajes` (conversaciones de WhatsApp) y `leer_conversacion`.

## [1.11.1] · 2026-10-20

### App web
- **«Mensajes» (Zernio) pasa a ser opcional y queda oculta por defecto.** Para quien la quiera: poner `localStorage.setItem('buzonero-zernio','1')` en la consola del navegador y recargar.

## [1.11] · 2026-10-20

### App web: Mensajes
- **Nueva vista «Mensajes»** en «Todas las cuentas»: las conversaciones de WhatsApp, Instagram, Facebook, Telegram y X que tengas conectadas en [Zernio](https://zernio.com), en una sola lista, con el chat al lado.
- Contestar desde la app (solo se envía al pulsar «Enviar»); se marcan como leídas al abrirlas y la lista se refresca cada minuto.
- La clave de Zernio vive solo en el servidor (variable `ZERNIO_API_KEY`); el navegador nunca la ve. Función nueva `api/zernio.js`.

## [1.10.1] · 2026-10-20

### App web
- **Corregido:** al abrir el CRM con el Calendario a la vista, el CRM salía debajo del calendario, cortado, en vez de ocupar su sitio. Ahora el calendario se esconde y el CRM ocupa la pantalla, como desde cualquier carpeta.

## [1.10] · 2026-10-19

### App web: el calendario, como Google Calendar
- **Día, Semana y Mes** (se recuerda la última), «Hoy», flechas y minicalendario en el lateral.
- **Día y Semana por horas**, con la fila «todo el día», la línea de la hora actual y los eventos que se solapan uno al lado del otro.
- **Pulsar un evento** abre su tarjeta: editar, borrar, abrir en Google Calendar, lugar, Meet, invitados y descripción.
- **Pulsar un hueco** crea un evento a esa hora (o arrastrando, con la duración que marques); en Mes, un evento de todo el día.
- **Arrastrar un evento** lo mueve (también a otro día) y **estirar su borde** cambia cuándo acaba; se guarda en Google al soltar.
- **Crear y editar** en una ventana: título, inicio y fin (también de varios días), todo el día, cuenta y calendario, lugar y descripción.
- **«Mis calendarios»** se guarda en tu propio Google Calendar (la casilla «visible»), así se recuerda en cualquier ordenador y también en Google.
- Un mismo evento de un calendario compartido entre varias cuentas sale una sola vez.

## [1.9.1] · 2026-10-19

### App web
- **«Reconectar todas las cuentas»** (Ajustes → Reconectar con Google): pasa por todas seguidas, sin volver a la app entre una y otra (Google pide confirmar cada una).
- **Calendario:** si la Google Calendar API no está activada en el proyecto, lo dice tal cual y avisa de que no hace falta reconectar (antes parecía que la cuenta no estaba conectada).

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
