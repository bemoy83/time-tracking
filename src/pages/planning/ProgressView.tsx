import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon } from '../../components/icons';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { BUILD_PHASE_LABELS, WORK_UNIT_LABELS, formatDurationShort } from '../../lib/types';
import { computePlanProgress } from '../../lib/planning/plan-progress';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { formatDeadlineStatusLabel } from '../../lib/planning/scheduling/deadline-label';
import { useExecutionReturnForProgress } from './hooks/useExecutionReturnForProgress';
import {
  parseExecutionReturnJson,
  previewExecutionReturnImport,
  applyExecutionReturnImport,
} from '../../lib/interop/data-transfer/execution-return-import';
import type { ExecutionReturnImportPreview } from '../../lib/interop/data-transfer/contracts';

interface ProgressViewProps {
  plan: Plan;
  tasks: Task[];
  timeEntries: TimeEntry[];
  onBack: () => void;
  showBackButton?: boolean;
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

export function ProgressView({
  plan,
  tasks,
  timeEntries,
  onBack,
  showBackButton = true,
  onWrapUp,
}: ProgressViewProps) {
  const importedExecutionStatus = useExecutionReturnForProgress(plan.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filePreview, setFilePreview] = useState<ExecutionReturnImportPreview | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const text = await file.text();
    const parsed = parseExecutionReturnJson(text);
    if (!parsed.ok) { setImportMsg(`Invalid file: ${parsed.error}`); return; }
    const preview = await previewExecutionReturnImport(parsed.envelope);
    setFilePreview(preview);
    setImportMsg('');
  }

  async function handleApply() {
    if (!filePreview) return;
    setIsApplying(true);
    const result = await applyExecutionReturnImport(filePreview);
    setFilePreview(null);
    setImportMsg(result.reason);
    setIsApplying(false);
  }

  const progress = useMemo(
    () => computePlanProgress(plan, tasks, timeEntries, importedExecutionStatus),
    [plan, tasks, timeEntries, importedExecutionStatus],
  );
  const hadRiskRef = useRef(false);

  useEffect(() => {
    const hasRisk = progress.deadline.enabled && progress.deadline.status != null && progress.deadline.status !== 'on-track';
    if (hasRisk && !hadRiskRef.current) {
      trackTelemetryEvent('schedule_deadline_risk_visible');
    }
    hadRiskRef.current = hasRisk;
  }, [progress.deadline.enabled, progress.deadline.status]);

  return (
    <div className="planning-view progress-view">
      <header className="planning-view__editor-header">
        {showBackButton && (
          <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
            <ChevronLeftIcon className="planning-view__back-icon" />
            Back
          </button>
        )}
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Progress
        </h2>
        {onWrapUp && (
          <button type="button" className="btn btn--primary" onClick={onWrapUp}>
            Wrap Up
          </button>
        )}
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => { void handleFileChange(e); }}
      />

      <section className="progress-view__import-section">
        {!filePreview && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Import Progress Report
          </button>
        )}
        {filePreview && (
          <div className="progress-view__import-card">
            <p className="progress-view__import-title">
              <strong>{filePreview.planTitle}</strong> · {filePreview.lineItemCount} items · {filePreview.timeEntryCount} time entries
            </p>
            {filePreview.dateRangeStart && (
              <p className="progress-view__import-meta">
                {filePreview.dateRangeStart} → {filePreview.dateRangeEnd ?? '—'}
              </p>
            )}
            {filePreview.duplicateTimeEntryIds.length > 0 && (
              <p className="progress-view__import-meta progress-view__import-meta--warn">
                {filePreview.duplicateTimeEntryIds.length} duplicate time {filePreview.duplicateTimeEntryIds.length === 1 ? 'entry' : 'entries'} will be skipped.
              </p>
            )}
            <div className="progress-view__import-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setFilePreview(null)}
                disabled={isApplying}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => { void handleApply(); }}
                disabled={isApplying}
              >
                {isApplying ? 'Importing…' : 'Apply Import'}
              </button>
            </div>
          </div>
        )}
        {importMsg && !filePreview && (
          <p className="progress-view__import-msg">{importMsg}</p>
        )}
      </section>

      <section
        className={`progress-view__summary${progress.deadline.enabled && progress.deadline.status && progress.deadline.status !== 'on-track' ? ' progress-view__summary--risk' : ''}`}
        aria-label="Plan progress summary"
      >
        <span className="progress-view__summary-metric">
          <strong>{Math.round(progress.completionRatio * 100)}%</strong> complete
        </span>
        <span className="progress-view__summary-sep">&middot;</span>
        <span className="progress-view__summary-metric">
          <strong>{progress.lineItems.length}</strong> planned {progress.lineItems.length === 1 ? 'item' : 'items'}
        </span>
        {progress.deadline.enabled && progress.deadline.label && (
          <>
            <span className="progress-view__summary-sep">&middot;</span>
            <span className={`progress-view__summary-deadline progress-view__summary-deadline--${progress.deadline.status ?? 'on-track'}`}>
              {progress.deadline.label}
            </span>
          </>
        )}
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
                    {item.workTypeTitle} · {BUILD_PHASE_LABELS[item.phase]} · {unitLabel} · {item.taskCount} task
                    {item.taskCount === 1 ? '' : 's'}
                  </p>
                  <p className="progress-view__item-meta">
                    {formatDeadlineStatusLabel(item.deadlineStatus)}
                    {item.dueDate ? ` · Due ${item.dueDate}` : ''}
                  </p>
                  {(item.status === 'blocked' || item.status === 'deferred') && (item.blockReason || item.deferredNote) && (
                    <p className="progress-view__item-meta progress-view__item-meta--block">
                      {item.status === 'blocked' ? 'Blocked' : 'Deferred'}
                      {item.blockCategory ? ` (${item.blockCategory})` : ''}: {item.blockReason || item.deferredNote}
                    </p>
                  )}
                </div>
                <span className={`progress-view__status progress-view__status--${item.status}`}>
                  {item.status.replace('-', ' ')}
                </span>
              </div>

              <div className="progress-view__item-grid">
                <div>
                  <span className="progress-view__label">Work quantity</span>
                  <span className="progress-view__value">
                    {item.plannedQuantity > 0
                      ? `${item.actualQuantity.toLocaleString()} / ${item.plannedQuantity.toLocaleString()} ${unitLabel}`
                      : '—'}
                  </span>
                </div>
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
