(() => {
  "use strict";
  let queue = Promise.resolve();
  let sequence = 0;
  let lastTheme;

  function render(code, dark = false) {
    const operation = queue.then(async () => {
      if (!window.mermaid) throw new Error("Motor de diagramas no disponible");
      if (code.length > 50000)
        throw new Error("El diagrama supera los 50 000 caracteres");
      if (lastTheme !== dark) {
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          htmlLabels: false,
          secure: [
            "secure",
            "securityLevel",
            "startOnLoad",
            "maxTextSize",
            "maxEdges",
            "suppressErrorRendering",
            "htmlLabels",
            "themeCSS",
            "themeVariables",
            "theme",
            "fontFamily",
          ],
          theme: dark ? "dark" : "default",
          fontFamily: "Montserrat, system-ui, sans-serif",
          flowchart: { htmlLabels: false, useMaxWidth: true, padding: 18 },
          maxTextSize: 50000,
          suppressErrorRendering: true,
        });
        lastTheme = dark;
      }
      const id = `doc-mermaid-${++sequence}`;
      try {
        const { svg } = await window.mermaid.render(id, code.trim());
        return window.ContentSafety.sanitizeSvg(svg);
      } finally {
        document.getElementById(`d${id}`)?.remove();
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }
  window.Diagrams = { render };
})();
