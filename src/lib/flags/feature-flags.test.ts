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

  it('defaults planningWorkspaceDesktop to true', () => {
    expect(getFeatureFlag('planningWorkspaceDesktop')).toBe(true);
  });

  it('disables planningWorkspaceDesktop when toggled off', () => {
    setFeatureFlag('planningWorkspaceDesktop', false);
    expect(getFeatureFlag('planningWorkspaceDesktop')).toBe(false);
  });
});
