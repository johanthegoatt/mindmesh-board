import {
  addNode,
  connectNodes,
  createBoardState,
  exportMarkdown,
  importMarkdown,
  mergeRemoteState,
  moveNode,
  removeNode,
  renameNode,
  restoreSnapshot,
  serializeState
} from "./src/boardState.js";
import { createHistory, pushSnapshot, redoSnapshot, undoSnapshot } from "./src/history.js";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "./src/persistence.js";
import { forceLayout } from "./src/layout.js";
import { createSyncBus } from "./src/syncBus.js";

const boardSvg = document.getElementById("board");
const addNodeBtn = document.getElementById("add-node-btn");
const renameNodeBtn = document.getElementById("rename-node-btn");
const deleteNodeBtn = document.getElementById("delete-node-btn");
const clearSelectionBtn = document.getElementById("clear-selection-btn");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const newBoardBtn = document.getElementById("new-board-btn");
const exportBtn = document.getElementById("export-md-btn");
const importBtn = document.getElementById("import-md-btn");
const importFileInput = document.getElementById("import-md-file");
const statusEl = document.getElementById("status");
const tidyBtn = document.getElementById("tidy-btn");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const seedSnapshot = loadSnapshot();
let state = createBoardState(seedSnapshot || {});
let selectedNodeId = null;
let dragNodeId = null;
let dragMoved = false;

const syncBus = createSyncBus();
const sessionId = crypto.randomUUID();
const history = createHistory(serializeState(state));

function updateStatus(message) {
  statusEl.textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointerToBoard(event) {
  const point = boardSvg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(boardSvg.getScreenCTM().inverse());
  return {
    x: clamp(transformed.x, 46, 1154),
    y: clamp(transformed.y, 46, 654)
  };
}

function render() {
  const snapshot = serializeState(state);
  boardSvg.innerHTML = "";

  for (const link of snapshot.links) {
    const [a, b] = link.split("::");
    const left = state.nodes.get(a);
    const right = state.nodes.get(b);
    if (!left || !right) continue;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("link-line");
    line.setAttribute("x1", left.x);
    line.setAttribute("y1", left.y);
    line.setAttribute("x2", right.x);
    line.setAttribute("y2", right.y);
    boardSvg.append(line);
  }

  for (const node of snapshot.nodes) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("node");
    if (node.id === selectedNodeId) {
      group.classList.add("selected");
    }
    group.dataset.nodeId = node.id;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
    circle.setAttribute("r", "36");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", node.x);
    text.setAttribute("y", node.y);
    text.textContent = node.label;

    group.append(circle, text);
    boardSvg.append(group);
  }

  updateStatus(`Nodes: ${snapshot.nodes.length} | Links: ${snapshot.links.length} | Version: ${snapshot.version}`);
}

function publishSnapshot() {
  const snapshot = serializeState(state);
  syncBus.publish({
    sender: sessionId,
    snapshot
  });
  return snapshot;
}

function resetHistory(snapshot) {
  history.past = [];
  history.present = structuredClone(snapshot);
  history.future = [];
}

function persistAndRecord(message, publish = true) {
  const snapshot = serializeState(state);
  pushSnapshot(history, snapshot);
  saveSnapshot(snapshot);
  if (publish) {
    syncBus.publish({
      sender: sessionId,
      snapshot
    });
  }
  if (message) {
    updateStatus(`${message} | Nodes: ${snapshot.nodes.length} | Links: ${snapshot.links.length} | Version: ${snapshot.version}`);
  }
}

function applySnapshot(snapshot, message, publish = true) {
  state = restoreSnapshot(state, snapshot);
  history.present = serializeState(state);
  saveSnapshot(history.present);
  render();
  if (publish) {
    publishSnapshot();
  }
  if (message) {
    updateStatus(message);
  }
}

function addRandomNode() {
  const count = state.nodes.size + 1;
  addNode(state, {
    label: `Idea ${count}`,
    x: 90 + Math.random() * 980,
    y: 90 + Math.random() * 510
  });
  persistAndRecord(`Added Idea ${count}`);
  render();
}

addNodeBtn.addEventListener("click", addRandomNode);

renameNodeBtn.addEventListener("click", () => {
  if (!selectedNodeId) {
    updateStatus("Select a node before renaming.");
    return;
  }
  const current = state.nodes.get(selectedNodeId);
  if (!current) return;

  const next = window.prompt("Rename node", current.label);
  if (next == null) return;

  try {
    renameNode(state, selectedNodeId, next);
    persistAndRecord(`Renamed node to "${next.trim()}"`);
    render();
  } catch {
    updateStatus("Rename failed. Label cannot be empty.");
  }
});

deleteNodeBtn.addEventListener("click", () => {
  if (!selectedNodeId) {
    updateStatus("Select a node before deleting.");
    return;
  }

  try {
    removeNode(state, selectedNodeId);
    persistAndRecord(`Deleted node ${selectedNodeId}`);
    selectedNodeId = null;
    render();
  } catch {
    updateStatus("Delete failed.");
  }
});

