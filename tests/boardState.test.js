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
  restoreSnapshot,
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

test("a delete in one tab is not undone by an older copy from another tab", () => {
  const left = createBoardState();
  addNode(left, { id: "a", label: "Keep" });
  addNode(left, { id: "b", label: "Drop" });
  connectNodes(left, "a", "b");
  const right = createBoardState(serializeState(left));
  const staleCopy = serializeState(right);

  removeNode(left, "b", Date.now() + 5000);
  mergeRemoteState(left, staleCopy);
  assert.equal(left.nodes.has("b"), false);
  assert.equal(left.links.size, 0);

  mergeRemoteState(right, serializeState(left));
  assert.equal(right.nodes.has("b"), false);
  assert.equal(right.links.size, 0);
});

test("an edit made after the delete brings the idea back", () => {
  const left = createBoardState();
  addNode(left, { id: "a", label: "Idea" });
  const right = createBoardState(serializeState(left));
  removeNode(left, "a", 1000);
  const renamed = serializeState(right);
  renamed.nodes[0].updatedAt = 2000;
  mergeRemoteState(left, renamed);
  assert.equal(left.nodes.has("a"), true);
  assert.equal(left.deleted.has("a"), false);
});

test("undoing a delete wins over the tombstone in other tabs", () => {
  const tab = createBoardState();
  addNode(tab, { id: "a", label: "Idea" });
  const before = serializeState(tab);
  removeNode(tab, "a", Date.now() + 1000);
  const peer = createBoardState(serializeState(tab));

  const restored = restoreSnapshot(tab, before, Date.now() + 2000);
  mergeRemoteState(peer, serializeState(restored));
  assert.equal(peer.nodes.has("a"), true);
});

test("undoing an add tombstones the node so peers drop it too", () => {
  const tab = createBoardState();
  const empty = serializeState(tab);
  addNode(tab, { id: "a" });
  const peer = createBoardState(serializeState(tab));
  const restored = restoreSnapshot(tab, empty, Date.now() + 1000);
  mergeRemoteState(peer, serializeState(restored));
  assert.equal(peer.nodes.has("a"), false);
});
