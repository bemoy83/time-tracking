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

// ── Pre-defined gates for risky flows ─────────────────────────────

/**
 * Gate for import-apply: requires the import guard flag and that
 * previous imports haven't produced excessive conflicts.
 */
export const IMPORT_APPLY_GATE: RolloutGateConfig = {
  flag: 'interopStaleImportGuard',
  thresholds: [
    { event: 'interop_import_conflict', minCount: 0, maxCount: 50 },
  ],
};

/**
 * Gate for archive KPI recompute: requires the recompute flag and
 * at least one maintenance scan (ensures data integrity checked first).
 */
export const ARCHIVE_RECOMPUTE_GATE: RolloutGateConfig = {
  flag: 'archiveKpiRecompute',
  thresholds: [
    { event: 'archive_maintenance_scan', minCount: 1, maxCount: Infinity },
  ],
};

/**
 * Gate for bulk remediation apply: requires archive tools flag and
 * caps total bulk applies to prevent runaway automated changes.
 */
export const REMEDIATION_BULK_GATE: RolloutGateConfig = {
  flag: 'archiveMaintenanceTools',
  thresholds: [
    { event: 'remediation_bulk_apply', minCount: 0, maxCount: 200 },
  ],
};
