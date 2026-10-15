import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist");
// Only remove the known build directory inside this repository.
if (dirname(output) !== resolve(root))
  throw new Error("Invalid build directory");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(
  ["index.html", "surprise.html", "css", "LICENSE"].map((name) =>
    cp(resolve(root, name), resolve(output, name), { recursive: true }),
  ),
);
await cp(
  resolve(root, "node_modules/prismjs/components"),
  resolve(output, "vendor/prism"),
  {
    recursive: true,
  },
);
await build({
  absWorkingDir: root,
  entryPoints: ["js/main.js"],
  outdir: resolve(output, "js"),
  bundle: true,
  format: "esm",
  splitting: true,
  minify: true,
  target: ["es2022"],
  loader: { ".woff2": "file", ".woff": "file", ".ttf": "file" },
  assetNames: "assets/[name]-[hash]",
  chunkNames: "chunks/[name]-[hash]",
  legalComments: "linked",
  metafile: false,
});
console.log("Static site built in dist/");
