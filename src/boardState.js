const DEFAULT_X = 200;
const DEFAULT_Y = 140;
// Tombstones are kept so a delete can win against an older copy of the node
// arriving from another tab. Only the newest ones are kept.
const TOMBSTONE_LIMIT = 500;

function cloneNode(node) {
  return {
    id: node.id,
    label: node.label,
    x: node.x,
    y: node.y,
    updatedAt: node.updatedAt
  };
}

function canonicalLink(a, b) {
  return [a, b].sort().join("::");
}

function hasNode(state, nodeId) {
  return state.nodes.has(nodeId);
}

export function createBoardState(seed = {}) {
  const state = {
    nodes: new Map(),
    links: new Set(),
    deleted: new Map(),
    version: Number(seed.version || 0)
  };

  for (const entry of seed.deleted || []) {
    const [id, at] = Array.isArray(entry) ? entry : [];
    if (id != null && Number.isFinite(at)) state.deleted.set(String(id), at);
  }

  for (const node of seed.nodes || []) {
    const safeNode = {
      id: String(node.id),
      label: String(node.label || node.id),
      x: Number.isFinite(node.x) ? node.x : DEFAULT_X,
      y: Number.isFinite(node.y) ? node.y : DEFAULT_Y,
      updatedAt: Number.isFinite(node.updatedAt) ? node.updatedAt : Date.now()
    };
    state.nodes.set(safeNode.id, safeNode);
  }

  for (const link of seed.links || []) {
    const [a, b] = String(link).split("::");
    if (!a || !b) continue;
    if (!state.nodes.has(a) || !state.nodes.has(b) || a === b) continue;
    state.links.add(canonicalLink(a, b));
  }

  return state;
}

export function addNode(state, nodeInput = {}) {
  const nodeId = String(nodeInput.id || `node-${crypto.randomUUID().slice(0, 8)}`);
  if (hasNode(state, nodeId)) {
    throw new Error(`Node already exists: ${nodeId}`);
  }

  const node = {
    id: nodeId,
    label: String(nodeInput.label || `Idea ${state.nodes.size + 1}`),
    x: Number.isFinite(nodeInput.x) ? nodeInput.x : DEFAULT_X,
    y: Number.isFinite(nodeInput.y) ? nodeInput.y : DEFAULT_Y,
    updatedAt: Date.now()
  };

  state.nodes.set(node.id, node);
  state.version += 1;
  return cloneNode(node);
}

export function moveNode(state, nodeId, nextX, nextY) {
  const node = state.nodes.get(String(nodeId));
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  node.x = Number.isFinite(nextX) ? nextX : node.x;
  node.y = Number.isFinite(nextY) ? nextY : node.y;
  node.updatedAt = Date.now();
  state.version += 1;
  return cloneNode(node);
}

export function renameNode(state, nodeId, nextLabel) {
  const node = state.nodes.get(String(nodeId));
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const label = String(nextLabel || "").trim();
  if (!label) {
    throw new Error("Node label cannot be empty.");
  }

  node.label = label;
  node.updatedAt = Date.now();
  state.version += 1;
  return cloneNode(node);
}

function dropNode(state, id) {
  state.nodes.delete(id);
  state.links = new Set(
    Array.from(state.links.values()).filter((link) => {
      const [a, b] = link.split("::");
      return a !== id && b !== id;
    })
  );
}

function markDeleted(state, id, at) {
  const prev = state.deleted.get(id);
  state.deleted.set(id, Math.max(prev || 0, at));
  while (state.deleted.size > TOMBSTONE_LIMIT) {
    let oldestId = null;
    let oldestAt = Infinity;
    for (const [key, value] of state.deleted) {
      if (value < oldestAt) {
        oldestAt = value;
        oldestId = key;
      }
    }
    state.deleted.delete(oldestId);
  }
}

export function removeNode(state, nodeId, now = Date.now()) {
  const id = String(nodeId);
  if (!state.nodes.has(id)) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  dropNode(state, id);
  markDeleted(state, id, now);
  state.version += 1;
  return id;
}