function tidyUp() {
  if (state.nodes.size < 2) {
    updateStatus("Add a few ideas first, then tidy up.");
    return;
  }
  const targets = forceLayout(serializeState(state));
  const starts = new Map(Array.from(state.nodes.values(), (node) => [node.id, { x: node.x, y: node.y }]));
  const finish = () => {
    for (const [id, target] of Object.entries(targets)) {
      if (state.nodes.has(id)) moveNode(state, id, target.x, target.y);
    }
    persistAndRecord("Tidied up: linked ideas sit together, nothing overlaps");
    render();
  };
  if (reduceMotion.matches) {
    finish();
    return;
  }
  const began = performance.now();
  const step = (now) => {
    const t = Math.min((now - began) / 450, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    for (const [id, target] of Object.entries(targets)) {
      const node = state.nodes.get(id);
      const start = starts.get(id);
      if (!node || !start) continue;
      node.x = start.x + (target.x - start.x) * ease;
      node.y = start.y + (target.y - start.y) * ease;
    }
    render();
    if (t < 1) requestAnimationFrame(step);
    else finish();
  };
  requestAnimationFrame(step);
}

tidyBtn.addEventListener("click", tidyUp);

clearSelectionBtn.addEventListener("click", () => {
  selectedNodeId = null;
  render();
});

undoBtn.addEventListener("click", () => {
  const previous = undoSnapshot(history);
  if (!previous) {
    updateStatus("Nothing to undo.");
    return;
  }
  selectedNodeId = null;
  applySnapshot(previous, "Undo applied.");
});

redoBtn.addEventListener("click", () => {
  const next = redoSnapshot(history);
  if (!next) {
    updateStatus("Nothing to redo.");
    return;
  }
  selectedNodeId = null;
  applySnapshot(next, "Redo applied.");
});

newBoardBtn.addEventListener("click", () => {
  state = createBoardState();
  selectedNodeId = null;
  clearSnapshot();
  const snapshot = serializeState(state);
  resetHistory(snapshot);
  saveSnapshot(snapshot);
  render();
  publishSnapshot();
  updateStatus("Started a new board.");
});

exportBtn.addEventListener("click", () => {
  const markdown = exportMarkdown(state);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mindmesh-export.md";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  updateStatus("Exported board as Markdown.");
});

importBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
  const [file] = importFileInput.files || [];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = importMarkdown(text);
    const snapshot = serializeState(createBoardState(imported));
    state = createBoardState(snapshot);
    selectedNodeId = null;
    saveSnapshot(snapshot);
    resetHistory(snapshot);
    render();
    publishSnapshot();
    updateStatus(`Imported board from ${file.name}.`);
  } catch {
    updateStatus("Import failed. Ensure the file uses MindMesh Markdown export format.");
  } finally {
    importFileInput.value = "";
  }
});

boardSvg.addEventListener("pointerdown", (event) => {
  const group = event.target.closest(".node");
  if (!group) return;
  const nodeId = group.dataset.nodeId;
  dragMoved = false;

  if (selectedNodeId && selectedNodeId !== nodeId) {
    connectNodes(state, selectedNodeId, nodeId);
    selectedNodeId = nodeId;
    persistAndRecord(`Connected nodes on ${nodeId}`);
    render();
    return;
  }

  selectedNodeId = nodeId;
  dragNodeId = nodeId;
  boardSvg.setPointerCapture(event.pointerId);
  render();
});

boardSvg.addEventListener("pointermove", (event) => {
  if (!dragNodeId) return;
  const next = pointerToBoard(event);
  moveNode(state, dragNodeId, next.x, next.y);
  dragMoved = true;
  render();
});

boardSvg.addEventListener("pointerup", (event) => {
  if (!dragNodeId) return;
  const movedNodeId = dragNodeId;
  dragNodeId = null;
  boardSvg.releasePointerCapture(event.pointerId);
  if (dragMoved) {
    persistAndRecord(`Moved ${movedNodeId}`);
  }
});

syncBus.subscribe((packet) => {
  if (!packet || packet.sender === sessionId || !packet.snapshot) return;
  mergeRemoteState(state, packet.snapshot);
  const snapshot = serializeState(state);
  pushSnapshot(history, snapshot);
  saveSnapshot(snapshot);
  render();
  updateStatus("Merged remote board update.");
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const withMeta = event.ctrlKey || event.metaKey;

  if (withMeta && key === "z" && !event.shiftKey) {
    event.preventDefault();
    undoBtn.click();
    return;
  }

  if ((withMeta && key === "y") || (withMeta && key === "z" && event.shiftKey)) {
    event.preventDefault();
    redoBtn.click();
    return;
  }

  if (key === "delete" || key === "backspace") {
    if (!selectedNodeId) return;
    event.preventDefault();
    deleteNodeBtn.click();
    return;
  }

  if (key === "t" && !withMeta) {
    event.preventDefault();
    tidyUp();
    return;
  }

  if (key === "n" && !withMeta) {
    event.preventDefault();
    addNodeBtn.click();
  }
});

if (!seedSnapshot) {
  addRandomNode();
  addRandomNode();
}
render();
