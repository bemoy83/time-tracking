/**
 * Lightweight client telemetry counters (quality + adoption).
 * Uses localStorage-backed aggregate counts to avoid impacting execution flow.
 */

import { nowUtc } from '../types';

const TELEMETRY_KEY = 'telemetryCounters';

export type TelemetryEventName =
  | 'calculator_save_task'
  | 'calculator_save_template'
  | 'calculator_scenario_add'
  | 'calculator_scenario_remove'
  | 'calculator_scenario_select'
  | 'interop_import_apply'
  | 'interop_import_conflict'
  | 'remediation_bulk_apply'
  | 'planning_compare_open'
  | 'planning_lock_toggle'
  | 'archive_maintenance_scan'
  | 'archive_kpi_recompute';

export interface TelemetryRecord {
  count: number;
  lastAt: string;
}

export type TelemetrySnapshot = Partial<Record<TelemetryEventName, TelemetryRecord>>;

function readTelemetry(): TelemetrySnapshot {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as TelemetrySnapshot;
  } catch {
    return {};
  }
}

function writeTelemetry(snapshot: TelemetrySnapshot): void {
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures.
  }
}

export function trackTelemetryEvent(name: TelemetryEventName): void {
  const snapshot = readTelemetry();
  const existing = snapshot[name];
  snapshot[name] = {
    count: (existing?.count ?? 0) + 1,
    lastAt: nowUtc(),
  };
  writeTelemetry(snapshot);
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  return readTelemetry();
}
