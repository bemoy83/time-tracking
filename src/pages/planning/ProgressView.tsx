import { useEffect, useMemo, useRef, useState } from 'react';
import { WorkUnitImportPreviewPanel } from '../../components/WorkUnitImportPreviewPanel';
import { ChevronLeftIcon } from '../../components/icons';
import { PlanKpiRow } from './PlanKpiRow';
import { getProgressViewMetrics } from './workspace/workspace-metrics';
import type { Plan } from '../../lib/planning/plan-model';
import type { Task, TimeEntry } from '../../lib/types';
import { BUILD_PHASE_LABELS, resolveWorkUnitLabel, formatDurationShort } from '../../lib/types';
import { computePlanProgress } from '../../lib/planning/plan-progress';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { formatDeadlineStatusLabel } from '../../lib/planning/scheduling/deadline-label';
import { useExecutionReturnForProgress } from './hooks/useExecutionReturnForProgress';
import {
  parseExecutionReturnJson,
  previewExecutionReturnImport,
  applyExecutionReturnImport,
  formatExecutionReturnMergeSummary,
} from '../../lib/interop/data-transfer/execution-return-import';
import {
  CANONICAL_HANDOFF_EXPLANATION,
  PLANNER_EXECUTION_RETURN_EXPLANATION,
} from '../../lib/interop/data-transfer/handoff-copy';
import type {
  ExecutionReturnImportPreview,
  ExecutionReturnMergeSummary,
} from '../../lib/interop/data-transfer/contracts';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import { useWorkUnitImportPreview } from '../../lib/hooks/useWorkUnitImportPreview';
import { useLatestExecutionReturnSummary } from './hooks/useLatestExecutionReturnSummary';

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
  const latestExecutionReturnSummary = useLatestExecutionReturnSummary(plan.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { definitions } = useWorkUnitStore();
  const [filePreview, setFilePreview] = useState<ExecutionReturnImportPreview | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [appliedMergeSummary, setAppliedMergeSummary] = useState<ExecutionReturnMergeSummary | null>(null);
  const {
    preview: importWorkUnitPreview,
    applyImportedLabels: applyImportedUnitLabels,
    setApplyImportedLabels: setApplyImportedUnitLabels,
  } = useWorkUnitImportPreview(
    filePreview?.envelope.payload.workUnitDefinitions?.map((definition) => ({
      id: definition.id,
      label: definition.label,
    })) ?? null,
    definitions,
  );

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
    const result = await applyExecutionReturnImport(filePreview, {
      applyLabelToExistingWorkUnits: applyImportedUnitLabels,
    });
    setFilePreview(null);
    setAppliedMergeSummary(result.mergeSummary);
    setImportMsg('');
    setIsApplying(false);
  }

  useEffect(() => {
    setAppliedMergeSummary(null);
    setImportMsg('');
  }, [plan.id]);

  const progress = useMemo(
    () => computePlanProgress(plan, tasks, timeEntries, importedExecutionStatus),
    [plan, tasks, timeEntries, importedExecutionStatus],
  );

  const progressKpiMetrics = useMemo(
    () => getProgressViewMetrics(plan, tasks, timeEntries, { progress }),
    [plan, progress, tasks, timeEntries],
  );
  const hadRiskRef = useRef(false);

  useEffect(() => {
    const hasRisk = progress.deadline.enabled && progress.deadline.status != null && progress.deadline.status !== 'on-track';
    if (hasRisk && !hadRiskRef.current) {
      trackTelemetryEvent('schedule_deadline_risk_visible');
    }
    hadRiskRef.current = hasRisk;
  }, [progress.deadline.enabled, progress.deadline.status]);

  const isRisk = progress.deadline.enabled && progress.deadline.status != null && progress.deadline.status !== 'on-track';
  const isComplete = progress.completionRatio >= 1;
  const displayedMergeSummary = latestExecutionReturnSummary?.mergeSummary ?? appliedMergeSummary;
  const displayedMergeImportedAt =
    latestExecutionReturnSummary?.importedAt
    ?? appliedMergeSummary?.importedAt
    ?? null;

  return (
    <div className="planning-view progress-view">
      <PlanKpiRow metrics={progressKpiMetrics} />

      {/* Mobile back button header — hidden in workspace context via CSS */}
      {showBackButton && (
        <header className="planning-view__editor-header">
          <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
            <ChevronLeftIcon className="planning-view__back-icon" />
            Back
          </button>
          <h2 className="planning-view__title" style={{ flex: 1 }}>
            Progress
          </h2>
        </header>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => { void handleFileChange(e); }}
      />

      {/* Overview card: completion ring + stats + actions */}
      <section
        className={`progress-view__overview${isRisk ? ' progress-view__overview--risk' : ''}`}
        aria-label="Plan progress summary"
      >
        <div
          className={`progress-view__overview-ring${isComplete ? ' progress-view__overview-ring--complete' : ''}`}
          style={{ '--ring-progress': progress.completionRatio } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="progress-view__ring-label">
            {Math.round(progress.completionRatio * 100)}%
          </span>
        </div>

        <div className="progress-view__overview-stats">
          <p className="progress-view__overview-stat-primary">
            <strong>{Math.round(progress.completionRatio * 100)}%</strong>{' '}complete
          </p>
          <p className="progress-view__overview-stat-secondary">
            {progress.lineItems.length} planned {progress.lineItems.length === 1 ? 'item' : 'items'}
          </p>
          {progress.deadline.enabled && progress.deadline.label && (
            <p className={`progress-view__overview-deadline progress-view__overview-deadline--${progress.deadline.status ?? 'on-track'}`}>
              {progress.deadline.label}
            </p>
          )}
        </div>

        <div className="progress-view__overview-actions">
          {!filePreview && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Import Execution Return
            </button>
          )}
          {onWrapUp && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onWrapUp}>
              Wrap Up
            </button>
          )}
        </div>
      </section>

      <section className="progress-view__import-section" aria-label="Execution return handoff guidance">
        <div className="progress-view__import-card">
          <p className="progress-view__import-meta">
            {PLANNER_EXECUTION_RETURN_EXPLANATION}
          </p>
          <p className="progress-view__import-meta">
            {CANONICAL_HANDOFF_EXPLANATION}
          </p>
        </div>
      </section>

      {displayedMergeSummary && displayedMergeImportedAt && (
        <section className="progress-view__import-section" aria-label="Latest handoff merge summary">
          <div className="progress-view__import-card">
            <p className="progress-view__import-title">
              <strong>Last merged from field</strong>
            </p>
            <p className="progress-view__import-meta">
              Merged {new Date(displayedMergeImportedAt).toLocaleString()}
            </p>
            <p className="progress-view__import-meta">
              {formatExecutionReturnMergeSummary(displayedMergeSummary)}
            </p>
            <p className="progress-view__import-meta">
              New entries: {displayedMergeSummary.importedEntryCount}
            </p>
            <p className="progress-view__import-meta">
              Duplicate entries skipped: {displayedMergeSummary.skippedDuplicateEntryCount}
            </p>
            <p className="progress-view__import-meta">
              Tasks merged from payload: {displayedMergeSummary.mergedTaskCount}
            </p>
            <p className="progress-view__import-meta">
              Line items reflected: {displayedMergeSummary.lineItemCount}
            </p>
          </div>
        </section>
      )}

      {/* File import preview card */}
      {filePreview && (
        <section className="progress-view__import-section">
          <div className="progress-view__import-card">
            <p className="progress-view__import-title">
              <strong>{filePreview.planTitle}</strong> · {filePreview.lineItemCount} items · {filePreview.timeEntryCount} time entries · {filePreview.workUnitCount} units
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
            <WorkUnitImportPreviewPanel
              preview={importWorkUnitPreview}
              applyImportedLabels={applyImportedUnitLabels}
              onApplyImportedLabelsChange={setApplyImportedUnitLabels}
              summaryClassName="progress-view__import-meta"
            />
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
        </section>
      )}
      {importMsg && !filePreview && (
        <p className="progress-view__import-msg">{importMsg}</p>
      )}

      {progress.lineItems.length > 0 && (
        <section className="progress-view__list" aria-label="Plan line item progress">
          {progress.lineItems.map((item) => {
          const unitLabel = resolveWorkUnitLabel(item.workUnit);
          const varianceText =
            item.variancePercent == null
              ? '—'
              : `${item.variancePercent > 0 ? '+' : ''}${item.variancePercent.toFixed(0)}%`;

          const completionRatio = item.status === 'completed'
            ? 1.0
            : item.plannedQuantity > 0
              ? Math.min(1, item.actualQuantity / item.plannedQuantity)
              : item.plannedHours > 0
                ? Math.min(1, item.actualHours / item.plannedHours)
                : 0;

          const progressColor = item.status === 'completed'
            ? 'var(--color-ready)'
            : item.variancePercent != null && item.variancePercent > 15
              ? 'var(--color-recording)'
              : 'var(--color-primary)';

          return (
            <article key={`${item.lineItemId}-${item.phase}`} className="progress-view__item">
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

              <div
                className="progress-view__item-progress"
                style={{
                  '--item-progress': completionRatio,
                  '--item-color': progressColor,
                } as React.CSSProperties}
                aria-hidden="true"
              />
            </article>
          );
        })}
        </section>
      )}

      <section className="progress-view__block progress-view__block--unplanned">
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
