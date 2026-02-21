/**
 * AttributionQualitySection — displays attribution quality summary counters
 * with per-reason breakdown of excluded hours.
 * Renders inside SettingsView after the Productivity section.
 */

import { useState, useEffect } from 'react';
import type { Task, AttributionSummary, AttributionReason, AttributedEntry, AttributionPolicy } from '../lib/types';
import { DEFAULT_ATTRIBUTION_POLICY } from '../lib/types';
import { getAllTimeEntries } from '../lib/db';
import { attributeEntries } from '../lib/attribution/engine';

/** Per-reason aggregation for excluded entries. */
interface ReasonBreakdown {
  reason: AttributionReason;
  entryCount: number;
  personHours: number;
}

/** Aggregate excluded entries by reason. */
export function computeReasonBreakdown(results: AttributedEntry[]): ReasonBreakdown[] {
  const map = new Map<AttributionReason, { entryCount: number; personHours: number }>();

  for (const r of results) {
    if (r.status === 'attributed') continue;
    const existing = map.get(r.reason);
    if (existing) {
      existing.entryCount += 1;
      existing.personHours += r.personHours;
    } else {
      map.set(r.reason, { entryCount: 1, personHours: r.personHours });
    }
  }

  const breakdowns: ReasonBreakdown[] = [];
  for (const [reason, data] of map) {
    breakdowns.push({ reason, ...data });
  }

  // Sort by personHours descending for visibility
  breakdowns.sort((a, b) => b.personHours - a.personHours);
  return breakdowns;
}

const REASON_LABELS: Record<AttributionReason, string> = {
  self: 'Self (measurable)',
  ancestor: 'Parent task',
  noMeasurableOwner: 'No measurable owner',
  multipleOwners: 'Multiple owners (ambiguous)',
};

interface AttributionQualitySectionProps {
  tasks: Task[];
  policy?: AttributionPolicy;
}

export function AttributionQualitySection({ tasks, policy = DEFAULT_ATTRIBUTION_POLICY }: AttributionQualitySectionProps) {
  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [reasonBreakdown, setReasonBreakdown] = useState<ReasonBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const entries = await getAllTimeEntries();
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const { results, summary } = attributeEntries(entries, taskMap, policy);

      if (cancelled) return;
      setSummary(summary);
      setReasonBreakdown(computeReasonBreakdown(results));
      setIsLoading(false);
    }

    setIsLoading(true);
    load();

    return () => { cancelled = true; };
  }, [tasks, policy]);

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
            {summary.attributedPersonHours > 0 &&
              `${summary.attributedPersonHours.toFixed(1)} person-hrs attributed`}
            {summary.excludedPersonHours > 0 &&
              ` · ${summary.excludedPersonHours.toFixed(1)} person-hrs excluded`}
          </span>
          {reasonBreakdown.length > 0 && (
            <span className="settings-view__kpi-stats">
              {reasonBreakdown.map((rb, i) => (
                <span key={rb.reason}>
                  {i > 0 && ' · '}
                  {REASON_LABELS[rb.reason]}: {rb.personHours.toFixed(1)} hrs ({rb.entryCount} {rb.entryCount === 1 ? 'entry' : 'entries'})
                </span>
              ))}
            </span>
          )}
          {summary.ambiguousSuggestedResolutions > 0 && (
            <span className="settings-view__kpi-stats">
              {summary.ambiguousSuggestedResolutions} with suggested fix
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
