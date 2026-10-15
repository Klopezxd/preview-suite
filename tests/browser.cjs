// Reproducible audit of the unmodified application. No production files are changed.
// Usage: node audit/verify.cjs
// Requires Playwright (PLAYWRIGHT_MODULE may point to an installed module).
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../dist");
const siteHeaders = Object.fromEntries(
  require("../vercel.json").headers[0].headers.map((header) => [
    header.key,
    header.value,
  ]),
);
const results = [];
let browser;
const check = (name, expected, actual) =>
  results.push({
    name,
    status: expected === actual ? "PASS" : "FAIL",
    expected,
    actual,
  });

(async () => {
  browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "msedge" }),
    headless: true,
  });
  const context = await browser.newContext();
  let enforceCsp = true;
  const externalRequests = [];
  await context.addInitScript(() => {
    if (!location.search.includes("persist=1")) localStorage.clear();
  });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith("http://localhost:4173/")) {
      externalRequests.push(url);
      return route.abort();
    }
    const name = new URL(url).pathname.slice(1) || "index.html";
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
      return route.fulfill({ status: 404, body: "" });
    const headers = { ...siteHeaders };
    if (!enforceCsp) delete headers["Content-Security-Policy"];
    return route.fulfill({
      body: fs.readFileSync(file),
      headers,
      contentType: file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".woff2")
            ? "font/woff2"
            : "text/html",
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) =>
    errors.push({ message: error.message, stack: error.stack }),
  );
  let resetId = 0;
  const reset = async (mode = "moodle", persist = false) => {
    await page.goto(
      `http://localhost:4173/?audit=${++resetId}${persist ? "&persist=1" : ""}#${mode}`,
      { waitUntil: "load" },
    );
    await page.waitForFunction(() => window.MarkdownEngine && window.Linter);
  };
  const edit = async (value, settle = true) => {
    await page.locator("#editor").fill(value);
    if (settle) await page.waitForTimeout(400);
  };
  const value = () => page.locator("#editor").inputValue();
  await reset();
  check(
    "Initial Moodle preview",
    true,
    (await page.locator("#preview-inner h1").count()) > 0,
  );
  check(
    "KaTeX renders default mathematics",
    true,
    (await page.locator("#preview-inner .katex").count()) > 0,
  );
  check(
    "Prism C++ grammar loads from configured bundle",
    true,
    await page.evaluate(() => !!window.Prism?.languages?.cpp),
  );
  await edit("<h1>Prueba</h1>");
  check(
    "HTML preview updates",
    "Prueba",
    await page.locator("#preview-inner h1").innerText(),
  );
  await page.locator("#btn-toggle-theme").click();
  check(
    "Theme button toggles preview theme",
    true,
    await page
      .locator("#preview-wrap")
      .evaluate((el) => el.classList.contains("theme-dark")),
  );
  await page.locator("#editor").press("Control+=");
  check(
    "Editor keyboard zoom",
    "15px",
    await page.locator("#editor").evaluate((el) => el.style.fontSize),
  );
  await page.locator("#editor").press("Control+0");
  check(
    "Editor zoom reset",
    "14px",
    await page.locator("#editor").evaluate((el) => el.style.fontSize),
  );
  await page.locator("#btn-clear-editor").click();
  await page.waitForTimeout(400);
  check("Clear editor", "", await value());
  await page.locator("#editor").press("Control+z");
  check("Undo clear restores text", "<h1>Prueba</h1>", await value());
  await page.locator("#editor").press("Control+y");
  check("Redo clear", "", await value());

  await reset();
  await edit("A");
  await edit("AB", false);
  await page.locator("#editor").press("Control+z");
  check("Undo flushes pending edit before reverting", "A", await value());
  await page.waitForTimeout(400);
  await page.locator("#editor").press("Control+y");
  check("Redo recovers pending edit", "AB", await value());

  await reset("markdown");
  await edit("BORRADOR MARKDOWN");
  await page.evaluate(() => {
    location.hash = "moodle";
  });
  await page.waitForFunction(() =>
    document.title.startsWith("Previsualizador Moodle"),
  );
  await page.locator("#btn-switch-mode").click();
  check(
    "Switching from untouched template preserves destination draft",
    "BORRADOR MARKDOWN",
    await value(),
  );

  await reset();
  await edit("texto seleccionado");
  await page.locator("#editor").selectText();
  await page.locator("#editor").press("Tab");
  check(
    "Tab indents without deleting selection",
    "  texto seleccionado",
    await value(),
  );

  await reset();
  await edit(
    '<img src="/missing-audit-image" onerror="document.body.dataset.auditExecuted=\'yes\'">',
  );
  await page.waitForTimeout(200);
  check(
    "Imported HTML cannot execute in application origin",
    null,
    await page.evaluate(() => document.body.dataset.auditExecuted || null),
  );
  await reset("markdown");
  await edit(
    '<img src="/missing-audit-image" onerror="document.body.dataset.auditExecuted=\'yes\'">',
  );
  await page.waitForTimeout(200);
  check(
    "Markdown raw HTML cannot execute in application origin",
    null,
    await page.evaluate(() => document.body.dataset.auditExecuted || null),
  );

  await reset("markdown");
  const observations = await page.evaluate(async () => {
    const engine = window.MarkdownEngine;
    const parse = engine.parseMarkdown;
    const doc = (html) => new DOMParser().parseFromString(html, "text/html");
    const fenced = "```text\n==literal==\n```";
    const footCode = "```text\n[^a]: literal\n```\n\nref [^a]";
    const exported = await engine.compileToMoodleHtml(
      "```mermaid\ngraph TD; A-->B\n```",
    );
    return {
      heading: doc(parse("# Título")).querySelector("h1")?.textContent,
      tableHead: !!doc(parse("| A | B |\n|---|---|\n| 1 | 2 |")).querySelector(
        "thead",
      ),
      checklist: !!doc(parse("- [x] Listo")).querySelector("input:checked"),
      alert: !!doc(parse("> [!NOTE]\n> Hola")).querySelector(
        ".markdown-alert-note",
      ),
      math: parse("\\(x_1\\)").includes("\\(x_1\\)"),
      literalHighlight: doc(parse(fenced)).querySelector("code")?.textContent,
      inlineHighlight: doc(parse("`==literal==`")).querySelector("code")
        ?.textContent,
      footCode: doc(parse(footCode)).querySelector("code")?.textContent,
      footParagraph: doc(parse("ref [^a]\n\n[^a]: Nota\nPárrafo posterior"))
        .querySelector(".footnotes")
        ?.textContent.includes("Párrafo posterior"),
      footStrong: !!doc(parse("ref [^a]\n\n[^a]: **negrita**")).querySelector(
        ".footnotes strong",
      ),
      image: engine.htmlToMarkdown(
        '<p>Foto <img src="foto.png" alt="Ejemplo"></p>',
      ),
      nestedList: engine.htmlToMarkdown(
        "<ul><li>Padre<ul><li>Hijo</li></ul></li></ul>",
      ),
      ordered: engine.htmlToMarkdown('<ol start="4"><li>Cuarto</li></ol>'),
      literalMarkdown: engine.htmlToMarkdown("<p>*literal*</p>"),
      exportButtons: doc(exported).querySelectorAll("button").length,
      exportSvg: !!doc(exported).querySelector(
        '.mermaid-export img[src^="data:image/svg+xml"]',
      ),
      exportLoading: exported.includes("Cargando diagrama"),
      link: doc(parse("[abrir](javascript:alert%281%29)"))
        .querySelector("a")
        ?.getAttribute("href"),
      orphanTable: window.Linter.inspectCriticalErrors("</table><table>", null),
      orphanMath: window.Linter.inspectCriticalErrors("\\] \\[", null),
      unclosedTable: window.Linter.inspectCriticalErrors("<table>", null),
      longValidTable: window.Linter.inspectCriticalErrors(
        "<table>\n" + "\n".repeat(10000) + "</table>",
        null,
      ),
    };
  });
  check("Markdown heading", "Título", observations.heading);
  check("Markdown table has semantic thead", true, observations.tableHead);
  check("Markdown task list", true, observations.checklist);
  check("GFM callout", true, observations.alert);
  check("LaTeX delimiters preserved", true, observations.math);
  check(
    "Highlights preserve fenced code",
    "==literal==",
    observations.literalHighlight,
  );
  check(
    "Highlights preserve inline code",
    "==literal==",
    observations.inlineHighlight,
  );
  check(
    "Footnotes preserve fenced code",
    "[^a]: literal",
    observations.footCode,
  );
  check(
    "Footnote does not consume unindented following paragraph",
    false,
    observations.footParagraph,
  );
  check("Footnote content renders Markdown", true, observations.footStrong);
  check(
    "HTML conversion preserves images",
    true,
    observations.image.includes("foto.png"),
  );
  check(
    "HTML conversion preserves nested list indentation",
    true,
    /\n +[-*]\s+Hijo/.test(observations.nestedList),
  );
  check(
    "HTML conversion preserves ordered start",
    true,
    observations.ordered.startsWith("4."),
  );
  check(
    "HTML conversion escapes literal Markdown",
    "\\*literal\\*",
    observations.literalMarkdown,
  );
  check("Moodle export excludes UI buttons", 0, observations.exportButtons);
  check(
    "Moodle Mermaid export contains portable SVG image",
    true,
    observations.exportSvg,
  );
  check(
    "Moodle export excludes loading placeholder",
    false,
    observations.exportLoading,
  );
  check(
    "Markdown rejects javascript links",
    false,
    /^javascript:/i.test(observations.link),
  );
  check("Linter detects reversed table tags", true, !!observations.orphanTable);
  check(
    "Linter detects reversed math delimiters",
    true,
    !!observations.orphanMath,
  );
  check("Linter detects unclosed table", true, !!observations.unclosedTable);
  check(
    "Linter does not reject valid table past scan limit",
    null,
    observations.longValidTable,
  );

  await edit("```mermaid\ngraph TD; A-->B\n```");
  await page.waitForFunction(() =>
    document.querySelector("#preview-inner .mermaid-output svg"),
  );
  check(
    "Mermaid renders in Markdown preview",
    true,
    (await page.locator("#preview-inner .mermaid-output svg").count()) > 0,
  );
  await page.locator("#btn-switch-mode").click();
  await page.locator("#btn-opt-transform").click();
  await page.waitForTimeout(600);
  check(
    "Transformed Mermaid renders in Moodle preview",
    true,
    (await page.locator("#preview-inner .mermaid-export img").count()) > 0,
  );

  await reset();
  await page.locator("#btn-show-shortcuts").click();
  check(
    "Opening dialog moves focus inside",
    true,
    await page.evaluate(() =>
      document
        .querySelector("#shortcuts-modal")
        .contains(document.activeElement),
    ),
  );
  await page.keyboard.press("Tab");
  check(
    "Dialog traps Tab within its controls",
    true,
    await page.evaluate(() =>
      document
        .querySelector("#shortcuts-modal")
        .contains(document.activeElement),
    ),
  );
  await page.keyboard.press("Escape");
  check(
    "Escape closes dialog",
    false,
    await page
      .locator("#shortcuts-modal")
      .evaluate((el) => el.classList.contains("open")),
  );
  check(
    "Closing dialog restores opener focus",
    "btn-show-shortcuts",
    await page.evaluate(() => document.activeElement.id),
  );
  await page.locator("#brand-icon").focus();
  await page.keyboard.press("Enter");
  check(
    "Brand button supports Enter",
    false,
    await page
      .locator("#hub-screen")
      .evaluate((el) => el.classList.contains("hidden")),
  );

  await reset();
  const race = await page.evaluate(async () => {
    const Original = window.FileReader;
    let reader;
    window.FileReader = class {
      constructor() {
        reader = this;
      }
      readAsText() {}
    };
    const input = document.querySelector("#file-input");
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["ARCHIVO MOODLE"], "prueba.html", { type: "text/html" }),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change"));
    location.hash = "markdown";
    await new Promise((resolve) => setTimeout(resolve, 50));
    reader.onload({ target: { result: "ARCHIVO MOODLE" } });
    window.FileReader = Original;
    return document.querySelector("#editor").value;
  });
  check(
    "Delayed file load cannot overwrite another mode",
    false,
    race === "ARCHIVO MOODLE",
  );

  await reset();
  const upload = async (name, text) => {
    await page.evaluate(
      ({ name, text }) => {
        const input = document.querySelector("#file-input");
        const transfer = new DataTransfer();
        transfer.items.add(new File([text], name));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change"));
      },
      { name, text },
    );
    await page.waitForTimeout(450);
  };
  await upload("prueba.html", "<p>Archivo válido</p>");
  check("Valid file import", "<p>Archivo válido</p>", await value());
  await upload("prueba.exe", "rechazar");
  check(
    "File extension guard preserves document",
    "<p>Archivo válido</p>",
    await value(),
  );
  await upload("grande.txt", "x".repeat(5 * 1024 * 1024 + 1));
  check(
    "Oversized file guard preserves document",
    "<p>Archivo válido</p>",
    await value(),
  );
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#btn-save-file").click();
  const download = await downloadEvent;
  check(
    "HTML download filename",
    "codigo_moodle.html",
    download.suggestedFilename(),
  );
  check(
    "Download preserves document bytes",
    "<p>Archivo válido</p>",
    fs.readFileSync(await download.path(), "utf8"),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#btn-reset-template").click();
  check(
    "Restore template",
    await page.evaluate(() => window.APP_CONFIG.DEFAULT_MOODLE_TEMPLATE),
    await value(),
  );
  await page.locator("#editor").press("Control+z");
  check("Undo template restoration", "<p>Archivo válido</p>", await value());

  await page.locator("#brand-icon").click();
  check(
    "Brand click shows hub",
    false,
    await page
      .locator("#hub-screen")
      .evaluate((el) => el.classList.contains("hidden")),
  );
  await page.locator("#card-mode-markdown").waitFor({ state: "visible" });
  await page.waitForTimeout(500); // Let the hub visibility transition finish before focusing it.
  await page.locator("#card-mode-markdown").focus();
  await page.keyboard.press("Enter");
  check(
    "Hub keyboard selection opens Markdown",
    true,
    await page
      .title()
      .then((title) => title.startsWith("Previsualizador Markdown")),
  );
  await edit("");
  await page.locator("#editor").press("(");
  await page.waitForTimeout(50);
  check("Delimiter auto-close", "()", await value());

  await reset("markdown");
  await edit("```js\nconst x = 1;\n```");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("AUDIT denied")) },
    });
  });
  await page.locator(".btn-copy-code-block").click();
  check(
    "Failed clipboard operation does not show success label",
    false,
    (await page.locator(".btn-copy-code-block").innerText()).includes(
      "¡Copiado!",
    ),
  );

  await reset("markdown");
  await edit("# Impresión");
  await page.emulateMedia({ media: "print" });
  check(
    "Print hides editing panel",
    "none",
    await page
      .locator("#left-panel")
      .evaluate((el) => getComputedStyle(el).display),
  );
  check(
    "Print retains preview",
    true,
    await page.locator("#preview-inner").isVisible(),
  );
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#btn-view-preview").click();
  check(
    "Mobile preview view hides editor",
    false,
    await page.locator("#editor").isVisible(),
  );
  await page.locator("#btn-view-editor").click();
  check(
    "Mobile editor view hides preview",
    false,
    await page.locator("#preview-inner").isVisible(),
  );
  await page.setViewportSize({ width: 1280, height: 720 });

  await reset("markdown");
  await page.evaluate(() => {
    window.marked = undefined;
  });
  await edit("# Sin red\n\n> [!NOTE]\n> Contenido");
  check(
    "Fallback parser renders headings",
    true,
    (await page.locator("#preview-inner h1").count()) > 0,
  );
  check(
    "Fallback parser supports documented alerts",
    true,
    (await page.locator("#preview-inner .markdown-alert-note").count()) > 0,
  );

  enforceCsp = false;
  await reset("markdown");
  await edit(
    '<style>body{display:none}</style><div class="modal-overlay open" id="app"><img src="/missing" onerror="document.body.dataset.unsafe=1"></div>',
  );
  await page.waitForTimeout(100);
  check(
    "Sanitizer blocks event handlers without CSP",
    null,
    await page.evaluate(() => document.body.dataset.unsafe || null),
  );
  check(
    "Imported styles cannot hide the application",
    0,
    await page.locator("#preview-inner style").count(),
  );
  check(
    "Imported classes cannot impersonate app overlays",
    0,
    await page.locator("#preview-inner .modal-overlay").count(),
  );
  check(
    "Imported IDs cannot shadow application controls",
    1,
    await page.locator("#app").count(),
  );
  const extra = await page.evaluate(async () => {
    const engine = window.MarkdownEngine;
    const doc = (value) => new DOMParser().parseFromString(value, "text/html");
    const repeated = doc(
      engine.parseMarkdown("uno [^a] dos [^a]\n\n[^a]: **nota**"),
    );
    const ids = [...repeated.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    const code = "````text\n```\n\\(x_1\\)\n==literal==\n````";
    const mathTable = doc(
      engine.parseMarkdown("| Error |\n|---|\n| \\( |x_1| \\) |"),
    );
    const portable = await engine.compileToMoodleHtml(
      '```mermaid\ngraph TD; A["Prueba á"]-->B\n```',
    );
    const exported = doc(portable);
    return {
      uniqueIds: new Set(ids).size === ids.length,
      validBackrefs: [...repeated.querySelectorAll('a[href^="#"]')].every(
        (element) => !!repeated.getElementById(element.hash.slice(1)),
      ),
      fourFenceCode: doc(engine.parseMarkdown(code)).querySelector("code")
        .textContent,
      mathColumns: mathTable.querySelectorAll("tbody tr:first-child td").length,
      mathText: mathTable.querySelector("tbody").textContent.trim(),
      codeConversion: engine.htmlToMarkdown(
        "<pre><code>```\ninside\n```</code></pre>",
      ),
      complexTable: engine.htmlToMarkdown(
        '<table><tr><th colspan="2">Título</th></tr><tr><td>A</td><td>B</td></tr></table>',
      ),
      diagramRoundTrip: engine.htmlToMarkdown(portable),
      exportStyle: exported
        .querySelector("img")
        .getAttribute("src")
        .startsWith("data:image/svg+xml;base64,"),
      rawTable: doc(
        engine.parseMarkdown(
          "| A |\n|---|\n| 1 |\n\n<table><tr><td>Otra</td></tr></table>",
        ),
      ).querySelectorAll(".table-responsive").length,
      links: doc(
        engine.parseMarkdown("[enlace](javascript:alert%281%29)"),
      ).querySelectorAll('a[href^="javascript:"]').length,
    };
  });
  check("Repeated footnotes generate unique IDs", true, extra.uniqueIds);
  check("Footnote links and backreferences resolve", true, extra.validBackrefs);
  check(
    "Four-backtick fences preserve literal formulas and highlights",
    "```\n\\(x_1\\)\n==literal==",
    extra.fourFenceCode,
  );
  check("Math pipes do not split Markdown table columns", 1, extra.mathColumns);
  check(
    "Math in table cells keeps source delimiters",
    "\\( |x_1| \\)",
    extra.mathText,
  );
  check(
    "HTML code containing fences uses a longer fence",
    true,
    extra.codeConversion.startsWith("````"),
  );
  check(
    "Complex tables preserve colspan as HTML",
    true,
    extra.complexTable.includes('colspan="2"'),
  );
  check(
    "Portable diagrams retain editable source on conversion back",
    true,
    extra.diagramRoundTrip.includes('A["Prueba á"]'),
  );
  check("Portable diagrams embed their own SVG", true, extra.exportStyle);
  check(
    "Mixed HTML and Markdown tables both become responsive",
    2,
    extra.rawTable,
  );
  check("Unsafe link protocols removed without CSP", 0, extra.links);
  enforceCsp = true;

  await reset();
  await edit("Borrador persistente");
  await reset("moodle", true);
  check("Draft survives reload", "Borrador persistente", await value());
  await reset();
  await edit("A\nB");
  await page.locator("#editor").selectText();
  await page.locator("#editor").press("Tab");
  check("Tab indents every selected line", "  A\n  B", await value());
  await page.locator("#editor").press("Shift+Tab");
  check("Shift+Tab unindents selected lines", "A\nB", await value());
  // Set a large fixture directly to measure the renderer, independent of OS paste latency.
  await page.locator("#editor").evaluate((element) => {
    element.value = "line\n".repeat(15000);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  check(
    "Long documents keep a bounded line-number DOM",
    true,
    (await page.locator("#line-numbers div").count()) <= 2002,
  );
  await page.locator("#editor").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  check(
    "Virtual line numbers reach the last document line",
    true,
    (await page.locator("#line-numbers").innerText()).includes("15001"),
  );
  await reset("markdown");
  check(
    "Opening a mode starts the editor at the first line",
    0,
    await page.locator("#editor").evaluate((element) => element.scrollTop),
  );
  check(
    "Opening a mode starts the editor at the left edge",
    0,
    await page.locator("#editor").evaluate((element) => element.scrollLeft),
  );
  await page.waitForFunction(() =>
    document.querySelector(".mermaid-output svg"),
  );
  await page.locator("#btn-view-split").evaluate((element) => element.click());
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/desktop.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/mobile.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await edit(
    "```mermaid\ngraph TD; A[Entrada]-->B[Salida]\n```\n\n\\[x^2\\]\n\n| A | B |\n|---|---|\n| 1 | 2 |",
  );
  await page.waitForFunction(() =>
    document.querySelector(".mermaid-output svg"),
  );
  check(
    "Rendered diagram retains node labels",
    true,
    (await page.locator(".mermaid-output svg").textContent()).includes(
      "Entrada",
    ),
  );
  check(
    "Rendered diagram uses SVG text instead of foreign HTML",
    0,
    await page.locator(".mermaid-output foreignObject").count(),
  );
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/diagram.png"),
  });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: path.resolve(__dirname, "../test-results/print.pdf"),
    format: "A4",
    printBackground: true,
  });
  check(
    "Print hides diagram action buttons",
    false,
    await page.locator(".mermaid-actions").isVisible(),
  );
  await page.emulateMedia({ media: "screen" });
  const diagramKinds = await page.evaluate(async () => {
    const examples = {
      sequence: "sequenceDiagram\nAlice->>Bob: Hola",
      classes: "classDiagram\nclass Animal {\n+eat()\n}",
      states: "stateDiagram-v2\n[*] --> Inicio\nInicio --> [*]",
      entities: "erDiagram\nPERSONA ||--o{ PEDIDO : realiza",
      gantt:
        "gantt\ntitle Plan\ndateFormat YYYY-MM-DD\nsection Trabajo\nTarea :2026-10-15, 2d",
      pie: 'pie title Reparto\n"Parte" : 40\n"Resto" : 60',
      mindmap: "mindmap\n  root((Tema))\n    Idea",
      timeline: "timeline\ntitle Historia\n2026 : Inicio",
      git: "gitGraph\ncommit\nbranch feature\ncheckout feature\ncommit",
    };
    const results = [];
    for (const [name, code] of Object.entries(examples)) {
      try {
        const svg = await window.Diagrams.render(code);
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        results.push({
          name,
          rendered:
            !!doc.querySelector("svg") && !doc.querySelector("parsererror"),
          labels: [...doc.querySelectorAll("text, tspan")].some((element) =>
            element.textContent.trim(),
          ),
        });
      } catch (error) {
        results.push({ name, rendered: false, error: error.message });
      }
    }
    return results;
  });
  for (const diagram of diagramKinds) {
    check(`Mermaid ${diagram.name} renders`, true, diagram.rendered);
    check(`Mermaid ${diagram.name} preserves labels`, true, diagram.labels);
  }
  const directive = await page.evaluate(async () => {
    const svg = await window.Diagrams.render(
      '%%{init: {"securityLevel":"loose","htmlLabels":true,"themeCSS":"body{display:none}"}}%%\ngraph TD; A[Seguro]-->B[Final]',
    );
    const config = window.mermaid.mermaidAPI.getConfig();
    return {
      strict: config.securityLevel === "strict",
      htmlLabels: config.htmlLabels,
      customCss: String(config.themeCSS || "").includes("display:none"),
      labels: svg.includes("Seguro"),
    };
  });
  check(
    "Diagram directives cannot weaken security mode",
    true,
    directive.strict,
  );
  check(
    "Diagram directives cannot enable foreign HTML labels",
    false,
    directive.htmlLabels,
  );
  check(
    "Diagram directives cannot inject custom CSS",
    false,
    directive.customCss,
  );
  check(
    "Secured diagram directives preserve document labels",
    true,
    directive.labels,
  );
  await edit("\\[\\invalidCommand{x}\\]");
  check(
    "Invalid mathematics shows an error status in Markdown",
    true,
    await page
      .locator("#status-pill")
      .evaluate((element) => element.classList.contains("error")),
  );
  await edit("```mermaid\ngraph TD; A[\n```");
  await page.waitForFunction(() =>
    document.querySelector(".mermaid-output.has-error"),
  );
  check(
    "Invalid diagram shows an error status",
    true,
    await page
      .locator("#status-pill")
      .evaluate((element) => element.classList.contains("error")),
  );
  const linterCases = await page.evaluate(() => ({
    preCode: window.Linter.inspectCriticalErrors(
      "<pre>\n```html\n\\[\n</pre>",
      null,
    ),
    comment: window.Linter.inspectCriticalErrors("<!-- <table> \\] -->", null),
    dollars: window.Linter.inspectCriticalErrors("$$ x", null),
  }));
  check(
    "Linter ignores Markdown and LaTeX examples in pre blocks",
    null,
    linterCases.preCode,
  );
  check("Linter ignores commented markup", null, linterCases.comment);
  check("Linter detects unclosed display dollars", true, !!linterCases.dollars);
  await reset();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("AUDIT quota");
    };
  });
  await edit("Documento en memoria");
  check(
    "Blocked draft storage does not stop editing",
    "Documento en memoria",
    await value(),
  );
  check(
    "Blocked draft storage shows a recovery message",
    true,
    (await page.locator("#toast-msg").innerText()).includes(
      "Descarga una copia",
    ),
  );
  check(
    "No external CDN resources needed for core features",
    0,
    externalRequests.length,
  );
  check("No uncaught browser errors", 0, errors.length);

  const uniqueErrors = [
    ...new Map(errors.map((error) => [error.stack, error])).values(),
  ];
  const report = {
    applicationVersion: require("../package.json").version,
    buildSha256: require("node:crypto")
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "js/main.js")))
      .digest("hex"),
    generatedAt: new Date().toISOString(),
    browser: browser.version(),
    revision: require("node:child_process")
      .execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: path.resolve(root, ".."),
        encoding: "utf8",
      })
      .trim(),
    dependencies: require("../package.json").dependencies,
    summary: {
      total: results.length,
      pass: results.filter((x) => x.status === "PASS").length,
      fail: results.filter((x) => x.status === "FAIL").length,
    },
    results,
    observations,
    pageErrors: uniqueErrors,
    pageErrorOccurrences: errors.length,
    limits: [
      "Built site with Vercel security headers; external requests blocked.",
      "FileReader race uses controlled completion timing.",
      "No real Moodle instance or OS clipboard tested.",
    ],
  };
  fs.mkdirSync(path.resolve(__dirname, "../test-results"), { recursive: true });
  fs.writeFileSync(
    path.resolve(__dirname, "../test-results/results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        summary: report.summary,
        failures: results.filter((x) => x.status === "FAIL").map((x) => x.name),
        observations,
        pageErrors: uniqueErrors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  process.exitCode = report.summary.fail ? 1 : 0;
})().catch(async (error) => {
  console.error(error.message.slice(0, 400));
  if (browser) await browser.close();
  process.exitCode = 1;
});
