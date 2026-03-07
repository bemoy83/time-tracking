import { useEffect, useState } from 'react';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import type { WrapUpV2Projection } from '../../lib/planning/wrap-up-v2-model';
import { loadWrapUpV2Projection } from '../../lib/planning/wrap-up-v2-projection';
import { buildEventReportV2 } from '../../lib/reports/event-report-v2';
import { ChevronLeftIcon } from '../../components/icons';
import { LoadingBlock } from '../../components/LoadingBlock';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';

interface EventReportViewProps {
  plan: Plan;
  tasks: Task[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  onBack: () => void;
}

export function EventReportView({
  plan,
  tasks,
  timeEntriesByTask,
  onBack,
}: EventReportViewProps) {
  const [projection, setProjection] = useState<WrapUpV2Projection | null>(null);

  useEffect(() => {
    let cancelled = false;
    trackTelemetryEvent('event_report_v2_open');

    const load = async () => {
      const next = await loadWrapUpV2Projection(plan, tasks, timeEntriesByTask);
      if (!cancelled) {
        setProjection(next);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [plan, tasks, timeEntriesByTask]);

  if (!projection) {
    return (
      <div className="planning-view">
        <header className="planning-view__editor-header">
          <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
            <ChevronLeftIcon className="planning-view__back-icon" />
            Back
          </button>
          <h2 className="planning-view__title" style={{ flex: 1 }}>
            Event Report
          </h2>
        </header>
        <LoadingBlock message="Loading report…" />
      </div>
    );
  }

  const report = buildEventReportV2(plan, projection);

  return (
    <div className="planning-view event-report" data-print-root>
      <header className="planning-view__editor-header event-report__header-print-hidden">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Back
        </button>
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Event Report
        </h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            trackTelemetryEvent('event_report_v2_print');
            window.print();
          }}
        >
          Print / Save PDF
        </button>
      </header>

      <section className="event-report__section">
        <h2>Summary</h2>
        <p>Plan: {report.planTitle}</p>
        <p>Reviewed: {report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : 'Not reviewed'}</p>
        <p>Planned person-hours: {report.summary.plannedPersonHours.toFixed(2)}</p>
        <p>Actual person-hours: {report.summary.actualPersonHours.toFixed(2)}</p>
      </section>

      <section className="event-report__section">
        <h2>Delivered Work</h2>
        {report.delivered.length === 0 ? <p>None</p> : (
          <ul>
            {report.delivered.map((item) => (
              <li key={item.lineItem.id}>
                {item.lineItem.title} - Planned {item.plannedPersonHours.toFixed(2)}h, Actual {item.actualPersonHours.toFixed(2)}h
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="event-report__section">
        <h2>Not Delivered</h2>
        {report.notDelivered.length === 0 ? <p>None</p> : (
          <ul>
            {report.notDelivered.map((item) => (
              <li key={item.lineItem.id}>
                {item.lineItem.title} - Deferred note: {item.deferredNote ?? '—'} - Not delivered / not invoiced
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="event-report__section">
        <h2>Disruptions</h2>
        {report.disruptions.length === 0 ? <p>None</p> : (
          <ul>
            {report.disruptions.map((item) => (
              <li key={item.lineItem.id}>
                {item.lineItem.title} - {item.blockReason ?? 'Blocked'}{item.blockCategory ? ` (${item.blockCategory})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="event-report__section">
        <h2>Unplanned Work</h2>
        {report.unplanned.length === 0 ? <p>None</p> : (
          <ul>
            {report.unplanned.map((item) => (
              <li key={item.taskId}>
                {item.title} - {item.personHours.toFixed(2)} person-hrs
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
