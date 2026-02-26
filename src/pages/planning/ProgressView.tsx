import { useMemo } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { BUILD_PHASE_LABELS, WORK_UNIT_LABELS, formatDurationShort } from '../../lib/types';
import { computePlanProgress } from '../../lib/planning/plan-progress';

interface ProgressViewProps {
  plan: Plan;
  tasks: Task[];
  timeEntries: TimeEntry[];
  onBack: () => void;
  onWrapUp?: () => void;
}

function formatHours(hours: number): string {
  return formatDurationShort(hours * 3_600_000);
}

function formatRate(rate: number | null, unit: string): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${rate.toFixed(1)} ${unit}/person-hr`;
}

function varianceClassName(variancePercent: number | null): string {
  if (variancePercent == null) return '';
  if (variancePercent <= 0) return 'progress-view__variance--under';
  if (variancePercent <= 15) return 'progress-view__variance--near';
  return 'progress-view__variance--over';
}

export function ProgressView({ plan, tasks, timeEntries, onBack, onWrapUp }: ProgressViewProps) {
  const progress = useMemo(
    () => computePlanProgress(plan, tasks, timeEntries),
    [plan, tasks, timeEntries],
  );

  return (
    <div className="planning-view progress-view">
      <header className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Back
        </button>
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Progress
        </h2>
        {onWrapUp && (
          <button type="button" className="btn btn--primary" onClick={onWrapUp}>
            Wrap Up
          </button>
        )}
      </header>

      <section className="progress-view__summary">
        <div className="progress-view__summary-row">
          <span>Completion</span>
          <strong>{Math.round(progress.completionRatio * 100)}%</strong>
        </div>
        <div className="progress-view__summary-row">
          <span>Planned items</span>
          <strong>{progress.lineItems.length}</strong>
        </div>
      </section>

      <section className="progress-view__list" aria-label="Plan line item progress">
        {progress.lineItems.map((item) => {
          const unitLabel = WORK_UNIT_LABELS[item.workUnit] ?? item.workUnit;
          const varianceText =
            item.variancePercent == null
              ? '—'
              : `${item.variancePercent > 0 ? '+' : ''}${item.variancePercent.toFixed(0)}%`;
          return (
            <article key={item.lineItemId} className="progress-view__item">
              <div className="progress-view__item-header">
                <div>
                  <h3 className="progress-view__item-title">{item.title}</h3>
                  <p className="progress-view__item-meta">
                    {BUILD_PHASE_LABELS[item.buildPhase]} · {unitLabel} · {item.taskCount} task
                    {item.taskCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span className={`progress-view__status progress-view__status--${item.status}`}>
                  {item.status}
                </span>
              </div>

              <div className="progress-view__item-grid">
                <div>
                  <span className="progress-view__label">Hours</span>
                  <span className="progress-view__value">
                    {formatHours(item.actualHours)} / {formatHours(item.plannedHours)}
                  </span>
                </div>
                <div>
                  <span className="progress-view__label">Person-hours</span>
                  <span className="progress-view__value">
                    {formatHours(item.actualPersonHours)} / {formatHours(item.plannedPersonHours)}
                  </span>
                </div>
                <div>
                  <span className="progress-view__label">Productivity</span>
                  <span className="progress-view__value">
                    {formatRate(item.actualProductivity, unitLabel)} /{' '}
                    {formatRate(item.plannedProductivity, unitLabel)}
                  </span>
                </div>
                <div>
                  <span className="progress-view__label">Variance</span>
                  <span className={`progress-view__value ${varianceClassName(item.variancePercent)}`}>
                    {varianceText}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="progress-view__block">
        <h3 className="progress-view__block-title">Unplanned Work</h3>
        <p className="progress-view__block-text">
          {progress.unplannedWork.taskCount} task{progress.unplannedWork.taskCount === 1 ? '' : 's'} ·{' '}
          {formatHours(progress.unplannedWork.hours)} · {formatHours(progress.unplannedWork.personHours)} person-hours
        </p>
      </section>

      {progress.orphanTasks.length > 0 && (
        <section className="progress-view__block">
          <h3 className="progress-view__block-title">Orphan Tasks</h3>
          <ul className="progress-view__orphan-list">
            {progress.orphanTasks.map((task) => (
              <li key={task.id} className="progress-view__orphan-item">
                <span>{task.title}</span>
                <span className="progress-view__orphan-meta">{task.sourceLineItemId ?? 'No source line item'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
