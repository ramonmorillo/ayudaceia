# AYUDA CEIA

Herramienta de apoyo para la evaluación ética de protocolos de investigación (uso interno CEI).

## Despliegue en GitHub Pages

1. Ve a **Settings → Pages** del repositorio.
2. En *Source*, selecciona la rama `main` (o la rama donde esté el código).
3. En *Folder*, selecciona `/ (root)`.
4. Guarda. La app estará disponible en `https://TU_USUARIO.github.io/ayudaceia/`.

No requiere build ni servidor. Solo los tres archivos estáticos: `index.html`, `styles.css`, `app.js`.

## Características principales

- **Sin backend.** Todo el procesamiento ocurre en el navegador del usuario.
- **Sin IA.** No se integran APIs externas ni modelos de lenguaje.
- **Persistencia local.** Los casos se guardan en IndexedDB; los ajustes en localStorage.
- **Exportación PDF** client-side (jsPDF).
- **7 secciones:** Nuevo caso · Lectura guiada · Evaluación · Preguntas · Dictamen · Historial · Ajustes.

## Importación PDF / DOCX

La herramienta permite importar el texto del protocolo directamente desde un archivo PDF o DOCX, evitando el copiado manual.

| Formato | Librería | Notas |
|---------|----------|-------|
| `.docx` | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) | Extracción completa del texto |
| `.pdf`  | [PDF.js](https://mozilla.github.io/pdf.js/) | **Solo texto embebido.** Los PDF escaneados (imágenes) no producirán texto utilizable. En ese caso, usa el DOCX o copia-pega el texto manualmente. |

**Privacidad:** el archivo nunca sale del navegador. No se realiza ninguna petición a servidores externos durante la extracción.

## Dependencias CDN (cargadas al abrir la app)

| Librería | Uso |
|----------|-----|
| [jsPDF 2.5.1](https://github.com/parallax/jsPDF) | Exportación PDF del dictamen |
| [PDF.js 3.11.174](https://mozilla.github.io/pdf.js/) | Extracción de texto de PDF |
| [Mammoth.js 1.6.0](https://github.com/mwilliamson/mammoth.js) | Extracción de texto de DOCX |

## Autoría y licencia

© 2026 Ramón Morillo. Todos los derechos reservados.

Herramienta de apoyo para la evaluación ética de protocolos. No sustituye la deliberación del CEI ni los procedimientos oficiales.
