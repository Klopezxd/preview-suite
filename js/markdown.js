/**
 * Motor de compilación Markdown y exportación limpia para Moodle.
 * Blindado contra fallos de CDN, errores de sintaxis y colisiones LaTeX.
 * Soporte integral para Diagramas Mermaid, Alertas GFM (Callouts), Tablas responsivas,
 * Listas de verificación (Task Lists), Bloques de código con copiado rápido y Notas al pie.
 * @module markdown
 * @version 3.2.0
 */
(() => {
  'use strict';

  /**
   * Metadatos visuales para Alertas GitHub Flavored Markdown (Callouts / Admonitions).
   */
  const ALERT_META = {
    NOTE: { title: 'Nota', icon: 'icon-alert-note', cls: 'markdown-alert-note' },
    TIP: { title: 'Consejo', icon: 'icon-alert-tip', cls: 'markdown-alert-tip' },
    IMPORTANT: { title: 'Importante', icon: 'icon-alert-important', cls: 'markdown-alert-important' },
    WARNING: { title: 'Advertencia', icon: 'icon-alert-warning', cls: 'markdown-alert-warning' },
    CAUTION: { title: 'Precaución', icon: 'icon-alert-caution', cls: 'markdown-alert-caution' }
  };

  /**
   * Escapa caracteres especiales en cadenas para inyección HTML segura.
   * @param {string} str 
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Extrae y procesa notas al pie en formato GFM ([^1] y [^1]: Definición).
   * @param {string} text 
   * @returns {{ text: string, footnotesHtml: string }}
   */
  function extractAndProcessFootnotes(text) {
    if (!text || typeof text !== 'string') return { text: '', footnotesHtml: '' };

    const footnoteDefs = {};
    // Extraer definiciones de notas al pie que inician al principio de línea
    let cleaned = text.replace(/^\[\^([a-zA-Z0-9_-]+)\]:\s*([^\n]+(?:\n(?!\n|\[\^).*)*)/gm, (match, id, content) => {
      footnoteDefs[id] = content.trim();
      return '';
    });

    const usedIds = [];
    // Reemplazar referencias inline [^id]
    cleaned = cleaned.replace(/\[\^([a-zA-Z0-9_-]+)\]/g, (match, id) => {
      if (footnoteDefs[id] !== undefined) {
        let order = usedIds.indexOf(id);
        if (order === -1) {
          usedIds.push(id);
          order = usedIds.length;
        } else {
          order += 1;
        }
        return `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}">${order}</a></sup>`;
      }
      return match;
    });

    let footnotesHtml = '';
    if (usedIds.length > 0) {
      const items = usedIds.map((id) => {
        const itemContent = footnoteDefs[id] || '';
        return `<li id="fn-${id}"><p>${itemContent} <a href="#fnref-${id}" class="footnote-backref" title="Regresar al texto">↩</a></p></li>`;
      }).join('\n');
      footnotesHtml = `<section class="footnotes"><hr class="footnotes-sep"><ol>${items}</ol></section>`;
    }

    return { text: cleaned, footnotesHtml };
  }

  /**
   * Soporta sintaxis de texto resaltado ==resaltado== -> <mark>resaltado</mark>.
   * @param {string} text 
   * @returns {string}
   */
  function processHighlights(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  }

  /**
   * Parser personalizado para citas y alertas GFM (> [!NOTE], > [!IMPORTANT], etc.).
   * @param {string} quote - HTML generado por marked para el contenido del blockquote.
   * @returns {string}
   */
  function renderAlertBlockquote(quote) {
    const alertMatch = quote.match(/^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*([^\n<]*))?(?:<br\s*\/?>|<\/p>)/i);
    if (!alertMatch) {
      return `<blockquote class="markdown-blockquote">${quote}</blockquote>`;
    }

    const type = alertMatch[1].toUpperCase();
    const customTitle = (alertMatch[2] || '').trim();
    const meta = ALERT_META[type] || ALERT_META.NOTE;
    const title = customTitle || meta.title;

    // Remover la cabecera de la alerta preservando el resto de los párrafos intactos
    const body = quote.replace(/^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*[^\n<]*)?(?:<br\s*\/?>|<\/p>)/i, (full) => {
      return /<\/p>/i.test(full) ? '' : '<p>';
    }).trim();

    return `<div class="markdown-alert ${meta.cls}" data-alert-type="${type.toLowerCase()}">
  <div class="markdown-alert-title">
    <svg class="icon"><use href="#${meta.icon}"></use></svg>
    <span>${escapeHtml(title)}</span>
  </div>
  ${body ? `<div class="markdown-alert-content">${body}</div>` : ''}
</div>`;
  }

  /**
   * Parser personalizado para bloques de código (Mermaid y lenguajes estándar con botón de copia).
   * @param {string|object} codeArg 
   * @param {string} infostring 
   * @returns {string}
   */
  function renderCodeBlock(codeArg, infostring) {
    const rawCode = typeof codeArg === 'object' ? (codeArg.text || '') : (codeArg || '');
    const lang = ((typeof codeArg === 'object' ? codeArg.lang : infostring) || '').trim().toLowerCase();

    // 1. Diagramas Mermaid
    if (lang === 'mermaid') {
      const diagramId = 'mermaid_' + Math.random().toString(36).substring(2, 9);
      return `<div class="mermaid-block" data-mermaid-code="${encodeURIComponent(rawCode)}">
  <div class="mermaid-toolbar">
    <span class="mermaid-label">
      <svg class="icon"><use href="#icon-sparkles"></use></svg> Diagrama Mermaid
    </span>
    <div class="mermaid-actions">
      <button class="btn-mermaid-action btn-copy-mermaid-source" type="button" title="Copiar código fuente Mermaid">
        <svg class="icon"><use href="#icon-copy"></use></svg> <span>Copiar</span>
      </button>
      <button class="btn-mermaid-action btn-copy-mermaid-svg" type="button" title="Copiar diagrama vectorial SVG">
        <svg class="icon"><use href="#icon-sparkles"></use></svg> <span>SVG</span>
      </button>
    </div>
  </div>
  <div class="mermaid-viewport">
    <div class="mermaid-raw" style="display:none;">${escapeHtml(rawCode)}</div>
    <div class="mermaid-output" id="${diagramId}">
      <div class="mermaid-loading">Cargando diagrama...</div>
    </div>
  </div>
</div>`;
    }

    // 2. Bloques de código fuente estándar con encabezado y botón de copiado
    const displayLang = lang || 'código';
    const langClass = lang ? `language-${lang}` : '';
    return `<div class="code-block-wrapper">
  <div class="code-block-header">
    <span class="code-block-lang">${escapeHtml(displayLang.toUpperCase())}</span>
    <button class="btn-copy-code-block" type="button" title="Copiar código al portapapeles">
      <svg class="icon"><use href="#icon-copy"></use></svg> <span>Copiar</span>
    </button>
  </div>
  <pre class="${langClass}"><code class="${langClass}">${escapeHtml(rawCode)}</code></pre>
</div>`;
  }

  /**
   * Configura las extensiones y renderizadores personalizados de marked.js si está disponible.
   */
  function configureMarked() {
    if (typeof marked !== 'undefined' && marked.use) {
      try {
        const customRenderer = {
          blockquote(quote) {
            return renderAlertBlockquote(quote);
          },

          code(codeArg, infostring) {
            return renderCodeBlock(codeArg, infostring);
          },

          table(header, body) {
            return `<div class="table-responsive"><table class="table table-bordered table-striped">${header}${body}</table></div>`;
          },

          listitem(text, task, checked) {
            if (task) {
              const clean = text.replace(/^<input[^>]*>\s*/i, '');
              return `<li class="task-list-item"><input type="checkbox" class="task-list-checkbox" disabled ${checked ? 'checked' : ''}> <span class="task-list-text">${clean}</span></li>`;
            }
            return `<li>${text}</li>`;
          },

          list(body, ordered, start) {
            const tag = ordered ? 'ol' : 'ul';
            const isTask = body.includes('task-list-item');
            const cls = isTask ? ' class="task-list"' : '';
            const startAttr = ordered && start && start !== 1 ? ` start="${start}"` : '';
            return `<${tag}${cls}${startAttr}>${body}</${tag}>`;
          },

          link(href, title, text) {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const isExternal = /^https?:\/\//i.test(href);
            const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${href}"${titleAttr}${targetAttr}>${text}</a>`;
          }
        };

        marked.use({
          gfm: true,
          breaks: true,
          pedantic: false,
          renderer: customRenderer
        });
      } catch (e) {
        console.warn('[MarkdownEngine] Advertencia al configurar extensiones de Marked:', e);
      }
    }
  }

  /**
   * Parser nativo de respaldo en caso de indisponibilidad temporal del CDN de Marked.js.
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
        .replace(/^\> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*([^\n<]*))?\n\> (.*$)/gim, (_, type, customTitle, content) => {
          const meta = ALERT_META[type.toUpperCase()] || ALERT_META.NOTE;
          const title = customTitle || meta.title;
          return `<div class="markdown-alert ${meta.cls}"><div class="markdown-alert-title"><span>${title}</span></div><div class="markdown-alert-content"><p>${content}</p></div></div>`;
        })
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
   * blindando primero los bloques de código (incluidos bloques Mermaid) para no alterar su contenido interno.
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

    // 2. Proteger fórmulas matemáticas LaTeX en el texto en prosa (bloques y fórmulas inline)
    const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\s)[^$\n]+(?<!\s)\$)/g;
    safeText = safeText.replace(mathRegex, (match) => {
      const id = mathPlaceholders.length;
      mathPlaceholders.push(match);
      return `@@MATH_EXPR_${id}@@`;
    });

    // 3. Restaurar los bloques de código originales para que marked genere las etiquetas <pre><code> o Mermaid correctas
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
   * Transpila Markdown a HTML con soporte integral para Mermaid, Alertas GFM,
   * tablas responsivas, checklists, código y preservación estricta de LaTeX.
   * 
   * @param {string} markdownText - Texto en sintaxis Markdown.
   * @returns {string} HTML renderizable.
   */
  function parseMarkdown(markdownText) {
    if (!markdownText || typeof markdownText !== 'string') return '';

    try {
      // 1. Extraer notas al pie antes de procesar delimitadores
      const { text: textWithoutFootnotes, footnotesHtml } = extractAndProcessFootnotes(markdownText);

      // 2. Proteger expresiones matemáticas LaTeX
      const { safeText, restoreMath } = protectMathDelimiters(textWithoutFootnotes);

      // 3. Procesar resaltado de texto (==resaltado==)
      const textWithHighlights = processHighlights(safeText);

      let rawHtml = '';
      if (typeof marked !== 'undefined') {
        rawHtml = (typeof marked.parse === 'function') ? marked.parse(textWithHighlights) : marked(textWithHighlights);
      } else {
        rawHtml = fallbackNativeParse(textWithHighlights);
      }

      // 4. Restaurar fórmulas matemáticas
      let finalHtml = restoreMath(rawHtml);

      // 5. Asegurar clases en tablas existentes que hayan llegado sin wrapper responsivo
      if (!finalHtml.includes('table-responsive') && finalHtml.includes('<table')) {
        finalHtml = finalHtml.replace(/<table([^>]*)>/gi, '<div class="table-responsive"><table class="table table-bordered table-striped"$1>');
        finalHtml = finalHtml.replace(/<\/table>/gi, '</table></div>');
      }

      // 6. Incorporar notas al pie al final del documento si existen
      if (footnotesHtml) {
        finalHtml += '\n' + footnotesHtml;
      }

      return finalHtml;
    } catch (err) {
      console.error('[MarkdownEngine] Error controlado al parsear markdown:', err);
      return `<div class="alert alert-danger" style="margin:12px;padding:12px;border-radius:6px;">
        <strong>Error en renderizado Markdown:</strong> ${escapeHtml(err.message || 'Sintaxis no compatible')}
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
      return `<!-- Generado con Suite Previsualizador Académico v3.2.0 (Modo Markdown -> Moodle) -->\n${compiled.trim()}`;
    } catch (err) {
      console.error('[MarkdownEngine] Error al exportar para Moodle:', err);
      return markdownText;
    }
  }

  /**
   * Convierte una cadena de código HTML a formato Markdown estándar (GFM),
   * preservando fórmulas matemáticas LaTeX, diagramas Mermaid, alertas, tablas y bloques de código.
   * 
   * @param {string} htmlText - Código HTML de entrada.
   * @returns {string} Texto formateado en Markdown.
   */
  function htmlToMarkdown(htmlText) {
    if (!htmlText || typeof htmlText !== 'string') return '';

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const body = doc.body;

      function nodeToMd(node) {
        if (!node) return '';

        if (node.nodeType === Node.TEXT_NODE) {
          return node.nodeValue;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
          return '';
        }

        const tag = node.tagName.toLowerCase();
        const childContent = () => Array.from(node.childNodes).map(nodeToMd).join('');

        // Manejo de Alertas GFM
        if (node.classList.contains('markdown-alert')) {
          const type = (node.dataset.alertType || 'note').toUpperCase();
          const contentEl = node.querySelector('.markdown-alert-content');
          const contentText = contentEl ? Array.from(contentEl.childNodes).map(nodeToMd).join('').trim() : childContent().trim();
          const lines = contentText.split('\n').map(l => `> ${l}`).join('\n');
          return `\n> [!${type}]\n${lines}\n\n`;
        }

        // Manejo de Diagramas Mermaid
        if (node.classList.contains('mermaid-block')) {
          const rawCode = node.dataset.mermaidCode 
            ? decodeURIComponent(node.dataset.mermaidCode)
            : (node.querySelector('.mermaid-raw') ? node.querySelector('.mermaid-raw').textContent.trim() : '');
          return `\n\`\`\`mermaid\n${rawCode}\n\`\`\`\n\n`;
        }

        // Manejo de Bloques de Código con Contenedor
        if (node.classList.contains('code-block-wrapper')) {
          const codeEl = node.querySelector('pre code');
          const codeText = codeEl ? codeEl.textContent : node.textContent;
          let lang = '';
          if (codeEl) {
            const match = (codeEl.className || '').match(/language-([a-z0-9_-]+)/i);
            if (match) lang = match[1];
          }
          return `\n\`\`\`${lang}\n${codeText.replace(/^\n+|\n+$/g, '')}\n\`\`\`\n\n`;
        }

        // Manejo de Contenedores Responsivos de Tablas
        if (node.classList.contains('table-responsive')) {
          const tableEl = node.querySelector('table');
          return tableEl ? nodeToMd(tableEl) : childContent();
        }

        switch (tag) {
          case 'h1': return `\n# ${childContent().trim()}\n\n`;
          case 'h2': return `\n## ${childContent().trim()}\n\n`;
          case 'h3': return `\n### ${childContent().trim()}\n\n`;
          case 'h4': return `\n#### ${childContent().trim()}\n\n`;
          case 'h5': return `\n##### ${childContent().trim()}\n\n`;
          case 'h6': return `\n###### ${childContent().trim()}\n\n`;

          case 'p': {
            const inner = childContent().trim();
            return inner ? `\n${inner}\n\n` : '\n';
          }

          case 'strong':
          case 'b': {
            const inner = childContent();
            return inner.trim() ? `**${inner}**` : '';
          }

          case 'em':
          case 'i': {
            const inner = childContent();
            return inner.trim() ? `*${inner}*` : '';
          }

          case 'del':
          case 's': {
            const inner = childContent();
            return inner.trim() ? `~~${inner}~~` : '';
          }

          case 'mark': {
            const inner = childContent();
            return inner.trim() ? `==${inner}==` : '';
          }

          case 'u': {
            const inner = childContent();
            return `<u>${inner}</u>`;
          }

          case 'br':
            return '\n';

          case 'hr':
            return '\n---\n\n';

          case 'pre': {
            const codeEl = node.querySelector('code');
            const codeText = codeEl ? codeEl.textContent : node.textContent;
            let lang = '';
            if (codeEl) {
              const match = (codeEl.className || '').match(/language-([a-z0-9_-]+)/i);
              if (match) lang = match[1];
            }
            return `\n\`\`\`${lang}\n${codeText.replace(/^\n+|\n+$/g, '')}\n\`\`\`\n\n`;
          }

          case 'code': {
            if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
              return node.textContent;
            }
            return `\`${node.textContent}\``;
          }

          case 'a': {
            const href = node.getAttribute('href') || '#';
            const text = childContent().trim() || href;
            return `[${text}](${href})`;
          }

          case 'blockquote': {
            const inner = childContent().trim();
            const lines = inner.split('\n').map(l => `> ${l}`).join('\n');
            return `\n${lines}\n\n`;
          }

          case 'ul': {
            const items = Array.from(node.children)
              .filter(el => el.tagName.toLowerCase() === 'li')
              .map(li => {
                const checkbox = li.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  const checked = checkbox.checked ? 'x' : ' ';
                  const labelSpan = li.querySelector('.task-list-text') || li;
                  const itemContent = Array.from(labelSpan.childNodes)
                    .filter(c => c !== checkbox)
                    .map(nodeToMd).join('').trim();
                  return `- [${checked}] ${itemContent}`;
                }
                return `- ${Array.from(li.childNodes).map(nodeToMd).join('').trim()}`;
              })
              .join('\n');
            return `\n${items}\n\n`;
          }

          case 'ol': {
            let idx = 1;
            const items = Array.from(node.children)
              .filter(el => el.tagName.toLowerCase() === 'li')
              .map(li => `${idx++}. ${Array.from(li.childNodes).map(nodeToMd).join('').trim()}`)
              .join('\n');
            return `\n${items}\n\n`;
          }

          case 'table': {
            const rows = Array.from(node.querySelectorAll('tr'));
            if (rows.length === 0) return '';

            const formatCell = (cell) => {
              const content = Array.from(cell.childNodes).map(nodeToMd).join('').trim();
              return content.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|');
            };

            let mdTable = '\n';
            const headerRow = rows[0];
            const headerCols = Array.from(headerRow.querySelectorAll('th, td')).map(formatCell);
            
            mdTable += `| ${headerCols.join(' | ')} |\n`;
            mdTable += `| ${headerCols.map(() => '---').join(' | ')} |\n`;

            for (let i = 1; i < rows.length; i++) {
              const cols = Array.from(rows[i].querySelectorAll('td, th')).map(formatCell);
              mdTable += `| ${cols.join(' | ')} |\n`;
            }
            return mdTable + '\n';
          }

          default:
            return childContent();
        }
      }

      const result = Array.from(body.childNodes).map(nodeToMd).join('');
      return result.replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
      console.error('[MarkdownEngine] Error al convertir HTML a Markdown:', e);
      return htmlText;
    }
  }

  // Inicializar configuración
  configureMarked();

  window.MarkdownEngine = {
    parseMarkdown,
    compileToMoodleHtml,
    htmlToMarkdown,
    protectMathDelimiters,
    fallbackNativeParse
  };
})();
