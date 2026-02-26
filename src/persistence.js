const STORAGE_KEY = "mindmesh:board:v2";

export function loadSnapshot(storage = localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSnapshot(storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
}

