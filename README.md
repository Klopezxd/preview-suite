# 🚀 Previsualizador Moodle — Rocket Edition (v2.1)

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://en.wikipedia.org/wiki/HTML5)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://en.wikipedia.org/wiki/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![KaTeX](https://img.shields.io/badge/KaTeX-0.16.11-00d084?style=for-the-badge&logo=latex&logoColor=white)](https://katex.org/)
[![Prism.js](https://img.shields.io/badge/Prism.js-1.29.0-2b7489?style=for-the-badge)](https://prismjs.com/)
[![License](https://img.shields.io/badge/Licencia-MIT-orange?style=for-the-badge)](LICENSE)

> **Entorno interactivo, reactivo y de alta fidelidad diseñado para estudiantes y docentes universitarios que redactan y previsualizan contenidos académicos para foros, estudios de caso y actividades en la plataforma Moodle.**

---

## 🌐 Demo en Vivo

Puedes probar la herramienta directamente desde cualquier navegador (computadora o celular) en:

👉 **[https://tu-usuario.github.io/previsualizador-moodle/](https://tu-usuario.github.io/previsualizador-moodle/)** *(Reemplaza `tu-usuario` con tu usuario de GitHub)*

---

## ✨ Características Principales

### ⚡ Motor Matemático KaTeX (Compilación en 2 ms)
- Renderizado ultra-rápido de fórmulas en bloque (`\[ ... \]`, `$$ ... $$`) y en línea (`\( ... \)`, `$ ... $`).
- Reducción del **85% de peso** frente a motores tradicionales (~180 KB vs 1.2 MB).
- Soporte nativo para modo oscuro e impresión en PDF sin cortes de ecuación.

### 🛡️ Inspector de Sintaxis Crítica (Cero Falsas Alarmas)
- Detección automática de **residuos de bloques Markdown de IA** (` ``` ` o ` ```html `).
- Alerta ante **tablas desbalanceadas** (`<table>` sin cerrar) o bloques de código `<pre>` abiertos.
- Localización de fórmulas LaTeX rotas con **salto directo a la línea del error con 1 solo clic**.

### 🎨 Arquitectura Autónoma e Iconos SVG Locales
- **Zero-Dependency Icons:** Diccionario vectorial embebido de 20 iconos SVG (ahorro de 450 KB al eliminar webfonts externas).
- **Single-File Architecture:** Funciona tanto en la web como descargado con doble clic en local sin requerir servidores locales.

### 📱 Diseño Adaptativo y Móvil Táctil
- Disposición automática:
  - **Escritorio (> 768px):** 2 columnas lado a lado con divisor arrastrable.
  - **Móvil (≤ 768px):** Apilamiento vertical optimizado (código arriba, vista previa abajo) con divisor sensible al tacto (`touchmove`).
- Tablas y fórmulas matemáticas con scroll horizontal táctil interno seguro.

### 📄 Impresión y Exportación a PDF Formato A4 (`Ctrl + P`)
- Hoja de estilos `@media print` calibrada para páginas A4.
- Ocultamiento total de barras de herramientas y menús.
- Bloques de código con fondo oscuro de alto contraste y sintaxis Prism coloreada al 100%.

### ⌨️ Atajos de Teclado y Productividad
- **Indentar código (2 espacios):** <kbd>Tab</kbd>
- **Deshacer / Rehacer:** <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd>
- **Copiar código al portapapeles:** <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>
- **Forzar renderizado manual:** <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
- **Imprimir / Exportar a PDF:** <kbd>Ctrl</kbd> + <kbd>P</kbd>

---

## 🛠️ Stack Tecnológico

- **Frontend:** HTML5 Semántico, CSS3 Moderno (Custom Properties / Design Tokens, Flexbox, Media Queries).
- **Lógica:** JavaScript ES6+ Modular (IIFE, Strict Mode, Event Delegation, Virtual Stack Undo/Redo).
- **Renderizado Matemático:** KaTeX 0.16.11 con extensión `auto-render`.
- **Resaltado Léxico:** Prism.js 1.29.0 unificado (jsDelivr Combine).
- **Tipografía:** Inter & JetBrains Mono (Google Fonts con `subset=latin`).

---

## 👨‍💻 Autor

**Klever López**  
*Estudiante de Tecnologías de la Información (TI)*  

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE). Puedes utilizarlo, estudiarlo y distribuirlo libremente manteniendo los créditos del autor original.
