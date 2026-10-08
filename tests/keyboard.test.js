import test from "node:test";
import assert from "node:assert/strict";

import { nearestInDirection, placeChild } from "../src/keyboard.js";

const board = {
  nodes: [
    { id: "root", x: 600, y: 350 },
    { id: "left", x: 470, y: 350 },
    { id: "up", x: 600, y: 200 },
    { id: "far-right", x: 1000, y: 360 },
    { id: "diag", x: 700, y: 520 }
  ],
  links: ["left::root", "root::up"]
};

test("a new linked idea grows away from the existing branches", () => {
  const p = placeChild(board, "root");
  assert.ok(p.x > 600, `expected right of root, got ${p.x}`);
  assert.ok(p.y > 350, `expected below root, got ${p.y}`);
});

test("a new idea never lands on top of another", () => {
  const snapshot = { nodes: [...board.nodes], links: [...board.links] };
  for (let i = 0; i < 8; i += 1) {
    const p = placeChild(snapshot, "root");
    for (const node of snapshot.nodes) {
      assert.ok(Math.hypot(node.x - p.x, node.y - p.y) >= 82);
    }
    snapshot.nodes.push({ id: `c${i}`, ...p });
    snapshot.links.push(`c${i}::root`);
  }
});

test("a new idea stays on the board near an edge", () => {
  const p = placeChild({ nodes: [{ id: "edge", x: 1150, y: 650 }], links: [] }, "edge");
  assert.ok(p.x <= 1154 && p.y <= 654);
});

test("arrow keys pick the closest idea in that direction", () => {
  assert.equal(nearestInDirection(board, "root", "ArrowLeft"), "left");
  assert.equal(nearestInDirection(board, "root", "ArrowUp"), "up");
  assert.equal(nearestInDirection(board, "root", "ArrowRight"), "far-right");
  assert.equal(nearestInDirection(board, "root", "ArrowDown"), "diag");
  assert.equal(nearestInDirection(board, "left", "ArrowLeft"), null);
});
