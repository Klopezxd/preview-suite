/**
 * Controlador principal de la aplicación (Academic Preview Suite).
 * Arquitectura blindada contra excepciones, fallos de red, restricciones de almacenamiento
 * y desbordamientos de memoria.
 * @module app
 * @version 3.0.0
 */
(() => {
  'use strict';

  const { CONFIG, AUTO_CLOSE_MAP, DEFAULT_MOODLE_TEMPLATE, DEFAULT_MARKDOWN_TEMPLATE } = window.APP_CONFIG;

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
    isDarkMode: false,
    debounceTimer: null,
    toastTimer: null,
    currentError: null,
    isResizing: false,
    isInitialized: false,

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
      cardModeMoodle: document.getElementById('card-mode-moodle'),
      cardModeMarkdown: document.getElementById('card-mode-markdown'),

      // Espacio de trabajo y barra superior
      appWorkspace: document.getElementById('app'),
      btnBackHub: document.getElementById('btn-back-hub'),
      modeBadge: document.getElementById('mode-badge'),
      btnSwitchMode: document.getElementById('btn-switch-mode'),
      btnCopyMoodleHtml: document.getElementById('btn-copy-moodle-html'),

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
      labelFontSize: document.getElementById('label-font-size'),
      themeIcon: document.getElementById('theme-icon'),
      themeText: document.getElementById('theme-text'),

      // Paneles y divisor
      panels: document.getElementById('panels'),
      leftPanel: document.getElementById('left-panel'),
      rightPanel: document.getElementById('right-panel'),
      resizer: document.getElementById('resizer'),

      // Retroalimentación y modales
      toast: document.getElementById('toast'),
      toastMsg: document.getElementById('toast-msg'),
      shortcutsModal: document.getElementById('shortcuts-modal'),
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
      btnFontDec: document.getElementById('btn-font-dec'),
      btnFontInc: document.getElementById('btn-font-inc')
    };
  }

  // --- 4. Gestión del Hub y Conmutación de Modos ---

  function showHub() {
    state.isHubVisible = true;
    if (DOM.hubScreen) DOM.hubScreen.classList.remove('hidden');
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function selectMode(mode) {
    if (mode !== 'moodle' && mode !== 'markdown') mode = 'moodle';

    // Limpiar temporizadores pendientes para evitar condiciones de carrera entre modos
    clearTimeout(state.debounceTimer);

    state.currentMode = mode;
    state.isHubVisible = false;
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

  function toggleCurrentMode() {
    if (DOM.editor) {
      state.buffers[state.currentMode] = DOM.editor.value;
    }
    const nextMode = state.currentMode === 'moodle' ? 'markdown' : 'moodle';
    selectMode(nextMode);
    showToast(`Cambiado a Modo ${nextMode === 'moodle' ? 'Moodle (HTML)' : 'Markdown'}`);
  }

  function updateModeUI() {
    const isMoodle = state.currentMode === 'moodle';

    if (DOM.modeBadge) {
      DOM.modeBadge.className = `mode-badge ${isMoodle ? 'mode-moodle' : 'mode-markdown'}`;
      DOM.modeBadge.textContent = isMoodle ? 'Modo Moodle (HTML)' : 'Modo Markdown';
    }

    if (DOM.btnSwitchMode) {
      DOM.btnSwitchMode.title = isMoodle ? 'Cambiar a Modo Markdown' : 'Cambiar a Modo Moodle (HTML)';
      const label = DOM.btnSwitchMode.querySelector('.btn-label');
      if (label) {
        label.textContent = isMoodle ? 'A Markdown' : 'A Moodle';
      }
    }

    if (DOM.btnCopyMoodleHtml) {
      DOM.btnCopyMoodleHtml.style.display = isMoodle ? 'none' : 'inline-flex';
    }

    if (DOM.btnSaveFile) {
      DOM.btnSaveFile.title = isMoodle ? 'Descargar como archivo .html' : 'Descargar como archivo .md';
    }

    if (DOM.editor) {
      DOM.editor.placeholder = isMoodle
        ? 'Escribe o pega aquí tu código HTML con fórmulas LaTeX (\\( ... \\), \\[ ... \\])...'
        : 'Escribe aquí en formato Markdown con fórmulas LaTeX ($$ ... $$, \\( ... \\))...';
    }
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

      // 1. Inyección de contenido según el modo activo
      if (state.currentMode === 'moodle') {
        DOM.previewInner.innerHTML = DOM.editor.value;
      } else {
        DOM.previewInner.innerHTML = window.MarkdownEngine
          ? window.MarkdownEngine.parseMarkdown(DOM.editor.value)
          : DOM.editor.value;
      }

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
            throwOnError: false,
            errorColor: '#ef4444'
          });
        } catch (katexErr) {
          console.warn('[KaTeX] Advertencia aislada en compilación matemática:', katexErr);
        }
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
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(renderPreview, CONFIG.DEBOUNCE_DELAY_MS);
  }

  function updateLineNumbers(errorLine = null) {
    if (!DOM.editor || !DOM.lineNumbers) return;

    const totalLines = DOM.editor.value.split('\n').length;
    const fragments = [];
    for (let i = 1; i <= totalLines; i++) {
      fragments.push(`<div class="${errorLine === i ? 'line-err' : ''}">${i}</div>`);
    }
    DOM.lineNumbers.innerHTML = fragments.join('');
  }

  function updateContentStatistics() {
    if (!DOM.editor || !DOM.charCount) return;

    const text = DOM.editor.value || '';
    const totalChars = text.length;
    const totalWords = text.trim() ? text.trim().split(/\s+/).length : 0;
    const totalLines = text.split('\n').length;

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

  // --- 7. Operaciones de Edición, Exportación y Archivos ---

  function changeFontSize(delta) {
    state.fontSize = Math.min(Math.max(state.fontSize + delta, CONFIG.FONT_SIZE_MIN), CONFIG.FONT_SIZE_MAX);
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.lineNumbers) DOM.lineNumbers.style.fontSize = `${state.fontSize}px`;
    if (DOM.labelFontSize) DOM.labelFontSize.textContent = state.fontSize;
    updateLineNumbers();
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

  async function copyMoodleHtmlFromMarkdown() {
    if (!DOM.editor || !DOM.editor.value.trim()) {
      showToast('El editor está vacío');
      return;
    }

    const moodleHtml = window.MarkdownEngine
      ? window.MarkdownEngine.compileToMoodleHtml(DOM.editor.value)
      : DOM.editor.value;

    await copyTextSafely(moodleHtml, '⭐ ¡HTML para Moodle copiado con éxito!');
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

  // --- 8. Modales ---
  function openShortcutsModal() {
    if (DOM.shortcutsModal) DOM.shortcutsModal.classList.add('open');
  }

  function closeShortcutsModal() {
    if (DOM.shortcutsModal) DOM.shortcutsModal.classList.remove('open');
  }

  // --- 9. Registro Seguro de Eventos ---

  function setupHubEvents() {
    if (DOM.cardModeMoodle) DOM.cardModeMoodle.addEventListener('click', () => selectMode('moodle'));
    if (DOM.cardModeMarkdown) DOM.cardModeMarkdown.addEventListener('click', () => selectMode('markdown'));

    const handleCardKey = (e, mode) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMode(mode);
      }
    };
    if (DOM.cardModeMoodle) DOM.cardModeMoodle.addEventListener('keydown', (e) => handleCardKey(e, 'moodle'));
    if (DOM.cardModeMarkdown) DOM.cardModeMarkdown.addEventListener('keydown', (e) => handleCardKey(e, 'markdown'));

    if (DOM.btnBackHub) DOM.btnBackHub.addEventListener('click', showHub);
    if (DOM.btnSwitchMode) DOM.btnSwitchMode.addEventListener('click', toggleCurrentMode);
    if (DOM.btnCopyMoodleHtml) DOM.btnCopyMoodleHtml.addEventListener('click', copyMoodleHtmlFromMarkdown);
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

    if (DOM.btnFontDec) DOM.btnFontDec.addEventListener('click', () => changeFontSize(-1));
    if (DOM.btnFontInc) DOM.btnFontInc.addEventListener('click', () => changeFontSize(1));

    if (DOM.btnOpenFile && DOM.fileInput) {
      DOM.btnOpenFile.addEventListener('click', () => {
        DOM.fileInput.value = '';
        DOM.fileInput.accept = state.currentMode === 'moodle' ? '.html,.htm,.txt' : '.md,.markdown,.txt';
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
      // Tabulador (2 espacios)
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;
        DOM.editor.value = DOM.editor.value.slice(0, start) + '  ' + DOM.editor.value.slice(end);
        DOM.editor.selectionStart = DOM.editor.selectionEnd = start + 2;
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

      // Copia rápida (Ctrl + Shift + C)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        copyCodeToClipboard();
      }

      // Render manual forzado (Ctrl + Enter)
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        renderPreview();
      }

      // Escape para modales
      if (e.key === 'Escape') {
        closeShortcutsModal();
      }

      // Auto-cierre y envoltura inteligente de delimitadores
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

        // Si no hay selección, insertar par si el siguiente carácter es espacio o fin
        const nextChar = DOM.editor.value[start];
        if (nextChar === undefined || /\s|<|>|\)/.test(nextChar)) {
          setTimeout(() => {
            const currentPos = DOM.editor.selectionStart;
            DOM.editor.value = DOM.editor.value.slice(0, currentPos) + AUTO_CLOSE_MAP[e.key] + DOM.editor.value.slice(currentPos);
            DOM.editor.selectionStart = DOM.editor.selectionEnd = currentPos;
            state.buffers[state.currentMode] = DOM.editor.value;
          }, 0);
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
        doResize(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    document.addEventListener('touchend', stopResize);
  }

  // --- 10. Inicialización y Ciclo de Vida ---
  function initApp() {
    if (state.isInitialized) return;
    state.isInitialized = true;

    cacheDOMElements();
    setupHubEvents();
    setupToolbarEvents();
    setupEditorEvents();
    setupDragAndDropEvents();
    setupResizerEvents();

    // Cargar preferencia de tema visual protegida
    const savedTheme = SafeStorage.get('suite_preview_theme');
    if (savedTheme === 'dark') {
      applyTheme(true);
    }

    // Configuración inicial de contenido
    if (DOM.editor) DOM.editor.value = state.buffers[state.currentMode] || '';
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
    window.__onPrismReady = () => {
      if (window.Prism && DOM.previewInner) {
        try { Prism.highlightAllUnder(DOM.previewInner); } catch {}
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
