/**
 * Feature flags — localStorage-backed runtime gates for risky rollouts.
 */

export type FeatureFlagKey =
  | 'planningScenarioCompare'
  | 'calculatorMultiScenarioCards';

export type FeatureFlagState = Record<FeatureFlagKey, boolean>;

const FLAGS_STORAGE_KEY = 'featureFlags';

const DEFAULT_FLAGS: FeatureFlagState = {
  planningScenarioCompare: true,
  calculatorMultiScenarioCards: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function readStoredFlags(): Partial<FeatureFlagState> {
  try {
    const raw = localStorage.getItem(FLAGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const result: Partial<FeatureFlagState> = {};
    for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlagKey[]) {
      if (typeof parsed[key] === 'boolean') {
        result[key] = parsed[key] as boolean;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeStoredFlags(flags: FeatureFlagState): void {
  try {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Ignore storage failures.
  }
}

export function getFeatureFlags(): FeatureFlagState {
  return { ...DEFAULT_FLAGS, ...readStoredFlags() };
}

export function getFeatureFlag(flag: FeatureFlagKey): boolean {
  return getFeatureFlags()[flag];
}

export function setFeatureFlag(flag: FeatureFlagKey, enabled: boolean): void {
  const next = getFeatureFlags();
  next[flag] = enabled;
  writeStoredFlags(next);
}
