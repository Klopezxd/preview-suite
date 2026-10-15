import DOMPurify from "dompurify";
import { marked, Marked } from "marked";
import mermaid from "mermaid";
import katex from "katex";
import renderMathInElement from "katex/contrib/auto-render";
import Prism from "prismjs";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-python";
import "prismjs/components/prism-latex";
import "prismjs/components/prism-r";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-java";
import "prismjs/plugins/autoloader/prism-autoloader";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import "katex/dist/katex.min.css";
import "prismjs/themes/prism-tomorrow.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";

Prism.manual = true;
Prism.plugins.autoloader.languages_path = new URL(
  "vendor/prism/",
  document.baseURI,
).href;
Object.assign(window, {
  DOMPurify,
  marked,
  Marked,
  mermaid,
  katex,
  renderMathInElement,
  Prism,
  TurndownService,
  turndownGfm: gfm,
});
