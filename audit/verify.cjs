// ARCHIVED verifier for the 4ae429f source tree. Use npm run check for the current application.
// Reproducible audit of the unmodified application. No production files are changed.
// Usage: node audit/verify.cjs
// Requires Playwright (PLAYWRIGHT_MODULE may point to an installed module).
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const results = [];
let browser;
const check = (name, expected, actual) => results.push({ name, status: expected === actual ? 'PASS' : 'FAIL', expected, actual });

(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const remote = new Map();
  const dependencies = [
    'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js',
    'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
    'https://cdn.jsdelivr.net/combine/npm/prismjs@1.29.0/prism.min.js,npm/prismjs@1.29.0/components/prism-python.min.js,npm/prismjs@1.29.0/components/prism-latex.min.js,npm/prismjs@1.29.0/components/prism-javascript.min.js,npm/prismjs@1.29.0/components/prism-r.min.js,npm/prismjs@1.29.0/components/prism-sql.min.js,npm/prismjs@1.29.0/components/prism-java.min.js,npm/prismjs@1.29.0/components/prism-cpp.min.js',
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js'
  ];
  await Promise.all(dependencies.map(async url => {
    const response = await context.request.get(url, { timeout: 25000 });
    if (!response.ok()) throw new Error(`Dependency ${response.status()}: ${url}`);
    remote.set(url, await response.body());
  }));
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (remote.has(url)) return route.fulfill({ body: remote.get(url), contentType: 'application/javascript' });
    if (!url.startsWith('http://preview-suite.audit/')) return route.abort();
    const name = new URL(url).pathname.slice(1) || 'index.html';
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack }));
  let resetId = 0;
  const reset = async (mode = 'moodle') => {
    await page.goto(`http://preview-suite.audit/?audit=${++resetId}#${mode}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.MarkdownEngine && window.Linter);
  };
  const edit = async (value, settle = true) => {
    await page.locator('#editor').fill(value);
    if (settle) await page.waitForTimeout(400);
  };
  const value = () => page.locator('#editor').inputValue();
  await reset();
  check('Initial Moodle preview', true, await page.locator('#preview-inner h1').count() > 0);
  check('KaTeX renders default mathematics', true, await page.locator('#preview-inner .katex').count() > 0);
  check('Prism C++ grammar loads from configured bundle', true, await page.evaluate(() => !!window.Prism?.languages?.cpp));
  await edit('<h1>Prueba</h1>');
  check('HTML preview updates', 'Prueba', await page.locator('#preview-inner h1').innerText());
  await page.locator('#btn-toggle-theme').click();
  check('Theme button toggles preview theme', true, await page.locator('#preview-wrap').evaluate(el => el.classList.contains('theme-dark')));
  await page.locator('#editor').press('Control+=');
  check('Editor keyboard zoom', '15px', await page.locator('#editor').evaluate(el => el.style.fontSize));
  await page.locator('#editor').press('Control+0');
  check('Editor zoom reset', '14px', await page.locator('#editor').evaluate(el => el.style.fontSize));
  await page.locator('#btn-clear-editor').click();
  await page.waitForTimeout(400);
  check('Clear editor', '', await value());
  await page.locator('#editor').press('Control+z');
  check('Undo clear restores text', '<h1>Prueba</h1>', await value());
  await page.locator('#editor').press('Control+y');
  check('Redo clear', '', await value());

  await reset();
  await edit('A');
  await edit('AB', false);
  await page.locator('#editor').press('Control+z');
  check('Undo flushes pending edit before reverting', 'A', await value());
  await page.waitForTimeout(400);
  await page.locator('#editor').press('Control+y');
  check('Redo recovers pending edit', 'AB', await value());

  await reset('markdown');
  await edit('BORRADOR MARKDOWN');
  await page.evaluate(() => { location.hash = 'moodle'; });
  await page.waitForFunction(() => document.title.startsWith('Previsualizador Moodle'));
  await page.locator('#btn-switch-mode').click();
  check('Switching from untouched template preserves destination draft', 'BORRADOR MARKDOWN', await value());

  await reset();
  await edit('texto seleccionado');
  await page.locator('#editor').selectText();
  await page.locator('#editor').press('Tab');
  check('Tab indents without deleting selection', '  texto seleccionado', await value());

  await reset();
  await edit('<img src="/missing-audit-image" onerror="document.body.dataset.auditExecuted=\'yes\'">');
  await page.waitForTimeout(200);
  check('Imported HTML cannot execute in application origin', null, await page.evaluate(() => document.body.dataset.auditExecuted || null));
  await reset('markdown');
  await edit('<img src="/missing-audit-image" onerror="document.body.dataset.auditExecuted=\'yes\'">');
  await page.waitForTimeout(200);
  check('Markdown raw HTML cannot execute in application origin', null, await page.evaluate(() => document.body.dataset.auditExecuted || null));

  await reset('markdown');
  const observations = await page.evaluate(() => {
    const engine = window.MarkdownEngine;
    const parse = engine.parseMarkdown;
    const doc = html => new DOMParser().parseFromString(html, 'text/html');
    const fenced = '```text\n==literal==\n```';
    const footCode = '```text\n[^a]: literal\n```\n\nref [^a]';
    const exported = engine.compileToMoodleHtml('```mermaid\ngraph TD; A-->B\n```');
    return {
      heading: doc(parse('# Título')).querySelector('h1')?.textContent,
      tableHead: !!doc(parse('| A | B |\n|---|---|\n| 1 | 2 |')).querySelector('thead'),
      checklist: !!doc(parse('- [x] Listo')).querySelector('input:checked'),
      alert: !!doc(parse('> [!NOTE]\n> Hola')).querySelector('.markdown-alert-note'),
      math: parse('\\(x_1\\)').includes('\\(x_1\\)'),
      literalHighlight: doc(parse(fenced)).querySelector('code')?.textContent,
      inlineHighlight: doc(parse('`==literal==`')).querySelector('code')?.textContent,
      footCode: doc(parse(footCode)).querySelector('code')?.textContent,
      footParagraph: doc(parse('ref [^a]\n\n[^a]: Nota\nPárrafo posterior')).querySelector('.footnotes')?.textContent.includes('Párrafo posterior'),
      footStrong: !!doc(parse('ref [^a]\n\n[^a]: **negrita**')).querySelector('.footnotes strong'),
      image: engine.htmlToMarkdown('<p>Foto <img src="foto.png" alt="Ejemplo"></p>'),
      nestedList: engine.htmlToMarkdown('<ul><li>Padre<ul><li>Hijo</li></ul></li></ul>'),
      ordered: engine.htmlToMarkdown('<ol start="4"><li>Cuarto</li></ol>'),
      literalMarkdown: engine.htmlToMarkdown('<p>*literal*</p>'),
      exportButtons: doc(exported).querySelectorAll('button').length,
      exportSvg: !!doc(exported).querySelector('.mermaid-output svg'),
      exportLoading: exported.includes('Cargando diagrama'),
      link: doc(parse('[abrir](javascript:alert%281%29)')).querySelector('a')?.getAttribute('href'),
      orphanTable: window.Linter.inspectCriticalErrors('</table><table>', null),
      orphanMath: window.Linter.inspectCriticalErrors('\\] \\[', null),
      unclosedTable: window.Linter.inspectCriticalErrors('<table>', null),
      longValidTable: window.Linter.inspectCriticalErrors('<table>\n' + '\n'.repeat(10000) + '</table>', null)
    };
  });
  check('Markdown heading', 'Título', observations.heading);
  check('Markdown table has semantic thead', true, observations.tableHead);
  check('Markdown task list', true, observations.checklist);
  check('GFM callout', true, observations.alert);
  check('LaTeX delimiters preserved', true, observations.math);
  check('Highlights preserve fenced code', '==literal==', observations.literalHighlight);
  check('Highlights preserve inline code', '==literal==', observations.inlineHighlight);
  check('Footnotes preserve fenced code', '[^a]: literal', observations.footCode);
  check('Footnote does not consume unindented following paragraph', false, observations.footParagraph);
  check('Footnote content renders Markdown', true, observations.footStrong);
  check('HTML conversion preserves images', true, observations.image.includes('foto.png'));
  check('HTML conversion preserves nested list indentation', true, /\n +[-*] Hijo/.test(observations.nestedList));
  check('HTML conversion preserves ordered start', true, observations.ordered.startsWith('4.'));
  check('HTML conversion escapes literal Markdown', '\\*literal\\*', observations.literalMarkdown);
  check('Moodle export excludes UI buttons', 0, observations.exportButtons);
  check('Moodle Mermaid export contains rendered SVG', true, observations.exportSvg);
  check('Moodle export excludes loading placeholder', false, observations.exportLoading);
  check('Markdown rejects javascript links', false, /^javascript:/i.test(observations.link));
  check('Linter detects reversed table tags', true, !!observations.orphanTable);
  check('Linter detects reversed math delimiters', true, !!observations.orphanMath);
  check('Linter detects unclosed table', true, !!observations.unclosedTable);
  check('Linter does not reject valid table past scan limit', null, observations.longValidTable);

  await edit('```mermaid\ngraph TD; A-->B\n```');
  await page.waitForFunction(() => document.querySelector('#preview-inner .mermaid-output svg'));
  check('Mermaid renders in Markdown preview', true, await page.locator('#preview-inner .mermaid-output svg').count() > 0);
  await page.locator('#btn-switch-mode').click();
  await page.locator('#btn-opt-transform').click();
  await page.waitForTimeout(600);
  check('Transformed Mermaid renders in Moodle preview', true, await page.locator('#preview-inner .mermaid-output svg').count() > 0);

  await reset();
  await page.locator('#btn-show-shortcuts').click();
  check('Opening dialog moves focus inside', true, await page.evaluate(() => document.querySelector('#shortcuts-modal').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  check('Escape closes dialog', false, await page.locator('#shortcuts-modal').evaluate(el => el.classList.contains('open')));
  await page.locator('#brand-icon').focus();
  await page.keyboard.press('Enter');
  check('Brand button supports Enter', false, await page.locator('#hub-screen').evaluate(el => el.classList.contains('hidden')));

  await reset();
  const race = await page.evaluate(async () => {
    const Original = window.FileReader;
    let reader;
    window.FileReader = class { constructor() { reader = this; } readAsText() {} };
    const input = document.querySelector('#file-input');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['ARCHIVO MOODLE'], 'prueba.html', { type: 'text/html' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    location.hash = 'markdown';
    await new Promise(resolve => setTimeout(resolve, 50));
    reader.onload({ target: { result: 'ARCHIVO MOODLE' } });
    window.FileReader = Original;
    return document.querySelector('#editor').value;
  });
  check('Delayed file load cannot overwrite another mode', false, race === 'ARCHIVO MOODLE');

  await reset();
  const upload = async (name, text) => {
    await page.evaluate(({ name, text }) => {
      const input = document.querySelector('#file-input');
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], name));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
    }, { name, text });
    await page.waitForTimeout(450);
  };
  await upload('prueba.html', '<p>Archivo válido</p>');
  check('Valid file import', '<p>Archivo válido</p>', await value());
  await upload('prueba.exe', 'rechazar');
  check('File extension guard preserves document', '<p>Archivo válido</p>', await value());
  await upload('grande.txt', 'x'.repeat(5 * 1024 * 1024 + 1));
  check('Oversized file guard preserves document', '<p>Archivo válido</p>', await value());
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#btn-save-file').click();
  const download = await downloadEvent;
  check('HTML download filename', 'codigo_moodle.html', download.suggestedFilename());
  check('Download preserves document bytes', '<p>Archivo válido</p>', fs.readFileSync(await download.path(), 'utf8'));
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#btn-reset-template').click();
  check('Restore template', await page.evaluate(() => window.APP_CONFIG.DEFAULT_MOODLE_TEMPLATE), await value());
  await page.locator('#editor').press('Control+z');
  check('Undo template restoration', '<p>Archivo válido</p>', await value());

  await page.locator('#brand-icon').click();
  check('Brand click shows hub', false, await page.locator('#hub-screen').evaluate(el => el.classList.contains('hidden')));
  await page.locator('#card-mode-markdown').waitFor({ state: 'visible' });
  await page.waitForTimeout(500); // Let the hub visibility transition finish before focusing it.
  await page.locator('#card-mode-markdown').focus();
  await page.keyboard.press('Enter');
  check('Hub keyboard selection opens Markdown', true, await page.title().then(title => title.startsWith('Previsualizador Markdown')));
  await edit('');
  await page.locator('#editor').press('(');
  await page.waitForTimeout(50);
  check('Delimiter auto-close', '()', await value());

  await reset('markdown');
  await edit('```js\nconst x = 1;\n```');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('AUDIT denied')) } });
  });
  await page.locator('.btn-copy-code-block').click();
  check('Failed clipboard operation does not show success label', false, (await page.locator('.btn-copy-code-block').innerText()).includes('¡Copiado!'));

  await reset('markdown');
  await edit('# Impresión');
  await page.emulateMedia({ media: 'print' });
  check('Print hides editing panel', 'none', await page.locator('#left-panel').evaluate(el => getComputedStyle(el).display));
  check('Print retains preview', true, await page.locator('#preview-inner').isVisible());
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#btn-view-preview').click();
  check('Mobile preview view hides editor', false, await page.locator('#editor').isVisible());
  await page.locator('#btn-view-editor').click();
  check('Mobile editor view hides preview', false, await page.locator('#preview-inner').isVisible());
  await page.setViewportSize({ width: 1280, height: 720 });

  await reset('markdown');
  await page.evaluate(() => { window.marked = undefined; });
  await edit('# Sin red\n\n> [!NOTE]\n> Contenido');
  check('Fallback parser renders headings', true, await page.locator('#preview-inner h1').count() > 0);
  check('Fallback parser supports documented alerts', true, await page.locator('#preview-inner .markdown-alert-note').count() > 0);

  const uniqueErrors = [...new Map(errors.map(error => [error.stack, error])).values()];
  const report = {
    generatedAt: new Date().toISOString(), browser: browser.version(),
    revision: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dependencies: [...remote.keys()],
    summary: { total: results.length, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length },
    results, observations, pageErrors: uniqueErrors, pageErrorOccurrences: errors.length,
    limits: ['External fonts and non-script CDN assets blocked for deterministic checks.', 'FileReader race uses controlled completion timing.', 'No real Moodle instance or OS clipboard tested.']
  };
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ summary: report.summary, failures: results.filter(x => x.status === 'FAIL').map(x => x.name), observations, pageErrors: uniqueErrors }, null, 2));
  await browser.close();
  process.exitCode = report.summary.fail ? 1 : 0;
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exitCode = 1; });
