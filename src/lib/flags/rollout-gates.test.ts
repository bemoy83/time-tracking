import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateRolloutGate,
  isRolloutGateOpen,
  IMPORT_APPLY_GATE,
  ARCHIVE_RECOMPUTE_GATE,
  REMEDIATION_BULK_GATE,
  type RolloutGateConfig,
} from './rollout-gates';

vi.mock('./feature-flags', () => ({
  getFeatureFlag: vi.fn(),
}));

vi.mock('../telemetry/telemetry', () => ({
  getTelemetrySnapshot: vi.fn(),
}));

import { getFeatureFlag } from './feature-flags';
import { getTelemetrySnapshot } from '../telemetry/telemetry';

const mockGetFeatureFlag = vi.mocked(getFeatureFlag);
const mockGetTelemetrySnapshot = vi.mocked(getTelemetrySnapshot);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFeatureFlag.mockReturnValue(true);
  mockGetTelemetrySnapshot.mockReturnValue({});
});

describe('evaluateRolloutGate', () => {
  const gate: RolloutGateConfig = {
    flag: 'interopStaleImportGuard',
    thresholds: [
      { event: 'interop_import_conflict', minCount: 0, maxCount: 10 },
    ],
  };

  it('allows when flag is on and thresholds pass', () => {
    const result = evaluateRolloutGate(gate);

    expect(result.allowed).toBe(true);
    expect(result.flagEnabled).toBe(true);
    expect(result.thresholdResults).toHaveLength(1);
    expect(result.thresholdResults[0].passed).toBe(true);
  });

  it('blocks when flag is off', () => {
    mockGetFeatureFlag.mockReturnValue(false);

    const result = evaluateRolloutGate(gate);

    expect(result.allowed).toBe(false);
    expect(result.flagEnabled).toBe(false);
  });

  it('blocks when count exceeds maxCount', () => {
    mockGetTelemetrySnapshot.mockReturnValue({
      interop_import_conflict: { count: 15, lastAt: '2024-01-01T00:00:00.000Z' },
    });

    const result = evaluateRolloutGate(gate);

    expect(result.allowed).toBe(false);
    expect(result.thresholdResults[0].passed).toBe(false);
    expect(result.thresholdResults[0].reason).toContain('exceeds maximum');
  });

  it('blocks when count is below minCount', () => {
    const gateWithMin: RolloutGateConfig = {
      flag: 'archiveKpiRecompute',
      thresholds: [
        { event: 'archive_maintenance_scan', minCount: 1, maxCount: Infinity },
      ],
    };

    const result = evaluateRolloutGate(gateWithMin);

    expect(result.allowed).toBe(false);
    expect(result.thresholdResults[0].passed).toBe(false);
    expect(result.thresholdResults[0].reason).toContain('below minimum');
  });

  it('passes when count equals minCount exactly', () => {
    mockGetTelemetrySnapshot.mockReturnValue({
      archive_maintenance_scan: { count: 1, lastAt: '2024-01-01T00:00:00.000Z' },
    });

    const gateWithMin: RolloutGateConfig = {
      flag: 'archiveKpiRecompute',
      thresholds: [
        { event: 'archive_maintenance_scan', minCount: 1, maxCount: Infinity },
      ],
    };

    const result = evaluateRolloutGate(gateWithMin);

    expect(result.allowed).toBe(true);
    expect(result.thresholdResults[0].passed).toBe(true);
  });

  it('evaluates multiple thresholds — all must pass', () => {
    const multiGate: RolloutGateConfig = {
      flag: 'archiveMaintenanceTools',
      thresholds: [
        { event: 'archive_maintenance_scan', minCount: 1, maxCount: Infinity },
        { event: 'remediation_bulk_apply', minCount: 0, maxCount: 100 },
      ],
    };

    // First threshold fails (no scan count)
    const result = evaluateRolloutGate(multiGate);

    expect(result.allowed).toBe(false);
    expect(result.thresholdResults[0].passed).toBe(false);
    expect(result.thresholdResults[1].passed).toBe(true);
  });

  it('allows flag-only gate with empty thresholds', () => {
    const flagOnlyGate: RolloutGateConfig = {
      flag: 'planningScenarioCompare',
      thresholds: [],
    };

    const result = evaluateRolloutGate(flagOnlyGate);

    expect(result.allowed).toBe(true);
    expect(result.thresholdResults).toHaveLength(0);
  });
});

describe('isRolloutGateOpen', () => {
  it('returns true when gate is allowed', () => {
    expect(isRolloutGateOpen({ flag: 'planningScenarioCompare', thresholds: [] })).toBe(true);
  });

  it('returns false when flag is off', () => {
    mockGetFeatureFlag.mockReturnValue(false);
    expect(isRolloutGateOpen({ flag: 'planningScenarioCompare', thresholds: [] })).toBe(false);
  });
});

describe('pre-defined gates', () => {
  it('IMPORT_APPLY_GATE blocks on excessive conflicts', () => {
    mockGetTelemetrySnapshot.mockReturnValue({
      interop_import_conflict: { count: 51, lastAt: '2024-01-01T00:00:00.000Z' },
    });

    expect(isRolloutGateOpen(IMPORT_APPLY_GATE)).toBe(false);
  });

  it('IMPORT_APPLY_GATE allows when conflicts are within bounds', () => {
    mockGetTelemetrySnapshot.mockReturnValue({
      interop_import_conflict: { count: 5, lastAt: '2024-01-01T00:00:00.000Z' },
    });

    expect(isRolloutGateOpen(IMPORT_APPLY_GATE)).toBe(true);
  });

  it('ARCHIVE_RECOMPUTE_GATE requires at least one maintenance scan', () => {
    expect(isRolloutGateOpen(ARCHIVE_RECOMPUTE_GATE)).toBe(false);

    mockGetTelemetrySnapshot.mockReturnValue({
      archive_maintenance_scan: { count: 1, lastAt: '2024-01-01T00:00:00.000Z' },
    });

    expect(isRolloutGateOpen(ARCHIVE_RECOMPUTE_GATE)).toBe(true);
  });

  it('REMEDIATION_BULK_GATE caps total bulk applies', () => {
    mockGetTelemetrySnapshot.mockReturnValue({
      remediation_bulk_apply: { count: 201, lastAt: '2024-01-01T00:00:00.000Z' },
    });

    expect(isRolloutGateOpen(REMEDIATION_BULK_GATE)).toBe(false);
  });
});
