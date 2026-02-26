import test from "node:test";
import assert from "node:assert/strict";

import { createHistory, pushSnapshot, redoSnapshot, undoSnapshot } from "../src/history.js";

test("pushSnapshot appends present to history", () => {
  const history = createHistory({ version: 1, nodes: [], links: [] });
  pushSnapshot(history, { version: 2, nodes: [{ id: "a" }], links: [] });

  assert.equal(history.past.length, 1);
  assert.equal(history.present.version, 2);
  assert.equal(history.future.length, 0);
});

test("undo/redo navigate snapshots", () => {
  const history = createHistory({ version: 1, nodes: [], links: [] });
  pushSnapshot(history, { version: 2, nodes: [{ id: "a" }], links: [] });
  pushSnapshot(history, { version: 3, nodes: [{ id: "a" }, { id: "b" }], links: [] });

  const undo = undoSnapshot(history);
  assert.equal(undo.version, 2);

  const redo = redoSnapshot(history);
  assert.equal(redo.version, 3);
});

