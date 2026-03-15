import { beforeEach, describe, expect, it } from 'vitest';
import { getFeatureFlag, getFeatureFlags, setFeatureFlag } from './feature-flags';

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

describe('feature flags', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorage(),
      configurable: true,
    });
  });

  it('includes calculator multi-scenario cards enabled by default', () => {
    const flags = getFeatureFlags();
    expect(flags.calculatorMultiScenarioCards).toBe(true);
  });

  it('persists calculator multi-scenario cards toggle', () => {
    setFeatureFlag('calculatorMultiScenarioCards', false);
    expect(getFeatureFlag('calculatorMultiScenarioCards')).toBe(false);
  });

  it('defaults planningWorkspaceDesktop to true', () => {
    expect(getFeatureFlag('planningWorkspaceDesktop')).toBe(true);
  });

  it('disables planningWorkspaceDesktop when toggled off', () => {
    setFeatureFlag('planningWorkspaceDesktop', false);
    expect(getFeatureFlag('planningWorkspaceDesktop')).toBe(false);
  });

  it('defaults fieldPlanExecution to true', () => {
    expect(getFeatureFlag('fieldPlanExecution')).toBe(true);
  });

  it('disables fieldPlanExecution when toggled off', () => {
    setFeatureFlag('fieldPlanExecution', false);
    expect(getFeatureFlag('fieldPlanExecution')).toBe(false);
  });

  it('defaults planningScheduleV1 to true', () => {
    expect(getFeatureFlag('planningScheduleV1')).toBe(true);
  });

  it('disables planningScheduleV1 when toggled off', () => {
    setFeatureFlag('planningScheduleV1', false);
    expect(getFeatureFlag('planningScheduleV1')).toBe(false);
  });

});
