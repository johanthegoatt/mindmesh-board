// Move a map in and out of plain bulleted lists, the format every notes app,
// email client and doc editor already pastes. Nesting follows CommonMark list
// items (https://spec.commonmark.org/0.31.2/#list-items): a child is indented
// past its parent's marker; a tab counts as four spaces.

function neighbours(snapshot) {
  const map = new Map(snapshot.nodes.map((node) => [node.id, []]));
  for (const link of snapshot.links) {
    const [a, b] = link.split("::");
    if (map.has(a) && map.has(b)) {
      map.get(a).push(b);
      map.get(b).push(a);
    }
  }
  return map;
}

// Each separate cluster starts from the idea added first, which is the topic
// the map grew from, then walks outward breadth first. Ideas linked in a loop
// are listed once, under whichever branch reached them first.
export function toOutline(snapshot) {
  const adj = neighbours(snapshot);
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  // Siblings keep the order they were added in, so a pasted list copies back
  // out the same way.
  const added = new Map(snapshot.nodes.map((node, i) => [node.id, i]));
  const order = (ids) => [...ids].sort((a, b) => added.get(a) - added.get(b));
  const seen = new Set();
  const lines = [];

  const roots = snapshot.nodes.map((node) => node.id);

  for (const root of roots) {
    if (seen.has(root)) continue;
    seen.add(root);
    const children = new Map();
    const queue = [root];
    while (queue.length) {
      const id = queue.shift();
      const kids = order(adj.get(id).filter((other) => !seen.has(other)));
      for (const kid of kids) seen.add(kid);
      children.set(id, kids);
      queue.push(...kids);
    }
    const write = (id, depth) => {
      lines.push(`${"  ".repeat(depth)}- ${byId.get(id).label}`);
      for (const kid of children.get(id) || []) write(kid, depth + 1);
    };
    write(root, 0);
  }
  return lines.join("\n");
}

const MARKER = /^([-*+]|\d{1,9}[.)])\s+/;

// Returns ideas and links. Lines without a bullet still count, so a list
// typed with only indentation, or copied out of a doc, works too.
export function fromOutline(text, makeId = (i) => `idea-${i + 1}`) {
  const nodes = [];
  const links = [];
  const stack = [];
  const rows = String(text || "").split(/\r?\n/);
  for (const raw of rows) {
    if (!raw.trim()) continue;
    const expanded = raw.replace(/\t/g, "    ");
    const indent = expanded.length - expanded.trimStart().length;
    let label = expanded.trim().replace(MARKER, "").replace(/^\[[ xX]\]\s+/, "").trim();
    if (!label) continue;
    label = label.slice(0, 60);
    const id = makeId(nodes.length);
    nodes.push({ id, label });
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) links.push([stack[stack.length - 1].id, id]);
    stack.push({ id, indent });
  }
  return { nodes, links };
}
