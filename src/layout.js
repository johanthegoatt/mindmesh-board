// Fruchterman & Reingold, "Graph Drawing by Force-directed Placement",
// Software: Practice and Experience 21(11), 1991. Every pair of ideas pushes
// apart with k^2/d, every link pulls its two ends together with d^2/k, and a
// temperature that cools each round caps how far an idea can move.

const RADIUS = 36;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forceLayout(snapshot, options = {}) {
  const width = options.width ?? 1200;
  const height = options.height ?? 700;
  const margin = options.margin ?? 56;
  const iterations = options.iterations ?? 300;
  const random = mulberry32(options.seed ?? 7);

  const nodes = snapshot.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, dx: 0, dy: 0 }));
  if (nodes.length === 0) return {};
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const edges = [];
  for (const link of snapshot.links) {
    const [a, b] = link.split("::");
    if (index.has(a) && index.has(b)) edges.push([index.get(a), index.get(b)]);
  }

  const area = (width - 2 * margin) * (height - 2 * margin);
  const k = 0.75 * Math.sqrt(area / nodes.length);
  let temperature = width / 10;
  const cooling = temperature / (iterations + 1);

  for (let round = 0; round < iterations; round += 1) {
    for (const node of nodes) {
      node.dx = 0;
      node.dy = 0;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        let ddx = nodes[i].x - nodes[j].x;
        let ddy = nodes[i].y - nodes[j].y;
        let dist = Math.hypot(ddx, ddy);
        if (dist < 0.01) {
          ddx = random() - 0.5;
          ddy = random() - 0.5;
          dist = Math.hypot(ddx, ddy);
        }
        const push = (k * k) / dist;
        nodes[i].dx += (ddx / dist) * push;
        nodes[i].dy += (ddy / dist) * push;
        nodes[j].dx -= (ddx / dist) * push;
        nodes[j].dy -= (ddy / dist) * push;
      }
    }

    for (const [a, b] of edges) {
      const ddx = nodes[a].x - nodes[b].x;
      const ddy = nodes[a].y - nodes[b].y;
      const dist = Math.max(Math.hypot(ddx, ddy), 0.01);
      const pull = (dist * dist) / k;
      nodes[a].dx -= (ddx / dist) * pull;
      nodes[a].dy -= (ddy / dist) * pull;
      nodes[b].dx += (ddx / dist) * pull;
      nodes[b].dy += (ddy / dist) * pull;
    }

    // A weak pull to the middle keeps separate clusters on screen.
    for (const node of nodes) {
      node.dx += (width / 2 - node.x) * 0.02;
      node.dy += (height / 2 - node.y) * 0.02;
      const step = Math.hypot(node.dx, node.dy);
      if (step > 0) {
        const capped = Math.min(step, temperature);
        node.x += (node.dx / step) * capped;
        node.y += (node.dy / step) * capped;
      }
      node.x = Math.min(width - margin, Math.max(margin, node.x));
      node.y = Math.min(height - margin, Math.max(margin, node.y));
    }
    temperature = Math.max(temperature - cooling, 1);
  }

  separate(nodes, width, height, margin);

  const positions = {};
  for (const node of nodes) {
    positions[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
  }
  return positions;
}

// Final pass so no two circles overlap, even on a crowded board.
function separate(nodes, width, height, margin) {
  const gap = RADIUS * 2 + 8;
  for (let pass = 0; pass < 50; pass += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const ddx = nodes[j].x - nodes[i].x;
        const ddy = nodes[j].y - nodes[i].y;
        const dist = Math.hypot(ddx, ddy) || 0.01;
        if (dist >= gap) continue;
        const shift = (gap - dist) / 2;
        const ux = ddx / dist || 1;
        const uy = ddy / dist;
        nodes[i].x -= ux * shift;
        nodes[i].y -= uy * shift;
        nodes[j].x += ux * shift;
        nodes[j].y += uy * shift;
        moved = true;
      }
    }
    for (const node of nodes) {
      node.x = Math.min(width - margin, Math.max(margin, node.x));
      node.y = Math.min(height - margin, Math.max(margin, node.y));
    }
    if (!moved) break;
  }
}

export function countCrossings(snapshot, positions) {
  const segments = snapshot.links.map((link) => link.split("::"));
  let crossings = 0;
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const [a, b] = segments[i];
      const [c, d] = segments[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (intersects(positions[a], positions[b], positions[c], positions[d])) crossings += 1;
    }
  }
  return crossings;
}

function orient(p, q, r) {
  return Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
}

function intersects(p1, p2, p3, p4) {
  return orient(p1, p2, p3) * orient(p1, p2, p4) < 0 && orient(p3, p4, p1) * orient(p3, p4, p2) < 0;
}
