import test from "node:test";
import assert from "node:assert/strict";

import { TIPS, moodFor, stageFor } from "../src/pip.js";

test("Pip's tips follow how far along the map is", () => {
  assert.equal(stageFor(0, 0), "empty");
  assert.equal(stageFor(1, 0), "empty");
  assert.equal(stageFor(3, 0), "loose");
  assert.equal(stageFor(3, 2), "linked");
  assert.equal(stageFor(14, 9), "busy");
  assert.equal(moodFor("empty"), "sleepy");
  assert.equal(moodFor("loose"), "curious");
});

test("every stage has tips and every tip is short and plain", () => {
  for (const [stage, tips] of Object.entries(TIPS)) {
    assert.ok(tips.length >= 3, stage);
    for (const tip of tips) {
      assert.ok(tip.length <= 90, `too long: ${tip}`);
      assert.ok(!/node|vertex|graph|snapshot|sync/i.test(tip), `jargon: ${tip}`);
    }
  }
});
