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
  | 'interop_plan_package_preview'
  | 'interop_plan_package_import'
  | 'interop_plan_package_merge'
  | 'interop_plan_package_skip'
  | 'interop_plan_package_conflict'
  | 'interop_plan_package_export'
  | 'interop_session_close'
  | 'interop_session_close_failed'
  | 'interop_execution_return_export'
  | 'interop_execution_return_preview'
  | 'interop_execution_return_preview_failed'
  | 'interop_execution_return_import'
  | 'interop_execution_return_import_failed'
  | 'wrapup_v2_open'
  | 'wrapup_v2_complete'
  | 'wrapup_v2_override_blocked_include'
  | 'event_report_v2_open'
  | 'event_report_v2_print'
  | 'schedule_tab_open'
  | 'shared_schedule_tab_open'
  | 'shared_schedule_plan_selection_change'
  | 'shared_schedule_crew_pool_edit'
  | 'shared_schedule_assignment_edit'
  | 'schedule_calendar_edit'
  | 'schedule_assignment_edit'
  | 'schedule_assistant_run'
  | 'schedule_import_defaulted'
  | 'schedule_deadline_risk_visible'
  | 'remediation_bulk_apply'
  | 'planning_lock_toggle'
  | 'archive_maintenance_scan'
  | 'archive_maintenance_archive_candidates'
  | 'archive_kpi_recompute';

export type TelemetryPayload = Record<string, string | number | boolean | null>;

export interface TelemetryRecord {
  count: number;
  lastAt: string;
  lastPayload?: TelemetryPayload;
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

export function trackTelemetryEvent(name: TelemetryEventName, payload?: TelemetryPayload): void {
  const snapshot = readTelemetry();
  const existing = snapshot[name];
  snapshot[name] = {
    count: (existing?.count ?? 0) + 1,
    lastAt: nowUtc(),
    lastPayload: payload,
  };
  writeTelemetry(snapshot);
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  return readTelemetry();
}
