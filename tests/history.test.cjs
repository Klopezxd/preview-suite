const { test } = require("node:test");
const assert = require("node:assert/strict");

test("pending edit is committed before undo and remains redoable", async () => {
  const { createHistory } = await import("../js/history.js");
  const history = createHistory("initial");
  history.commit("A");
  assert.equal(history.undo("AB"), "A");
  assert.equal(history.redo(), "AB");
});

test("editing after undo removes the obsolete redo branch", async () => {
  const { createHistory } = await import("../js/history.js");
  const history = createHistory("A");
  history.commit("B");
  history.undo("B");
  history.commit("C");
  assert.equal(history.redo(), "C");
  assert.equal(history.canRedo, false);
});

test("timeline bounds retained memory while preserving the current document", async () => {
  const { createHistory } = await import("../js/history.js");
  const history = createHistory("", { maxEntries: 3, maxBytes: 12 });
  for (const text of ["AA", "BB", "CC", "DD"]) history.commit(text);
  assert.equal(history.size, 3);
  history.commit("oversized current snapshot");
  assert.equal(history.size, 1);
  assert.equal(history.current, "oversized current snapshot");
});