// Undo and redo swap in an old snapshot. Anything that comes back or goes away
// is stamped with the current time so other tabs treat it as a fresh edit
// instead of an old one that their own newer copy should overwrite.
export function restoreSnapshot(current, snapshot, now = Date.now()) {
  const next = createBoardState(snapshot);
  for (const [id, at] of current.deleted) {
    if (!next.nodes.has(id)) markDeleted(next, id, at);
  }
  for (const node of next.nodes.values()) {
    if (!current.nodes.has(node.id)) {
      node.updatedAt = now;
      next.deleted.delete(node.id);
    }
  }
  for (const id of current.nodes.keys()) {
    if (!next.nodes.has(id)) markDeleted(next, id, now);
  }
  next.version = Math.max(current.version, next.version) + 1;
  return next;
}

export function connectNodes(state, leftId, rightId) {
  const a = String(leftId);
  const b = String(rightId);

  if (a === b) {
    throw new Error("Cannot connect node to itself.");
  }

  if (!hasNode(state, a) || !hasNode(state, b)) {
    throw new Error("Both nodes must exist before linking.");
  }

  const key = canonicalLink(a, b);
  if (!state.links.has(key)) {
    state.links.add(key);
    state.version += 1;
  }

  return key;
}

export function serializeState(state) {
  return {
    version: state.version,
    nodes: Array.from(state.nodes.values()).map(cloneNode),
    links: Array.from(state.links.values()),
    deleted: Array.from(state.deleted.entries())
  };
}

export function mergeRemoteState(localState, remoteSnapshot) {
  const remote = createBoardState(remoteSnapshot);

  for (const [id, at] of remote.deleted) {
    const localNode = localState.nodes.get(id);
    if (localNode && localNode.updatedAt <= at) dropNode(localState, id);
    markDeleted(localState, id, at);
  }

  for (const remoteNode of remote.nodes.values()) {
    const localNode = localState.nodes.get(remoteNode.id);
    const deletedAt = localState.deleted.get(remoteNode.id);
    if (deletedAt != null && deletedAt >= remoteNode.updatedAt) continue;
    if (deletedAt != null) localState.deleted.delete(remoteNode.id);
    if (!localNode || remoteNode.updatedAt >= localNode.updatedAt) {
      localState.nodes.set(remoteNode.id, cloneNode(remoteNode));
    }
  }

  for (const link of remote.links.values()) {
    const [a, b] = link.split("::");
    if (localState.nodes.has(a) && localState.nodes.has(b)) {
      localState.links.add(link);
    }
  }

  localState.version = Math.max(localState.version, Number(remoteSnapshot.version || 0));
  return serializeState(localState);
}

export function exportMarkdown(state) {
  const snapshot = serializeState(state);
  const lines = [];
  lines.push("# MindMesh Snapshot");
  lines.push("");
  lines.push(`Version: ${snapshot.version}`);
  lines.push("");
  lines.push("## Nodes");

  const nodes = [...snapshot.nodes].sort((left, right) => left.id.localeCompare(right.id));
  for (const node of nodes) {
    lines.push(`- ${node.id}|${node.label.replace(/\|/g, "/")}|${node.x}|${node.y}|${node.updatedAt}`);
  }

  lines.push("");
  lines.push("## Links");
  const links = [...snapshot.links].sort();
  for (const link of links) {
    lines.push(`- ${link}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function importMarkdown(markdown) {
  const text = String(markdown || "");
  const lines = text.split(/\r?\n/);
  const nodes = [];
  const links = [];
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^##\s+nodes$/i.test(line)) {
      section = "nodes";
      continue;
    }
    if (/^##\s+links$/i.test(line)) {
      section = "links";
      continue;
    }
    if (!line.startsWith("- ")) {
      continue;
    }

    const payload = line.slice(2).trim();
    if (section === "nodes") {
      const [id, label, x, y, updatedAt] = payload.split("|");
      if (!id || !label) continue;
      nodes.push({
        id: String(id),
        label: String(label),
        x: Number(x),
        y: Number(y),
        updatedAt: Number(updatedAt)
      });
      continue;
    }

    if (section === "links") {
      if (!payload.includes("::")) continue;
      links.push(payload);
    }
  }

  return {
    version: 0,
    nodes,
    links
  };
}
