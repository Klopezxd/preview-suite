/**
 * Inspector heurístico de sintaxis crítica para entregas Moodle.
 * Blindado contra entradas nulas, excepciones DOM y textos masivos.
 * @module linter
 * @version 3.1.1
 */
(() => {
  'use strict';

  /**
   * Inspecciona errores críticos de sintaxis que alteran la entrega en Moodle:
   * 1. Residuos de bloques Markdown de IA (``` o ```html)
   * 2. Estructura HTML crítica desbalanceada (table, pre)
   * 3. Delimitadores matemáticos LaTeX sin cierre: \[ ... \] o \( ... \)
   * 4. Fallos de parseo de KaTeX / MathJax
   *
   * @param {string} code - Código fuente del editor.
   * @param {HTMLElement|null} previewEl - Contenedor de previsualización DOM.
   * @returns {{ line: number, type: string, message: string } | null}
   */
  function inspectCriticalErrors(code, previewEl) {
    if (!code || typeof code !== 'string' || !code.trim()) return null;

    try {
      const lines = code.split('\n');
      const maxScanLines = Math.min(lines.length, 10000); // Límite de seguridad contra bloqueos por archivos gigantes

      const openTables = [];
      const openPres = [];
      const openDisplayMath = [];
      const openInlineMath = [];
      let aiResidual = null;

      for (let i = 0; i < maxScanLines; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Residuos de bloques Markdown de IA (prioridad sintáctica)
        if (!aiResidual && /^```(?:html|latex|markdown|text|[a-z0-9_-]+)?$/i.test(trimmed)) {
          aiResidual = {
            line: i + 1,
            type: 'Residuo IA',
            message: 'Bloque Markdown (```) no interpretado por Moodle'
          };
        }

        // 2. Estructura HTML crítica desbalanceada (table, pre)
        const tableOpens = (line.match(/<table\b[^>]*>/gi) || []).length;
        const tableCloses = (line.match(/<\/table>/gi) || []).length;
        for (let t = 0; t < tableOpens; t++) openTables.push(i + 1);
        for (let t = 0; t < tableCloses; t++) {
          if (openTables.length > 0) openTables.pop();
        }

        const preOpens = (line.match(/<pre\b[^>]*>/gi) || []).length;
        const preCloses = (line.match(/<\/pre>/gi) || []).length;
        for (let p = 0; p < preOpens; p++) openPres.push(i + 1);
        for (let p = 0; p < preCloses; p++) {
          if (openPres.length > 0) openPres.pop();
        }

        // 3. Delimitadores matemáticos sin pareja: \[ ... \] o \( ... \)
        const dispOpens = (line.match(/\\\[/g) || []).length;
        const dispCloses = (line.match(/\\\]/g) || []).length;
        for (let d = 0; d < dispOpens; d++) openDisplayMath.push(i + 1);
        for (let d = 0; d < dispCloses; d++) {
          if (openDisplayMath.length > 0) openDisplayMath.pop();
        }

        const inOpens = (line.match(/\\\(/g) || []).length;
        const inCloses = (line.match(/\\\)/g) || []).length;
        for (let m = 0; m < inOpens; m++) openInlineMath.push(i + 1);
        for (let m = 0; m < inCloses; m++) {
          if (openInlineMath.length > 0) openInlineMath.pop();
        }
      }

      if (aiResidual) return aiResidual;

      if (openTables.length > 0) {
        return {
          line: openTables[openTables.length - 1],
          type: 'HTML',
          message: 'Etiqueta <table> sin cerrar (rompe la estructura de la página)'
        };
      }

      if (openPres.length > 0) {
        return {
          line: openPres[openPres.length - 1],
          type: 'HTML',
          message: 'Etiqueta <pre> sin cerrar (contagia formato de código)'
        };
      }

      if (openDisplayMath.length > 0) {
        return {
          line: openDisplayMath[openDisplayMath.length - 1],
          type: 'LaTeX',
          message: 'Fórmula en bloque \\[ sin su cierre \\]'
        };
      }

      if (openInlineMath.length > 0) {
        return {
          line: openInlineMath[openInlineMath.length - 1],
          type: 'LaTeX',
          message: 'Fórmula en línea \\( sin su cierre \\)'
        };
      }

      // 4. Detección de fallos de compilación matemática (KaTeX / MathJax)
      if (previewEl && previewEl.nodeType === Node.ELEMENT_NODE) {
        try {
          const mathErrorNode = previewEl.querySelector('.katex-error, mjx-merror');
          if (mathErrorNode) {
            const rawErr = mathErrorNode.getAttribute('title') || mathErrorNode.textContent || '';
            const cleanErr = rawErr.replace(/^ParseError:\s*/i, '').replace(/^KaTeX parse error:\s*/i, '');
            let matchedLine = 1;

            const errSnippet = mathErrorNode.textContent ? mathErrorNode.textContent.trim().slice(0, 20) : '';
            let foundSpecific = false;
            if (errSnippet) {
              for (let i = 0; i < maxScanLines; i++) {
                if (lines[i].includes(errSnippet)) {
                  matchedLine = i + 1;
                  foundSpecific = true;
                  break;
                }
              }
            }
            if (!foundSpecific) {
              for (let i = 0; i < maxScanLines; i++) {
                if (/\\(?:\[|\()|\$|\\frac|\\sqrt|\\int|\\sum/.test(lines[i])) {
                  matchedLine = i + 1;
                  break;
                }
              }
            }

            return {
              line: matchedLine,
              type: 'LaTeX',
              message: cleanErr ? `Sintaxis rota: ${cleanErr.slice(0, 48)}` : 'Error de sintaxis en fórmula matemática'
            };
          }
        } catch (domErr) {
          console.warn('[Linter] Advertencia al inspeccionar nodos de error en DOM:', domErr);
        }
      }
    } catch (unexpectedErr) {
      console.error('[Linter] Error no crítico durante la inspección:', unexpectedErr);
      return null;
    }

    return null;
  }

  window.Linter = {
    inspectCriticalErrors
  };
})();
