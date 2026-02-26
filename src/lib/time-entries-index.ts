import type { TimeEntry } from './types';

export function buildTimeEntriesByTask(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const byTask = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const existing = byTask.get(entry.taskId);
    if (existing) {
      existing.push(entry);
    } else {
      byTask.set(entry.taskId, [entry]);
    }
  }
  return byTask;
}
