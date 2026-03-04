import { beforeEach, describe, expect, it } from 'vitest';
import { loadPlanningSession, savePlanningSession } from './usePlanningSession';

function createStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map<string, string>();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('usePlanningSession', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorage(),
      configurable: true,
    });
  });

  it('returns defaults when nothing stored', () => {
    const session = loadPlanningSession();
    expect(session).toEqual({
      selectedPlanId: null,
      activeTab: 'edit',
      selectedPlanIdsForSharedSchedule: [],
    });
  });

  it('persists and restores selectedPlanId and activeTab', () => {
    savePlanningSession({
      selectedPlanId: 'plan-1',
      activeTab: 'progress',
      selectedPlanIdsForSharedSchedule: ['plan-1', 'plan-2'],
    });
    const session = loadPlanningSession();
    expect(session.selectedPlanId).toBe('plan-1');
    expect(session.activeTab).toBe('progress');
    expect(session.selectedPlanIdsForSharedSchedule).toEqual(['plan-1', 'plan-2']);
  });

  it('merges partial updates', () => {
    savePlanningSession({ selectedPlanId: 'plan-1', activeTab: 'edit' });
    savePlanningSession({ activeTab: 'schedule' });
    const session = loadPlanningSession();
    expect(session.selectedPlanId).toBe('plan-1');
    expect(session.activeTab).toBe('schedule');
  });

  it('handles corrupted storage gracefully', () => {
    localStorage.setItem('planning-workspace-session', 'not-json');
    const session = loadPlanningSession();
    expect(session).toEqual({
      selectedPlanId: null,
      activeTab: 'edit',
      selectedPlanIdsForSharedSchedule: [],
    });
  });
});
