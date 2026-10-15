import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../vercel.json" with { type: "json" };

const root = fileURLToPath(new URL("../dist", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    for (const header of config.headers[0].headers)
      res.setHeader(header.key, header.value);
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.writeHead(200).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(Number(process.env.PORT || 8000), "127.0.0.1", () =>
  console.log(`Preview: http://localhost:${server.address().port}`),
);
