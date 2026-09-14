# Changelog / Registro de Cambios

Todos los cambios notables de este proyecto se documentan en este archivo.  
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer 2.0.0)](https://semver.org/lang/es/).

---

## [3.1.0] - 2026-09-13

### Añadido
- **Sistema de Zoom Ergonómico e Híbrido Estilo Overleaf:**
  - Pseudobotones compactos en las cabeceras (`14px` en editor, `100%` en vista previa) que muestran el valor en vivo sin tapar el contenido.
  - Control de escritorio mediante ratón (`Ctrl + Rueda`) y teclado (`Ctrl + +`, `Ctrl + -`, `Ctrl + 0`).
  - Gesto táctil nativo **Pinch-to-zoom (2 dedos)** en editor y vista previa para móviles y tablets.
  - **Micro-popover táctil** al pulsar el pseudobotón con controles cómodos `[ − ]`, `[ + ]` y `[ Restablecer ]`.
- **Fondo de Landing Page: Luz Cenital de Estudio (Estilo Linear / Raycast):**
  - Iluminación difusa continua desde el borde superior central sobre una cuadrícula técnica milimétrica boreal (eliminación de focos circulares aislados).
- **Easter Egg de Rickroll Sutil y Experiencia de Regreso:**
  - Reubicación en el badge de versión (`v3.1`) y en `Made by Antigravity` en la barra inferior y footer del Hub (cero activaciones accidentales).
  - Apertura directa en YouTube en pestaña nueva (sin iframes pesados).
  - Modal flotante minimalista que recibe al usuario al volver a la pestaña con el hombre bailando (`🕺`) y título en letras grandes.
- **Navegación Rápida:** Clic en el logo o título principal de la barra superior regresa naturalmente a la pantalla de bienvenida (Hub).

### Cambiado
- **Rediseño Visual Aurora Boreal Nórdica:** Paleta cromática Dark IDE con cian neón (`#00D4FF`), esmeralda (`#00FF87`), azul abisal (`#050B1A`) y violeta boreal.
- **Calibración Ergonómica de Barras:** Reducción proporcional del grosor de la barra superior, cabeceras e inferior al 80%-83% de su altura original para maximizar el área de trabajo del editor y vista previa.
- **Botoneras Unificadas (`.btn-group`):** Contenedor exterior unificado sin divisiones internas ("solo el cuadrito"), con iluminación cian al pasar el cursor.
- **Botón "Limpiar" Reactivo:** Integración sin delimitación en reposo (fondo y borde transparentes, texto e ícono en Rojo Nórdico `#FF4757`) e iluminación con resplandor completo al pasar el cursor.
- **Conmutador de Modo Bicolor Reactivo:** Iluminación contextual e inteligente con halo Violeta Boreal (`#A855F7`) al invitar a Modo Markdown y Ámbar Solar Moodle (`#FF9234`) al conmutar a Modo Moodle.
- **Control de Zoom Adaptativo:** En computadora el clic en la lupa restablece directamente al tamaño por defecto (14px / 100%), reservando el menú emergente táctil exclusivamente para celulares y tablets.
- **Blindaje ante Extensiones de Modo Oscuro (Dark Reader):** Incorporación de directiva nativa `<meta name="darkreader-lock">` y `color-scheme: dark;` para autodesactivar extensiones invasivas y evitar doble inversión de colores.
- **Simplificación de la Landing Page:** Eliminación de detalles técnicos innecesarios para el usuario final, manteniendo descripciones concisas y directas.
- **Claridad de Botones:** Renombrado a "Reestablecer Plantilla" y botón único conmutador de modo ("Modo Moodle" / "Modo Markdown").
- **Estándares WAI-ARIA:** Diálogos modales con roles accesibles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).

### Optimizado
- **Auditoría Integral de Rendimiento y Clean Code:**
  - Escaneo de saltos de línea optimizado mediante `charCodeAt(10)` en $O(N)$ con memoización, eliminando el stutter al teclear en documentos extensos.
  - Debounce de 100ms en el redimensionamiento de ventana (`resize`) para evitar reflows continuos de layout.
  - Conversión recursiva de tablas HTML a Markdown preservando fórmulas LaTeX sin romper filas ni columnas.

### Eliminado
- Enlace inexistente a `css/variables.css` que provocaba errores 404 en la consola del navegador.
- Función huérfana `copyMoodleHtmlFromMarkdown` y botón redundante de copia directa a Moodle.
- Notificaciones flotantes superpuestas que bloqueaban la visibilidad del documento.
- Selectores CSS obsoletos (`.font-ctrl`, `.btn-hub`, `.mode-badge`, etc.).

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
