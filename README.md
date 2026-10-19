# Preview Suite (Moodle & Markdown)

[![Versión](https://img.shields.io/badge/Versi%C3%B3n-3.2.4-0284c7?style=for-the-badge)](https://github.com/Klopezxd/preview-suite)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)](LICENSE)
[![Despliegue Vercel](https://img.shields.io/badge/Vercel-Producci%C3%B3n-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://preview-suite.vercel.app)
[![Despliegue GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Activo-22c55e?style=for-the-badge&logo=github)](https://klopezxd.github.io/preview-suite/)
[![KaTeX](https://img.shields.io/badge/KaTeX-0.16.11-00d084?style=for-the-badge&logo=latex&logoColor=white)](https://katex.org/)
[![Mermaid.js](https://img.shields.io/badge/Mermaid.js-10.9-ff3670?style=for-the-badge)](https://mermaid.js.org/)
[![DOMPurify](https://img.shields.io/badge/DOMPurify-3.1.6-00D4FF?style=for-the-badge)](https://github.com/cure53/DOMPurify)
[![Prism.js](https://img.shields.io/badge/Prism.js-1.29.0-blueviolet?style=for-the-badge)](https://prismjs.com/)
[![Marked.js](https://img.shields.io/badge/Marked.js-12.0.2-ef4444?style=for-the-badge&logo=markdown&logoColor=white)](https://marked.js.org/)
[![Arquitectura](https://img.shields.io/badge/Arquitectura-Modular%20SPA%20v3.2.4-f97316?style=for-the-badge)](https://developer.mozilla.org/es/docs/Web/JavaScript)

> **Entorno interactivo y reactivo para redacción, visualización y validación en tiempo real de documentos técnicos y académicos con soporte para KaTeX, Mermaid.js, Prism.js y Markdown (GFM).**

---

## 🌐 Despliegue en Producción (Demo en Vivo)

La aplicación se encuentra disponible de forma pública y con alta disponibilidad a través de su infraestructura en Vercel y su réplica de respaldo en GitHub Pages:

* 🚀 **Vercel (Producción Principal):** **[https://preview-suite.vercel.app](https://preview-suite.vercel.app)**
  * **Acceso directo al Modo Moodle:** [https://preview-suite.vercel.app/#moodle](https://preview-suite.vercel.app/#moodle)
  * **Acceso directo al Modo Markdown:** [https://preview-suite.vercel.app/#markdown](https://preview-suite.vercel.app/#markdown)

* 🔗 **GitHub Pages (Espejo de Respaldo):** [https://klopezxd.github.io/preview-suite/](https://klopezxd.github.io/preview-suite/)

---

## 📋 Descripción del Proyecto

Una suite unificada diseñada tanto para desarrollo de contenidos de aulas virtuales como para visualización y redacción de documentos en Markdown:
- **Modo Moodle:** Diseñado para código HTML y componentes de aulas virtuales. Valida el renderizado exacto de tablas, avisos y fórmulas KaTeX antes de publicar en Moodle u otras plataformas educativas.
- **Modo Markdown:** Visor y editor universal de Markdown (GFM) para redactar notas, documentación y apuntes con renderizado instantáneo de fórmulas matemáticas en LaTeX, bloques de código y exportación rápida.
- **Detección sintáctica:** Alerta de etiquetas HTML sin cerrar o bloques Markdown residuales.
- **Soporte matemático riguroso:** KaTeX en línea `\( ... \)` y en bloque `\[ ... \]` o `$$ ... $$`.

**Previsualizador Moodle & Markdown** resuelve estas necesidades mediante una arquitectura web modular blindada contra excepciones y fallos de entorno, 100% responsiva para ordenadores, tablets y smartphones.

## 🌟 Compatibilidad Total con Markdown Moderno (Novedades v3.2)

1. **Diagramas Mermaid en Vivo y Exportación SVG (`mermaid`):**
   - Renderizado vectorial reactivo para diagramas de flujo (`flowchart`, `graph`), secuencias (`sequenceDiagram`), diagramas de clases (`classDiagram`), máquinas de estados (`stateDiagram`), entidad-relación (`erDiagram`), diagramas de Gantt (`gantt`), circulares (`pie`), mapas mentales (`mindmap`), líneas de tiempo y git (`gitGraph`).
   - Adaptación temática automática al alternar entre Modo Claro y Modo Oscuro, con paleta nórdica personalizada.
   - Barra de herramientas en cada diagrama para **copiar código fuente** y **exportar SVG vectorial** con un solo clic.
   - Tolerancia a fallos en tiempo real mientras el usuario escribe la sintaxis, sin romper la interfaz.
2. **Alertas y Callouts GitHub Flavored Markdown (GFM):**
   - Soporte para los 5 tipos oficiales: `> [!NOTE]` (Nota), `> [!TIP]` (Consejo), `> [!IMPORTANT]` (Importante), `> [!WARNING]` (Advertencia) y `> [!CAUTION]` (Precaución).
   - Insensibilidad a mayúsculas/minúsculas y soporte para títulos personalizados en la misma línea.
   - Fórmulas matemáticas LaTeX KaTeX, formato enriquecido, código y listas dentro de las alertas.
3. **Resaltado Léxico Universal con Prism Autoloader:**
   - Carga dinámica bajo demanda para cualquier lenguaje de programación soportado por Prism (Bash, Shell, TypeScript, JSON, YAML, HTML, CSS, Rust, Go, C#, C++, Java, PHP, Markdown, Dockerfile, etc.).
4. **Bloques de Código Mejorados con Botón de Copiado:**
   - Encabezado con etiqueta en mayúsculas del lenguaje detectado y botón interactivo "Copiar" en la vista previa.
5. **Tablas Responsivas y Estilizadas:**
   - Contenedor con scroll horizontal suave (`.table-responsive`), bordes limpios y alineación de columnas (`:---`, `:---:`, `---:`).
6. **Listas de Verificación (Task Lists / Checklists):**
   - Sintaxis `- [ ]` y `- [x]` sin viñetas residuales del navegador, con casillas estilizadas.
7. **Notas al Pie (Footnotes GFM):**
   - Sintaxis `[^1]` y `[^1]: Explicación` con superíndices vinculados y sección final con retorno `↩`.
8. **Elementos Extendidos:**
   - Texto tachado (`~~tachado~~`), resaltado (`==resaltado==`), bloques colapsables (`<details><summary>`), teclas (`<kbd>`) y citas estándar `> ...`.

---

## 🛡️ Blindaje Técnico, Interactividad y Resiliencia (v3.1)

1. **Parser Markdown Resiliente con Modo Offline / Respaldo Nativo:**
   - Si el CDN de `marked.js` no carga o la red se interrumpe, el sistema activa automáticamente un parser nativo interno seguro, evitando pantallas en blanco o bloqueos del editor.
2. **Sistema de Zoom Ergonómico e Híbrido Estilo Overleaf:**
   - Píldoras interactivas en cabeceras (`14px` en editor, `100%` en vista previa) que muestran el valor en vivo sin tapar el contenido.
   - Atajos de ratón (`Ctrl + Rueda`), teclado (`Ctrl + 0`) y clic directo en la lupa para restablecer en PC.
   - Soporte táctil nativo **Pinch-to-zoom (2 dedos)** y micro-popovers flotantes exclusivos para pantallas táctiles (móviles y tablets).
   - Blindaje nativo con `<meta name="darkreader-lock">` y `color-scheme: dark;` para desactivar extensiones invasivas de oscurecimiento forzado.
3. **Modo Pantalla Completa en Ventana (Foco Zen de Lectura):**
   - Maximización inmersiva del panel de vista previa dentro de la ventana sin activar la pantalla completa invasiva del navegador (`F11`), conservando la barra del explorador y las pestañas.
   - Botón ergonómico en cabecera con iconografía SVG reactiva (`Maximizar` / `Restaurar`), atajo universal <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> y salida limpia con <kbd>Esc</kbd>.
   - Adaptación fluida de diagramas vectoriales Mermaid y fórmulas KaTeX al conmutar dimensiones del lienzo.
4. **Calibración Visual Óptima (80%-83%):**
   - Reducción proporcional del grosor de la barra superior, cabeceras e inferior para maximizar el área de trabajo y legibilidad del código.
   - Botoneras unificadas sin divisiones internas, botón "Limpiar" reactivo con iluminación en Rojo Nórdico (`#FF4757`) y conmutador de modo dinámico bicolor (Violeta Boreal `#A855F7` para Markdown y Ámbar Solar `#FF9234` para Moodle).
5. **Capa Segura de Almacenamiento (`SafeStorage`):**
   - Acceso blindado a `localStorage` con captura de excepciones para garantizar funcionamiento en navegación privada, modo incógnito estricto (Safari/Firefox) o entornos corporativos restringidos.
6. **Control de Validación y Conmutación Inteligente de Archivos:**
   - Límite de seguridad de 5 MB por archivo para prevenir congelamientos del navegador.
   - Filtro de extensiones permitidas (`.html`, `.htm`, `.md`, `.markdown`, `.txt`) con rechazo amigable de binarios.
   - Conmutación automática de modo contextual al abrir o arrastrar archivos: si se suelta un archivo `.md` o `.markdown`, la suite conmuta automáticamente a Modo Markdown; si se suelta un archivo `.html` o `.htm`, conmuta a Modo Moodle.
7. **Auto-cierre, Salto (Overtype) y Pares Inteligentes (Estilo IDE Profesional):**
   - **Envoltura:** Si se selecciona texto y se presiona `(`, `[`, `{`, `"`, `'`, `` ` `` o `<`, el editor envuelve la selección automáticamente sin borrar el texto.
   - **Salto (Overtype):** Al escribir un delimitador de cierre (`)`, `]`, `}`, `>`, `"`, `'`, `` ` ``) estando el cursor justo antes de dicho carácter, el cursor avanza sobre él sin duplicarlo.
   - **Eliminación Síncrona de Pares:** Al pulsar <kbd>Backspace</kbd> entre delimitadores vacíos (`()`, `[]`, `{}`, `<>`, `""`, `''`, `` `` ``), se eliminan ambos caracteres limpiamente.
   - **Protección de Contracciones:** Comillas simples o dobles precedidas por caracteres alfanuméricos (p. ej. *don't*, *l'arbre*) no activan auto-cierre indebido.
8. **Aislamiento de Condiciones de Carrera:**
   - Limpieza atómica de temporizadores de *debounce* y grabación de historial al conmutar entre modos, impidiendo sobreescrituras accidentales de buffers.
9. **Accesibilidad Universal (WCAG 2.1):**
   - Tarjetas interactivas del Hub navegables y activables mediante teclado (<kbd>Tab</kbd> + <kbd>Enter</kbd> / <kbd>Espacio</kbd>).
   - Anillos de enfoque `:focus-visible` calibrados en CSS.

---

## 🚀 Características Funcionales

### 1. Hub de Entrada Elegante y Conmutación de Modos
- **Pantalla de Bienvenida Permanente:** Menú inicial de selección con diseño Dark IDE que presenta con claridad las herramientas disponibles.
- **Acceso por Hash:** Soporte para enlaces directos (`#moodle` y `#markdown`) con sincronización en el historial del navegador.
- **Navegación Intuitiva:** Clic en el logotipo o título para volver a la pantalla de bienvenida (Hub) y botón conmutador único para alternar instantáneamente entre Modo Moodle y Modo Markdown preservando los borradores en memoria.

### 2. Modo Moodle (HTML Semántico Continuo)
- **Lienzo de Renderizado Moodle:** Simulación exacta de tarjeta de aula virtual en modo claro y oscuro.
- **Linter Heurístico de Sintaxis:**
  - Detección inmediata de residuos de IA (```` ``` ```` o ```html````).
  - Alerta de etiquetas desbalanceadas (`<table>` y `<pre>`).
  - Detección de delimitadores LaTeX huérfanos.
  - Salto de cursor directo a la línea del error con un clic en la píldora de telemetría.
- **Telemetría Libre:** Contador de palabras, caracteres y líneas en tiempo real sin límites artificiales.

### 3. Modo Markdown (GFM + Motor KaTeX)
- **Especificación Completa:** Soporte para encabezados, tablas comparativas, listas de tareas (`- [x]`) y bloques de código Prism.
- **Fórmulas Matemáticas Integradas:** Delimitadores LaTeX en bloque (`$$ ... $$`, `\[ ... \]`) y en línea (`\( ... \)`).
- **⭐ Exportador a Moodle:** Botón que compila el Markdown a HTML continuo semántico limpio, formateando las tablas con clases nativas y enviándolo al portapapeles listo para pegar.

### 4. Compilación Matemática y Resaltado Léxico
- **KaTeX Engine (v0.16.11):** Compilación matemática en menos de 5 ms en el cliente.
- **Prism.js (v1.29.0):** Resaltado léxico de Python, C++, Java, LaTeX, JavaScript, SQL y R con tema Tomorrow.

---

## 🏗️ Flujo de Procesamiento del Sistema

```mermaid
flowchart TD
    Entrada[Entrada en Editor] --> Scheduler[Scheduler con Debounce]
    Scheduler --> CondicionModo{Modo Activo}
    
    CondicionModo -->|Modo Moodle| InyMoodle[Inyección Directa DOM]
    CondicionModo -->|Modo Markdown| Transpila[Marked.js / Fallback Nativo]
    
    Transpila --> InyMoodle
    InyMoodle --> KaTeX[Compilador KaTeX]
    InyMoodle --> Prism[Tokenizador Prism.js]
    
    KaTeX --> Vista[Vista Previa Final]
    Prism --> Vista
    
    CondicionModo -->|Modo Moodle| Linter[Linter Heurístico Blindado]
    Linter --> Telemetria[Barra de Telemetría Libre]
    CondicionModo -->|Modo Markdown| Telemetria
```

---

## ⌨️ Matriz de Atajos de Teclado

| Atajo | Acción | Descripción |
| :--- | :--- | :--- |
| <kbd>Tab</kbd> | **Indentar Texto** | Inserta 2 espacios de indentación respetando la selección |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | **Deshacer** | Revierte el último cambio mediante pila de historial del modo activo |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | **Rehacer** | Restaura el cambio revertido |
| <kbd>Ctrl</kbd> + <kbd>Rueda</kbd> / <kbd>Ctrl</kbd> + <kbd>0</kbd> | **Zoom de Panel** | Ajuste y restablecimiento ergonómico de zoom en editor o vista previa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | **Pantalla Completa** | Maximiza el panel de vista previa dentro de la ventana (foco de lectura) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | **Copiar Contenido** | Copia el contenido del editor al portapapeles |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | **Actualizar Render** | Fuerza una compilación síncrona manual de KaTeX y Prism |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | **Guardar Documento** | Descarga instantánea del archivo editado |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | **Exportar / Imprimir** | Diálogo de impresión calibrado para formato A4 |
| <kbd>Esc</kbd> | **Cerrar Diálogos / Salir** | Cierra cualquier modal o menú flotante, o sale de pantalla completa |

---

## 🛠️ Estructura del Repositorio

```text
preview-suite/
├── css/
│   ├── styles.css        # Layout dual, design tokens, temas y print A4
│   └── hub.css           # Pantalla de bienvenida y tarjetas de selección
├── js/
│   ├── config.js         # Constantes, configuraciones, límites y plantillas base
│   ├── linter.js         # Inspector heurístico de sintaxis crítica protegido
│   ├── markdown.js       # Transpilador Markdown con protección LaTeX y fallback
│   └── app.js            # Controlador central, router, SafeStorage y eventos
├── index.html            # Estructura limpia HTML5
├── .editorconfig         # Consistencia de formato (2 espacios, LF, UTF-8)
├── .gitignore            # Exclusión de temporales y notas privadas
├── .nojekyll             # Bypass de Jekyll para GitHub Pages
├── CHANGELOG.md          # Bitácora histórica según estándar Keep a Changelog
├── LICENSE               # Licencia libre MIT
└── README.md             # Documentación oficial del proyecto
```

---

## 📦 Ejecución y Despliegue

### 1. Ejecución en Local (Sin conexión ni dependencias)

La suite está diseñada para funcionar inmediatamente sin requerir entornos Node.js ni compiladores:

* **Método A (Doble Clic Directo):**  
  Clona el repositorio o descarga el archivo ZIP, abre la carpeta y haz **doble clic en `index.html`** para ejecutarlo directamente en Google Chrome, Microsoft Edge, Mozilla Firefox o Safari a través del protocolo nativo `file:///`.
* **Método B (Servidor Local con Python o VS Code):**  
  Para simular un entorno idéntico a producción:
  ```bash
  # Iniciar servidor local nativo con Python en el puerto 8000:
  python -m http.server 8000
  ```
  Luego abre en tu navegador: `http://localhost:8000`.

### 2. Despliegue en GitHub Pages

1. Sube este repositorio a tu cuenta de GitHub.
2. Ve a **Settings** > **Pages** en tu repositorio.
3. En **Build and deployment**, selecciona la fuente **Deploy from a branch**.
4. Elige la rama `main` y la carpeta `/ (root)`.
5. Haz clic en **Save**. En menos de 2 minutos estará publicado globalmente.

---

## 📜 Historial de Cambios (Changelog)

Consulta el archivo [CHANGELOG.md](CHANGELOG.md) para revisar en detalle la evolución completa del software, desde el prototipo inicial en MathJax hasta la versión actual v3.2.1.

---

## 👨‍💻 Autor

**Klever López**  
*Estudiante de Tecnologías de la Información (TI)*  
GitHub: [@Klopezxd](https://github.com/Klopezxd)

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia libre **MIT**. Consulta el archivo [LICENSE](LICENSE) para obtener más detalles sobre los términos de uso, modificación y distribución.
