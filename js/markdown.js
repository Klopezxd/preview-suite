/**
 * Motor de compilación Markdown y exportación limpia para Moodle.
 * Blindado contra fallos de CDN, errores de sintaxis y colisiones LaTeX.
 * @module markdown
 * @version 3.0.0
 */
(() => {
  'use strict';

  /**
   * Configura las opciones por defecto de marked.js si está disponible.
   */
  function configureMarked() {
    if (typeof marked !== 'undefined' && marked.setOptions) {
      try {
        marked.setOptions({
          gfm: true,
          breaks: true,
          pedantic: false
        });
      } catch (e) {
        console.warn('[MarkdownEngine] Advertencia al configurar Marked:', e);
      }
    }
  }

  /**
   * Parser nativo ultra-liviano de respaldo en caso de fallo o indisponibilidad del CDN de Marked.js.
   * Garantiza que la herramienta nunca quede inoperativa ante caídas de red.
   * 
   * @param {string} text - Texto en formato Markdown.
   * @returns {string} HTML básico seguro.
   */
  function fallbackNativeParse(text) {
    if (!text) return '';
    try {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return escaped
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        .replace(/\n$/gim, '<br>');
    } catch {
      return text;
    }
  }

  /**
   * Protege las expresiones matemáticas LaTeX contra la interpolación errónea de Markdown,
   * blindando primero los bloques de código para no alterar su contenido interno.
   * 
   * @param {string} markdownText 
   * @returns {{ safeText: string, restoreMath: (html: string) => string }}
   */
  function protectMathDelimiters(markdownText) {
    if (typeof markdownText !== 'string') {
      return { safeText: '', restoreMath: (h) => h };
    }

    const codePlaceholders = [];
    const mathPlaceholders = [];

    // 1. Proteger bloques de código (```...```) y código en línea (`...`)
    const codeRegex = /(```[\s\S]*?```|`[^`\n]+`)/g;
    let safeText = markdownText.replace(codeRegex, (match) => {
      const id = codePlaceholders.length;
      codePlaceholders.push(match);
      return `@@CODE_EXPR_${id}@@`;
    });

    // 2. Proteger fórmulas matemáticas LaTeX en el texto en prosa
    const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\s)[^$\n]+(?<!\s)\$)/g;
    safeText = safeText.replace(mathRegex, (match) => {
      const id = mathPlaceholders.length;
      mathPlaceholders.push(match);
      return `@@MATH_EXPR_${id}@@`;
    });

    // 3. Restaurar los bloques de código originales para que marked genere las etiquetas <pre><code> correctas
    safeText = safeText.replace(/@@CODE_EXPR_(\d+)@@/g, (_, index) => {
      return codePlaceholders[Number(index)] || '';
    });

    // 4. Restaurador de fórmulas matemáticas para aplicar sobre el HTML final
    const restoreMath = (html) => {
      if (typeof html !== 'string') return '';
      return html.replace(/@@MATH_EXPR_(\d+)@@/g, (_, index) => {
        return mathPlaceholders[Number(index)] || '';
      });
    };

    return { safeText, restoreMath };
  }

  /**
   * Transpila Markdown a HTML con preservación estricta de LaTeX, estilo para tablas y tolerancia a fallos.
   * 
   * @param {string} markdownText - Texto en sintaxis Markdown.
   * @returns {string} HTML renderizable.
   */
  function parseMarkdown(markdownText) {
    if (!markdownText || typeof markdownText !== 'string') return '';

    try {
      const { safeText, restoreMath } = protectMathDelimiters(markdownText);
      let rawHtml = '';

      if (typeof marked !== 'undefined') {
        rawHtml = (typeof marked.parse === 'function') ? marked.parse(safeText) : marked(safeText);
      } else {
        // Respaldo resiliente si el CDN no está disponible
        rawHtml = fallbackNativeParse(safeText);
      }

      let finalHtml = restoreMath(rawHtml);

      // Inyectar clases de estilo en tablas para consistencia visual con Moodle
      finalHtml = finalHtml.replace(/<table>/gi, '<table class="table table-bordered table-striped">');

      return finalHtml;
    } catch (err) {
      console.error('[MarkdownEngine] Error controlado al parsear markdown:', err);
      return `<div class="alert alert-danger" style="margin:12px;padding:12px;border-radius:6px;">
        <strong>Error en renderizado Markdown:</strong> ${err.message || 'Sintaxis no compatible'}
      </div>`;
    }
  }

  /**
   * Genera código HTML limpio optimizado para copiar directamente en el editor de Moodle.
   * 
   * @param {string} markdownText 
   * @returns {string} Código HTML continuo semántico sin cajas artificiales.
   */
  function compileToMoodleHtml(markdownText) {
    if (!markdownText || !markdownText.trim()) return '';
    try {
      const compiled = parseMarkdown(markdownText);
      return `<!-- Generado con Suite Previsualizador Académico v3.0 (Modo Markdown -> Moodle) -->\n${compiled.trim()}`;
    } catch (err) {
      console.error('[MarkdownEngine] Error al exportar para Moodle:', err);
      return markdownText;
    }
  }

  // Inicializar configuración
  configureMarked();

  window.MarkdownEngine = {
    parseMarkdown,
    compileToMoodleHtml,
    protectMathDelimiters,
    fallbackNativeParse
  };
})();
