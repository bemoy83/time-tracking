/**
 * KPI settings — localStorage-backed configuration for KPI computation behavior.
 */

import type { OutlierHandlingMode } from '../kpi';

const OUTLIER_MODE_KEY = 'kpiOutlierHandlingMode';

const VALID_OUTLIER_MODES: OutlierHandlingMode[] = [
  'report_only',
  'exclude_from_rate',
];

export function getOutlierHandlingMode(): OutlierHandlingMode {
  try {
    const stored = localStorage.getItem(OUTLIER_MODE_KEY);
    if (stored && VALID_OUTLIER_MODES.includes(stored as OutlierHandlingMode)) {
      return stored as OutlierHandlingMode;
    }
  } catch {
    // Ignore storage failures and use default mode.
  }
  return 'report_only';
}

export function setOutlierHandlingMode(mode: OutlierHandlingMode): void {
  try {
    localStorage.setItem(OUTLIER_MODE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}
