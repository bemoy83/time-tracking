/**
 * AttributionQualitySection — displays attribution quality summary counters.
 * Renders inside SettingsView after the Productivity section.
 */

import { useState, useEffect } from 'react';
import type { Task, AttributionSummary } from '../lib/types';
import { getAllTimeEntries } from '../lib/db';
import { attributeEntries } from '../lib/attribution/engine';

interface AttributionQualitySectionProps {
  tasks: Task[];
}

export function AttributionQualitySection({ tasks }: AttributionQualitySectionProps) {
  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const entries = await getAllTimeEntries();
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const { summary } = attributeEntries(entries, taskMap);

      if (cancelled) return;
      setSummary(summary);
      setIsLoading(false);
    }

    setIsLoading(true);
    load();

    return () => { cancelled = true; };
  }, [tasks]);

  if (isLoading) {
    return <p className="settings-view__empty">Loading...</p>;
  }

  if (!summary || summary.totalEntries === 0) {
    return (
      <p className="settings-view__empty">
        No time entries to analyze.
      </p>
    );
  }

  const pct = summary.totalEntries > 0
    ? Math.round((summary.attributed / summary.totalEntries) * 100)
    : 0;

  return (
    <div className="settings-view__template-list">
      <div className="settings-view__row settings-view__kpi-row">
        <div className="settings-view__template-info">
          <span className="settings-view__row-label">
            {pct}% attributed ({summary.attributed} / {summary.totalEntries})
          </span>
          <span className="settings-view__kpi-stats">
            {summary.unattributed} unattributed · {summary.ambiguous} ambiguous
            {summary.attributedPersonHours > 0 &&
              ` · ${summary.attributedPersonHours.toFixed(1)} person-hrs attributed`}
          </span>
        </div>
      </div>
    </div>
  );
}
