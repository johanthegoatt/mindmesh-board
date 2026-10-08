// Placement and focus moves for keyboard-only mapping. In the keystroke-level
// model (Card, Moran & Newell, CACM 1980) a key press costs about 0.2 s and
// pointing with a mouse about 1.1 s, so adding and naming ideas from the keys
// keeps the thought moving instead of stopping to aim.

const GAP = 130;
const MIN_SPACE = 82;

function clampPoint(x, y, bounds) {
  return {
    x: Math.min(bounds.width - bounds.margin, Math.max(bounds.margin, x)),
    y: Math.min(bounds.height - bounds.margin, Math.max(bounds.margin, y))
  };
}

// Pick a free spot on a ring around the parent. The first try points away
// from the parent's other links, so a branch keeps growing outward.
export function placeChild(snapshot, parentId, bounds = { width: 1200, height: 700, margin: 46 }) {
  const parent = snapshot.nodes.find((node) => node.id === parentId);
  if (!parent) throw new Error(`Node not found: ${parentId}`);

  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let ax = 0;
  let ay = 0;
  for (const link of snapshot.links) {
    const [a, b] = link.split("::");
    const other = a === parentId ? b : b === parentId ? a : null;
    const node = other && byId.get(other);
    if (!node) continue;
    ax += node.x - parent.x;
    ay += node.y - parent.y;
  }
  const away = ax === 0 && ay === 0 ? 0 : Math.atan2(-ay, -ax);

  const free = (p) => snapshot.nodes.every((node) => Math.hypot(node.x - p.x, node.y - p.y) >= MIN_SPACE);
  for (const ring of [GAP, GAP * 1.6, GAP * 2.2]) {
    for (let step = 0; step < 16; step += 1) {
      const turn = Math.ceil(step / 2) * (step % 2 ? 1 : -1) * (Math.PI / 8);
      const angle = away + turn;
      const p = clampPoint(parent.x + Math.cos(angle) * ring, parent.y + Math.sin(angle) * ring, bounds);
      if (free(p)) return { x: Math.round(p.x), y: Math.round(p.y) };
    }
  }
  const p = clampPoint(parent.x + GAP, parent.y, bounds);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

const DIRECTIONS = {
  arrowright: [1, 0],
  arrowleft: [-1, 0],
  arrowdown: [0, 1],
  arrowup: [0, -1]
};

// Arrow keys jump to the closest idea inside a 90 degree cone in that
// direction. Distance off the arrow's line counts double so the jump feels
// straight rather than diagonal.
export function nearestInDirection(snapshot, fromId, key) {
  const dir = DIRECTIONS[String(key).toLowerCase()];
  const from = snapshot.nodes.find((node) => node.id === fromId);
  if (!dir || !from) return null;
  let best = null;
  let bestScore = Infinity;
  for (const node of snapshot.nodes) {
    if (node.id === fromId) continue;
    const dx = node.x - from.x;
    const dy = node.y - from.y;
    const along = dx * dir[0] + dy * dir[1];
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    if (along <= 0 || across > along) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = node.id;
    }
  }
  return best;
}
