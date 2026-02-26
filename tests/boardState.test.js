import test from "node:test";
import assert from "node:assert/strict";

import {
  addNode,
  connectNodes,
  createBoardState,
  exportMarkdown,
  importMarkdown,
  mergeRemoteState,
  moveNode,
  removeNode,
  renameNode,
  serializeState
} from "../src/boardState.js";

test("addNode inserts node and bumps version", () => {
  const state = createBoardState();
  const node = addNode(state, { id: "n1", label: "Root", x: 100, y: 120 });

  assert.equal(node.id, "n1");
  assert.equal(state.nodes.size, 1);
  assert.equal(state.version, 1);
});

test("connectNodes creates canonical unique link", () => {
  const state = createBoardState();
  addNode(state, { id: "a" });
  addNode(state, { id: "b" });

  connectNodes(state, "a", "b");
  connectNodes(state, "b", "a");

  assert.deepEqual(Array.from(state.links.values()), ["a::b"]);
});

test("moveNode updates coordinates", () => {
  const state = createBoardState();
  addNode(state, { id: "n1", x: 50, y: 50 });
  moveNode(state, "n1", 210, 320);

  const node = state.nodes.get("n1");
  assert.equal(node.x, 210);
  assert.equal(node.y, 320);
});

test("renameNode updates label", () => {
  const state = createBoardState();
  addNode(state, { id: "n1", label: "Before" });
  renameNode(state, "n1", "After");

  assert.equal(state.nodes.get("n1").label, "After");
});

test("removeNode deletes node and attached links", () => {
  const state = createBoardState();
  addNode(state, { id: "a" });
  addNode(state, { id: "b" });
  connectNodes(state, "a", "b");
  removeNode(state, "a");

  assert.equal(state.nodes.has("a"), false);
  assert.equal(state.links.size, 0);
});

test("serializeState returns plain object snapshot", () => {
  const state = createBoardState();
  addNode(state, { id: "one" });
  const snapshot = serializeState(state);

  assert.equal(typeof snapshot.version, "number");
  assert.equal(Array.isArray(snapshot.nodes), true);
  assert.equal(Array.isArray(snapshot.links), true);
});

test("mergeRemoteState keeps newer node data and merges links", () => {
  const local = createBoardState();
  addNode(local, { id: "a", label: "Old", x: 10, y: 10 });
  addNode(local, { id: "b", label: "Peer", x: 30, y: 30 });

  const remote = {
    version: 7,
    nodes: [
      { id: "a", label: "New", x: 99, y: 98, updatedAt: Date.now() + 1000 },
      { id: "b", label: "Peer", x: 33, y: 35, updatedAt: Date.now() + 1000 }
    ],
    links: ["a::b"]
  };

  const merged = mergeRemoteState(local, remote);
  assert.equal(local.nodes.get("a").label, "New");
  assert.equal(local.links.has("a::b"), true);
  assert.equal(merged.version, 7);
});

test("exportMarkdown and importMarkdown roundtrip key data", () => {
  const state = createBoardState();
  addNode(state, { id: "a", label: "Root", x: 110, y: 120 });
  addNode(state, { id: "b", label: "Leaf", x: 210, y: 220 });
  connectNodes(state, "a", "b");

  const markdown = exportMarkdown(state);
  const imported = importMarkdown(markdown);
  const rebuilt = createBoardState(imported);

  assert.equal(markdown.includes("## Nodes"), true);
  assert.equal(markdown.includes("## Links"), true);
  assert.equal(rebuilt.nodes.has("a"), true);
  assert.equal(rebuilt.links.has("a::b"), true);
});
