# Contribuir a Buzonero Campillero

¡Gracias por querer mejorarlo! Puedes ayudar de tres formas.

## Avisar de un fallo o proponer una idea

Abre un [issue](../../issues/new/choose) con la plantilla que corresponda.
- **Nunca pegues correos reales, direcciones ni claves.** Si necesitas enseñar algo, invéntate los datos.
- **Los problemas de seguridad** no van en un issue: usa el aviso privado que explica [SECURITY.md](SECURITY.md).

## Cambiar el código

1. Haz un fork y una rama con un nombre claro (`arregla-paquetes-duplicados`, `mcp-nueva-herramienta`…).
2. Pruébalo en tu propia instalación (ver [INSTALAR.md](INSTALAR.md)). Antes de enviar nada, comprueba la sintaxis:
   ```bash
   node --check api/*.js api/auth/*.js app/*.js mcp/buzonero-mcp.mjs scripts/*.mjs
   ```
3. Abre un pull request explicando qué cambia y por qué, con capturas si toca la interfaz. Para las capturas, usa `node scripts/capturas-demo.mjs https://tu-app.vercel.app`, que tiene datos inventados.

### Cómo está hecho (y cómo queremos que siga)

- **Cero dependencias y cero compilación.**
  - `app/index.html` es la app: HTML, CSS y JavaScript. Las vistas grandes van en su propio fichero (`crm.js`, `calendario.js`, `mensajes.js`, `integraciones.js`, `redes.js`), cargado con un `<script>`; sin compilación.
  - `api/` son funciones de Vercel en Node 20. **El plan gratis admite 12 y ya están usadas**: una ruta nueva va dentro de una función existente (por ejemplo `api/zernio.js`, el enrutador de integraciones). Las ayudas `api/_*.js` no cuentan.
  - `mcp/buzonero-mcp.mjs` es el MCP en un solo fichero.
  - Si algo necesita una librería, se carga en el navegador desde un CDN con versión fija.
- **Los temas** se generan con `python scripts/temas.py app`. No edites a mano el bloque de temas de `app/tema.css`.
- **Interfaz en español.** Textos claros, sin jerga. Los nombres de las herramientas del MCP también van en español.
- **Seguridad**, reglas que no se rompen:
  - todo dato de un correo se pinta con `esc()`;
  - el HTML de un correo se convierte a texto con `htmlATexto` (DOMParser), nunca con `createElement(...).innerHTML`;
  - el MCP no envía, ni da de baja, ni bloquea sin `confirmado: true`;
  - WhatsApp es solo lectura: nada que envíe ni marque como leído;
  - las acciones de Metricool (`mc-*`) exigen sesión de la app y confirmación en pantalla, y se rechazan con la clave del MCP;
  - ningún dato personal en el repositorio: usa `scripts/exportar.py`, que se niega si aparece algo tuyo.
- **El MCP:** cada herramienta nueva necesita una descripción que un agente entienda sin contexto, su `inputSchema` y su entrada en la tabla del README y de `AGENTS.md`.

## Traducciones y documentación

Mejorar [INSTALAR.md](INSTALAR.md), [AGENTS.md](AGENTS.md) o la versión en inglés ([README.en.md](README.en.md)) ayuda muchísimo a quien se lo instala por primera vez.

Al participar aceptas el [código de conducta](CODE_OF_CONDUCT.md).
