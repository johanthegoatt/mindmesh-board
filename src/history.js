const LIMIT = 80;

export function createHistory(initialSnapshot) {
  return {
    past: [],
    present: structuredClone(initialSnapshot),
    future: []
  };
}

export function pushSnapshot(history, snapshot) {
  history.past.push(structuredClone(history.present));
  if (history.past.length > LIMIT) {
    history.past.shift();
  }
  history.present = structuredClone(snapshot);
  history.future = [];
  return history.present;
}

export function undoSnapshot(history) {
  if (history.past.length === 0) return null;
  history.future.push(structuredClone(history.present));
  history.present = history.past.pop();
  return structuredClone(history.present);
}

export function redoSnapshot(history) {
  if (history.future.length === 0) return null;
  history.past.push(structuredClone(history.present));
  history.present = history.future.pop();
  return structuredClone(history.present);
}

