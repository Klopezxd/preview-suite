/**
 * Controlador principal de la aplicación (Academic Preview Suite).
 * Coordina documentos, interfaz y operaciones de edición.
 * @module app
 * @version 3.2.1
 */
(() => {
  "use strict";

  const {
    CONFIG,
    AUTO_CLOSE_MAP,
    DEFAULT_MOODLE_TEMPLATE,
    DEFAULT_MARKDOWN_TEMPLATE,
  } = window.APP_CONFIG;

  // --- 1. Capa Segura de Almacenamiento Local (SafeStorage) ---
  const SafeStorage = {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item !== null ? item : defaultValue;
      } catch (e) {
        console.warn("[SafeStorage] Acceso a localStorage restringido:", e);
        return defaultValue;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn("[SafeStorage] No se pudo persistir en localStorage:", e);
        return false;
      }
    },
  };

  // --- 2. Estado Reactivo y Buffers de Memoria ---
  const state = {
    currentMode: "moodle", // 'moodle' | 'markdown'
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

    // Buffers de memoria independientes por modo
    buffers: {
      moodle: SafeStorage.get(
        "suite_preview_draft_moodle",
        DEFAULT_MOODLE_TEMPLATE,
      ),
      markdown: SafeStorage.get(
        "suite_preview_draft_markdown",
        DEFAULT_MARKDOWN_TEMPLATE,
      ),
    },

    // Pila de deshacer / rehacer independiente por modo (capacidad fija)
    history: {
      moodle: window.EditHistory.create(
        SafeStorage.get("suite_preview_draft_moodle", DEFAULT_MOODLE_TEMPLATE),
      ),
      markdown: window.EditHistory.create(
        SafeStorage.get(
          "suite_preview_draft_markdown",
          DEFAULT_MARKDOWN_TEMPLATE,
        ),
      ),
    },
  };

  // --- 3. Caché de Referencias del DOM ---
  let DOM = {};
  let documentRevision = 0;
  let fileRequest = 0;
  let draftTimer;
  let storageWarningShown = false;
  const editorPositions = {
    moodle: { start: 0, end: 0, top: 0, left: 0 },
    markdown: { start: 0, end: 0, top: 0, left: 0 },
  };

  function saveDrafts() {
    const saved = Object.entries(state.buffers)
      .map(([mode, text]) =>
        SafeStorage.set(`suite_preview_draft_${mode}`, text),
      )
      .every(Boolean);
    if (!saved && !storageWarningShown) {
      storageWarningShown = true;
      showToast(
        "No se pudo guardar el borrador en este navegador. Descarga una copia.",
      );
    }
  }

  function flushHistory() {
    const active = getActiveHistory();
    clearTimeout(active?.recordTimer);
    if (active && DOM.editor) active.commit(DOM.editor.value);
  }

  function replaceDocument(mode, text) {
    if (new Blob([text]).size > CONFIG.MAX_FILE_SIZE_BYTES)
      throw new Error("El documento transformado supera los 5 MB");
    state.history[mode].commit(state.buffers[mode]);
    state.history[mode].commit(text);
    state.buffers[mode] = text;
    editorPositions[mode] = { start: 0, end: 0, top: 0, left: 0 };
  }

  function recordEditorChange() {
    if (new Blob([DOM.editor.value]).size > CONFIG.MAX_FILE_SIZE_BYTES) {
      DOM.editor.value = state.buffers[state.currentMode];
      showToast("El documento supera los 5 MB. Se conservó el texto anterior.");
      return;
    }
    state.buffers[state.currentMode] = DOM.editor.value;
    pushHistoryState(DOM.editor.value);
    schedulePreviewUpdate();
  }

  function cacheDOMElements() {
    DOM = {
      // Pantalla Hub
      hubScreen: document.getElementById("hub-screen"),
      hubBrandIcon: document.querySelector(".hub-brand-icon"),
      cardModeMoodle: document.getElementById("card-mode-moodle"),
      cardModeMarkdown: document.getElementById("card-mode-markdown"),

      // Espacio de trabajo y barra superior
      appWorkspace: document.getElementById("app"),
      brandTitle: document.getElementById("brand-title"),
      brandIcon: document.getElementById("brand-icon"),
      brandIconSvg: document.getElementById("brand-icon-svg"),
      btnSwitchMode: document.getElementById("btn-switch-mode"),
      switchModeLabel: document.getElementById("switch-mode-label"),
      switchModeIcon: document.getElementById("switch-mode-icon"),

      // Editor y Lienzo
      editor: document.getElementById("editor"),
      lineNumbers: document.getElementById("line-numbers"),
      editorWrap: document.getElementById("editor-wrap"),
      previewInner: document.getElementById("preview-inner"),
      previewWrap: document.getElementById("preview-wrap"),
      emptyState: document.getElementById("empty-state"),

      // Barra de telemetría y estado
      statusPill: document.getElementById("status-pill"),
      statusTxt: document.getElementById("status-txt"),
      charCount: document.getElementById("char-count"),
      lastUpdate: document.getElementById("last-update"),
      themeIcon: document.getElementById("theme-icon"),
      themeText: document.getElementById("theme-text"),

      // Paneles y divisor
      panels: document.getElementById("panels"),
      leftPanel: document.getElementById("left-panel"),
      rightPanel: document.getElementById("right-panel"),
      resizer: document.getElementById("resizer"),
      mobileViewNav: document.getElementById("mobile-view-nav"),
      btnViewSplit: document.getElementById("btn-view-split"),
      btnViewEditor: document.getElementById("btn-view-editor"),
      btnViewPreview: document.getElementById("btn-view-preview"),

      // Retroalimentación y modales
      toast: document.getElementById("toast"),
      toastMsg: document.getElementById("toast-msg"),
      shortcutsModal: document.getElementById("shortcuts-modal"),
      modeSwitchModal: document.getElementById("mode-switch-modal"),
      modeSwitchTitle: document.getElementById("mode-switch-title"),
      btnOptTransform: document.getElementById("btn-opt-transform"),
      optTransformTitle: document.getElementById("opt-transform-title"),
      optTransformDesc: document.getElementById("opt-transform-desc"),
      btnOptClean: document.getElementById("btn-opt-clean"),
      btnCloseModeModal: document.getElementById("btn-close-mode-modal"),
      btnCancelModeModal: document.getElementById("btn-cancel-mode-modal"),
      rickrollModal: document.getElementById("rickroll-modal"),
      btnCloseRickroll: document.getElementById("btn-close-rickroll"),
      btnRickrollOk: document.getElementById("btn-rickroll-ok"),
      versionBadge: document.getElementById("version-badge"),
      antigravityBadge: document.getElementById("antigravity-badge"),
      fileInput: document.getElementById("file-input"),
      dropOverlay: document.getElementById("drop-overlay"),

      // Botonera de herramientas
      btnResetTemplate: document.getElementById("btn-reset-template"),
      btnClearEditor: document.getElementById("btn-clear-editor"),
      btnToggleTheme: document.getElementById("btn-toggle-theme"),
      btnOpenFile: document.getElementById("btn-open-file"),
      btnSaveFile: document.getElementById("btn-save-file"),
      btnPrint: document.getElementById("btn-print"),
      btnCopyCode: document.getElementById("btn-copy-code"),
      btnUndo: document.getElementById("btn-undo"),
      btnShowShortcuts: document.getElementById("btn-show-shortcuts"),
      btnCloseModal: document.getElementById("btn-close-modal"),

      // Pseudobotones y popovers táctiles de escala tipográfica y zoom estilo Overleaf
      btnFontReset: document.getElementById("btn-font-reset"),
      labelFontSize: document.getElementById("label-font-size"),
      editorZoomPopover: document.getElementById("editor-zoom-popover"),
      btnFontPopoverDec: document.getElementById("btn-font-popover-dec"),
      valFontPopover: document.getElementById("val-font-popover"),
      btnFontPopoverInc: document.getElementById("btn-font-popover-inc"),
      btnFontPopoverReset: document.getElementById("btn-font-popover-reset"),

      btnPreviewZoomReset: document.getElementById("btn-preview-zoom-reset"),
      labelPreviewZoom: document.getElementById("label-preview-zoom"),
      previewZoomPopover: document.getElementById("preview-zoom-popover"),
      btnPreviewPopoverDec: document.getElementById("btn-preview-popover-dec"),
      valPreviewPopover: document.getElementById("val-preview-popover"),
      btnPreviewPopoverInc: document.getElementById("btn-preview-popover-inc"),
      btnPreviewPopoverReset: document.getElementById(
        "btn-preview-popover-reset",
      ),
      previewCard: document.getElementById("preview-card"),
    };
  }

  // --- 4. Gestión del Hub y Conmutación Inteligente de Modos ---

  function showHub() {
    state.isHubVisible = true;
    if (DOM.appWorkspace) DOM.appWorkspace.inert = true;
    if (DOM.hubScreen) DOM.hubScreen.classList.remove("hidden");
    if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }

  function selectMode(mode) {
    if (mode !== "moodle" && mode !== "markdown") mode = "moodle";
    flushHistory();
    if (DOM.editor)
      editorPositions[state.currentMode] = {
        start: DOM.editor.selectionStart,
        end: DOM.editor.selectionEnd,
        top: DOM.editor.scrollTop,
        left: DOM.editor.scrollLeft,
      };
    documentRevision++;
    fileRequest++;

    // Limpiar temporizadores pendientes para evitar condiciones de carrera
    clearTimeout(state.debounceTimer);

    state.currentMode = mode;
    state.isHubVisible = false;
    if (DOM.appWorkspace) DOM.appWorkspace.inert = false;
    state.lastLineCount = null;
    state.lastErrorLine = null;
    closeAllZoomPopovers();
    if (DOM.hubScreen) DOM.hubScreen.classList.add("hidden");

    updateModeUI();
    if (DOM.editor) {
      DOM.editor.value = state.buffers[mode] || "";
      const position = editorPositions[mode];
      DOM.editor.setSelectionRange(position.start, position.end);
      DOM.editor.focus({ preventScroll: true });
      DOM.editor.scrollTop = position.top;
      DOM.editor.scrollLeft = position.left;
    }
    updateLineNumbers();
    renderPreview();
    updateUndoButtonState();

    if (window.location.hash !== `#${mode}`) {
      window.location.hash = mode;
    }
  }

  function openModeSwitchModal() {
    window.Dialogs.open(DOM.modeSwitchModal);
  }

  function closeModeSwitchModal() {
    window.Dialogs.close(DOM.modeSwitchModal);
  }

  /**
   * Conmutador inteligente de modo:
   * Si el editor no tiene contenido o tiene la plantilla sin tocar, cambia inmediatamente.
   * Si el usuario escribió contenido real, pregunta con 2 opciones limpias: transformar o empezar en blanco.
   */
  function handleSmartModeSwitch() {
    const isMoodle = state.currentMode === "moodle";
    const targetMode = isMoodle ? "markdown" : "moodle";
    const targetName = isMoodle ? "Markdown" : "Moodle (HTML)";
    const currentCode = DOM.editor ? DOM.editor.value.trim() : "";
    const defaultTemplate = (
      isMoodle ? DEFAULT_MOODLE_TEMPLATE : DEFAULT_MARKDOWN_TEMPLATE
    ).trim();

    // 1. Si no hay cambios que proteger, cambiar directamente sin interrupciones
    if (!currentCode || currentCode === defaultTemplate) {
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
        ? "Convierte tu código HTML y fórmulas a Markdown para seguir editando."
        : "Compila tu Markdown y fórmulas a código HTML continuo para Moodle.";
    }

    openModeSwitchModal();
  }

  /**
   * Ejecutar la transformación de contenido y cambiar de modo.
   */
  async function executeTransform() {
    closeModeSwitchModal();
    const isMoodle = state.currentMode === "moodle";
    const currentCode = DOM.editor ? DOM.editor.value : "";

    const targetMode = isMoodle ? "markdown" : "moodle";
    const targetTemplate = isMoodle
      ? DEFAULT_MARKDOWN_TEMPLATE
      : DEFAULT_MOODLE_TEMPLATE;
    const previousTarget = state.buffers[targetMode];
    if (
      previousTarget &&
      previousTarget !== targetTemplate &&
      !confirm(
        "El modo de destino ya tiene un borrador. ¿Deseas reemplazarlo? Podrás deshacer el reemplazo en ese modo.",
      )
    )
      return;
    const revision = documentRevision;
    try {
      if (isMoodle) {
        const converted =
          window.MarkdownEngine &&
          typeof window.MarkdownEngine.htmlToMarkdown === "function"
            ? window.MarkdownEngine.htmlToMarkdown(currentCode)
            : currentCode;
        replaceDocument("markdown", converted);
        selectMode("markdown");
        showToast("Contenido transformado a Markdown");
      } else {
        const compiled =
          window.MarkdownEngine &&
          typeof window.MarkdownEngine.compileToMoodleHtml === "function"
            ? await window.MarkdownEngine.compileToMoodleHtml(currentCode)
            : currentCode;
        if (revision !== documentRevision || currentCode !== DOM.editor.value) {
          showToast("La transformación se canceló porque cambió el documento");
          return;
        }
        replaceDocument("moodle", compiled);
        selectMode("moodle");
        showToast("Contenido transformado a Moodle HTML");
      }
      saveDrafts();
    } catch (error) {
      showToast(`No se pudo transformar: ${error.message}`);
    }
  }

  /**
   * Ejecutar el cambio con plantilla limpia descartando el contenido actual.
   */
  function executeCleanSwitch() {
    closeModeSwitchModal();
    const isMoodle = state.currentMode === "moodle";
    const targetMode = isMoodle ? "markdown" : "moodle";
    const targetName = isMoodle ? "Markdown" : "Moodle (HTML)";
    const cleanTpl =
      targetMode === "moodle"
        ? DEFAULT_MOODLE_TEMPLATE
        : DEFAULT_MARKDOWN_TEMPLATE;

    if (
      state.buffers[targetMode] &&
      state.buffers[targetMode] !== cleanTpl &&
      !confirm(
        "El modo de destino tiene un borrador. ¿Deseas reemplazarlo por la plantilla? Podrás deshacerlo.",
      )
    )
      return;
    replaceDocument(targetMode, cleanTpl);
    selectMode(targetMode);
    showToast(`Modo cambiado a ${targetName} (lienzo limpio)`);
    saveDrafts();
  }

  function updateModeUI() {
    const isMoodle = state.currentMode === "moodle";

    if (DOM.brandTitle) {
      DOM.brandTitle.textContent = isMoodle
        ? "Previsualizador Moodle"
        : "Previsualizador Markdown";
    }

    if (DOM.brandIconSvg) {
      DOM.brandIconSvg.innerHTML = `<use href="${isMoodle ? "#icon-school" : "#icon-markdown"}"></use>`;
    }

    if (DOM.btnSwitchMode) {
      DOM.btnSwitchMode.title = isMoodle
        ? "Cambiar a Modo Markdown"
        : "Cambiar a Modo Moodle";
      DOM.btnSwitchMode.classList.toggle("switch-to-markdown", isMoodle);
      DOM.btnSwitchMode.classList.toggle("switch-to-moodle", !isMoodle);
    }

    if (DOM.switchModeLabel) {
      DOM.switchModeLabel.textContent = isMoodle
        ? "Modo Markdown"
        : "Modo Moodle";
    }

    if (DOM.switchModeIcon) {
      DOM.switchModeIcon.innerHTML = `<use href="${isMoodle ? "#icon-markdown" : "#icon-school"}"></use>`;
    }

    if (DOM.btnSaveFile) {
      DOM.btnSaveFile.title = isMoodle
        ? "Descargar como archivo .html"
        : "Descargar como archivo .md";
    }

    if (DOM.editor) {
      DOM.editor.placeholder = isMoodle
        ? "Escribe o pega aquí tu código HTML con fórmulas LaTeX (\\( ... \\), \\[ ... \\])..."
        : "Escribe aquí en formato Markdown con fórmulas LaTeX ($$ ... $$, \\( ... \\))...";
    }

    document.title = `${isMoodle ? "Previsualizador Moodle" : "Previsualizador Markdown"} | Suite`;
  }

  // --- 5. Sistema de Historial (Undo / Redo) ---

  function getActiveHistory() {
    return state.history[state.currentMode];
  }

  function pushHistoryState(content, immediate = false) {
    const h = getActiveHistory();
    if (!h) return;
    documentRevision++;
    clearTimeout(h.recordTimer);
    const commit = () => {
      h.commit(content);
      updateUndoButtonState();
    };
    if (immediate) commit();
    else h.recordTimer = setTimeout(commit, CONFIG.HISTORY_DELAY_MS);
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDrafts, CONFIG.DEBOUNCE_DELAY_MS);
    updateUndoButtonState();
  }

  function applyHistoryValue(value) {
    DOM.editor.value = value;
    state.buffers[state.currentMode] = value;
    documentRevision++;
    saveDrafts();
    schedulePreviewUpdate();
    updateUndoButtonState();
  }

  function undoChange() {
    const h = getActiveHistory();
    clearTimeout(h.recordTimer);
    applyHistoryValue(h.undo(DOM.editor.value));
    showToast("Acción deshecha");
  }

  function redoChange() {
    const h = getActiveHistory();
    clearTimeout(h.recordTimer);
    if (h.current !== DOM.editor.value) {
      h.commit(DOM.editor.value);
      updateUndoButtonState();
      return;
    }
    applyHistoryValue(h.redo());
    showToast("Acción rehecha");
  }

  function updateUndoButtonState() {
    if (!DOM.btnUndo) return;
    const h = getActiveHistory();
    DOM.btnUndo.disabled =
      !h || (!h.canUndo && h.current === DOM.editor?.value);
  }

  // --- 6. Motor de Renderizado Unificado y Tolerante a Fallos ---

  let mermaidRenderToken = 0;

  async function renderMermaidDiagrams() {
    const currentToken = ++mermaidRenderToken;
    const blocks = [...DOM.previewInner.querySelectorAll(".mermaid-block")];
    for (const [index, block] of blocks.entries()) {
      const output = block.querySelector(".mermaid-output");
      if (!output) continue;
      try {
        if (index >= 20)
          throw new Error("La vista previa admite hasta 20 diagramas");
        const source = decodeURIComponent(block.dataset.mermaidCode || "");
        const svg = await window.Diagrams.render(source, state.isDarkMode);
        if (currentToken !== mermaidRenderToken || !block.isConnected) return;
        output.innerHTML = svg;
        output.classList.add("rendered");
      } catch (error) {
        if (currentToken !== mermaidRenderToken || !block.isConnected) return;
        output.textContent = `No se pudo generar el diagrama: ${error.message}`;
        output.classList.add("has-error");
        state.currentError = {
          type: "Mermaid",
          line: 1,
          message: error.message,
        };
        setRenderStatus("error", state.currentError);
      }
    }
  }

  function renderPreview() {
    if (!DOM.editor || !DOM.previewInner) return;

    try {
      ++mermaidRenderToken;
      const rawContent = DOM.editor.value ? DOM.editor.value.trim() : "";
      if (new Blob([DOM.editor.value]).size > CONFIG.MAX_FILE_SIZE_BYTES)
        throw new Error("El documento supera los 5 MB");

      if (!rawContent) {
        if (DOM.emptyState) DOM.emptyState.style.display = "flex";
        DOM.previewInner.style.display = "none";
        DOM.previewInner.innerHTML = "";
        state.currentError = null;
        setRenderStatus("ok");
        updateLineNumbers(null);
        updateContentStatistics();
        return;
      }

      if (DOM.emptyState) DOM.emptyState.style.display = "none";
      DOM.previewInner.style.display = "block";

      // 1. Inyección de contenido según el modo activo
      if (state.currentMode === "moodle") {
        DOM.previewInner.innerHTML = window.ContentSafety.sanitizeHtml(
          DOM.editor.value,
          { interactive: true },
        );
      } else {
        DOM.previewInner.innerHTML = window.MarkdownEngine
          ? window.MarkdownEngine.parseMarkdown(DOM.editor.value)
          : DOM.editor.value;
      }

      // 2. Resaltado léxico de código (Prism.js)
      let renderFailure = null;
      if (window.Prism) {
        try {
          Prism.highlightAllUnder(DOM.previewInner);
        } catch (prismErr) {
          renderFailure = { line: 1, type: "Prism", message: prismErr.message };
          console.warn(
            "[Prism] Advertencia aislada en resaltado léxico:",
            prismErr,
          );
        }
      }

      // 3. Compilación matemática ultra-rápida (KaTeX)
      if (typeof renderMathInElement === "function") {
        try {
          renderMathInElement(DOM.previewInner, {
            delimiters: [
              { left: "\\[", right: "\\]", display: true },
              { left: "\\(", right: "\\)", display: false },
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
            ignoredClasses: [
              "katex-ignore",
              "mermaid",
              "mermaid-output",
              "mermaid-raw",
              "mermaid-block",
            ],
            throwOnError: true,
            errorCallback: (_message, error) => {
              renderFailure = {
                line: 1,
                type: "LaTeX",
                message: error.message,
              };
            },
            errorColor: "#ef4444",
          });
        } catch (katexErr) {
          renderFailure = { line: 1, type: "LaTeX", message: katexErr.message };
          console.warn(
            "[KaTeX] Advertencia aislada en compilación matemática:",
            katexErr,
          );
        }
      }

      // 4. Renderizado asíncrono de Diagramas Mermaid (Modo Markdown)
      if (state.currentMode === "markdown") {
        renderMermaidDiagrams();
      }

      // 4. Inspección heurística de errores (Modo Moodle)
      let err = renderFailure;
      if (state.currentMode === "moodle" && window.Linter) {
        err =
          window.Linter.inspectCriticalErrors(
            DOM.editor.value,
            DOM.previewInner,
          ) || err;
      }
      const mathError = DOM.previewInner.querySelector(".katex-error");
      if (!err && mathError)
        err = {
          line: 1,
          type: "LaTeX",
          message:
            mathError.getAttribute("title") || "Error en fórmula matemática",
        };
      state.currentError = err;

      if (err) {
        setRenderStatus("error", err);
        updateLineNumbers(err.line);
      } else {
        setRenderStatus("ok");
        updateLineNumbers(null);
      }

      const now = new Date();
      if (DOM.lastUpdate) {
        DOM.lastUpdate.textContent =
          "Actualizado " +
          now.toLocaleTimeString("es", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
      }
      updateContentStatistics();
    } catch (unexpectedRenderError) {
      console.error(
        "[RenderPreview] Fallo de renderizado:",
        unexpectedRenderError,
      );
      DOM.previewInner.textContent = unexpectedRenderError.message;
      state.currentError = {
        line: 1,
        type: "Render",
        message: unexpectedRenderError.message,
      };
      setRenderStatus("error", {
        line: 1,
        type: "Render",
        message:
          unexpectedRenderError.message ||
          "Error inesperado al renderizar el contenido",
      });
    }
  }

  function schedulePreviewUpdate() {
    setRenderStatus("updating");
    updateLineNumbers(state.currentError ? state.currentError.line : null);
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

    const lineHeight = state.fontSize * 1.65;
    const firstLine = Math.max(
      1,
      Math.floor(DOM.editor.scrollTop / lineHeight) - 5,
    );
    const lastLine = Math.min(
      totalLines,
      firstLine + CONFIG.MAX_LINE_MARKERS - 1,
    );
    const cacheKey = `${totalLines}:${errorLine}:${firstLine}:${state.fontSize}`;
    if (state.lastLineCount === cacheKey) return;
    state.lastLineCount = cacheKey;
    let html = `<div style="height:${(firstLine - 1) * lineHeight}px"></div>`;
    for (let line = firstLine; line <= lastLine; line++) {
      html +=
        errorLine === line
          ? `<div class="line-err">${line}</div>`
          : `<div>${line}</div>`;
    }
    html += `<div style="height:${Math.max(0, totalLines - lastLine) * lineHeight}px"></div>`;
    DOM.lineNumbers.innerHTML = html;
  }

  function updateContentStatistics() {
    if (!DOM.editor || !DOM.charCount) return;

    const text = DOM.editor.value || "";
    const totalChars = text.length;
    const trimmed = text.trim();
    const totalWords = trimmed ? trimmed.split(/\s+/).length : 0;
    let totalLines = 1;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) totalLines++;
    }

    DOM.charCount.textContent = `${totalWords.toLocaleString()} palabras · ${totalChars.toLocaleString()} caracteres · ${totalLines.toLocaleString()} líneas`;
  }

  function setRenderStatus(status, errorInfo = null) {
    if (!DOM.statusPill || !DOM.statusTxt) return;

    DOM.statusPill.className = "status-pill " + status;
    if (status === "error" && errorInfo) {
      DOM.statusTxt.textContent = `⚠ ${errorInfo.type} L:${errorInfo.line}`;
      DOM.statusPill.title = `Clic para ir a la línea ${errorInfo.line}: ${errorInfo.message}`;
    } else if (status === "updating") {
      DOM.statusTxt.textContent = "Procesando...";
      DOM.statusPill.title = "";
    } else {
      DOM.statusTxt.textContent = "Listo";
      DOM.statusPill.title = "";
    }
  }

  function jumpToLine(lineNumber) {
    if (!DOM.editor) return;

    const lines = DOM.editor.value.split("\n");
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
    DOM.toast.classList.add("show");
    state.toastTimer = setTimeout(() => {
      if (DOM.toast) DOM.toast.classList.remove("show");
    }, CONFIG.TOAST_DURATION_MS);
  }

  // --- 7. Operaciones de Edición, Zoom, Exportación y Archivos ---

  function changeFontSize(delta) {
    state.fontSize = Math.min(
      Math.max(state.fontSize + delta, CONFIG.FONT_SIZE_MIN),
      CONFIG.FONT_SIZE_MAX,
    );
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.lineNumbers) DOM.lineNumbers.style.fontSize = `${state.fontSize}px`;
    if (DOM.labelFontSize)
      DOM.labelFontSize.textContent = `${state.fontSize}px`;
    if (DOM.valFontPopover)
      DOM.valFontPopover.textContent = `${state.fontSize}px`;

    if (DOM.btnFontReset) {
      DOM.btnFontReset.title = `Tamaño de fuente: ${state.fontSize}px (Ctrl + Rueda para ajustar, clic para restablecer)`;
      DOM.btnFontReset.classList.remove("zoom-active");
      void DOM.btnFontReset.offsetWidth;
      DOM.btnFontReset.classList.add("zoom-active");
      clearTimeout(state.zoomPulseTimer);
      state.zoomPulseTimer = setTimeout(() => {
        if (DOM.btnFontReset) DOM.btnFontReset.classList.remove("zoom-active");
      }, 350);
    }
    updateLineNumbers();
  }

  function changePreviewZoom(delta) {
    const min = CONFIG.PREVIEW_ZOOM_MIN || 50;
    const max = CONFIG.PREVIEW_ZOOM_MAX || 200;
    const step = CONFIG.PREVIEW_ZOOM_STEP || 10;
    state.previewZoom = Math.min(
      Math.max(state.previewZoom + delta * step, min),
      max,
    );

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
      DOM.btnPreviewZoomReset.classList.remove("zoom-active");
      void DOM.btnPreviewZoomReset.offsetWidth;
      DOM.btnPreviewZoomReset.classList.add("zoom-active");
      clearTimeout(state.previewZoomPulseTimer);
      state.previewZoomPulseTimer = setTimeout(() => {
        if (DOM.btnPreviewZoomReset)
          DOM.btnPreviewZoomReset.classList.remove("zoom-active");
      }, 350);
    }
  }

  function resetEditorFont() {
    state.fontSize = CONFIG.DEFAULT_FONT_SIZE;
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.lineNumbers) DOM.lineNumbers.style.fontSize = `${state.fontSize}px`;
    if (DOM.labelFontSize)
      DOM.labelFontSize.textContent = `${state.fontSize}px`;
    if (DOM.valFontPopover)
      DOM.valFontPopover.textContent = `${state.fontSize}px`;
    if (DOM.btnFontReset) {
      DOM.btnFontReset.title = `Tamaño de fuente: ${state.fontSize}px (Ctrl + Rueda para ajustar, clic para restablecer)`;
      DOM.btnFontReset.classList.remove("zoom-active");
      void DOM.btnFontReset.offsetWidth;
      DOM.btnFontReset.classList.add("zoom-active");
      clearTimeout(state.zoomPulseTimer);
      state.zoomPulseTimer = setTimeout(() => {
        if (DOM.btnFontReset) DOM.btnFontReset.classList.remove("zoom-active");
      }, 350);
    }
    updateLineNumbers();
  }

  function resetPreviewZoom() {
    state.previewZoom = CONFIG.DEFAULT_PREVIEW_ZOOM || 100;
    if (DOM.previewCard) {
      DOM.previewCard.style.zoom = "100%";
    }
    if (DOM.labelPreviewZoom) {
      DOM.labelPreviewZoom.textContent = "100%";
    }
    if (DOM.valPreviewPopover) {
      DOM.valPreviewPopover.textContent = "100%";
    }
    if (DOM.btnPreviewZoomReset) {
      DOM.btnPreviewZoomReset.title =
        "Zoom: 100% (Ctrl + Rueda para ajustar, clic para restablecer)";
      DOM.btnPreviewZoomReset.classList.remove("zoom-active");
      void DOM.btnPreviewZoomReset.offsetWidth;
      DOM.btnPreviewZoomReset.classList.add("zoom-active");
      clearTimeout(state.previewZoomPulseTimer);
      state.previewZoomPulseTimer = setTimeout(() => {
        if (DOM.btnPreviewZoomReset)
          DOM.btnPreviewZoomReset.classList.remove("zoom-active");
      }, 350);
    }
  }

  function resetZoom() {
    resetEditorFont();
    resetPreviewZoom();
  }

  function applyTheme(isDark) {
    state.isDarkMode = isDark;
    if (DOM.previewWrap)
      DOM.previewWrap.classList.toggle("theme-dark", state.isDarkMode);

    const useEl = DOM.themeIcon ? DOM.themeIcon.querySelector("use") : null;
    if (useEl) {
      useEl.setAttribute("href", state.isDarkMode ? "#icon-moon" : "#icon-sun");
    }
    if (DOM.themeText) {
      DOM.themeText.textContent = state.isDarkMode ? "Oscuro" : "Claro";
    }

    SafeStorage.set("suite_preview_theme", state.isDarkMode ? "dark" : "light");

    if (state.currentMode === "markdown") {
      renderMermaidDiagrams();
    }
  }

  function toggleTheme() {
    applyTheme(!state.isDarkMode);
  }

  async function copyTextSafely(text, successMsg) {
    if (!text) {
      showToast("No hay contenido para copiar");
      return false;
    }
    let temporary;
    const previousFocus = document.activeElement;
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(text);
      else {
        temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.append(temporary);
        temporary.select();
        if (!document.execCommand("copy")) throw new Error("Copia rechazada");
      }
      showToast(successMsg);
      return true;
    } catch (error) {
      console.warn("[Clipboard]", error);
      showToast("No se pudo acceder al portapapeles");
      return false;
    } finally {
      temporary?.remove();
      if (temporary) previousFocus?.focus();
    }
  }

  async function copyCodeToClipboard() {
    if (!DOM.editor?.value) return;
    if (
      !(await copyTextSafely(
        DOM.editor.value,
        "Código copiado al portapapeles",
      ))
    )
      return;
    if (DOM.btnCopyCode) {
      const originalHtml = DOM.btnCopyCode.innerHTML;
      DOM.btnCopyCode.innerHTML =
        '<svg class="icon"><use href="#icon-check"></use></svg> <span class="btn-label">¡Copiado!</span>';
      setTimeout(() => {
        if (DOM.btnCopyCode) DOM.btnCopyCode.innerHTML = originalHtml;
      }, 1800);
    }
  }

  function restoreDefaultTemplate() {
    if (!DOM.editor) return;

    const defaultText =
      state.currentMode === "moodle"
        ? DEFAULT_MOODLE_TEMPLATE
        : DEFAULT_MARKDOWN_TEMPLATE;
    const hasModifications =
      DOM.editor.value && DOM.editor.value !== defaultText;

    if (hasModifications) {
      const confirmed = confirm(
        "¿Deseas restablecer la plantilla inicial?\n\n" +
          "Se reemplazará el texto actual del editor por la plantilla de ejemplo de este modo.",
      );
      if (!confirmed) return;
    }

    pushHistoryState(DOM.editor.value, true);
    DOM.editor.value = defaultText;
    state.buffers[state.currentMode] = defaultText;
    pushHistoryState(defaultText, true);
    schedulePreviewUpdate();
    showToast("Plantilla restablecida");
  }

  function clearEditorContent() {
    if (!DOM.editor || !DOM.editor.value) return;

    pushHistoryState(DOM.editor.value, true);
    DOM.editor.value = "";
    state.buffers[state.currentMode] = "";
    pushHistoryState("", true);
    schedulePreviewUpdate();
    showToast("Editor limpio (Ctrl + Z para deshacer)");
  }

  function downloadCurrentFile() {
    if (!DOM.editor) return;

    const isMoodle = state.currentMode === "moodle";
    const filename = isMoodle ? "codigo_moodle.html" : "documento.md";
    const mimeType = isMoodle
      ? "text/html;charset=utf-8"
      : "text/markdown;charset=utf-8";

    try {
      const blob = new Blob([DOM.editor.value || ""], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");

      downloadAnchor.href = objectUrl;
      downloadAnchor.download = filename;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      showToast(`Archivo ${filename} descargado`);
    } catch (err) {
      console.error("[Download] Error al generar la descarga:", err);
      showToast("Error al descargar el archivo");
    }
  }

  function loadFileContent(file) {
    if (!file) return;

    // Validación de seguridad de tamaño
    if (file.size > CONFIG.MAX_FILE_SIZE_BYTES) {
      showToast(
        `El archivo supera el límite de seguridad (${CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB)`,
      );
      return;
    }

    // Validación de extensión permitida
    const extension = "." + file.name.split(".").pop().toLowerCase();
    if (!CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
      showToast(
        `Formato "${extension}" no compatible. Usa archivos de texto (.html, .md, .txt)`,
      );
      return;
    }

    const request = ++fileRequest;
    const revision = documentRevision;
    const targetMode = state.currentMode;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (
        request !== fileRequest ||
        revision !== documentRevision ||
        targetMode !== state.currentMode
      ) {
        showToast("Carga cancelada porque cambió el documento");
        return;
      }
      const content = String(event.target.result || "");
      if (content.includes("\0")) {
        showToast("El archivo contiene datos binarios");
        return;
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
      showToast("Error de lectura al cargar el archivo");
    };
    reader.onabort = () => {
      showToast("Carga de archivo cancelada");
    };
    reader.readAsText(file);
  }

  // --- 8. Modales y Easter Egg ---
  function openShortcutsModal() {
    window.Dialogs.open(DOM.shortcutsModal);
  }

  function closeShortcutsModal() {
    window.Dialogs.close(DOM.shortcutsModal);
  }

  function closeRickrollModal() {
    if (DOM.rickrollModal) {
      window.Dialogs.close(DOM.rickrollModal);
    }
  }

  function isMobileOrTablet() {
    return (
      window.matchMedia("(max-width: 1024px)").matches ||
      ("ontouchstart" in window && window.innerWidth <= 1024)
    );
  }

  function closeAllZoomPopovers() {
    if (DOM.editorZoomPopover) DOM.editorZoomPopover.classList.remove("open");
    if (DOM.previewZoomPopover) DOM.previewZoomPopover.classList.remove("open");
    if (DOM.btnFontReset)
      DOM.btnFontReset.setAttribute("aria-expanded", "false");
    if (DOM.btnPreviewZoomReset)
      DOM.btnPreviewZoomReset.setAttribute("aria-expanded", "false");
  }

  function setupRickrollEasterEgg() {
    let waitingForReturn = false;

    const triggerRickroll = () => {
      waitingForReturn = true;

      // 1. Abrir pantalla secreta sin anuncios en una pestaña nueva
      window.open("surprise.html", "_blank", "noopener,noreferrer");

      // 2. Preparar el detector para cuando el usuario regrese a esta pestaña
      const onUserReturn = () => {
        if (!waitingForReturn) return;
        waitingForReturn = false;

        window.removeEventListener("focus", onUserReturn);
        document.removeEventListener("visibilitychange", onVisibilityChange);

        // Desplegar la ventana flotante de bienvenida sorpresa
        if (DOM.rickrollModal) {
          window.Dialogs.open(DOM.rickrollModal);
        }
        showToast("🎵 ¡Has sido Rickrolleado! 🕺");
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          onUserReturn();
        }
      };

      window.addEventListener("focus", onUserReturn);
      document.addEventListener("visibilitychange", onVisibilityChange);
    };

    // Vincular al badge de versión del Workspace y al badge de Antigravity
    if (DOM.versionBadge) {
      DOM.versionBadge.addEventListener("click", triggerRickroll);
    }
    if (DOM.antigravityBadge) {
      DOM.antigravityBadge.addEventListener("click", triggerRickroll);
    }

    // Eventos de cierre del modal de retorno
    if (DOM.btnCloseRickroll) {
      DOM.btnCloseRickroll.addEventListener("click", closeRickrollModal);
    }
    if (DOM.btnRickrollOk) {
      DOM.btnRickrollOk.addEventListener("click", closeRickrollModal);
    }
    if (DOM.rickrollModal) {
      DOM.rickrollModal.addEventListener("click", (e) => {
        if (e.target === DOM.rickrollModal) closeRickrollModal();
      });
    }

    // Atajo global: Cerrar cualquier modal o popover activo con Escape
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
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
      const sel = window.getSelection ? window.getSelection().toString() : "";
      if (sel && sel.trim().length > 0) return;
      selectMode(mode);
    };

    if (DOM.cardModeMoodle) {
      DOM.cardModeMoodle.addEventListener("click", (e) =>
        handleCardClick(e, "moodle"),
      );
    }
    if (DOM.cardModeMarkdown) {
      DOM.cardModeMarkdown.addEventListener("click", (e) =>
        handleCardClick(e, "markdown"),
      );
    }

    const handleCardKey = (e, mode) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectMode(mode);
      }
    };
    if (DOM.cardModeMoodle)
      DOM.cardModeMoodle.addEventListener("keydown", (e) =>
        handleCardKey(e, "moodle"),
      );
    if (DOM.cardModeMarkdown)
      DOM.cardModeMarkdown.addEventListener("keydown", (e) =>
        handleCardKey(e, "markdown"),
      );

    // Clic en el logo o título para volver a la pantalla de bienvenida (Hub)
    if (DOM.brandIcon) DOM.brandIcon.addEventListener("click", showHub);
    if (DOM.brandTitle) DOM.brandTitle.addEventListener("click", showHub);
    for (const control of [
      DOM.brandIcon,
      DOM.brandTitle,
      DOM.versionBadge,
      DOM.antigravityBadge,
      DOM.statusPill,
    ]) {
      control?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          control.click();
        }
      });
    }

    // Botón único conmutador de modo
    if (DOM.btnSwitchMode)
      DOM.btnSwitchMode.addEventListener("click", handleSmartModeSwitch);

    // Eventos del modal inteligente de cambio de modo
    if (DOM.btnOptTransform)
      DOM.btnOptTransform.addEventListener("click", executeTransform);
    if (DOM.btnOptClean)
      DOM.btnOptClean.addEventListener("click", executeCleanSwitch);
    if (DOM.btnCloseModeModal)
      DOM.btnCloseModeModal.addEventListener("click", closeModeSwitchModal);
    if (DOM.btnCancelModeModal)
      DOM.btnCancelModeModal.addEventListener("click", closeModeSwitchModal);
    if (DOM.modeSwitchModal) {
      DOM.modeSwitchModal.addEventListener("click", (e) => {
        if (e.target === DOM.modeSwitchModal) closeModeSwitchModal();
      });
    }
  }

  function setupToolbarEvents() {
    if (DOM.btnResetTemplate)
      DOM.btnResetTemplate.addEventListener("click", restoreDefaultTemplate);
    if (DOM.btnClearEditor)
      DOM.btnClearEditor.addEventListener("click", clearEditorContent);
    if (DOM.btnToggleTheme)
      DOM.btnToggleTheme.addEventListener("click", toggleTheme);
    if (DOM.btnCopyCode)
      DOM.btnCopyCode.addEventListener("click", copyCodeToClipboard);
    if (DOM.btnUndo) DOM.btnUndo.addEventListener("click", undoChange);
    if (DOM.btnSaveFile)
      DOM.btnSaveFile.addEventListener("click", downloadCurrentFile);
    if (DOM.btnPrint)
      DOM.btnPrint.addEventListener("click", () => window.print());
    if (DOM.btnShowShortcuts)
      DOM.btnShowShortcuts.addEventListener("click", openShortcutsModal);
    if (DOM.btnCloseModal)
      DOM.btnCloseModal.addEventListener("click", closeShortcutsModal);

    if (DOM.btnFontReset) {
      DOM.btnFontReset.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isMobileOrTablet()) {
          resetEditorFont();
          showToast("Tamaño de fuente restablecido a 14px");
          return;
        }
        const wasOpen =
          DOM.editorZoomPopover &&
          DOM.editorZoomPopover.classList.contains("open");
        closeAllZoomPopovers();
        if (!wasOpen && DOM.editorZoomPopover) {
          DOM.editorZoomPopover.classList.add("open");
          DOM.btnFontReset.setAttribute("aria-expanded", "true");
        }
      });
    }

    if (DOM.btnPreviewZoomReset) {
      DOM.btnPreviewZoomReset.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isMobileOrTablet()) {
          resetPreviewZoom();
          showToast("Zoom de vista previa restablecido a 100%");
          return;
        }
        const wasOpen =
          DOM.previewZoomPopover &&
          DOM.previewZoomPopover.classList.contains("open");
        closeAllZoomPopovers();
        if (!wasOpen && DOM.previewZoomPopover) {
          DOM.previewZoomPopover.classList.add("open");
          DOM.btnPreviewZoomReset.setAttribute("aria-expanded", "true");
        }
      });
    }

    if (DOM.btnFontPopoverDec)
      DOM.btnFontPopoverDec.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(-1);
      });
    if (DOM.btnFontPopoverInc)
      DOM.btnFontPopoverInc.addEventListener("click", (e) => {
        e.stopPropagation();
        changeFontSize(1);
      });
    if (DOM.btnFontPopoverReset)
      DOM.btnFontPopoverReset.addEventListener("click", (e) => {
        e.stopPropagation();
        resetEditorFont();
        closeAllZoomPopovers();
      });

    if (DOM.btnPreviewPopoverDec)
      DOM.btnPreviewPopoverDec.addEventListener("click", (e) => {
        e.stopPropagation();
        changePreviewZoom(-1);
      });
    if (DOM.btnPreviewPopoverInc)
      DOM.btnPreviewPopoverInc.addEventListener("click", (e) => {
        e.stopPropagation();
        changePreviewZoom(1);
      });
    if (DOM.btnPreviewPopoverReset)
      DOM.btnPreviewPopoverReset.addEventListener("click", (e) => {
        e.stopPropagation();
        resetPreviewZoom();
        closeAllZoomPopovers();
      });

    document.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".zoom-ctrl-wrapper")) {
        closeAllZoomPopovers();
      }
    });

    if (DOM.btnOpenFile && DOM.fileInput) {
      DOM.btnOpenFile.addEventListener("click", () => {
        DOM.fileInput.value = "";
        DOM.fileInput.accept =
          state.currentMode === "moodle"
            ? ".html,.htm,.txt"
            : ".md,.markdown,.txt";
        DOM.fileInput.click();
      });

      DOM.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          loadFileContent(e.target.files[0]);
        }
      });
    }

    if (DOM.shortcutsModal) {
      DOM.shortcutsModal.addEventListener("click", (e) => {
        if (e.target === DOM.shortcutsModal) closeShortcutsModal();
      });
    }

    if (DOM.statusPill) {
      DOM.statusPill.addEventListener("click", () => {
        if (state.currentError) jumpToLine(state.currentError.line);
      });
    }

    // Delegación de eventos interactivos en vista previa (Copiar código y exportar SVG de diagramas)
    if (DOM.previewInner) {
      DOM.previewInner.addEventListener("click", async (e) => {
        const anchor = e.target.closest('a[href^="#doc-"]');
        if (anchor) {
          e.preventDefault();
          const id = anchor.getAttribute("href").slice(1);
          [...DOM.previewInner.querySelectorAll("[id]")]
            .find((element) => element.id === id)
            ?.scrollIntoView({ block: "nearest" });
          return;
        }
        // 1. Botón Copiar bloque de código estándar
        const copyCodeBtn = e.target.closest(".btn-copy-code-block");
        if (copyCodeBtn) {
          const wrapper = copyCodeBtn.closest(".code-block-wrapper");
          const codeEl = wrapper ? wrapper.querySelector("pre code") : null;
          if (codeEl) {
            if (
              !(await copyTextSafely(
                codeEl.textContent,
                "Código copiado al portapapeles",
              ))
            )
              return;
            copyCodeBtn.classList.add("copied");
            const label = copyCodeBtn.querySelector("span");
            if (label) label.textContent = "¡Copiado!";
            setTimeout(() => {
              copyCodeBtn.classList.remove("copied");
              if (label) label.textContent = "Copiar";
            }, 1800);
          }
          return;
        }

        // 2. Botón Copiar código fuente de Diagrama Mermaid
        const copyMermaidBtn = e.target.closest(".btn-copy-mermaid-source");
        if (copyMermaidBtn) {
          const block = copyMermaidBtn.closest(".mermaid-block");
          const rawCode =
            block && block.dataset.mermaidCode
              ? decodeURIComponent(block.dataset.mermaidCode)
              : block && block.querySelector(".mermaid-raw")
                ? block.querySelector(".mermaid-raw").textContent
                : "";
          if (rawCode) {
            if (
              !(await copyTextSafely(
                rawCode,
                "Sintaxis Mermaid copiada al portapapeles",
              ))
            )
              return;
            const label = copyMermaidBtn.querySelector("span");
            if (label) {
              label.textContent = "¡Copiado!";
              setTimeout(() => {
                label.textContent = "Copiar";
              }, 1800);
            }
          }
          return;
        }

        // 3. Botón Copiar SVG vectorial generado de Diagrama Mermaid
        const copySvgBtn = e.target.closest(".btn-copy-mermaid-svg");
        if (copySvgBtn) {
          const block = copySvgBtn.closest(".mermaid-block");
          const svgEl = block
            ? block.querySelector(".mermaid-output svg")
            : null;
          if (svgEl) {
            if (
              !(await copyTextSafely(
                svgEl.outerHTML,
                "SVG del diagrama copiado al portapapeles",
              ))
            )
              return;
            const label = copySvgBtn.querySelector("span");
            if (label) {
              label.textContent = "¡Copiado!";
              setTimeout(() => {
                label.textContent = "SVG";
              }, 1800);
            }
          } else {
            showToast("El diagrama aún no ha sido renderizado");
          }
          return;
        }
      });
    }

    // Navegación de vistas para pantallas móviles y tablets verticales (<= 768px)
    if (DOM.btnViewSplit)
      DOM.btnViewSplit.addEventListener("click", () => setMobileView("split"));
    if (DOM.btnViewEditor)
      DOM.btnViewEditor.addEventListener("click", () =>
        setMobileView("editor"),
      );
    if (DOM.btnViewPreview)
      DOM.btnViewPreview.addEventListener("click", () =>
        setMobileView("preview"),
      );
  }

  function setMobileView(view) {
    if (!DOM.panels) return;
    DOM.panels.classList.remove(
      "view-mode-split",
      "view-mode-editor",
      "view-mode-preview",
    );

    if (DOM.btnViewSplit)
      DOM.btnViewSplit.classList.toggle("active", view === "split");
    if (DOM.btnViewEditor)
      DOM.btnViewEditor.classList.toggle("active", view === "editor");
    if (DOM.btnViewPreview)
      DOM.btnViewPreview.classList.toggle("active", view === "preview");

    if (view === "editor") {
      DOM.panels.classList.add("view-mode-editor");
      if (DOM.editor) DOM.editor.focus();
    } else if (view === "preview") {
      DOM.panels.classList.add("view-mode-preview");
      renderPreview();
    } else {
      DOM.panels.classList.add("view-mode-split");
      updateLineNumbers();
    }
  }

  function setupEditorEvents() {
    if (!DOM.editor) return;

    DOM.editor.addEventListener("input", recordEditorChange);

    DOM.editor.addEventListener("scroll", () => {
      updateLineNumbers(state.currentError?.line ?? null);
      if (DOM.lineNumbers) DOM.lineNumbers.scrollTop = DOM.editor.scrollTop;
    });

    DOM.editor.addEventListener("keydown", (e) => {
      // Tabulador (2 espacios)
      if (e.key === "Tab") {
        e.preventDefault();
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;
        const text = DOM.editor.value;
        const first = text.lastIndexOf("\n", start - 1) + 1;
        const last = end > start && text[end - 1] === "\n" ? end - 1 : end;
        const selected = text.slice(first, last);
        const changed = e.shiftKey
          ? selected.replace(/^ {1,2}/gm, "")
          : selected.replace(/^/gm, "  ");
        DOM.editor.value = text.slice(0, first) + changed + text.slice(last);
        const delta = changed.length - selected.length;
        DOM.editor.selectionStart = Math.max(
          first,
          start + (e.shiftKey ? -Math.min(2, start - first) : 2),
        );
        DOM.editor.selectionEnd = Math.max(
          DOM.editor.selectionStart,
          end + delta,
        );
        recordEditorChange();
      }

      // Deshacer (Ctrl/Cmd + Z)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "z" || e.key === "Z") &&
        !e.shiftKey
      ) {
        e.preventDefault();
        undoChange();
      }

      // Rehacer (Ctrl/Cmd + Y | Ctrl + Shift + Z)
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        redoChange();
      }

      // Copia rápida (Ctrl + Shift + C)
      if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        copyCodeToClipboard();
      }

      // Render manual forzado (Ctrl + Enter)
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        renderPreview();
      }

      // Auto-cierre y envoltura inteligente de delimitadores
      if (
        AUTO_CLOSE_MAP[e.key] &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.isComposing
      ) {
        const start = DOM.editor.selectionStart;
        const end = DOM.editor.selectionEnd;

        // Si hay texto seleccionado, envolver la selección (Comportamiento IDE)
        if (start !== end) {
          e.preventDefault();
          const selectedText = DOM.editor.value.slice(start, end);
          const wrapped = e.key + selectedText + AUTO_CLOSE_MAP[e.key];
          DOM.editor.value =
            DOM.editor.value.slice(0, start) +
            wrapped +
            DOM.editor.value.slice(end);
          DOM.editor.selectionStart = start + 1;
          DOM.editor.selectionEnd = end + 1;
          recordEditorChange();
          return;
        }

        // Si no hay selección, insertar par si el siguiente carácter es espacio o fin
        const nextChar = DOM.editor.value[start];
        if (nextChar === undefined || /\s|<|>|\)/.test(nextChar)) {
          e.preventDefault();
          {
            DOM.editor.value =
              DOM.editor.value.slice(0, start) +
              e.key +
              AUTO_CLOSE_MAP[e.key] +
              DOM.editor.value.slice(end);
            DOM.editor.selectionStart = DOM.editor.selectionEnd = start + 1;
            recordEditorChange();
          }
        }
      }
    });
  }

  function setupDragAndDropEvents() {
    if (!DOM.editorWrap || !DOM.dropOverlay) return;

    DOM.editorWrap.addEventListener("dragover", (e) => {
      e.preventDefault();
      DOM.dropOverlay.classList.add("active");
    });

    DOM.editorWrap.addEventListener("dragleave", (e) => {
      if (!DOM.editorWrap.contains(e.relatedTarget)) {
        DOM.dropOverlay.classList.remove("active");
      }
    });

    DOM.editorWrap.addEventListener("drop", (e) => {
      e.preventDefault();
      DOM.dropOverlay.classList.remove("active");
      if (
        e.dataTransfer &&
        e.dataTransfer.files &&
        e.dataTransfer.files.length > 0
      ) {
        loadFileContent(e.dataTransfer.files[0]);
      }
    });
  }

  function setupResizerEvents() {
    if (!DOM.resizer || !DOM.panels) return;

    const isVerticalStack = () => window.innerWidth <= 768;

    const startResize = () => {
      state.isResizing = true;
      DOM.resizer.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = isVerticalStack()
        ? "row-resize"
        : "col-resize";
    };

    const doResize = (clientX, clientY) => {
      if (!state.isResizing) return;
      const containerRect = DOM.panels.getBoundingClientRect();

      if (!isVerticalStack()) {
        const percentage = Math.min(
          Math.max(
            (clientX - containerRect.left) / (containerRect.width - 7),
            0.15,
          ),
          0.85,
        );
        if (DOM.leftPanel) {
          DOM.leftPanel.style.flex = "none";
          DOM.leftPanel.style.width = `${percentage * (containerRect.width - 7)}px`;
        }
        if (DOM.rightPanel) DOM.rightPanel.style.flex = "1";
      } else {
        const percentage = Math.min(
          Math.max(
            (clientY - containerRect.top) / (containerRect.height - 7),
            0.15,
          ),
          0.85,
        );
        if (DOM.leftPanel) {
          DOM.leftPanel.style.flex = "none";
          DOM.leftPanel.style.height = `${percentage * (containerRect.height - 7)}px`;
        }
        if (DOM.rightPanel) DOM.rightPanel.style.flex = "1";
      }
    };

    const stopResize = () => {
      if (!state.isResizing) return;
      state.isResizing = false;
      DOM.resizer.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    DOM.resizer.addEventListener("mousedown", startResize);
    document.addEventListener("mousemove", (e) =>
      doResize(e.clientX, e.clientY),
    );
    document.addEventListener("mouseup", stopResize);

    DOM.resizer.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches && e.touches.length > 0) startResize();
      },
      { passive: true },
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!state.isResizing) return;
        if (e.touches && e.touches.length > 0) {
          if (e.cancelable) e.preventDefault();
          doResize(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false },
    );

    document.addEventListener("touchend", stopResize);
    document.addEventListener("touchcancel", stopResize);

    DOM.resizer.addEventListener("keydown", (event) => {
      const vertical = isVerticalStack();
      const decrease = vertical ? "ArrowUp" : "ArrowLeft";
      const increase = vertical ? "ArrowDown" : "ArrowRight";
      if (event.key !== decrease && event.key !== increase) return;
      event.preventDefault();
      const rect = DOM.panels.getBoundingClientRect();
      const left = DOM.leftPanel.getBoundingClientRect();
      startResize();
      doResize(
        left.right + (event.key === increase ? 24 : -24),
        left.bottom + (event.key === increase ? 24 : -24),
      );
      stopResize();
      DOM.resizer.setAttribute(
        "aria-valuenow",
        String(
          Math.round(
            (vertical ? left.height / rect.height : left.width / rect.width) *
              100,
          ),
        ),
      );
    });

    // Si el usuario cambia de orientación o expande la pantalla a escritorio (> 768px), restablecer vista dividida
    let resizeTimer = null;
    let wasVertical = isVerticalStack();
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const vertical = isVerticalStack();
        if (wasVertical !== vertical) {
          DOM.leftPanel.style.width = "";
          DOM.leftPanel.style.height = "";
          DOM.leftPanel.style.flex = "";
          DOM.rightPanel.style.flex = "";
          DOM.resizer.setAttribute(
            "aria-orientation",
            vertical ? "horizontal" : "vertical",
          );
          wasVertical = vertical;
        }
        if (window.innerWidth > 768 && DOM.panels) {
          DOM.panels.classList.remove("view-mode-editor", "view-mode-preview");
          DOM.panels.classList.add("view-mode-split");
          if (DOM.btnViewSplit) DOM.btnViewSplit.classList.add("active");
          if (DOM.btnViewEditor) DOM.btnViewEditor.classList.remove("active");
          if (DOM.btnViewPreview) DOM.btnViewPreview.classList.remove("active");
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
    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          wheelAccumulator += e.deltaY;
          clearTimeout(wheelResetTimer);
          wheelResetTimer = setTimeout(() => {
            wheelAccumulator = 0;
          }, 180);

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
      },
      { passive: false },
    );

    // 2. Gesto Táctil de Pellizco (Pinch-to-Zoom con 2 dedos en Móviles y Tablets)
    let pinchStartDist = null;
    let pinchDeltaAccumulator = 0;
    const PINCH_THRESHOLD = 20;

    const calcTouchDistance = (touches) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
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
      DOM.leftPanel.addEventListener("touchstart", handlePinchStart, {
        passive: true,
      });
      DOM.leftPanel.addEventListener(
        "touchmove",
        (e) => handlePinchMove(e, false),
        { passive: false },
      );
      DOM.leftPanel.addEventListener("touchend", handlePinchEnd, {
        passive: true,
      });
      DOM.leftPanel.addEventListener("touchcancel", handlePinchEnd, {
        passive: true,
      });
    }

    if (DOM.rightPanel) {
      DOM.rightPanel.addEventListener("touchstart", handlePinchStart, {
        passive: true,
      });
      DOM.rightPanel.addEventListener(
        "touchmove",
        (e) => handlePinchMove(e, true),
        { passive: false },
      );
      DOM.rightPanel.addEventListener("touchend", handlePinchEnd, {
        passive: true,
      });
      DOM.rightPanel.addEventListener("touchcancel", handlePinchEnd, {
        passive: true,
      });
    }

    // 3. Atajos de teclado para Zoom: Ctrl + '+' / Ctrl + '-' / Ctrl + '0'
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
          e.preventDefault();
          if (
            document.activeElement &&
            (document.activeElement === DOM.editor ||
              (DOM.leftPanel && DOM.leftPanel.contains(document.activeElement)))
          ) {
            changeFontSize(1);
          } else {
            changePreviewZoom(1);
          }
        } else if (
          e.key === "-" ||
          e.key === "_" ||
          e.code === "NumpadSubtract"
        ) {
          e.preventDefault();
          if (
            document.activeElement &&
            (document.activeElement === DOM.editor ||
              (DOM.leftPanel && DOM.leftPanel.contains(document.activeElement)))
          ) {
            changeFontSize(-1);
          } else {
            changePreviewZoom(-1);
          }
        } else if (e.key === "0" || e.code === "Numpad0") {
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
    const savedTheme = SafeStorage.get("suite_preview_theme");
    if (savedTheme === "dark") {
      applyTheme(true);
    }

    // Configuración inicial de contenido, escala tipográfica y zoom
    if (DOM.editor) {
      DOM.editor.value = state.buffers[state.currentMode] || "";
      DOM.editor.setSelectionRange(0, 0);
    }
    if (DOM.editor) DOM.editor.style.fontSize = `${state.fontSize}px`;
    if (DOM.lineNumbers) DOM.lineNumbers.style.fontSize = `${state.fontSize}px`;
    if (DOM.previewCard) DOM.previewCard.style.zoom = `${state.previewZoom}%`;
    if (DOM.labelFontSize)
      DOM.labelFontSize.textContent = `${state.fontSize}px`;
    if (DOM.labelPreviewZoom)
      DOM.labelPreviewZoom.textContent = `${state.previewZoom}%`;
    if (DOM.versionBadge && CONFIG.VERSION) {
      DOM.versionBadge.textContent = `v${CONFIG.VERSION}`;
      DOM.versionBadge.title = `v${CONFIG.VERSION}`;
    }
    updateLineNumbers();
    updateContentStatistics();
    updateUndoButtonState();

    // Enrutamiento por hash inicial
    const hash = window.location.hash.toLowerCase();
    if (hash === "#moodle" || hash === "#markdown") {
      selectMode(hash === "#markdown" ? "markdown" : "moodle");
    } else {
      showHub();
      updateModeUI();
      renderPreview();
    }

    // Escucha de navegación por historial del navegador (Atrás / Adelante)
    window.addEventListener("hashchange", () => {
      const currentHash = window.location.hash.toLowerCase();
      if (currentHash === "#moodle") {
        if (state.currentMode !== "moodle" || state.isHubVisible)
          selectMode("moodle");
      } else if (currentHash === "#markdown") {
        if (state.currentMode !== "markdown" || state.isHubVisible)
          selectMode("markdown");
      } else if (!currentHash && !state.isHubVisible) {
        showHub();
      }
    });

    window.addEventListener("pagehide", saveDrafts);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveDrafts();
    });

    window.addEventListener("load", () => renderPreview());
  }

  // Captura global de errores no controlados para telemetría limpia
  window.addEventListener("error", (event) => {
    console.error("[AcademicSuite] Error no controlado:", event.message);
    setRenderStatus("error", {
      line: 1,
      type: "Aplicación",
      message: event.message,
    });
  });

  document.addEventListener("DOMContentLoaded", initApp);
  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  ) {
    initApp();
  }
})();
