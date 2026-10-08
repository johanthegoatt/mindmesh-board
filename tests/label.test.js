import test from "node:test";
import assert from "node:assert/strict";

import { wrapLabel } from "../src/label.js";

test("short names stay on one line", () => {
  assert.deepEqual(wrapLabel("Budget"), ["Budget"]);
  assert.deepEqual(wrapLabel("Main idea"), ["Main idea"]);
});

test("longer names wrap on whole words", () => {
  assert.deepEqual(wrapLabel("Weekend trip"), ["Weekend", "trip"]);
  assert.deepEqual(wrapLabel("Snacks for the drive"), ["Snacks", "for the", "drive"]);
});

test("one very long word is split with a hyphen", () => {
  const lines = wrapLabel("Supercalifragilistic");
  assert.equal(lines[0], "Supercal-");
  assert.ok(lines.every((l) => l.length <= 11));
});

test("too much text ends in an ellipsis and never passes three lines", () => {
  const lines = wrapLabel("Call the venue about parking and the late checkout fee");
  assert.equal(lines.length, 3);
  assert.ok(lines[2].endsWith("…"));
  assert.ok(lines.every((l) => l.length <= 11));
});
