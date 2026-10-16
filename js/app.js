/**
 * Controlador principal de la aplicación (Academic Preview Suite).
 * Arquitectura blindada contra excepciones, fallos de red, restricciones de almacenamiento
 * y desbordamientos de memoria.
 * @module app
 * @version 3.2.3
 */
(() => {
  'use strict';

  const { CONFIG, AUTO_CLOSE_MAP, CLOSING_DELIMITERS, DEFAULT_MOODLE_TEMPLATE, DEFAULT_MARKDOWN_TEMPLATE } = window.APP_CONFIG;

  // --- 1. Capa Segura de Almacenamiento Local (SafeStorage) ---
  const SafeStorage = {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item !== null ? item : defaultValue;
      } catch (e) {
        console.warn('[SafeStorage] Acceso a localStorage restringido:', e);
        return defaultValue;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('[SafeStorage] No se pudo persistir en localStorage:', e);
      }
    }
  };

  // --- 2. Estado Reactivo y Buffers de Memoria ---
  const state = {
    currentMode: 'moodle', // 'moodle' | 'markdown'
    isHubVisible: true,
    fontSize: CONFIG.DEFAULT_FONT_SIZE,
    previewZoom: CONFIG.DEFAULT_PREVIEW_ZOOM || 100,
    zoomPulseTimer: null,
    previewZoomPulseTimer: null,
    isDarkMode: false,
    debounceTimer: null,
    toastTimer: null,
    currentError: null,
    isResizing: false,
    isInitialized: false,
    lastLineCount: null,
    lastErrorLine: null,
    lastFocusedElement: null,

    // Buffers de memoria independientes por modo
    buffers: {
      moodle: DEFAULT_MOODLE_TEMPLATE,
      markdown: DEFAULT_MARKDOWN_TEMPLATE
    },

    // Pila de deshacer / rehacer independiente por modo (capacidad fija)
    history: {
      moodle: { stack: [DEFAULT_MOODLE_TEMPLATE], index: 0, recordTimer: null, isUndoing: false },
      markdown: { stack: [DEFAULT_MARKDOWN_TEMPLATE], index: 0, recordTimer: null, isUndoing: false }
    }
  };

  // --- 3. Caché de Referencias del DOM ---
  let DOM = {};

  function cacheDOMElements() {
    DOM = {
      // Pantalla Hub
      hubScreen: document.getElementById('hub-screen'),
      hubBrandIcon: document.querySelector('.hub-brand-icon'),
      cardModeMoodle: document.getElementById('card-mode-moodle'),
      cardModeMarkdown: document.getElementById('card-mode-markdown'),

      // Espacio de trabajo y barra superior
      appWorkspace: document.getElementById('app'),
      brandTitle: document.getElementById('brand-title'),
      brandIcon: document.getElementById('brand-icon'),
      brandIconSvg: document.getElementById('brand-icon-svg'),
      btnSwitchMode: document.getElementById('btn-switch-mode'),
      switchModeLabel: document.getElementById('switch-mode-label'),
      switchModeIcon: document.getElementById('switch-mode-icon'),

      // Editor y Lienzo
      editor: document.getElementById('editor'),
      lineNumbers: document.getElementById('line-numbers'),
      editorWrap: document.getElementById('editor-wrap'),
      previewInner: document.getElementById('preview-inner'),
      previewWrap: document.getElementById('preview-wrap'),
      emptyState: document.getElementById('empty-state'),

      // Barra de telemetría y estado
      statusPill: document.getElementById('status-pill'),
      statusTxt: document.getElementById('status-txt'),
      charCount: document.getElementById('char-count'),
      lastUpdate: document.getElementById('last-update'),
      themeIcon: document.getElementById('theme-icon'),
      themeText: document.getElementById('theme-text'),

      // Paneles y divisor
      panels: document.getElementById('panels'),
      leftPanel: document.getElementById('left-panel'),
      rightPanel: document.getElementById('right-panel'),
      resizer: document.getElementById('resizer'),
      mobileViewNav: document.getElementById('mobile-view-nav'),
      btnViewSplit: document.getElementById('btn-view-split'),
      btnViewEditor: document.getElementById('btn-view-editor'),
      btnViewPreview: document.getElementById('btn-view-preview'),

      // Retroalimentación y modales
      toast: document.getElementById('toast'),
      toastMsg: document.getElementById('toast-msg'),
      shortcutsModal: document.getElementById('shortcuts-modal'),
      modeSwitchModal: document.getElementById('mode-switch-modal'),
      modeSwitchTitle: document.getElementById('mode-switch-title'),
      btnOptTransform: document.getElementById('btn-opt-transform'),
      optTransformTitle: document.getElementById('opt-transform-title'),
      optTransformDesc: document.getElementById('opt-transform-desc'),
      btnOptClean: document.getElementById('btn-opt-clean'),
      btnCloseModeModal: document.getElementById('btn-close-mode-modal'),
      btnCancelModeModal: document.getElementById('btn-cancel-mode-modal'),
      rickrollModal: document.getElementById('rickroll-modal'),
      btnCloseRickroll: document.getElementById('btn-close-rickroll'),
      btnRickrollOk: document.getElementById('btn-rickroll-ok'),
      versionBadge: document.getElementById('version-badge'),
      antigravityBadge: document.getElementById('antigravity-badge'),
      fileInput: document.getElementById('file-input'),
      dropOverlay: document.getElementById('drop-overlay'),

      // Botonera de herramientas
      btnResetTemplate: document.getElementById('btn-reset-template'),
      btnClearEditor: document.getElementById('btn-clear-editor'),
      btnToggleTheme: document.getElementById('btn-toggle-theme'),
      btnOpenFile: document.getElementById('btn-open-file'),
      btnSaveFile: document.getElementById('btn-save-file'),
      btnPrint: document.getElementById('btn-print'),
      btnCopyCode: document.getElementById('btn-copy-code'),
      btnUndo: document.getElementById('btn-undo'),
      btnShowShortcuts: document.getElementById('btn-show-shortcuts'),
      btnCloseModal: document.getElementById('btn-close-modal'),

      // Pseudobotones y popovers táctiles de escala tipográfica y zoom estilo Overleaf
      btnFontReset: document.getElementById('btn-font-reset'),
      labelFontSize: document.getElementById('label-font-size'),
      editorZoomPopover: document.getElementById('editor-zoom-popover'),
      btnFontPopoverDec: document.getElementById('btn-font-popover-dec'),
      valFontPopover: document.getElementById('val-font-popover'),
      btnFontPopoverInc: document.getElementById('btn-font-popover-inc'),
      btnFontPopoverReset: document.getElementById('btn-font-popover-reset'),

      btnPreviewZoomReset: document.getElementById('btn-preview-zoom-reset'),
      labelPreviewZoom: document.getElementById('label-preview-zoom'),
      previewZoomPopover: document.getElementById('preview-zoom-popover'),
      btnPreviewPopoverDec: document.getElementById('btn-preview-popover-dec'),
      valPreviewPopover: document.getElementById('val-preview-popover'),
      btnPreviewPopoverInc: document.getElementById('btn-preview-popover-inc'),
      btnPreviewPopoverReset: document.getElementById('btn-preview-popover-reset'),
      previewCard: document.getElementById('preview-card')
    };
  }

  // --- 4. Gestión del Hub y Conmutación Inteligente de Modos ---

  function showHub() {
    state.isHubVisible = true;
    if (DOM.hubScreen) DOM.hubScreen.classList.remove('hidden');
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function selectMode(mode) {
    if (mode !== 'moodle' && mode !== 'markdown') mode = 'moodle';

    // Limpiar temporizadores pendientes para evitar condiciones de carrera
    clearTimeout(state.debounceTimer);

    state.currentMode = mode;
    state.isHubVisible = false;
    state.lastLineCount = null;
    state.lastErrorLine = null;
    closeAllZoomPopovers();
    if (DOM.hubScreen) DOM.hubScreen.classList.add('hidden');

    updateModeUI();
    if (DOM.editor) {
      DOM.editor.value = state.buffers[mode] || '';
      DOM.editor.focus();
    }
    updateLineNumbers();
    renderPreview();
    updateUndoButtonState();

    if (window.location.hash !== `#${mode}`) {
      window.location.hash = mode;
    }
  }

  function openModeSwitchModal() {
    state.lastFocusedElement = document.activeElement;
    if (DOM.modeSwitchModal) {
      DOM.modeSwitchModal.classList.add('open');
      if (DOM.btnOptTransform) DOM.btnOptTransform.focus();
    }
  }

  function closeModeSwitchModal() {
    if (DOM.modeSwitchModal) DOM.modeSwitchModal.classList.remove('open');
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
      state.lastFocusedElement = null;
    }
  }

  /**
   * Conmutador inteligente de modo:
   * Si el editor no tiene contenido o tiene la plantilla sin tocar, cambia inmediatamente.
   * Si el usuario escribió contenido real, pregunta con 2 opciones limpias: transformar o empezar en blanco.
   */
  function handleSmartModeSwitch() {
    const isMoodle = state.currentMode === 'moodle';
    const targetMode = isMoodle ? 'markdown' : 'moodle';
    const targetName = isMoodle ? 'Markdown' : 'Moodle (HTML)';
    const currentCode = DOM.editor ? DOM.editor.value.trim() : '';
    const defaultTemplate = (isMoodle ? DEFAULT_MOODLE_TEMPLATE : DEFAULT_MARKDOWN_TEMPLATE).trim();

    // 1. Si no hay cambios que proteger, cambiar directamente sin interrupciones
    if (!currentCode || currentCode === defaultTemplate) {
      const cleanTpl = targetMode === 'moodle' ? DEFAULT_MOODLE_TEMPLATE : DEFAULT_MARKDOWN_TEMPLATE;
      // Preservar trabajo previo en el buffer destino si ya tenía modificaciones no vacías
      if (!state.buffers[targetMode] || state.buffers[targetMode] === cleanTpl) {
        state.buffers[targetMode] = cleanTpl;
        state.history[targetMode] = { stack: [cleanTpl], index: 0, recordTimer: null, isUndoing: false };
      }
      selectMode(targetMode);
      showToast(`Modo cambiado a ${targetName}`);
      return;
    }

    // 2. Si hay trabajo real en el editor, abrir el modal inteligente
    if (DOM.modeSwitchTitle) {
      DOM.modeSwitchTitle.textContent = `Cambiar a Modo ${targetName}`;
    }
    if (DOM.optTransformTitle) {
      DOM.optTransformTitle.textContent = `✨ Transformar a ${targetName}`;
    }
    if (DOM.optTransformDesc) {
      DOM.optTransformDesc.textContent = isMoodle
        ? 'Convierte tu código HTML y fórmulas a Markdown para seguir editando.'
        : 'Compila tu Markdown y fórmulas a código HTML continuo para Moodle.';
    }

    openModeSwitchModal();
  }

  /**
   * Ejecutar la transformación de contenido y cambiar de modo.
   */
  function executeTransform() {
    closeModeSwitchModal();
    const isMoodle = state.currentMode === 'moodle';
    const currentCode = DOM.editor ? DOM.editor.value : '';

    if (isMoodle) {
      const converted = (window.MarkdownEngine && typeof window.MarkdownEngine.htmlToMarkdown === 'function')
        ? window.MarkdownEngine.htmlToMarkdown(currentCode)
        : currentCode;
      state.buffers.markdown = converted;
      state.history.markdown = { stack: [converted], index: 0, recordTimer: null, isUndoing: false };
      selectMode('markdown');
      showToast('Contenido transformado a Markdown');
    } else {
      const compiled = (window.MarkdownEngine && typeof window.MarkdownEngine.compileToMoodleHtml === 'function')
        ? window.MarkdownEngine.compileToMoodleHtml(currentCode, DOM.previewInner)
        : currentCode;
      state.buffers.moodle = compiled;
      state.history.moodle = { stack: [compiled], index: 0, recordTimer: null, isUndoing: false };
      selectMode('moodle');
      showToast('Contenido transformado a Moodle HTML');
    }
  }

  /**
   * Ejecutar el cambio con plantilla limpia descartando el contenido actual.
   */
  function executeCleanSwitch() {
    closeModeSwitchModal();
    const isMoodle = state.currentMode === 'moodle';
    const targetMode = isMoodle ? 'markdown' : 'moodle';
    const targetName = isMoodle ? 'Markdown' : 'Moodle (HTML)';
    const cleanTpl = targetMode === 'moodle' ? DEFAULT_MOODLE_TEMPLATE : DEFAULT_MARKDOWN_TEMPLATE;

    state.buffers[targetMode] = cleanTpl;
    state.history[targetMode] = { stack: [cleanTpl], index: 0, recordTimer: null, isUndoing: false };
    selectMode(targetMode);
    showToast(`Modo cambiado a ${targetName} (lienzo limpio)`);
  }

  function updateModeUI() {
    const isMoodle = state.currentMode === 'moodle';

    if (DOM.brandTitle) {
      DOM.brandTitle.textContent = isMoodle ? 'Previsualizador Moodle' : 'Previsualizador Markdown';
    }

    if (DOM.brandIconSvg) {
      DOM.brandIconSvg.innerHTML = `<use href="${isMoodle ? '#icon-school' : '#icon-markdown'}"></use>`;
    }

    if (DOM.btnSwitchMode) {
      DOM.btnSwitchMode.title = isMoodle ? 'Cambiar a Modo Markdown' : 'Cambiar a Modo Moodle';
      DOM.btnSwitchMode.classList.toggle('switch-to-markdown', isMoodle);
      DOM.btnSwitchMode.classList.toggle('switch-to-moodle', !isMoodle);
    }

    if (DOM.switchModeLabel) {
      DOM.switchModeLabel.textContent = isMoodle ? 'Modo Markdown' : 'Modo Moodle';
    }

    if (DOM.switchModeIcon) {
      DOM.switchModeIcon.innerHTML = `<use href="${isMoodle ? '#icon-markdown' : '#icon-school'}"></use>`;
    }

    if (DOM.btnSaveFile) {
      DOM.btnSaveFile.title = isMoodle ? 'Descargar como archivo .html' : 'Descargar como archivo .md';
    }

    if (DOM.editor) {
      DOM.editor.placeholder = isMoodle
        ? 'Escribe o pega aquí tu código HTML con fórmulas LaTeX (\\( ... \\), \\[ ... \\])...'
        : 'Escribe aquí en formato Markdown con fórmulas LaTeX ($$ ... $$, \\( ... \\))...';
    }

    document.title = `${isMoodle ? 'Previsualizador Moodle' : 'Previsualizador Markdown'} | Suite`;
  }

  // --- 5. Sistema de Historial (Undo / Redo) ---

  function getActiveHistory() {
    return state.history[state.currentMode];
  }

  function pushHistoryState(content, immediate = false) {
    const h = getActiveHistory();
    if (!h || h.isUndoing) return;

    const commit = () => {
      if (h.index >= 0 && h.stack[h.index] === content) return;

      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(content);

      if (h.stack.length > 50) {
        h.stack.shift();
      } else {
        h.index++;
      }
      updateUndoButtonState();
    };

    if (immediate) {
      clearTimeout(h.recordTimer);
      commit();
    } else {
      clearTimeout(h.recordTimer);
      h.recordTimer = setTimeout(commit, 300);
    }
  }

  function undoChange() {
    const h = getActiveHistory();
    if (!h) return;

    // Si hay cambios pendientes en debounce o el editor tiene contenido más nuevo que el tope de la pila
    if (h.recordTimer || (DOM.editor && DOM.editor.value !== h.stack[h.index])) {
      clearTimeout(h.recordTimer);
      h.recordTimer = null;
      if (DOM.editor && DOM.editor.value !== h.stack[h.index]) {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(DOM.editor.value);
        if (h.stack.length > 50) h.stack.shift();
        else h.index++;
      }
    }

    if (h.index > 0) {
      h.isUndoing = true;
      h.index--;
      DOM.editor.value = h.stack[h.index];
      state.buffers[state.currentMode] = DOM.editor.value;
      schedulePreviewUpdate();
      showToast('Acción deshecha');
      h.isUndoing = false;
      updateUndoButtonState();
    } else {
      showToast('No hay más acciones para deshacer');
    }
  }

  function redoChange() {
    const h = getActiveHistory();
    if (!h) return;

    if (h.recordTimer) {
      clearTimeout(h.recordTimer);
      h.recordTimer = null;
    }

    if (h.index < h.stack.length - 1) {
      h.isUndoing = true;
      h.index++;
      DOM.editor.value = h.stack[h.index];
      state.buffers[state.currentMode] = DOM.editor.value;
      schedulePreviewUpdate();
      showToast('Acción rehecha');
      h.isUndoing = false;
      updateUndoButtonState();
    } else {
      showToast('No hay acciones para rehacer');
    }
  }

  function updateUndoButtonState() {
    if (!DOM.btnUndo) return;
    const h = getActiveHistory();
    const canUndo = h && h.index > 0;
    DOM.btnUndo.style.opacity = canUndo ? '1' : '0.45';
    DOM.btnUndo.style.pointerEvents = canUndo ? 'auto' : 'none';
  }

  // --- 6. Motor de Renderizado Unificado y Tolerante a Fallos ---

  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let mermaidRenderToken = 0;
  let lastMermaidTheme = null;

  /**
   * Renderiza todos los diagramas Mermaid en el lienzo de vista previa.
   * Maneja inicialización de tema adaptativo, errores de sintaxis en vivo y aislamiento DOM.
   */
  async function renderMermaidDiagrams() {
    if (!DOM.previewInner) return;
    const blocks = DOM.previewInner.querySelectorAll('.mermaid-block');
    if (blocks.length === 0) return;

    if (!window.mermaid) {
      // Mermaid aún descargando del CDN; se ejecutará automáticamente en __onMermaidReady
      return;
    }

    const isDark = document.body.classList.contains('theme-dark') || 
                   (DOM.previewWrap && DOM.previewWrap.classList.contains('theme-dark')) ||
                   state.isDarkMode;

    if (lastMermaidTheme !== isDark) {
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
          fontSize: 13,
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            padding: 18,
            curve: 'basis'
          },
          sequence: {
            useMaxWidth: true,
            boxMargin: 12,
            boxTextMargin: 6
          },
          themeVariables: isDark ? {
            darkMode: true,
            background: '#0A1628',
            primaryColor: '#00D4FF',
            primaryTextColor: '#FAFBFC',
            primaryBorderColor: '#00D4FF',
            lineColor: '#00FF87',
            secondaryColor: '#A855F7',
            tertiaryColor: '#050B1A',
            fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
            fontSize: '13px'
          } : {
            fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
            fontSize: '13px'
          }
        });
        lastMermaidTheme = isDark;
      } catch (initErr) {
        console.warn('[Mermaid] Error en inicialización:', initErr);
      }
    }

    const currentToken = ++mermaidRenderToken;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const outputEl = block.querySelector('.mermaid-output');
      const rawCode = block.dataset.mermaidCode 
        ? decodeURIComponent(block.dataset.mermaidCode)
        : (block.querySelector('.mermaid-raw') ? block.querySelector('.mermaid-raw').textContent : '');

      if (!outputEl || !rawCode || !rawCode.trim()) continue;

      const uniqueId = `mermaid_diag_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`;

      try {
        const renderResult = await window.mermaid.render(uniqueId, rawCode.trim());
        // Descartar si otro ciclo de renderizado inició mientras este se procesaba
        if (currentToken !== mermaidRenderToken) return;

        const svgCode = typeof renderResult === 'string' ? renderResult : (renderResult.svg || '');
        outputEl.innerHTML = svgCode;
        outputEl.classList.remove('has-error');
        outputEl.classList.add('rendered');

        if (renderResult.bindFunctions) {
          try {
            renderResult.bindFunctions(outputEl);
          } catch (bindErr) {
            // Ignorado de forma segura
          }
        }
      } catch (err) {
        if (currentToken !== mermaidRenderToken) return;

        // Limpiar elementos residuales que Mermaid inyecta en el DOM ante fallos de sintaxis
        const dangling = document.getElementById('d' + uniqueId);
        if (dangling) dangling.remove();
        const dangling2 = document.getElementById(uniqueId);
        if (dangling2 && dangling2.parentElement !== outputEl) dangling2.remove();

        outputEl.classList.add('has-error');
        const firstLineErr = err.message ? err.message.split('\n')[0] : 'Error en sintaxis de diagrama';
        outputEl.innerHTML = `
          <div class="mermaid-syntax-hint">
            <span class="mermaid-hint-icon">⚙️</span>
            <div class="mermaid-hint-body">
              <strong>Diagrama Mermaid en edición</strong>
              <span>Esperando sintaxis completa (${escapeHtml(firstLineErr)})</span>
            </div>
          </div>
        `;
      }
    }
  }

  function renderPreview() {
    if (!DOM.editor || !DOM.previewInner) return;

    try {
      const rawContent = DOM.editor.value ? DOM.editor.value.trim() : '';

      if (!rawContent) {
        if (DOM.emptyState) DOM.emptyState.style.display = 'flex';
        DOM.previewInner.style.display = 'none';
        DOM.previewInner.innerHTML = '';
        state.currentError = null;
        setRenderStatus('ok');
        updateLineNumbers(null);
        updateContentStatistics();
        return;
      }

      if (DOM.emptyState) DOM.emptyState.style.display = 'none';
      DOM.previewInner.style.display = 'block';

      // 1. Inyección de contenido según el modo activo con sanitización preventiva (DOMPurify)
      const rawHtml = state.currentMode === 'moodle'
        ? DOM.editor.value
        : (window.MarkdownEngine ? window.MarkdownEngine.parseMarkdown(DOM.editor.value) : DOM.editor.value);

      const safeHtml = (typeof window.DOMPurify !== 'undefined' && typeof window.DOMPurify.sanitize === 'function')
        ? window.DOMPurify.sanitize(rawHtml, {
            USE_PROFILES: { html: true, svg: true, mathMl: true },
            ADD_ATTR: ['target', 'data-mermaid-code', 'data-alert-type', 'checked', 'disabled', 'start'],
            ADD_TAGS: ['use', 'annotation']
          })
        : rawHtml;

      DOM.previewInner.innerHTML = safeHtml;

      // 2. Resaltado léxico de código (Prism.js)
      if (window.Prism) {
        try {
          Prism.highlightAllUnder(DOM.previewInner);
        } catch (prismErr) {
          console.warn('[Prism] Advertencia aislada en resaltado léxico:', prismErr);
        }
      }

      // 3. Compilación matemática ultra-rápida (KaTeX)
      if (typeof renderMathInElement === 'function') {
        try {
          renderMathInElement(DOM.previewInner, {
            delimiters: [
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
              { left: '$$',  right: '$$',  display: true },
              { left: '$',   right: '$',   display: false }
            ],
            ignoredClasses: ['katex-ignore', 'mermaid', 'mermaid-output', 'mermaid-raw', 'mermaid-block'],
            throwOnError: false,
            errorColor: '#ef4444'
          });
        } catch (katexErr) {
          console.warn('[KaTeX] Advertencia aislada en compilación matemática:', katexErr);
        }
      }

      // 4. Renderizado asíncrono de Diagramas Mermaid (Modo Markdown)
      if (state.currentMode === 'markdown') {
        renderMermaidDiagrams();
      }

      // 4. Inspección heurística de errores (Modo Moodle)
      let err = null;
      if (state.currentMode === 'moodle' && window.Linter) {
        err = window.Linter.inspectCriticalErrors(DOM.editor.value, DOM.previewInner);
      }
      state.currentError = err;

      if (err) {
        setRenderStatus('error', err);
        updateLineNumbers(err.line);
      } else {
        setRenderStatus('ok');
        updateLineNumbers(null);
      }

      const now = new Date();
      if (DOM.lastUpdate) {
        DOM.lastUpdate.textContent = 'Actualizado ' + now.toLocaleTimeString('es', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
      updateContentStatistics();
    } catch (unexpectedRenderError) {
      console.error('[RenderPreview] Error crítico capturado:', unexpectedRenderError);
      setRenderStatus('error', {
        line: 1,
        type: 'Render',
        message: 'Error inesperado al renderizar el contenido'
      });
    }
  }

  function schedulePreviewUpdate() {
    setRenderStatus('updating');
    updateLineNumbers(state.currentError ? state.currentError.line : null);
    updateContentStatistics();
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(renderPreview, CONFIG.DEBOUNCE_DELAY_MS);
  }

  function updateLineNumbers(errorLine = null) {
    if (!DOM.editor || !DOM.lineNumbers) return;

    const text = DOM.editor.value;
    let totalLines = 1;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) totalLines++;
    }

    // Memoización: evitar reconstrucción innecesaria del DOM si nada cambió
    if (totalLines === state.lastLineCount && errorLine === state.lastErrorLine) {
      return;
    }

    state.lastLineCount = totalLines;
    state.lastErrorLine = errorLine;

    let html = '';
    for (let i = 1; i <= totalLines; i++) {
      html += errorLine === i ? `<div class="line-err">${i}</div>` : `<div>${i}</div>`;
    }
    DOM.lineNumbers.innerHTML = html;
  }

  function updateContentStatistics() {
    if (!DOM.editor || !DOM.charCount) return;

    const text = DOM.editor.value || '';
    const totalChars = text.length;
    const trimmed = text.trim();
    const totalWords = trimmed ? trimmed.split(/\s+/).length : 0;
    let totalLines = 1;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) totalLines++;
    }

    DOM.charCount.textContent = 
      `${totalWords.toLocaleString()} palabras · ${totalChars.toLocaleString()} caracteres · ${totalLines.toLocaleString()} líneas`;
  }

  function setRenderStatus(status, errorInfo = null) {
    if (!DOM.statusPill || !DOM.statusTxt) return;

    DOM.statusPill.className = 'status-pill ' + status;
    if (status === 'error' && errorInfo) {
      DOM.statusTxt.textContent = `⚠ ${errorInfo.type} L:${errorInfo.line}`;
      DOM.statusPill.title = `Clic para ir a la línea ${errorInfo.line}: ${errorInfo.message}`;
    } else if (status === 'updating') {
      DOM.statusTxt.textContent = 'Procesando...';
      DOM.statusPill.title = '';
    } else {
      DOM.statusTxt.textContent = 'Listo';
      DOM.statusPill.title = '';
    }
  }

  function jumpToLine(lineNumber) {
    if (!DOM.editor) return;

    const lines = DOM.editor.value.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) return;

    let charOffset = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      charOffset += lines[i].length + 1;
    }

    DOM.editor.focus();
    const lineLength = lines[lineNumber - 1] ? lines[lineNumber - 1].length : 0;
    DOM.editor.setSelectionRange(charOffset, charOffset + lineLength);

    const approxLineHeight = state.fontSize * 1.65;
    DOM.editor.scrollTop = Math.max(0, (lineNumber - 4) * approxLineHeight);

    if (state.currentError) {
      showToast(`Línea ${lineNumber}: ${state.currentError.message}`);
    }
  }

  function showToast(message) {
    if (!DOM.toast || !DOM.toastMsg) return;

    clearTimeout(state.toastTimer);
    DOM.toastMsg.textContent = message;
    DOM.toast.classList.add('show');
    state.toastTimer = setTimeout(() => {
      if (DOM.toast) DOM.toast.classList.remove('show');
    }, CONFIG.TOAST_DURATION_MS);
  }

  // --- 7. Operaciones de Edición, Zoom, Exportación y Archivos ---

  function changeFontSize(delta) {
    state.fontSize = Math.min(Math.max(state.fontSize + delta, CONFIG.FONT_SIZE_MIN), CONFIG.FONT_SIZE_MAX);
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.lineNumbers) DOM.lineNumbers.style.fontSize = `${state.fontSize}px`;
    if (DOM.labelFontSize) DOM.labelFontSize.textContent = `${state.fontSize}px`;
    if (DOM.valFontPopover) DOM.valFontPopover.textContent = `${state.fontSize}px`;

    if (DOM.btnFontReset) {
      DOM.btnFontReset.title = `Tamaño de fuente: ${state.fontSize}px (Ctrl + Rueda para ajustar, clic para restablecer)`;
      DOM.btnFontReset.classList.remove('zoom-active');
      void DOM.btnFontReset.offsetWidth;
      DOM.btnFontReset.classList.add('zoom-active');
      clearTimeout(state.zoomPulseTimer);
      state.zoomPulseTimer = setTimeout(() => {
        if (DOM.btnFontReset) DOM.btnFontReset.classList.remove('zoom-active');
      }, 350);
    }
    updateLineNumbers();
  }

  function changePreviewZoom(delta) {
    const min = CONFIG.PREVIEW_ZOOM_MIN || 50;
    const max = CONFIG.PREVIEW_ZOOM_MAX || 200;
    const step = CONFIG.PREVIEW_ZOOM_STEP || 10;
    state.previewZoom = Math.min(Math.max(state.previewZoom + (delta * step), min), max);

    if (DOM.previewCard) {
      DOM.previewCard.style.zoom = `${state.previewZoom}%`;
    }
    if (DOM.labelPreviewZoom) {
      DOM.labelPreviewZoom.textContent = `${state.previewZoom}%`;
    }
    if (DOM.valPreviewPopover) {
      DOM.valPreviewPopover.textContent = `${state.previewZoom}%`;
    }

    if (DOM.btnPreviewZoomReset) {
      DOM.btnPreviewZoomReset.title = `Zoom: ${state.previewZoom}% (Ctrl + Rueda para ajustar, clic para restablecer)`;
      DOM.btnPreviewZoomReset.classList.remove('zoom-active');
      void DOM.btnPreviewZoomReset.offsetWidth;
      DOM.btnPreviewZoomReset.classList.add('zoom-active');
      clearTimeout(state.previewZoomPulseTimer);
      state.previewZoomPulseTimer = setTimeout(() => {
        if (DOM.btnPreviewZoomReset) DOM.btnPreviewZoomReset.classList.remove('zoom-active');
      }, 350);
    }
  }

  function resetEditorFont() {
    state.fontSize = CONFIG.DEFAULT_FONT_SIZE;
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.lineNumbers) DOM.lineNumbers.style.fontSize = `${state.fontSize}px`;
    if (DOM.labelFontSize) DOM.labelFontSize.textContent = `${state.fontSize}px`;
    if (DOM.valFontPopover) DOM.valFontPopover.textContent = `${state.fontSize}px`;
    if (DOM.btnFontReset) {
      DOM.btnFontReset.title = `Tamaño de fuente: ${state.fontSize}px (Ctrl + Rueda para ajustar, clic para restablecer)`;
      DOM.btnFontReset.classList.remove('zoom-active');
      void DOM.btnFontReset.offsetWidth;
      DOM.btnFontReset.classList.add('zoom-active');
      clearTimeout(state.zoomPulseTimer);
      state.zoomPulseTimer = setTimeout(() => {
        if (DOM.btnFontReset) DOM.btnFontReset.classList.remove('zoom-active');
      }, 350);
    }
    updateLineNumbers();
  }

  function resetPreviewZoom() {
    state.previewZoom = CONFIG.DEFAULT_PREVIEW_ZOOM || 100;
    if (DOM.previewCard) {
      DOM.previewCard.style.zoom = '100%';
    }
    if (DOM.labelPreviewZoom) {
      DOM.labelPreviewZoom.textContent = '100%';
    }
    if (DOM.valPreviewPopover) {
      DOM.valPreviewPopover.textContent = '100%';
    }
    if (DOM.btnPreviewZoomReset) {
      DOM.btnPreviewZoomReset.title = 'Zoom: 100% (Ctrl + Rueda para ajustar, clic para restablecer)';
      DOM.btnPreviewZoomReset.classList.remove('zoom-active');
      void DOM.btnPreviewZoomReset.offsetWidth;
      DOM.btnPreviewZoomReset.classList.add('zoom-active');
      clearTimeout(state.previewZoomPulseTimer);
      state.previewZoomPulseTimer = setTimeout(() => {
        if (DOM.btnPreviewZoomReset) DOM.btnPreviewZoomReset.classList.remove('zoom-active');
      }, 350);
    }
  }

  function resetZoom() {
    resetEditorFont();
    resetPreviewZoom();
  }

  function applyTheme(isDark) {
    state.isDarkMode = isDark;
    if (DOM.previewWrap) DOM.previewWrap.classList.toggle('theme-dark', state.isDarkMode);

    const useEl = DOM.themeIcon ? DOM.themeIcon.querySelector('use') : null;
    if (useEl) {
      useEl.setAttribute('href', state.isDarkMode ? '#icon-moon' : '#icon-sun');
    }
    if (DOM.themeText) {
      DOM.themeText.textContent = state.isDarkMode ? 'Oscuro' : 'Claro';
    }

    SafeStorage.set('suite_preview_theme', state.isDarkMode ? 'dark' : 'light');

    if (state.currentMode === 'markdown') {
      renderMermaidDiagrams();
    }
  }

  function toggleTheme() {
    applyTheme(!state.isDarkMode);
  }

  async function copyTextSafely(text, successMsg) {
    if (!text) {
      showToast('No hay contenido para copiar');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const dummyTextarea = document.createElement('textarea');
        dummyTextarea.value = text;
        dummyTextarea.style.position = 'fixed';
        dummyTextarea.style.left = '-9999px';
        dummyTextarea.style.top = '0';
        document.body.appendChild(dummyTextarea);
        dummyTextarea.focus();
        dummyTextarea.select();
        document.execCommand('copy');
        document.body.removeChild(dummyTextarea);
      }
      showToast(successMsg);
    } catch (err) {
      console.warn('[Clipboard] Fallo al copiar texto:', err);
      showToast('No se pudo acceder al portapapeles');
    }
  }

  async function copyCodeToClipboard() {
    if (!DOM.editor || !DOM.editor.value) return;

    await copyTextSafely(DOM.editor.value, 'Código copiado al portapapeles');

    if (DOM.btnCopyCode) {
      const originalHtml = DOM.btnCopyCode.innerHTML;
      DOM.btnCopyCode.innerHTML = '<svg class="icon"><use href="#icon-check"></use></svg> <span class="btn-label">¡Copiado!</span>';
      setTimeout(() => { if (DOM.btnCopyCode) DOM.btnCopyCode.innerHTML = originalHtml; }, 1800);
    }
  }

  function restoreDefaultTemplate() {
    if (!DOM.editor) return;

    const defaultText = state.currentMode === 'moodle' ? DEFAULT_MOODLE_TEMPLATE : DEFAULT_MARKDOWN_TEMPLATE;
    const hasModifications = DOM.editor.value && DOM.editor.value !== defaultText;
    
    if (hasModifications) {
      const confirmed = confirm(
        '¿Deseas restablecer la plantilla inicial?\n\n' +
        'Se reemplazará el texto actual del editor por la plantilla de ejemplo de este modo.'
      );
      if (!confirmed) return;
    }

    pushHistoryState(DOM.editor.value, true);
    DOM.editor.value = defaultText;
    state.buffers[state.currentMode] = defaultText;
    pushHistoryState(defaultText, true);
    schedulePreviewUpdate();
    showToast('Plantilla restablecida');
  }

  function clearEditorContent() {
    if (!DOM.editor || !DOM.editor.value) return;

    pushHistoryState(DOM.editor.value, true);
    DOM.editor.value = '';
    state.buffers[state.currentMode] = '';
    pushHistoryState('', true);
    schedulePreviewUpdate();
    showToast('Editor limpio (Ctrl + Z para deshacer)');
  }

  function downloadCurrentFile() {
    if (!DOM.editor) return;

    const isMoodle = state.currentMode === 'moodle';
    const filename = isMoodle ? 'codigo_moodle.html' : 'documento.md';
    const mimeType = isMoodle ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8';

    try {
      const blob = new Blob([DOM.editor.value || ''], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');

      downloadAnchor.href = objectUrl;
      downloadAnchor.download = filename;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(objectUrl);

      showToast(`Archivo ${filename} descargado`);
    } catch (err) {
      console.error('[Download] Error al generar la descarga:', err);
      showToast('Error al descargar el archivo');
    }
  }

  function loadFileContent(file) {
    if (!file) return;

    // Validación de seguridad de tamaño
    if (file.size > CONFIG.MAX_FILE_SIZE_BYTES) {
      showToast(`El archivo supera el límite de seguridad (${CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB)`);
      return;
    }

    // Validación de extensión permitida
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
      showToast(`Formato "${extension}" no compatible. Usa archivos de texto (.html, .md, .txt)`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;

      // Detección y conmutación inteligente de modo según la extensión del archivo
      const isMdFile = extension === '.md' || extension === '.markdown';
      const isHtmlFile = extension === '.html' || extension === '.htm';

      if (isMdFile && state.currentMode !== 'markdown') {
        selectMode('markdown');
      } else if (isHtmlFile && state.currentMode !== 'moodle') {
        selectMode('moodle');
      }

      pushHistoryState(DOM.editor.value, true);
      DOM.editor.value = content;
      state.buffers[state.currentMode] = content;
      pushHistoryState(content, true);
      updateLineNumbers();
      updateContentStatistics();
      schedulePreviewUpdate();
      showToast(`Archivo "${file.name}" cargado con éxito`);
    };
    reader.onerror = () => {
      showToast('Error de lectura al cargar el archivo');
    };
    reader.onabort = () => {
      showToast('Carga de archivo cancelada');
    };
    reader.readAsText(file);
  }

  // --- 8. Modales y Easter Egg ---
  function openShortcutsModal() {
    state.lastFocusedElement = document.activeElement;
    if (DOM.shortcutsModal) {
      DOM.shortcutsModal.classList.add('open');
      if (DOM.btnCloseModal) DOM.btnCloseModal.focus();
    }
  }

  function closeShortcutsModal() {
    if (DOM.shortcutsModal) DOM.shortcutsModal.classList.remove('open');
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
      state.lastFocusedElement = null;
    }
  }

  function closeRickrollModal() {
    if (DOM.rickrollModal) {
      DOM.rickrollModal.classList.remove('open');
    }
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
      state.lastFocusedElement = null;
    }
  }

  function isMobileOrTablet() {
    return window.matchMedia('(max-width: 1024px)').matches || ('ontouchstart' in window && window.innerWidth <= 1024);
  }

  function closeAllZoomPopovers() {
    if (DOM.editorZoomPopover) DOM.editorZoomPopover.classList.remove('open');
    if (DOM.previewZoomPopover) DOM.previewZoomPopover.classList.remove('open');
    if (DOM.btnFontReset) DOM.btnFontReset.setAttribute('aria-expanded', 'false');
    if (DOM.btnPreviewZoomReset) DOM.btnPreviewZoomReset.setAttribute('aria-expanded', 'false');
  }

  function setupRickrollEasterEgg() {
    let waitingForReturn = false;

    const triggerRickroll = () => {
      waitingForReturn = true;

      // 1. Abrir pantalla secreta sin anuncios en una pestaña nueva
      window.open('surprise.html', '_blank');

      // 2. Preparar el detector para cuando el usuario regrese a esta pestaña
      const onUserReturn = () => {
        if (!waitingForReturn) return;
        waitingForReturn = false;

        window.removeEventListener('focus', onUserReturn);
        document.removeEventListener('visibilitychange', onVisibilityChange);

        // Desplegar la ventana flotante de bienvenida sorpresa
        if (DOM.rickrollModal) {
          state.lastFocusedElement = document.activeElement;
          DOM.rickrollModal.classList.add('open');
          if (DOM.btnRickrollOk) DOM.btnRickrollOk.focus();
        }
        showToast('🎵 ¡Has sido Rickrolleado! 🕺');
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          onUserReturn();
        }
      };

      window.addEventListener('focus', onUserReturn);
      document.addEventListener('visibilitychange', onVisibilityChange);
    };

    // Vincular al badge de versión del Workspace y al badge de Antigravity
    if (DOM.versionBadge) {
      DOM.versionBadge.addEventListener('click', triggerRickroll);
    }
    if (DOM.antigravityBadge) {
      DOM.antigravityBadge.addEventListener('click', triggerRickroll);
    }

    // Eventos de cierre del modal de retorno
    if (DOM.btnCloseRickroll) {
      DOM.btnCloseRickroll.addEventListener('click', closeRickrollModal);
    }
    if (DOM.btnRickrollOk) {
      DOM.btnRickrollOk.addEventListener('click', closeRickrollModal);
    }
    if (DOM.rickrollModal) {
      DOM.rickrollModal.addEventListener('click', (e) => {
        if (e.target === DOM.rickrollModal) closeRickrollModal();
      });
    }

    // Atajo global: Cerrar cualquier modal o popover activo con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeRickrollModal();
        closeShortcutsModal();
        closeModeSwitchModal();
        closeAllZoomPopovers();
      }
    });
  }

  // --- 9. Registro Seguro de Eventos ---

  function setupHubEvents() {
    const handleCardClick = (e, mode) => {
      // Si el usuario simplemente está seleccionando texto, no activar la tarjeta
      const sel = window.getSelection ? window.getSelection().toString() : '';
      if (sel && sel.trim().length > 0) return;
      selectMode(mode);
    };

    if (DOM.cardModeMoodle) {
      DOM.cardModeMoodle.addEventListener('click', (e) => handleCardClick(e, 'moodle'));
    }
    if (DOM.cardModeMarkdown) {
      DOM.cardModeMarkdown.addEventListener('click', (e) => handleCardClick(e, 'markdown'));
    }

    const handleCardKey = (e, mode) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMode(mode);
      }
    };
    if (DOM.cardModeMoodle) DOM.cardModeMoodle.addEventListener('keydown', (e) => handleCardKey(e, 'moodle'));
    if (DOM.cardModeMarkdown) DOM.cardModeMarkdown.addEventListener('keydown', (e) => handleCardKey(e, 'markdown'));

    // Clic en el logo o título para volver a la pantalla de bienvenida (Hub)
    if (DOM.brandIcon) DOM.brandIcon.addEventListener('click', showHub);
    if (DOM.brandTitle) DOM.brandTitle.addEventListener('click', showHub);

    // Botón único conmutador de modo
    if (DOM.btnSwitchMode) DOM.btnSwitchMode.addEventListener('click', handleSmartModeSwitch);

    // Eventos del modal inteligente de cambio de modo
    if (DOM.btnOptTransform) DOM.btnOptTransform.addEventListener('click', executeTransform);
    if (DOM.btnOptClean) DOM.btnOptClean.addEventListener('click', executeCleanSwitch);
    if (DOM.btnCloseModeModal) DOM.btnCloseModeModal.addEventListener('click', closeModeSwitchModal);
    if (DOM.btnCancelModeModal) DOM.btnCancelModeModal.addEventListener('click', closeModeSwitchModal);
    if (DOM.modeSwitchModal) {
      DOM.modeSwitchModal.addEventListener('click', (e) => {
        if (e.target === DOM.modeSwitchModal) closeModeSwitchModal();
      });
    }
  }

  function setupToolbarEvents() {
    if (DOM.btnResetTemplate) DOM.btnResetTemplate.addEventListener('click', restoreDefaultTemplate);
    if (DOM.btnClearEditor) DOM.btnClearEditor.addEventListener('click', clearEditorContent);
    if (DOM.btnToggleTheme) DOM.btnToggleTheme.addEventListener('click', toggleTheme);
    if (DOM.btnCopyCode) DOM.btnCopyCode.addEventListener('click', copyCodeToClipboard);
    if (DOM.btnUndo) DOM.btnUndo.addEventListener('click', undoChange);
    if (DOM.btnSaveFile) DOM.btnSaveFile.addEventListener('click', downloadCurrentFile);
    if (DOM.btnPrint) DOM.btnPrint.addEventListener('click', () => window.print());
    if (DOM.btnShowShortcuts) DOM.btnShowShortcuts.addEventListener('click', openShortcutsModal);
    if (DOM.btnCloseModal) DOM.btnCloseModal.addEventListener('click', closeShortcutsModal);

    if (DOM.btnFontReset) {
      DOM.btnFontReset.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isMobileOrTablet()) {
          resetEditorFont();
          showToast('Tamaño de fuente restablecido a 14px');
          return;
        }
        const wasOpen = DOM.editorZoomPopover && DOM.editorZoomPopover.classList.contains('open');
        closeAllZoomPopovers();
        if (!wasOpen && DOM.editorZoomPopover) {
          DOM.editorZoomPopover.classList.add('open');
          DOM.btnFontReset.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (DOM.btnPreviewZoomReset) {
      DOM.btnPreviewZoomReset.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isMobileOrTablet()) {
          resetPreviewZoom();
          showToast('Zoom de vista previa restablecido a 100%');
          return;
        }
        const wasOpen = DOM.previewZoomPopover && DOM.previewZoomPopover.classList.contains('open');
        closeAllZoomPopovers();
        if (!wasOpen && DOM.previewZoomPopover) {
          DOM.previewZoomPopover.classList.add('open');
          DOM.btnPreviewZoomReset.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (DOM.btnFontPopoverDec) DOM.btnFontPopoverDec.addEventListener('click', (e) => { e.stopPropagation(); changeFontSize(-1); });
    if (DOM.btnFontPopoverInc) DOM.btnFontPopoverInc.addEventListener('click', (e) => { e.stopPropagation(); changeFontSize(1); });
    if (DOM.btnFontPopoverReset) DOM.btnFontPopoverReset.addEventListener('click', (e) => { e.stopPropagation(); resetEditorFont(); closeAllZoomPopovers(); });

    if (DOM.btnPreviewPopoverDec) DOM.btnPreviewPopoverDec.addEventListener('click', (e) => { e.stopPropagation(); changePreviewZoom(-1); });
    if (DOM.btnPreviewPopoverInc) DOM.btnPreviewPopoverInc.addEventListener('click', (e) => { e.stopPropagation(); changePreviewZoom(1); });
    if (DOM.btnPreviewPopoverReset) DOM.btnPreviewPopoverReset.addEventListener('click', (e) => { e.stopPropagation(); resetPreviewZoom(); closeAllZoomPopovers(); });

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.zoom-ctrl-wrapper')) {
        closeAllZoomPopovers();
      }
    });

    if (DOM.btnOpenFile && DOM.fileInput) {
      DOM.btnOpenFile.addEventListener('click', () => {
        DOM.fileInput.value = '';
        DOM.fileInput.accept = '.html,.htm,.md,.markdown,.txt';
        DOM.fileInput.click();
      });

      DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          loadFileContent(e.target.files[0]);
        }
      });
    }

    if (DOM.shortcutsModal) {
      DOM.shortcutsModal.addEventListener('click', (e) => {
        if (e.target === DOM.shortcutsModal) closeShortcutsModal();
      });
    }

    if (DOM.statusPill) {
      DOM.statusPill.addEventListener('click', () => {
        if (state.currentError) jumpToLine(state.currentError.line);
      });
    }

    // Delegación de eventos interactivos en vista previa (Copiar código y exportar SVG de diagramas)
    if (DOM.previewInner) {
      DOM.previewInner.addEventListener('click', async (e) => {
        // 1. Botón Copiar bloque de código estándar
        const copyCodeBtn = e.target.closest('.btn-copy-code-block');
        if (copyCodeBtn) {
          const wrapper = copyCodeBtn.closest('.code-block-wrapper');
          const codeEl = wrapper ? wrapper.querySelector('pre code') : null;
          if (codeEl) {
            await copyTextSafely(codeEl.textContent, 'Código copiado al portapapeles');
            copyCodeBtn.classList.add('copied');
            const label = copyCodeBtn.querySelector('span');
            if (label) label.textContent = '¡Copiado!';
            setTimeout(() => {
              copyCodeBtn.classList.remove('copied');
              if (label) label.textContent = 'Copiar';
            }, 1800);
          }
          return;
        }

        // 2. Botón Copiar código fuente de Diagrama Mermaid
        const copyMermaidBtn = e.target.closest('.btn-copy-mermaid-source');
        if (copyMermaidBtn) {
          const block = copyMermaidBtn.closest('.mermaid-block');
          const rawCode = block && block.dataset.mermaidCode
            ? decodeURIComponent(block.dataset.mermaidCode)
            : (block && block.querySelector('.mermaid-raw') ? block.querySelector('.mermaid-raw').textContent : '');
          if (rawCode) {
            await copyTextSafely(rawCode, 'Sintaxis Mermaid copiada al portapapeles');
            const label = copyMermaidBtn.querySelector('span');
            if (label) {
              label.textContent = '¡Copiado!';
              setTimeout(() => { label.textContent = 'Copiar'; }, 1800);
            }
          }
          return;
        }

        // 3. Botón Copiar SVG vectorial generado de Diagrama Mermaid
        const copySvgBtn = e.target.closest('.btn-copy-mermaid-svg');
        if (copySvgBtn) {
          const block = copySvgBtn.closest('.mermaid-block');
          const svgEl = block ? block.querySelector('.mermaid-output svg') : null;
          if (svgEl) {
            await copyTextSafely(svgEl.outerHTML, 'SVG del diagrama copiado al portapapeles');
            const label = copySvgBtn.querySelector('span');
            if (label) {
              label.textContent = '¡Copiado!';
              setTimeout(() => { label.textContent = 'SVG'; }, 1800);
            }
          } else {
            showToast('El diagrama aún no ha sido renderizado');
          }
          return;
        }
      });
    }

    // Navegación de vistas para pantallas móviles y tablets verticales (<= 768px)
    if (DOM.btnViewSplit) DOM.btnViewSplit.addEventListener('click', () => setMobileView('split'));
    if (DOM.btnViewEditor) DOM.btnViewEditor.addEventListener('click', () => setMobileView('editor'));
    if (DOM.btnViewPreview) DOM.btnViewPreview.addEventListener('click', () => setMobileView('preview'));
  }

  function setMobileView(view) {
    if (!DOM.panels) return;
    DOM.panels.classList.remove('view-mode-split', 'view-mode-editor', 'view-mode-preview');

    if (DOM.btnViewSplit) DOM.btnViewSplit.classList.toggle('active', view === 'split');
    if (DOM.btnViewEditor) DOM.btnViewEditor.classList.toggle('active', view === 'editor');
    if (DOM.btnViewPreview) DOM.btnViewPreview.classList.toggle('active', view === 'preview');

    if (view === 'editor') {
      DOM.panels.classList.add('view-mode-editor');
      if (DOM.editor) DOM.editor.focus();
    } else if (view === 'preview') {
      DOM.panels.classList.add('view-mode-preview');
      renderPreview();
    } else {
      DOM.panels.classList.add('view-mode-split');
      updateLineNumbers();
    }
  }

  function setupEditorEvents() {
    if (!DOM.editor) return;

    DOM.editor.addEventListener('input', () => {
      state.buffers[state.currentMode] = DOM.editor.value;
      pushHistoryState(DOM.editor.value);
      schedulePreviewUpdate();
    });

    DOM.editor.addEventListener('scroll', () => {
      if (DOM.lineNumbers) DOM.lineNumbers.scrollTop = DOM.editor.scrollTop;
    });

    DOM.editor.addEventListener('keydown', (e) => {
      // Tabulador (Indentar / Desindentar selección o línea)
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;
        const value = DOM.editor.value;
        const isMultiLine = value.slice(start, end).includes('\n');

        if (e.shiftKey || isMultiLine) {
          // Bloque multilínea o comando de desindentación (Shift + Tab)
          const lineStart = value.lastIndexOf('\n', start - 1) + 1;
          let lineEnd = value.indexOf('\n', end);
          if (lineEnd === -1) lineEnd = value.length;

          const block = value.slice(lineStart, lineEnd);
          const lines = block.split('\n');

          let deltaStart = 0;
          let deltaEnd = 0;

          if (e.shiftKey) {
            // Desindentar (remover hasta 2 espacios iniciales por línea)
            const modifiedLines = lines.map((l, idx) => {
              let removed = 0;
              if (l.startsWith('  ')) {
                removed = 2;
                l = l.slice(2);
              } else if (l.startsWith(' ')) {
                removed = 1;
                l = l.slice(1);
              }
              if (idx === 0) deltaStart = -removed;
              deltaEnd -= removed;
              return l;
            });
            const newBlock = modifiedLines.join('\n');
            DOM.editor.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
            DOM.editor.selectionStart = Math.max(lineStart, start + deltaStart);
            DOM.editor.selectionEnd = Math.max(lineStart, end + deltaEnd);
          } else {
            // Indentar cada línea seleccionada con 2 espacios
            const modifiedLines = lines.map((l, idx) => {
              if (idx === 0) deltaStart = 2;
              deltaEnd += 2;
              return '  ' + l;
            });
            const newBlock = modifiedLines.join('\n');
            DOM.editor.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
            DOM.editor.selectionStart = start + deltaStart;
            DOM.editor.selectionEnd = end + deltaEnd;
          }
        } else {
          // Inserción estándar de 2 espacios en cursor individual
          DOM.editor.value = value.slice(0, start) + '  ' + value.slice(end);
          DOM.editor.selectionStart = DOM.editor.selectionEnd = start + 2;
        }

        state.buffers[state.currentMode] = DOM.editor.value;
        pushHistoryState(DOM.editor.value);
        schedulePreviewUpdate();
      }

      // Deshacer (Ctrl/Cmd + Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        undoChange();
      }

      // Rehacer (Ctrl/Cmd + Y | Ctrl + Shift + Z)
      if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        redoChange();
      }

      // Copia rápida (Ctrl/Cmd + Shift + C)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        copyCodeToClipboard();
      }

      // Render manual forzado (Ctrl/Cmd + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        renderPreview();
      }

      // Guardar / Descargar archivo directamente (Ctrl/Cmd + S)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !e.shiftKey) {
        e.preventDefault();
        downloadCurrentFile();
      }

      // 1. Eliminación síncrona de pares vacíos con Backspace (Comportamiento IDE)
      if (e.key === 'Backspace') {
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;
        if (start === end && start > 0) {
          const prevChar = DOM.editor.value[start - 1];
          const nextChar = DOM.editor.value[start];
          if (AUTO_CLOSE_MAP[prevChar] === nextChar) {
            e.preventDefault();
            DOM.editor.value = DOM.editor.value.slice(0, start - 1) + DOM.editor.value.slice(start + 1);
            DOM.editor.selectionStart = DOM.editor.selectionEnd = start - 1;
            state.buffers[state.currentMode] = DOM.editor.value;
            pushHistoryState(DOM.editor.value);
            schedulePreviewUpdate();
            return;
          }
        }
      }

      // 2. Salto inteligente (overtype) de delimitadores de cierre existentes
      if (CLOSING_DELIMITERS && CLOSING_DELIMITERS.has(e.key)) {
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;
        if (start === end && DOM.editor.value[start] === e.key) {
          e.preventDefault();
          DOM.editor.selectionStart = DOM.editor.selectionEnd = start + 1;
          return;
        }
      }

      // 3. Auto-cierre y envoltura inteligente de delimitadores
      if (AUTO_CLOSE_MAP[e.key]) {
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;

        // Si hay texto seleccionado, envolver la selección (Comportamiento IDE)
        if (start !== end) {
          e.preventDefault();
          const selectedText = DOM.editor.value.slice(start, end);
          const wrapped = e.key + selectedText + AUTO_CLOSE_MAP[e.key];
          DOM.editor.value = DOM.editor.value.slice(0, start) + wrapped + DOM.editor.value.slice(end);
          DOM.editor.selectionStart = start + 1;
          DOM.editor.selectionEnd = end + 1;
          state.buffers[state.currentMode] = DOM.editor.value;
          pushHistoryState(DOM.editor.value);
          schedulePreviewUpdate();
          return;
        }

        // Si es una comilla precedida por una letra o número (p. ej. don't, d'un), no auto-cerrar
        if ((e.key === "'" || e.key === '"') && start > 0 && /[a-zA-Z0-9]/.test(DOM.editor.value[start - 1])) {
          return;
        }

        // Inserción síncrona si el siguiente carácter es espacio, salto o puntuación de cierre
        const nextChar = DOM.editor.value[start];
        const shouldAutoClose = nextChar === undefined || /[\s\n\r,.;:!?)\]}>]/.test(nextChar);

        if (shouldAutoClose) {
          e.preventDefault();
          const closeChar = AUTO_CLOSE_MAP[e.key];
          const before = DOM.editor.value.slice(0, start);
          const after = DOM.editor.value.slice(start);
          DOM.editor.value = before + e.key + closeChar + after;
          DOM.editor.selectionStart = DOM.editor.selectionEnd = start + 1;
          state.buffers[state.currentMode] = DOM.editor.value;
          pushHistoryState(DOM.editor.value);
          schedulePreviewUpdate();
          return;
        }
      }
    });
  }

  function setupDragAndDropEvents() {
    if (!DOM.editorWrap || !DOM.dropOverlay) return;

    DOM.editorWrap.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.dropOverlay.classList.add('active');
    });

    DOM.editorWrap.addEventListener('dragleave', (e) => {
      if (!DOM.editorWrap.contains(e.relatedTarget)) {
        DOM.dropOverlay.classList.remove('active');
      }
    });

    DOM.editorWrap.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.dropOverlay.classList.remove('active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        loadFileContent(e.dataTransfer.files[0]);
      }
    });
  }

  function setupResizerEvents() {
    if (!DOM.resizer || !DOM.panels) return;

    const isVerticalStack = () => window.innerWidth <= 768;

    const startResize = () => {
      state.isResizing = true;
      DOM.resizer.classList.add('dragging');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isVerticalStack() ? 'row-resize' : 'col-resize';
    };

    const doResize = (clientX, clientY) => {
      if (!state.isResizing) return;
      const containerRect = DOM.panels.getBoundingClientRect();

      if (!isVerticalStack()) {
        const percentage = Math.min(Math.max((clientX - containerRect.left) / (containerRect.width - 7), 0.15), 0.85);
        if (DOM.leftPanel) {
          DOM.leftPanel.style.flex = 'none';
          DOM.leftPanel.style.width = `${percentage * (containerRect.width - 7)}px`;
        }
        if (DOM.rightPanel) DOM.rightPanel.style.flex = '1';
      } else {
        const percentage = Math.min(Math.max((clientY - containerRect.top) / (containerRect.height - 7), 0.15), 0.85);
        if (DOM.leftPanel) {
          DOM.leftPanel.style.flex = 'none';
          DOM.leftPanel.style.height = `${percentage * (containerRect.height - 7)}px`;
        }
        if (DOM.rightPanel) DOM.rightPanel.style.flex = '1';
      }
    };

    const stopResize = () => {
      if (!state.isResizing) return;
      state.isResizing = false;
      DOM.resizer.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    DOM.resizer.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', (e) => doResize(e.clientX, e.clientY));
    document.addEventListener('mouseup', stopResize);

    DOM.resizer.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) startResize();
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!state.isResizing) return;
      if (e.touches && e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        doResize(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    document.addEventListener('touchend', stopResize);

    // Si el usuario cambia de orientación o expande la pantalla a escritorio (> 768px), restablecer vista dividida
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 768 && DOM.panels) {
          DOM.panels.classList.remove('view-mode-editor', 'view-mode-preview');
          DOM.panels.classList.add('view-mode-split');
          if (DOM.btnViewSplit) DOM.btnViewSplit.classList.add('active');
          if (DOM.btnViewEditor) DOM.btnViewEditor.classList.remove('active');
          if (DOM.btnViewPreview) DOM.btnViewPreview.classList.remove('active');
        }
        if (window.innerWidth > 1024) {
          closeAllZoomPopovers();
        }
      }, 100);
    });
  }

  // --- 10. Control Ergonómico de Zoom y Escala (Rueda y Atajos) ---
  function setupZoomEvents() {
    let wheelAccumulator = 0;
    let wheelResetTimer = null;
    const WHEEL_THRESHOLD = 36;

    // Interceptar Ctrl + Rueda del mouse (ajuste exclusivo por mouse sin alterar zoom del navegador)
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        wheelAccumulator += e.deltaY;
        clearTimeout(wheelResetTimer);
        wheelResetTimer = setTimeout(() => { wheelAccumulator = 0; }, 180);

        if (Math.abs(wheelAccumulator) >= WHEEL_THRESHOLD) {
          const delta = wheelAccumulator < 0 ? 1 : -1;
          wheelAccumulator = 0;

          if (DOM.rightPanel && DOM.rightPanel.contains(e.target)) {
            changePreviewZoom(delta);
          } else if (DOM.leftPanel && DOM.leftPanel.contains(e.target)) {
            changeFontSize(delta);
          } else {
            if (e.clientX > window.innerWidth / 2) {
              changePreviewZoom(delta);
            } else {
              changeFontSize(delta);
            }
          }
        }
      }
    }, { passive: false });

    // 2. Gesto Táctil de Pellizco (Pinch-to-Zoom con 2 dedos en Móviles y Tablets)
    let pinchStartDist = null;
    let pinchDeltaAccumulator = 0;
    const PINCH_THRESHOLD = 20;

    const calcTouchDistance = (touches) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    };

    const handlePinchStart = (e) => {
      if (e.touches && e.touches.length === 2) {
        pinchStartDist = calcTouchDistance(e.touches);
        pinchDeltaAccumulator = 0;
      }
    };

    const handlePinchMove = (e, isPreview) => {
      if (e.touches && e.touches.length === 2 && pinchStartDist !== null) {
        if (e.cancelable) e.preventDefault();
        const currentDist = calcTouchDistance(e.touches);
        const diff = currentDist - pinchStartDist;
        pinchDeltaAccumulator += diff;
        pinchStartDist = currentDist;

        if (Math.abs(pinchDeltaAccumulator) >= PINCH_THRESHOLD) {
          const delta = pinchDeltaAccumulator > 0 ? 1 : -1;
          pinchDeltaAccumulator = 0;
          if (isPreview) {
            changePreviewZoom(delta);
          } else {
            changeFontSize(delta);
          }
        }
      }
    };

    const handlePinchEnd = () => {
      pinchStartDist = null;
      pinchDeltaAccumulator = 0;
    };

    if (DOM.leftPanel) {
      DOM.leftPanel.addEventListener('touchstart', handlePinchStart, { passive: true });
      DOM.leftPanel.addEventListener('touchmove', (e) => handlePinchMove(e, false), { passive: false });
      DOM.leftPanel.addEventListener('touchend', handlePinchEnd, { passive: true });
      DOM.leftPanel.addEventListener('touchcancel', handlePinchEnd, { passive: true });
    }

    if (DOM.rightPanel) {
      DOM.rightPanel.addEventListener('touchstart', handlePinchStart, { passive: true });
      DOM.rightPanel.addEventListener('touchmove', (e) => handlePinchMove(e, true), { passive: false });
      DOM.rightPanel.addEventListener('touchend', handlePinchEnd, { passive: true });
      DOM.rightPanel.addEventListener('touchcancel', handlePinchEnd, { passive: true });
    }

    // 3. Atajos de teclado para Zoom: Ctrl + '+' / Ctrl + '-' / Ctrl + '0'
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault();
          if (document.activeElement && (document.activeElement === DOM.editor || (DOM.leftPanel && DOM.leftPanel.contains(document.activeElement)))) {
            changeFontSize(1);
          } else {
            changePreviewZoom(1);
          }
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          if (document.activeElement && (document.activeElement === DOM.editor || (DOM.leftPanel && DOM.leftPanel.contains(document.activeElement)))) {
            changeFontSize(-1);
          } else {
            changePreviewZoom(-1);
          }
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          resetZoom();
        }
      }
    });
  }

  // --- 11. Inicialización y Ciclo de Vida ---
  function initApp() {
    if (state.isInitialized) return;
    state.isInitialized = true;

    cacheDOMElements();
    setupHubEvents();
    setupToolbarEvents();
    setupEditorEvents();
    setupDragAndDropEvents();
    setupResizerEvents();
    setupZoomEvents();
    setupRickrollEasterEgg();

    // Cargar preferencia de tema visual protegida
    const savedTheme = SafeStorage.get('suite_preview_theme');
    if (savedTheme === 'dark') {
      applyTheme(true);
    }

    // Configuración inicial de contenido, escala tipográfica y zoom
    if (DOM.editor) DOM.editor.value = state.buffers[state.currentMode] || '';
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.previewCard) DOM.previewCard.style.zoom = `${state.previewZoom}%`;
    if (DOM.labelFontSize) DOM.labelFontSize.textContent = `${state.fontSize}px`;
    if (DOM.labelPreviewZoom) DOM.labelPreviewZoom.textContent = `${state.previewZoom}%`;
    if (CONFIG.VERSION) {
      document.querySelectorAll('.version-badge, .modal-footer-version').forEach(el => {
        el.textContent = `v${CONFIG.VERSION}`;
        el.title = `v${CONFIG.VERSION}`;
      });
    }
    updateLineNumbers();
    updateContentStatistics();
    updateUndoButtonState();

    // Enrutamiento por hash inicial
    const hash = window.location.hash.toLowerCase();
    if (hash === '#moodle' || hash === '#markdown') {
      selectMode(hash === '#markdown' ? 'markdown' : 'moodle');
    } else {
      showHub();
      updateModeUI();
      renderPreview();
    }

    // Escucha de navegación por historial del navegador (Atrás / Adelante)
    window.addEventListener('hashchange', () => {
      const currentHash = window.location.hash.toLowerCase();
      if (currentHash === '#moodle') {
        if (state.currentMode !== 'moodle' || state.isHubVisible) selectMode('moodle');
      } else if (currentHash === '#markdown') {
        if (state.currentMode !== 'markdown' || state.isHubVisible) selectMode('markdown');
      } else if (!currentHash && !state.isHubVisible) {
        showHub();
      }
    });

    // Disparadores directos desde scripts CDN
    window.__onKaTeXReady = () => renderPreview();
    window.__onMermaidReady = () => {
      if (state.currentMode === 'markdown') {
        renderMermaidDiagrams();
      }
    };
    window.__onPrismReady = () => {
      if (window.Prism) {
        if (window.Prism.plugins && window.Prism.plugins.autoloader) {
          window.Prism.plugins.autoloader.languages_path = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';
        }
        if (DOM.previewInner) {
          try { Prism.highlightAllUnder(DOM.previewInner); } catch {}
        }
      }
    };

    // Sondeo de alta frecuencia para KaTeX si se cargó asíncronamente
    if (typeof renderMathInElement !== 'function') {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        if (typeof renderMathInElement === 'function') {
          clearInterval(timer);
          renderPreview();
        } else if (attempts > 100) {
          clearInterval(timer);
        }
      }, 25);
    }

    window.addEventListener('load', () => renderPreview());
  }

  // Captura global de errores no controlados para telemetría limpia
  window.addEventListener('error', (event) => {
    console.warn('[AcademicSuite] Error no crítico capturado en ventana:', event.message);
  });

  document.addEventListener('DOMContentLoaded', initApp);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initApp();
  }
})();
