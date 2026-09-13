# Changelog / Registro de Cambios

Todos los cambios notables de este proyecto se documentan en este archivo.  
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer 2.0.0)](https://semver.org/lang/es/).

---

## [3.0.0] - 2026-09-13

### Añadido
- **Hub de Bienvenida Permanente:** Pantalla inicial con selección de modo (Moodle vs Markdown) con diseño y efectos visuales Dark IDE.
- **Modo Markdown (GFM):** Motor de previsualización para GitHub Flavored Markdown con soporte completo de tablas, listas de tareas y bloques de código Prism.
- **⭐ Exportador a Moodle:** Botón exclusivo en modo Markdown para compilar y copiar HTML semántico continuo con clases de tabla compatibles con Moodle.
- **Enrutamiento por Hash:** Soporte para enlaces directos (`#moodle` y `#markdown`) y navegación integrada con el historial del navegador (*Back/Forward*).
- **Blindaje y Resiliencia Técnica:**
  - Parser nativo de respaldo offline que se activa automáticamente si el CDN de Marked no está disponible.
  - `SafeStorage`: Capa de persistencia segura ante navegadores en modo incógnito estricto (Safari/Firefox) o WebViews.
  - Envoltura inteligente de texto seleccionado al teclear pares delimitadores (`(`, `[`, `{`, `"`, `'`, `` ` ``).
  - Filtro defensivo de archivos (límite de seguridad de 5 MB y validación de extensiones de texto).
- **Metadatos Sociales y SEO:** Etiquetas Open Graph (`og:title`, `og:description`, `og:url`) y `theme-color: #090d16` para previsualizaciones ricas al compartir enlaces en WhatsApp, LinkedIn y Teams.
- **Accesibilidad Universal (WCAG 2.1):** Soporte de teclado completo (<kbd>Tab</kbd> + <kbd>Enter</kbd> / <kbd>Espacio</kbd>) en tarjetas interactivas y anillos de foco visuales `:focus-visible`.

### Cambiado
- **Arquitectura Modular Desacoplada:** Migración desde la arquitectura de archivo único (SFA) hacia una estructura web organizada (`css/styles.css`, `css/hub.css`, `js/config.js`, `js/linter.js`, `js/markdown.js`, `js/app.js`).
- **Telemetría Libre:** Contador de palabras, caracteres y líneas en tiempo real sin restricciones arbitrarias de longitud.
- **Aislamiento de Excepciones:** Bloques `try/catch` defensivos en renderizado de KaTeX, Prism y Linter.

### Eliminado
- Archivo binario duplicado `Preview_Moodle.html`.

---

## [2.0.0] - 2026-09-12

### Añadido
- **Motor KaTeX (v0.16.11):** Compilación matemática instantánea (< 5 ms) sustituyendo a MathJax, reduciendo el consumo de memoria en un 85%.
- **Inspector Heurístico de Sintaxis:** Linter estático en tiempo real para detectar bloques de código Markdown huérfanos de IA (```html) y etiquetas desbalanceadas (`<table>`, `<pre>`).
- **Diccionario Vectorial SVG Sprite:** Sistema de iconografía embebido mediante `<symbol>`, eliminando dependencias de webfonts externas.
- **Motor de Impresión A4:** Hoja de estilos `@media print` calibrada para generación directa de PDFs académicos vía `Ctrl + P`.
- **Historial de Edición:** Pila de Deshacer/Rehacer (`Ctrl+Z` / `Ctrl+Y`).
- **Despliegue GitHub Pages:** Configuración y publicación en la nube pública sin costo de infraestructura.

### Cambiado
- Refactorización a arquitectura Single-File SPA portable para ejecución offline sin servidores.

---

## [1.0.0] - 2026-02-15 (Prototipo Inicial)

### Añadido
- Primer prototipo funcional en archivo HTML monolítico para previsualización de contenidos académicos.
- Integración de **MathJax 3** para compilación de fórmulas matemáticas LaTeX.
- Integración de **Prism.js** para resaltado léxico de bloques de código en Python, JavaScript, LaTeX y R.
- Barra de inserción de snippets para fórmulas matemáticas comunes (`\frac`, `\sum`, `\int`, `\deriv`).
- Panel dual (*split-view*) con divisor arrastrable con cursor de ratón.
- Barra de herramientas con botones de formato básico (`<b>`, `<i>`, `<u>`, `<h1>`, `<h2>`, `<p>`).
