/** A bounded timeline; edits commit before undo, with no delayed mutation of its cursor. */
export function createHistory(
  initial,
  { maxEntries = 50, maxBytes = 16 * 1024 * 1024 } = {},
) {
  let entries = [initial];
  let index = 0;
  const bytes = (text) => text.length * 2;
  function commit(text) {
    if (entries[index] === text) return;
    entries = entries.slice(0, index + 1);
    entries.push(text);
    let total = entries.reduce((sum, value) => sum + bytes(value), 0);
    while (
      entries.length > 1 &&
      (entries.length > maxEntries || total > maxBytes)
    )
      total -= bytes(entries.shift());
    index = entries.length - 1;
  }
  return {
    commit,
    undo(current) {
      commit(current);
      if (index > 0) index--;
      return entries[index];
    },
    redo() {
      if (index < entries.length - 1) index++;
      return entries[index];
    },
    get canUndo() {
      return index > 0;
    },
    get canRedo() {
      return index < entries.length - 1;
    },
    get size() {
      return entries.length;
    },
    get current() {
      return entries[index];
    },
  };
}

if (typeof window !== "undefined")
  window.EditHistory = { create: createHistory };
