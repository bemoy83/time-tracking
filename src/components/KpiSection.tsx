/**
 * KpiSection — displays productivity KPIs grouped by Work Type.
 * Renders inside SettingsView.
 */

import { useState, useEffect } from 'react';
import {
  Task,
  WORK_CATEGORY_LABELS,
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
  formatProductivity,
} from '../lib/types';
import { computeWorkTypeKpis, WorkTypeKpi } from '../lib/kpi';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { pluralize } from '../lib/utils/pluralize';

interface KpiSectionProps {
  tasks: Task[];
}

export function KpiSection({ tasks }: KpiSectionProps) {
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Only fetch entries for completed tasks with work data
      const qualifying = tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.workCategory != null &&
          t.workUnit != null &&
          t.workQuantity != null &&
          t.workQuantity > 0
      );

      const { entriesByTask } = await buildAttributedRollup(qualifying, tasks);

      if (cancelled) return;

      const results = computeWorkTypeKpis(tasks, entriesByTask);
      setKpis(results);
      setIsLoading(false);
    }

    setIsLoading(true);
    load();

    return () => {
      cancelled = true;
    };
  }, [tasks]);

  if (isLoading) {
    return <p className="settings-view__empty">Loading...</p>;
  }

  if (kpis.length === 0) {
    return (
      <p className="settings-view__empty">
        No completed tasks with work data yet.
      </p>
    );
  }

  return (
    <div className="settings-view__template-list">
      {kpis.map((kpi) => {
        const { key } = kpi;
        const label = [
          WORK_CATEGORY_LABELS[key.workCategory],
          WORK_UNIT_LABELS[key.workUnit],
          key.buildPhase != null ? BUILD_PHASE_LABELS[key.buildPhase] : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <div
            key={`${key.workCategory}:${key.workUnit}:${key.buildPhase ?? ''}`}
            className="settings-view__row settings-view__kpi-row"
          >
            <div className="settings-view__template-info">
              <span className="settings-view__row-label">{label}</span>
              <span className="settings-view__kpi-stats">
                {formatProductivity(kpi.avgProductivity, key.workUnit)}
                {' · '}
                {pluralize(kpi.sampleCount, 'task')}
                {' · '}
                {Math.round(kpi.totalQuantity)} {WORK_UNIT_LABELS[key.workUnit]} completed
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
