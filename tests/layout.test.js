import test from "node:test";
import assert from "node:assert/strict";

import { countCrossings, forceLayout } from "../src/layout.js";

function messyBoard() {
  // Two small trees dropped at random on top of each other.
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ids = ["a", "a1", "a2", "a3", "a4", "b", "b1", "b2", "b3", "c"];
  return {
    nodes: ids.map((id) => ({ id, label: id, x: 400 + rand() * 300, y: 250 + rand() * 200 })),
    links: ["a::a1", "a::a2", "a::a3", "a::a4", "b::b1", "b::b2", "b::b3", "a2::b"]
  };
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

test("no two ideas overlap after tidying", () => {
  const positions = forceLayout(messyBoard());
  const list = Object.values(positions);
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      assert.ok(dist(list[i], list[j]) >= 72, `overlap ${dist(list[i], list[j])}`);
    }
  }
});

test("linked ideas end up closer than unlinked ones", () => {
  const board = messyBoard();
  const positions = forceLayout(board);
  const linked = new Set(board.links);
  let near = 0;
  let nearCount = 0;
  let far = 0;
  let farCount = 0;
  const ids = board.nodes.map((n) => n.id);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const d = dist(positions[ids[i]], positions[ids[j]]);
      const key = [ids[i], ids[j]].sort().join("::");
      if (linked.has(key)) { near += d; nearCount += 1; } else { far += d; farCount += 1; }
    }
  }
  assert.ok(near / nearCount < 0.7 * (far / farCount));
});

test("trees come out with no crossing links", () => {
  const board = messyBoard();
  assert.equal(countCrossings(board, forceLayout(board)), 0);
});

test("stays on the board and gives the same answer every time", () => {
  const board = messyBoard();
  const first = forceLayout(board);
  assert.deepEqual(forceLayout(board), first);
  for (const p of Object.values(first)) {
    assert.ok(p.x >= 56 && p.x <= 1144 && p.y >= 56 && p.y <= 644);
  }
});

test("handles an empty board and a single idea", () => {
  assert.deepEqual(forceLayout({ nodes: [], links: [] }), {});
  const one = forceLayout({ nodes: [{ id: "x", x: 10, y: 10 }], links: [] });
  assert.ok(one.x.x >= 56);
});

test("a small board stays compact instead of flying to the edges", () => {
  const board = {
    nodes: [
      { id: "a", x: 300, y: 300 },
      { id: "b", x: 320, y: 310 },
      { id: "c", x: 900, y: 500 },
      { id: "d", x: 700, y: 200 }
    ],
    links: ["a::b", "b::c"]
  };
  const positions = Object.values(forceLayout(board));
  for (const p of positions) {
    assert.ok(Math.hypot(p.x - 600, p.y - 350) < 300, `too far out: ${p.x},${p.y}`);
  }
});
