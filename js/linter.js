/** Heuristic source validation; this is not a Moodle HTML validator. */
(() => {
  "use strict";
  function inspectCriticalErrors(code, preview) {
    if (typeof code !== "string" || !code.trim()) return null;
    const lines = code.split("\n");
    const html = [];
    const display = [];
    const inline = [];
    const dollars = [];
    const tokens =
      /<!--[\s\S]*?(?:-->|$)|<\/?(?:table|pre)\b(?:"[^"]*"|'[^']*'|[^'">])*?>|^[ \t]*```(?:[a-z0-9_-]+)?[ \t]*$|\$\$|\\[[\]()]/gim;
    let line = 1;
    let offset = 0;
    for (const match of code.matchAll(tokens)) {
      for (let index = offset; index < match.index; index++)
        if (code[index] === "\n") line++;
      const value = match[0];
      const tokenLine = line;
      for (const character of value) if (character === "\n") line++;
      offset = match.index + value.length;
      if (value.startsWith("<!--")) continue;
      if (value.startsWith("<")) {
        const tag = /^<\/?(\w+)/.exec(value)[1].toLowerCase();
        if (!value.startsWith("</")) html.push({ tag, line: tokenLine });
        else {
          if (html.at(-1)?.tag !== tag)
            return {
              line: tokenLine,
              type: "HTML",
              message: `Cierre </${tag}> sin apertura correspondiente o fuera de orden`,
            };
          html.pop();
        }
      } else if (!html.some((element) => element.tag === "pre")) {
        if (value.trim().startsWith("```"))
          return {
            line: tokenLine,
            type: "Markdown",
            message: "Bloque Markdown no interpretado por Moodle",
          };
        if (value === "$$") {
          if (dollars.length) dollars.pop();
          else dollars.push(tokenLine);
          continue;
        }
        const opening = value === "\\[" || value === "\\(";
        const stack =
          value.endsWith("[") || value.endsWith("]") ? display : inline;
        if (opening) stack.push(tokenLine);
        else if (stack.length) stack.pop();
        else
          return {
            line: tokenLine,
            type: "LaTeX",
            message: `Cierre ${value} sin apertura`,
          };
      }
    }
    if (html.length)
      return {
        line: html.at(-1).line,
        type: "HTML",
        message: `Etiqueta <${html.at(-1).tag}> sin cerrar`,
      };
    if (display.length || inline.length || dollars.length)
      return {
        line: display.at(-1) || inline.at(-1) || dollars.at(-1),
        type: "LaTeX",
        message: "Fórmula sin delimitador de cierre",
      };
    const error = preview?.querySelector(".katex-error, mjx-merror");
    if (error) {
      const snippet = error.textContent?.trim();
      const sourceLine = snippet
        ? lines.findIndex((value) => value.includes(snippet))
        : -1;
      return {
        line: sourceLine < 0 ? 1 : sourceLine + 1,
        type: "LaTeX",
        message: (
          error.getAttribute("title") || "Error en fórmula matemática"
        ).slice(0, 160),
      };
    }
    return null;
  }
  window.Linter = { inspectCriticalErrors };
})();
