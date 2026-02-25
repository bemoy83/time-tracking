/**
 * Rollout gates — block/allow risky flows based on production quality metrics.
 *
 * Gates compose feature flags with telemetry-derived quality signals.
 * A gated flow is allowed only when:
 *   1. Its feature flag is enabled, AND
 *   2. All quality metric thresholds are met.
 */

import { getFeatureFlag, type FeatureFlagKey } from './feature-flags';
import { getTelemetrySnapshot, type TelemetryEventName, type TelemetrySnapshot } from '../telemetry/telemetry';

export interface QualityThreshold {
  /** Telemetry event whose count is checked. */
  event: TelemetryEventName;
  /** Minimum event count required to pass. 0 = no minimum. */
  minCount: number;
  /** Maximum event count allowed. Infinity = no maximum. */
  maxCount: number;
}

export interface RolloutGateConfig {
  /** Feature flag that must be enabled. */
  flag: FeatureFlagKey;
  /** Quality thresholds that must all pass. Empty = flag-only gate. */
  thresholds: QualityThreshold[];
}

export interface RolloutGateResult {
  allowed: boolean;
  flagEnabled: boolean;
  thresholdResults: ThresholdResult[];
}

export interface ThresholdResult {
  event: TelemetryEventName;
  count: number;
  passed: boolean;
  reason: string;
}

function evaluateThreshold(
  threshold: QualityThreshold,
  snapshot: TelemetrySnapshot,
): ThresholdResult {
  const count = snapshot[threshold.event]?.count ?? 0;

  if (count < threshold.minCount) {
    return {
      event: threshold.event,
      count,
      passed: false,
      reason: `count ${count} below minimum ${threshold.minCount}`,
    };
  }

  if (count > threshold.maxCount) {
    return {
      event: threshold.event,
      count,
      passed: false,
      reason: `count ${count} exceeds maximum ${threshold.maxCount}`,
    };
  }

  return {
    event: threshold.event,
    count,
    passed: true,
    reason: 'ok',
  };
}

/**
 * Evaluate a rollout gate: flag must be on AND all quality thresholds must pass.
 */
export function evaluateRolloutGate(config: RolloutGateConfig): RolloutGateResult {
  const flagEnabled = getFeatureFlag(config.flag);
  const snapshot = getTelemetrySnapshot();

  const thresholdResults = config.thresholds.map((t) => evaluateThreshold(t, snapshot));
  const allThresholdsPassed = thresholdResults.every((r) => r.passed);

  return {
    allowed: flagEnabled && allThresholdsPassed,
    flagEnabled,
    thresholdResults,
  };
}

/**
 * Quick boolean check: is this gate open?
 */
export function isRolloutGateOpen(config: RolloutGateConfig): boolean {
  return evaluateRolloutGate(config).allowed;
}
