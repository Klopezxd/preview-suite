# Changelog / Registro de Cambios

Todos los cambios notables de este proyecto se documentan en este archivo.  
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer 2.0.0)](https://semver.org/lang/es/).

## [3.2.4] - 2026-10-18

### Añadido y Mejorado
- **Modo Pantalla Completa en Ventana (Zen Reading Focus):**
  - Se implementó la maximización en ventana del panel de vista previa (`#right-panel.preview-fullscreen`) para lectura y revisión inmersiva de documentos Markdown y Moodle sin recurrir al modo de pantalla completa invasivo del sistema operativo (`F11`), preservando pestañas y barra del navegador.
  - Nuevo control ergonómico `.btn-fullscreen-toggle` en la cabecera del panel con iconografía SVG interactiva (`#icon-maximize` y `#icon-minimize`) e indicación de estado visual con resplandor en Verde Aurora (`--aurora-green`).
  - Atajo de teclado global <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> (o <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> en macOS) para alternar instantáneamente entre la vista dividida y el foco de lectura completo.
  - Cierre y restauración ergonómica mediante la tecla <kbd>Esc</kbd> con resolución jerárquica prioritaria de modales y micro-popovers de zoom.
  - Re-renderizado adaptativo automático de diagramas vectoriales Mermaid y fórmulas matemáticas KaTeX al conmutar dimensiones del lienzo.
  - Retroalimentación mediante notificaciones no bloqueantes tipo toast.

## [3.2.3] - 2026-10-15

### Añadido y Mejorado
- **Editor: Salto Inteligente (Overtype) en Delimitadores de Cierre:**
  - Al escribir delimitadores de cierre (`>`, `)`, `]`, `}`, `"`, `'`, `` ` ``), si el cursor se encuentra posicionado inmediatamente antes del mismo delimitador, el editor salta sobre él en lugar de duplicarlo (previniendo errores comunes como `<p>>` o `(x))`).
- **Editor: Eliminación Síncrona de Pares de Delimitadores en Backspace:**
  - Al presionar <kbd>Backspace</kbd> cuando el cursor está ubicado entre delimitadores coincidentes (`()`, `[]`, `{}`, `<>`, `""`, `''`, `` `` ``), se eliminan ambos caracteres de forma síncrona y atómica, eliminando delimitadores huérfanos que rompen fórmulas KaTeX o etiquetas HTML.
- **Editor: Inserción Síncrona Atómica de Delimitadores:**
  - Se eliminó el desfase asíncrono (`setTimeout`) en el auto-cierre, logrando una sincronización inmediata del buffer en memoria, el historial de deshacer y el árbol de renderizado.
- **Editor: Detección Contextual de Contracciones:**
  - Las comillas simples o dobles precedidas por caracteres alfanuméricos (p. ej. *don't*, *l'arbre*, *user's*) se escriben de manera literal sin disparar auto-cierre indebido.
- **Editor: Atajo Nativo para Guardar (`Ctrl / Cmd + S`):**
  - Permite descargar el documento en edición de forma instantánea mediante el atajo universal de guardado, previniendo la apertura del molesto diálogo nativo del navegador ("Guardar página web como...").
- **Multiplataforma: Soporte Completo para Tecla Command (`Cmd` / `metaKey`) en macOS:**
  - Los atajos `Cmd + Shift + C` (copiado rápido), `Cmd + Enter` (renderizado forzado) y `Cmd + S` (guardar archivo) ahora funcionan de forma fluida y homogénea en sistemas macOS.
- **Accesibilidad Universal y Consistencia UI (WCAG 2.1):**
  - Redimensionamiento de paneles por teclado: foco accesible en `#resizer` con teclas <kbd>Flecha Izquierda</kbd> / <kbd>Arriba</kbd> (reducir), <kbd>Flecha Derecha</kbd> / <kbd>Abajo</kbd> (expandir) y <kbd>Home</kbd> (restablecer a 50/50).
  - Activación por teclado (<kbd>Enter</kbd> / <kbd>Espacio</kbd>) en el logotipo, título de la barra y badges del easter egg.
  - Sincronización dinámica automática de insignias de versión y pie de ventana modal desde `CONFIG.VERSION`.
  - Inclusión de `summary:focus-visible` para navegación accesible por teclado en bloques colapsables `<details><summary>`.
  - Configuración defensiva de ruta CDN para Prism Autoloader contra condiciones de carrera de red.

### Blindaje del Repositorio
- **Reglas Reforzadas en `.gitignore`:**
  - Bloqueo permanente contra artefactos de compilación externa (`package.json`, `package-lock.json`, `node_modules/`, `dist/`, `build/`) e informes de auditoría o pruebas locales (`*audit*`, `*auditoria*`, `test-results/`), garantizando un repositorio 100% puro y profesional con cero herramientas de compilación intrusivas.

## [3.2.2] - 2026-10-15

### Seguridad
- **Sanitización Segura con DOMPurify (Anti-XSS):**
  - Se integró DOMPurify 3.1.6 vía CDN con perfiles habilitados para HTML, SVG y MathML.
  - Neutraliza vectores de inyección de scripts y código malicioso sin alterar clases CSS, atributos `data-*` ni identificadores de usuario, preservando la compatibilidad de estilos con Moodle y temas personalizados.

### Añadido y Mejorado
- **Editor: Indentación y Desindentación por Bloques (`Tab` / `Shift + Tab`):**
  - Soporte completo para indentación multi-línea: al presionar `Tab` con múltiples líneas seleccionadas, todas se indentan por 2 espacios.
  - Soporte para desindentación multi-línea: al presionar `Shift + Tab`, se remueven hasta 2 espacios iniciales por cada línea seleccionada, recalculando y preservando la selección.
- **Historial: Resolución de Carrera en Deshacer/Rehacer (`Ctrl+Z` / `Ctrl+Y`):**
  - Se eliminó la pérdida de estados intermedios al teclear rápido: al solicitar `undoChange` o `redoChange`, se consolidan de inmediato los cambios pendientes en el debounce antes de navegar la pila histórica.
- **Markdown: Aislamiento Estricto de Bloques de Código:**
  - Los bloques de código cercados (```...```) y de código en línea (`...`) se enmascaran antes del procesamiento de notas al pie, delimitadores matemáticos LaTeX y resaltado (`==texto==`), previniendo que códigos con `==` o `[^1]` se alteren durante la compilación.
- **Exportación Moodle: Embebido Limpio de Diagramas Mermaid en SVG:**
  - Al compilar o transformar Markdown hacia Moodle, los diagramas Mermaid se embeben como gráficos vectoriales SVG independientes dentro de contenedores centrados (`.moodle-mermaid-diagram`), eliminando botones interactivos (`Copiar`, `SVG`) y estados de carga de la suite.
- **Conversor Bidireccional `htmlToMarkdown` Mejorado:**
  - Soporte para imágenes (`<img src="..." alt="...">`).
  - Soporte para listas ordenadas con atributo `start` y listas anidadas con indentación adecuada.
  - Extracción de fórmulas matemáticas limpias desde KaTeX a partir de etiquetas `<annotation encoding="application/x-tex">`, evitando fragmentación de MathML y texto corrupto.
- **Linter Heurístico Moodle:**
  - Detección precisa de etiquetas de cierre huérfanas (`</table>`, `</pre>`, `\]`, `\)`).
- **Accesibilidad y Foco en Ventanas Modales:**
  - Foco inicial automático y restauración del foco en el elemento disparador al cerrar ventanas modales.

## [3.2.1] - 2026-10-13

### Corregido
- **Visibilidad y Contraste de Bloques de Código de Texto Plano y Diagramas de Árbol:**
  - Se corrigió el problema en el modo de previsualización clara donde los bloques de código sin etiqueta de lenguaje explícita o diagramas de árbol de directorios (ASCII/Unicode como `├──`, `└──`) heredaban el color oscuro del texto (`#0A1628`) sobre el fondo oscuro del contenedor (`#0d1527`), volviéndose ilegibles sin selección manual.
  - Se asignó la clase estándar `language-plaintext` a todos los bloques sin lenguaje especificado.
  - Se añadieron estilos globales y específicos con `color: #E2E8F0 !important;` y soporte de alto contraste para tokens de Prism.js en bloques de código dentro de la previsualización.

### Optimizado y Refactorizado (Auditoría Clean Code)
- **Rendimiento de Renderizado Mermaid:**
  - Se implementó caché de tema visual para evitar reinicializaciones redundantes de `window.mermaid.initialize` en cada pulsación de tecla durante la edición.
- **Limpieza de Selectores y Estilos Muertos:**
  - Se eliminaron selectores CSS obsoletos (`.font-ctrl button`, `.font-ctrl .btn-zoom-reset`) reemplazándolos por reglas ergonómicas para `.zoom-pill`.
  - Se corrigió la regla huérfana `.theme-light` para código en línea, garantizando alto contraste accesible (`#0969da`) en modo claro y Aurora cyan (`#00D4FF`) en modo oscuro.
- **Sincronización Reactiva de Delimitadores:**
  - El auto-cierre de delimitadores (`(`, `[`, `{`, etc.) ahora sincroniza de inmediato el buffer en memoria, registra el estado en el historial de deshacer y dispara la actualización del render en vivo.
- **Arquitectura DRY y Calidad de Código:**
  - Se eliminó propiedad duplicada `labelFontSize` en el caché del DOM.
  - Se desacopló la inyección de versión en `compileToMoodleHtml`, haciéndola dinámica desde `APP_CONFIG.CONFIG.VERSION`.
  - Se añadieron reglas de impresión y exportación A4 para Alertas GFM, bloques de código y diagramas Mermaid, ocultando controles interactivos (`.btn-copy-code-block`, `.mermaid-actions`).


## [3.2.0] - 2026-10-10

### Añadido
- **Soporte Integral para Diagramas Mermaid (`mermaid`):**
  - Motor vectorial integrado con Mermaid v10 para procesar bloques de código ````mermaid`.
  - Soporte completo para diagramas de flujo (`flowchart`, `graph`), diagramas de secuencia (`sequenceDiagram`), diagramas de clases (`classDiagram`), máquinas de estados (`stateDiagram`), diagramas de entidad-relación (`erDiagram`), diagramas de Gantt (`gantt`), diagramas circulares (`pie`), mapas mentales (`mindmap`), líneas de tiempo (`timeline`) y ramas de git (`gitGraph`).
  - Adaptación temática automática con la paleta nórdica de la Suite al conmutar entre Modo Claro y Modo Oscuro.
  - Barra de herramientas interactiva en cada diagrama con botones para:
    - **Copiar código:** Copia la sintaxis Mermaid al portapapeles.
    - **SVG:** Exporta el markup vectorial SVG renderizado directamente al portapapeles.
  - Tolerancia y recuperación de errores en vivo mientras el usuario redacta la sintaxis del diagrama, evitando mensajes obstructivos o bloqueos del renderizador.
- **Alertas y Callouts Oficiales GitHub Flavored Markdown (GFM):**
  - Compatibilidad completa con la especificación de GitHub para los 5 tipos oficiales:
    - `> [!NOTE]` (Nota - Cyan Glaciar)
    - `> [!TIP]` (Consejo - Verde Esmeralda)
    - `> [!IMPORTANT]` (Importante - Violeta Boreal)
    - `> [!WARNING]` (Advertencia - Ámbar Solar)
    - `> [!CAUTION]` (Precaución - Rojo Fresa Boreal)
  - Soporte insensible a mayúsculas/minúsculas y admisión de títulos personalizados en la misma línea.
  - Coexistencia armónica con fórmulas matemáticas LaTeX KaTeX, negritas, código en línea y listas multinivel.
  - Iconografía SVG dedicada e integrada para cada tipo de alerta (`#icon-alert-note`, `#icon-alert-tip`, `#icon-alert-important`, `#icon-alert-warning`, `#icon-alert-caution`).
- **Resaltado Léxico Universal bajo demanda (Prism Autoloader):**
  - Incorporación del plugin Autoloader de Prism.js que descarga automáticamente componentes de gramática para cualquier lenguaje (Bash, Shell, TypeScript, JSON, YAML, HTML, CSS, Rust, Go, C#, C++, Java, PHP, Markdown, Dockerfile, etc.).
- **Bloques de Código Mejorados en Vista Previa:**
  - Encabezado con badge del lenguaje detectado y botón interactivo "Copiar" con retroalimentación animada ("¡Copiado!").
- **Tablas Responsivas y Alineadas:**
  - Envoltorio automático `.table-responsive` que permite desplazamiento horizontal suave en dispositivos móviles y pantallas divididas.
  - Alineación de texto por columna (`:---`, `:---:`, `---:`) y estilos `.table-striped .table-bordered`.
- **Listas de Verificación (Task Lists / Checklists):**
  - Renderizado nativo de `- [ ]` y `- [x]` sin viñetas residuales del navegador, con casillas de verificación estilizadas.
- **Notas al Pie de Página (Footnotes GFM):**
  - Sintaxis `[^1]` en texto y `[^1]: Detalle` al final, con superíndices vinculados y retorno rápido `↩`.
- **Elementos Tipográficos Extendidos:**
  - Texto tachado (`~~tachado~~`), texto resaltado (`==resaltado==`), bloques desplegables (`<details><summary>`), teclas de teclado (`<kbd>`) y estilo refinado para citas tradicionales `> ...`.
- **Plantilla Inicial Enriquecida:**
  - Actualización de `DEFAULT_MARKDOWN_TEMPLATE` para demostrar de inmediato diagramas Mermaid, alertas GFM, tablas alineadas, código Python con copiado y fórmulas LaTeX.

### Cambiado
- Incremento de versión general del sistema a `v3.2.0`.
- Optimización de `protectMathDelimiters` para proteger bloques Mermaid y citas complejas sin colisiones de sintaxis.
- Protección en KaTeX `ignoredClasses` para excluir bloques `.mermaid` y contenedores asociados de transformaciones matemáticas involuntarias.

---

## [3.1.1] - 2026-09-24

### Corregido
- **Iconografía Oficial de Markdown:** Corrección integral del trazado SVG del icono de Markdown (`#icon-markdown`) implementando las proporciones matemáticas canónicas (glifo "M" nítido, flecha descendente `↓` balanceada y márgenes simétricos).

### Cambiado
- **Easter Egg Inmersivo sin Anuncios (`surprise.html`):**
  - Creación de una página dedicada a pantalla completa en pestaña nueva que sirve el reproductor sin cookies de rastreo y con cabeceras *Referer* legítimas, erradicando el "Error 153" de YouTube.
  - Eliminación de botones artificiales de retorno en la pestaña del video para preservar la autenticidad del Rickroll y detonar el modal de bienvenida al volver a la suite.

### Infraestructura
- **Migración de Nombre de Repositorio:** Actualización oficial de referencias, remotos y metadatos tras el renombramiento a `preview-suite`.
- **Despliegue Continuo (CI/CD) en Vercel:** Integración automatizada para producción global en `preview-suite.vercel.app` sincronizada con la rama `main` de GitHub.

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
