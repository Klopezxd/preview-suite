(() => {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function safeUrl(value) {
    const url = String(value || "").trim();
    if (
      !url ||
      [...url].some(
        (character) =>
          character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      )
    )
      return "";
    return /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/)/i.test(url) ||
      !/^[^/]*:/.test(url)
      ? url
      : "";
  }

  const allowedStyles =
    /^(?:color|background-color|font-size|font-weight|font-style|font-family|text-align|text-decoration|line-height|border(?:-(?:top|right|bottom|left))?(?:-(?:width|style|color))?|border-collapse|border-radius|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|width|max-width|min-width|height|vertical-align|white-space|display)$/;
  const documentClasses =
    /^(?:language-[\w+-]+|table(?:-[\w-]+)?|alert(?:-[\w-]+)?|markdown-(?:alert(?:-[\w-]+)?|blockquote)|code-block-(?:wrapper|header|lang)|btn-copy-code-block|mermaid-(?:block|toolbar|label|actions|viewport|raw|output|loading|export)|btn-mermaid-action|btn-copy-mermaid-(?:source|svg)|task-list(?:-item|-checkbox|-text)?|footnote(?:s|-ref|-backref)|icon|katex-ignore)$/;

  function sanitizeHtml(html, { interactive = false } = {}) {
    if (!window.DOMPurify)
      throw new Error(
        "No se pudo iniciar la protección del contenido. Recarga la página.",
      );
    const fragment = window.DOMPurify.sanitize(String(html || ""), {
      USE_PROFILES: { html: true, svg: true },
      FORBID_TAGS: [
        "style",
        "form",
        "textarea",
        "select",
        "iframe",
        "object",
        "embed",
        "base",
        "link",
        "meta",
        "foreignObject",
        ...(interactive ? [] : ["input", "button"]),
      ],
      FORBID_ATTR: ["name", "srcset", "autofocus"],
      RETURN_DOM_FRAGMENT: true,
    });
    for (const element of fragment.querySelectorAll("*")) {
      if (
        element.matches("input") &&
        element.getAttribute("type") !== "checkbox"
      ) {
        element.remove();
        continue;
      }
      if (element.matches("input")) element.disabled = true;
      for (const name of [...element.classList]) {
        if (!documentClasses.test(name) && !name.startsWith("doc-"))
          element.classList.replace(name, `doc-${name}`);
      }
      if (
        element.localName === "use" &&
        !/^#icon-[\w-]+$/.test(element.getAttribute("href") || "")
      )
        element.remove();
      // Scope imported IDs and links away from application routing and controls.
      if (element.id && !element.id.startsWith("doc-"))
        element.id = `doc-${element.id}`;
      const style = element.style;
      if (!style) continue;
      for (const property of Array.from(style)) {
        const value = style.getPropertyValue(property);
        if (
          !allowedStyles.test(property) ||
          /url\s*\(|expression|@import|[<>\\]/i.test(value)
        )
          style.removeProperty(property);
      }
      if (element.matches("a")) {
        const href = safeUrl(element.getAttribute("href"));
        if (!href) element.removeAttribute("href");
        else if (href.startsWith("#"))
          element.setAttribute(
            "href",
            href.startsWith("#doc-") ? href : `#doc-${href.slice(1)}`,
          );
        else {
          element.setAttribute("href", href);
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      }
    }
    const container = document.createElement("div");
    container.append(fragment);
    return container.innerHTML;
  }

  function sanitizeSvg(svg) {
    if (!window.DOMPurify) throw new Error("Protección SVG no disponible");
    return window.DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["foreignObject", "a"],
      FORBID_ATTR: ["target"],
    });
  }

  window.ContentSafety = { escapeHtml, safeUrl, sanitizeHtml, sanitizeSvg };
})();
