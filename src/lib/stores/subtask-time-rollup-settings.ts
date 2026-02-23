import { useSyncExternalStore } from 'react';

export type SubtaskTimeRollupMode = 'simple' | 'attribution';

const ROLLUP_MODE_KEY = 'subtaskTimeRollupMode';
const VALID_MODES: SubtaskTimeRollupMode[] = ['simple', 'attribution'];

type SubtaskTimeRollupState = {
  mode: SubtaskTimeRollupMode;
};

function readStoredMode(): SubtaskTimeRollupMode {
  try {
    const stored = localStorage.getItem(ROLLUP_MODE_KEY);
    if (stored && VALID_MODES.includes(stored as SubtaskTimeRollupMode)) {
      return stored as SubtaskTimeRollupMode;
    }
  } catch {
    // Ignore storage failures and use default mode.
  }

  return 'simple';
}

let state: SubtaskTimeRollupState = {
  mode: readStoredMode(),
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SubtaskTimeRollupState {
  return state;
}

export function getSubtaskTimeRollupMode(): SubtaskTimeRollupMode {
  return state.mode;
}

export function setSubtaskTimeRollupMode(mode: SubtaskTimeRollupMode): void {
  if (!VALID_MODES.includes(mode)) return;

  try {
    localStorage.setItem(ROLLUP_MODE_KEY, mode);
  } catch {
    // Ignore storage failures and keep in-memory mode.
  }

  if (state.mode !== mode) {
    state = { mode };
    notifyListeners();
  }
}

export function useSubtaskTimeRollupMode(): SubtaskTimeRollupMode {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshot.mode;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== ROLLUP_MODE_KEY) return;
    const mode = readStoredMode();
    if (mode !== state.mode) {
      state = { mode };
      notifyListeners();
    }
  });
}
