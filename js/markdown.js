/** Markdown parsing, safe preview markup and portable Moodle export. */
(() => {
  "use strict";
  const { escapeHtml, safeUrl, sanitizeHtml } = window.ContentSafety;
  const ALERT_META = {
    NOTE: ["Nota", "note"],
    TIP: ["Consejo", "tip"],
    IMPORTANT: ["Importante", "important"],
    WARNING: ["Advertencia", "warning"],
    CAUTION: ["Precaución", "caution"],
  };

  function renderAlertBlockquote(quote) {
    const header =
      /^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([^\n<]*)(?:<br\s*\/?>|<\/p>)/i;
    const match = quote.match(header);
    if (!match)
      return `<blockquote class="markdown-blockquote">${quote}</blockquote>`;
    const [title, type] = ALERT_META[match[1].toUpperCase()];
    const body = quote.replace(header, (full) =>
      /<\/p>/i.test(full) ? "" : "<p>",
    );
    return `<div class="markdown-alert markdown-alert-${type}" data-alert-type="${type}"><div class="markdown-alert-title"><svg class="icon"><use href="#icon-alert-${type}"></use></svg><span>${match[2].trim() || title}</span></div><div class="markdown-alert-content">${body}</div></div>`;
  }

  function renderCodeBlock(code, info = "") {
    const language = (/^[\w+-]+/.exec(info.trim())?.[0] || "").toLowerCase();
    if (language === "mermaid")
      return `<div class="mermaid-block" data-mermaid-code="${encodeURIComponent(code)}"><div class="mermaid-toolbar"><span class="mermaid-label">Diagrama Mermaid</span><div class="mermaid-actions"><button class="btn-mermaid-action btn-copy-mermaid-source" type="button"><span>Copiar</span></button><button class="btn-mermaid-action btn-copy-mermaid-svg" type="button"><span>SVG</span></button></div></div><div class="mermaid-viewport"><div class="mermaid-raw" hidden>${escapeHtml(code)}</div><div class="mermaid-output"><div class="mermaid-loading">Cargando diagrama...</div></div></div></div>`;
    const languageClass = `language-${language || "plaintext"}`;
    return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${escapeHtml(language || "código")}</span><button class="btn-copy-code-block" type="button"><svg class="icon"><use href="#icon-copy"></use></svg><span>Copiar</span></button></div><pre class="${languageClass}"><code class="${languageClass}">${escapeHtml(code)}</code></pre></div>`;
  }

  /** Mask math before table splitting; skip variable-length code fences and code spans. */
  function protectMathDelimiters(text) {
    if (typeof text !== "string")
      return { safeText: "", restoreMath: (html) => html };
    let prefix = "PREVIEWMATH";
    while (text.includes(prefix)) prefix += "X";
    const expressions = [];
    const pattern =
      /(^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]{0,3}\2[ \t]*(?:\n|$)|(`+)[\s\S]*?\3|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\s)[^$\n]+(?<!\s)\$)/gm;
    const safeText = text.replace(pattern, (match) => {
      if (/^[ \t]*[`~]/.test(match)) return match;
      const key = `${prefix}${expressions.length}END`;
      expressions.push(match);
      return key;
    });
    return {
      safeText,
      restoreMath: (html) =>
        html.replace(new RegExp(`${prefix}(\\d+)END`, "g"), (_, index) =>
          escapeHtml(expressions[Number(index)] || ""),
        ),
    };
  }

  function createParser() {
    const definitions = new Map();
    const references = new Map();
    const parser = new window.Marked({ gfm: true, breaks: true });
    parser.use({
      renderer: {
        blockquote: renderAlertBlockquote,
        code: renderCodeBlock,
        listitem(text, task, checked) {
          if (!task) return `<li>${text}</li>`;
          return `<li class="task-list-item"><input type="checkbox" disabled ${checked ? "checked" : ""}><span class="task-list-text">${text.replace(/^<input[^>]*>\s*/i, "")}</span></li>`;
        },
        list(body, ordered, start) {
          const tag = ordered ? "ol" : "ul";
          return `<${tag}${body.includes("task-list-item") ? ' class="task-list"' : ""}${ordered && start !== 1 ? ` start="${start}"` : ""}>${body}</${tag}>`;
        },
        table: (header, body) =>
          `<div class="table-responsive"><table class="table table-bordered table-striped"><thead>${header}</thead><tbody>${body}</tbody></table></div>`,
        link(href, title, text) {
          const url = safeUrl(href);
          if (!url) return text;
          return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ""}>${text}</a>`;
        },
      },
      extensions: [
        {
          name: "highlight",
          level: "inline",
          start: (src) => src.indexOf("=="),
          tokenizer(src) {
            const match = /^==([^=\n]+)==/.exec(src);
            if (match)
              return {
                type: "highlight",
                raw: match[0],
                tokens: this.lexer.inlineTokens(match[1]),
              };
          },
          renderer(token) {
            return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
          },
        },
        {
          name: "footnoteDefinition",
          level: "block",
          start: (src) => src.search(/^\[\^[\w-]+\]:/m),
          tokenizer(src) {
            const match =
              /^\[\^([\w-]+)\]:[ \t]*([^\n]*)(?:\n|$)((?:(?: {4}|\t)[^\n]*(?:\n|$))*)/.exec(
                src,
              );
            if (!match) return;
            definitions.set(
              match[1],
              match[2] + "\n" + match[3].replace(/^(?: {4}|\t)/gm, ""),
            );
            return { type: "footnoteDefinition", raw: match[0] };
          },
          renderer: () => "",
        },
        {
          name: "footnoteReference",
          level: "inline",
          start: (src) => src.indexOf("[^"),
          tokenizer(src) {
            const match = /^\[\^([\w-]+)\]/.exec(src);
            if (match && definitions.has(match[1]))
              return { type: "footnoteReference", raw: match[0], id: match[1] };
          },
          renderer(token) {
            const reference = references.get(token.id) || {
              order: references.size + 1,
              count: 0,
            };
            reference.count++;
            references.set(token.id, reference);
            return `<sup class="footnote-ref"><a href="#fn-${token.id}" id="fnref-${token.id}-${reference.count}">${reference.order}</a></sup>`;
          },
        },
      ],
    });
    function footnotes() {
      if (!references.size) return "";
      const inlineParser = new window.Marked({ gfm: true, breaks: true });
      const items = [...references].map(([id, reference]) => {
        const backrefs = Array.from(
          { length: reference.count },
          (_, index) =>
            `<a href="#fnref-${id}-${index + 1}" class="footnote-backref" title="Regresar al texto">↩</a>`,
        ).join(" ");
        return `<li id="fn-${id}"><p>${inlineParser.parseInline(definitions.get(id).trim())} ${backrefs}</p></li>`;
      });
      return `<section class="footnotes"><hr><ol>${items.join("")}</ol></section>`;
    }
    return { parser, footnotes };
  }

  /** Small documented fallback; no raw HTML, tables or diagrams. */
  function fallbackNativeParse(text) {
    const lines = String(text || "").split("\n");
    const blocks = [];
    const inline = (value) =>
      escapeHtml(value).replace(
        /`([^`]+)`|\*\*([^*]+)\*\*/g,
        (_, code, bold) =>
          code !== undefined
            ? `<code>${code}</code>`
            : `<strong>${bold}</strong>`,
      );
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const fence = /^\s*(`{3,}|~{3,})(.*)/.exec(line);
      if (fence) {
        const code = [];
        while (
          ++index < lines.length &&
          !lines[index].trim().startsWith(fence[1])
        )
          code.push(lines[index]);
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      } else if (/^>/.test(line)) {
        const quote = [];
        do {
          quote.push(lines[index].replace(/^>[ \t]?/, ""));
          index++;
        } while (index < lines.length && /^>/.test(lines[index]));
        index--;
        blocks.push(
          renderAlertBlockquote(`<p>${quote.map(inline).join("<br>")}</p>`),
        );
      } else {
        const heading = /^(#{1,6})\s+(.*)/.exec(line);
        if (heading)
          blocks.push(
            `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`,
          );
        else if (line.trim()) blocks.push(`<p>${inline(line)}</p>`);
      }
    }
    return blocks.join("\n");
  }

  function parseMarkdown(text) {
    if (!text || typeof text !== "string") return "";
    const { safeText, restoreMath } = protectMathDelimiters(text);
    if (!window.marked || !window.Marked)
      return sanitizeHtml(restoreMath(fallbackNativeParse(safeText)), {
        interactive: true,
      });
    const { parser, footnotes } = createParser();
    const html = parser.parse(safeText);
    const container = document.createElement("div");
    container.innerHTML = sanitizeHtml(restoreMath(html + footnotes()), {
      interactive: true,
    });
    for (const table of container.querySelectorAll("table")) {
      table.classList.add("table", "table-bordered", "table-striped");
      if (!table.parentElement.classList.contains("table-responsive")) {
        const wrapper = document.createElement("div");
        wrapper.className = "table-responsive";
        table.replaceWith(wrapper);
        wrapper.append(table);
      }
    }
    return container.innerHTML;
  }

  async function compileToMoodleHtml(text) {
    if (!text?.trim()) return "";
    const container = document.createElement("div");
    container.innerHTML = parseMarkdown(text);
    const diagrams = [...container.querySelectorAll(".mermaid-block")];
    if (diagrams.length > 20)
      throw new Error("Exporta como máximo 20 diagramas por documento");
    for (const block of diagrams) {
      const source = decodeURIComponent(block.dataset.mermaidCode);
      const svg = await window.Diagrams.render(source);
      const image = document.createElement("img");
      image.alt = "Diagrama Mermaid";
      image.style.maxWidth = "100%";
      image.src = `data:image/svg+xml;base64,${btoa(Array.from(new TextEncoder().encode(svg), (byte) => String.fromCharCode(byte)).join(""))}`;
      const figure = document.createElement("figure");
      figure.className = "mermaid-export";
      figure.dataset.mermaidCode = encodeURIComponent(source);
      figure.append(image);
      block.replaceWith(figure);
    }
    container
      .querySelectorAll(
        "button, .code-block-header, .mermaid-toolbar, .mermaid-raw",
      )
      .forEach((element) => element.remove());
    container
      .querySelectorAll("svg.icon")
      .forEach((element) => element.remove());
    container
      .querySelectorAll(".code-block-wrapper, .table-responsive")
      .forEach((element) => element.replaceWith(...element.childNodes));
    container
      .querySelectorAll("input[type=checkbox]")
      .forEach((element) =>
        element.replaceWith(
          document.createTextNode(element.checked ? "☑ " : "☐ "),
        ),
      );
    const version = window.APP_CONFIG.CONFIG.VERSION;
    return `<!-- Generado con Preview Suite v${version} -->\n${container.innerHTML.trim()}`;
  }

  function htmlToMarkdown(html) {
    if (!html || typeof html !== "string") return "";
    const converter = new window.TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      fence: "```",
    });
    converter.use(window.turndownGfm);
    converter.keep(["details", "summary", "kbd", "u", "svg"]);
    converter.addRule("complexTables", {
      filter: (node) =>
        node.nodeName === "TABLE" &&
        !!node.querySelector("[colspan], [rowspan], table"),
      replacement: (_, node) => `\n\n${node.outerHTML}\n\n`,
    });
    converter.addRule("fencedCode", {
      filter: "pre",
      replacement: (_, node) => {
        const code = node.querySelector("code") || node;
        const text = code.textContent.replace(/\n$/, "");
        const longest = Math.max(
          2,
          ...[...text.matchAll(/`+/g)].map((match) => match[0].length),
        );
        const fence = "`".repeat(longest + 1);
        const language =
          /language-([\w+-]+)/.exec(code.className || node.className)?.[1] ||
          "";
        return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
      },
    });
    converter.addRule("highlight", {
      filter: "mark",
      replacement: (content) => `==${content}==`,
    });
    converter.addRule("diagrams", {
      filter: (node) => node.hasAttribute("data-mermaid-code"),
      replacement: (_, node) =>
        `\n\n\`\`\`mermaid\n${decodeURIComponent(node.dataset.mermaidCode)}\n\`\`\`\n\n`,
    });
    converter.addRule("codeContainers", {
      filter: (node) => node.classList.contains("code-block-header"),
      replacement: () => "",
    });
    converter.addRule("alerts", {
      filter: (node) => node.classList.contains("markdown-alert"),
      replacement: (_, node) => {
        const type = (node.dataset.alertType || "note").toUpperCase();
        const body = node.querySelector(".markdown-alert-content");
        const title = node
          .querySelector(".markdown-alert-title")
          ?.textContent.trim();
        const customTitle =
          title && title !== ALERT_META[type]?.[0] ? ` ${title}` : "";
        return `\n\n> [!${type}]${customTitle}\n${converter
          .turndown(body?.innerHTML || "")
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}\n\n`;
      },
    });
    const { safeText, restoreMath } = protectMathDelimiters(html);
    const clean = sanitizeHtml(safeText, { interactive: true });
    const converted = converter.turndown(clean);
    const textarea = document.createElement("textarea");
    return restoreMath(converted).replace(
      /(?:\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/g,
      (expression) => {
        textarea.innerHTML = expression;
        return textarea.value;
      },
    );
  }

  window.MarkdownEngine = {
    parseMarkdown,
    compileToMoodleHtml,
    htmlToMarkdown,
    protectMathDelimiters,
    fallbackNativeParse,
  };
})();
