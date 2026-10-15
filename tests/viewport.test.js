import test from "node:test";
import assert from "node:assert/strict";
import { clampView, fullView, panBy, zoomAt, zoomOf, MAX_ZOOM } from "../src/viewport.js";

test("zooming keeps the point under the cursor in place", () => {
  const view = zoomAt(fullView(), 2, { x: 300, y: 200 });
  assert.equal(zoomOf(view), 2);
  // 300 was a quarter of the way across; it still is.
  assert.equal((300 - view.x) / view.width, 0.25);
  assert.ok(Math.abs((200 - view.y) / view.height - 200 / 700) < 1e-12);
});

test("zoom stays between the whole board and four times closer", () => {
  assert.equal(zoomOf(zoomAt(fullView(), 0.25, { x: 600, y: 350 })), 1);
  let view = fullView();
  for (let i = 0; i < 10; i += 1) view = zoomAt(view, 2, { x: 600, y: 350 });
  assert.equal(zoomOf(view), MAX_ZOOM);
});

test("the window never leaves the board", () => {
  const close = zoomAt(fullView(), 2, { x: 1150, y: 650 });
  assert.ok(close.x + close.width <= 1200 && close.y + close.height <= 700);
  const panned = panBy(close, -5000, -5000);
  assert.equal(panned.x + panned.width, 1200);
  assert.equal(panned.y + panned.height, 700);
  assert.deepEqual(panBy(fullView(), 100, 100), fullView());
});

test("clampView repairs a window that is too large or offset", () => {
  assert.deepEqual(clampView({ x: -50, y: 20, width: 5000, height: 9000 }), fullView());
});
