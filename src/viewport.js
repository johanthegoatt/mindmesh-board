// The board is a fixed 1200 x 700 world. Zooming and panning only move the
// window onto it (the SVG viewBox), so ideas keep their coordinates, saved
// boards stay valid, and dragging still maps through getScreenCTM.

export const WORLD = { width: 1200, height: 700 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function fullView() {
  return { x: 0, y: 0, width: WORLD.width, height: WORLD.height };
}

export function zoomOf(view) {
  return WORLD.width / view.width;
}

// Keeps the window inside the world and the zoom within limits.
export function clampView(view) {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomOf(view)));
  const width = WORLD.width / zoom;
  const height = WORLD.height / zoom;
  return {
    x: Math.min(WORLD.width - width, Math.max(0, view.x)),
    y: Math.min(WORLD.height - height, Math.max(0, view.y)),
    width,
    height,
  };
}

// Zooms by `factor` (2 is twice as close) keeping the world point `at` under
// the same spot on screen, the way maps zoom toward the cursor.
export function zoomAt(view, factor, at) {
  const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomOf(view) * factor));
  const width = WORLD.width / target;
  const height = WORLD.height / target;
  const fx = (at.x - view.x) / view.width;
  const fy = (at.y - view.y) / view.height;
  return clampView({ x: at.x - fx * width, y: at.y - fy * height, width, height });
}

// Moves the window by a drag measured in world units.
export function panBy(view, dx, dy) {
  return clampView({ ...view, x: view.x - dx, y: view.y - dy });
}

export function viewBoxString(view) {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}
