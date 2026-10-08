import test from "node:test";
import assert from "node:assert/strict";

import { fromOutline, toOutline } from "../src/outline.js";

test("a map comes out as a nested list starting from the first idea", () => {
  const snapshot = {
    nodes: [
      { id: "t", label: "Trip", x: 600, y: 300 },
      { id: "p", label: "Packing", x: 400, y: 200 },
      { id: "b", label: "Budget", x: 800, y: 200 },
      { id: "s", label: "Sunscreen", x: 300, y: 100 },
      { id: "x", label: "Stray thought", x: 100, y: 600 }
    ],
    links: ["p::t", "b::t", "p::s"]
  };
  assert.equal(toOutline(snapshot), [
    "- Trip",
    "  - Packing",
    "    - Sunscreen",
    "  - Budget",
    "- Stray thought"
  ].join("\n"));
});

test("a loop is listed once, not forever", () => {
  const snapshot = {
    nodes: ["a", "b", "c"].map((id, i) => ({ id, label: id.toUpperCase(), x: i * 100, y: 0 })),
    links: ["a::b", "b::c", "a::c"]
  };
  const lines = toOutline(snapshot).split("\n");
  assert.equal(lines.length, 3);
});

test("pasting a list from a notes app builds linked ideas", () => {
  const pasted = "Party\n\t- Food\n\t\t* Pizza\n\t\t* Cake\n\t- [x] Music\n1. Clean up";
  const { nodes, links } = fromOutline(pasted);
  assert.deepEqual(nodes.map((n) => n.label), ["Party", "Food", "Pizza", "Cake", "Music", "Clean up"]);
  assert.deepEqual(links, [
    ["idea-1", "idea-2"],
    ["idea-2", "idea-3"],
    ["idea-2", "idea-4"],
    ["idea-1", "idea-5"]
  ]);
});

test("export then import keeps the same shape", () => {
  const snapshot = {
    nodes: [
      { id: "r", label: "Root", x: 0, y: 0 },
      { id: "a", label: "A", x: 0, y: 10 },
      { id: "b", label: "B | with a pipe", x: 0, y: 20 }
    ],
    links: ["a::r", "a::b"]
  };
  const back = fromOutline(toOutline(snapshot));
  assert.equal(back.nodes.length, 3);
  assert.equal(back.links.length, 2);
  assert.ok(back.nodes.some((n) => n.label === "B | with a pipe"));
});

test("a pasted list copies back out in the same order", () => {
  const list = "- Weekend\n  - Groceries\n    - Eggs\n  - Laundry";
  const { nodes, links } = fromOutline(list);
  const snapshot = {
    nodes: nodes.map((n, i) => ({ ...n, x: 600, y: 600 - i * 100 })),
    links: links.map(([a, b]) => `${a}::${b}`)
  };
  assert.equal(toOutline(snapshot), list);
});
