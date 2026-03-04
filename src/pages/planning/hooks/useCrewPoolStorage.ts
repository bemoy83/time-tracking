import type { WorkCalendarDay } from '../../../lib/planning/plan-model';

const STORAGE_KEY = 'planning-workspace-crew-pool';

interface CrewPoolStored {
  calendar: WorkCalendarDay[];
  defaultCrewSize: number;
}

export function loadCrewPoolOverride(
  sourceKey: string,
): CrewPoolStored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CrewPoolStored>;
    const stored = parsed[sourceKey];
    if (!stored || !Array.isArray(stored.calendar)) return null;
    if (typeof stored.defaultCrewSize !== 'number') return null;
    return {
      calendar: stored.calendar,
      defaultCrewSize: stored.defaultCrewSize,
    };
  } catch {
    return null;
  }
}

export function saveCrewPoolOverride(
  sourceKey: string,
  calendar: WorkCalendarDay[],
  defaultCrewSize: number,
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: Record<string, CrewPoolStored> = raw ? JSON.parse(raw) : {};
    parsed[sourceKey] = { calendar, defaultCrewSize };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Silently ignore storage errors
  }
}
