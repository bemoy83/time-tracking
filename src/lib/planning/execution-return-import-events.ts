/**
 * Signals that execution return import completed.
 * Planning data layer uses this to reload time entries and ensure UI reflects imported data.
 */

let executionReturnImportPending = false;
const listeners = new Set<() => void>();

export function notifyExecutionReturnImported(): void {
  executionReturnImportPending = true;
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore listener errors
    }
  });
}

export function clearExecutionReturnImportPending(): void {
  executionReturnImportPending = false;
}

export function hasExecutionReturnImportPending(): boolean {
  return executionReturnImportPending;
}

export function subscribeToExecutionReturnImported(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
