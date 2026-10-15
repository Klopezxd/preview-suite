const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

test("static server publishes the Vercel build and configured security headers", async (t) => {
  const server = spawn(process.execPath, ["scripts/serve.js"], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  t.after(() => server.kill());
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Static server did not start")),
      10000,
    );
    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.stdout.on("data", (data) => {
      const match = String(data).match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
  });
  const response = await fetch(address);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-security-policy"),
    /script-src 'self'/,
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(await response.text(), /type="module" src="js\/main.js"/);
  assert.equal((await fetch(`${address}/js/main.js`)).status, 200);
  assert.equal((await fetch(`${address}/surprise.html`)).status, 200);
  assert.equal((await fetch(`${address}/README.md`)).status, 404);
  assert.equal((await fetch(`${address}/package-lock.json`)).status, 404);
});
