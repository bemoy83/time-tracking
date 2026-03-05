import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackIcon,
  BlockedIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  ExpandChevronIcon,
  PlayIcon,
  TaskListIcon,
  WarningIcon,
} from '../../components/icons';
import { CountBadge } from '../../components/CountBadge';
import { SwipeableRow } from '../../components/SwipeableRow';
import { ActionSheet } from '../../components/ActionSheet';
import { getAllPlans, getAllTimeEntries, updatePlan } from '../../lib/db';
import { lineItemToCreateTaskInput } from '../../lib/planning/release-plan';
import {
  type BlockCategory,
  type Plan,
  type PlanLineItem,
  updatePlanLineItem,
} from '../../lib/planning/plan-model';
import { createTask, useTaskStore } from '../../lib/stores/task-store';
import { nowUtc, WORK_UNIT_LABELS, type TimeEntry } from '../../lib/types';
import { buildExecutionReturnEnvelope } from '../../lib/interop/data-transfer/execution-return';
import { downloadJson } from '../../lib/interop/download-json';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  buildFieldPlanLineItemSummaries,
  summarizeLineItemStatuses,
  type FieldPlanLineItemSummary,
} from './field-plan-model';
import { formatDeadlineStatusLabel } from '../../lib/planning/scheduling/deadline-label';
import { useFieldPlanImport } from './useFieldPlanImport';
import { sanitizeFileNameSegment } from '../../lib/utils/sanitize-filename';
import {
  syncLineItemBlockToTasks,
  syncLineItemUnblockToTasks,
} from '../../lib/planning/task-plan-block-sync';

interface FieldPlanOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function isExecutorPlan(plan: Plan): boolean {
  return plan.status === 'received' || plan.status === 'session-closed';
}

function sortExecutorPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const aPriority = a.status === 'received' ? 0 : 1;
    const bPriority = b.status === 'received' ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aDate = a.status === 'received' ? (a.importedAt ?? a.updatedAt) : (a.sessionClosedAt ?? a.updatedAt);
    const bDate = b.status === 'received' ? (b.importedAt ?? b.updatedAt) : (b.sessionClosedAt ?? b.updatedAt);
    return bDate.localeCompare(aDate);
  });
}

function normalizeBlockCategory(raw: string | null): BlockCategory | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'access') return 'access';
  if (normalized === 'materials') return 'materials';
  if (normalized === 'crew') return 'crew';
  if (normalized === 'dependency') return 'dependency';
  if (normalized === 'other') return 'other';
  return null;
}

function formatPlanPersonHours(plan: Plan, tasks: ReturnType<typeof useTaskStore>['tasks'], timeEntries: TimeEntry[]): string {
  const linkedTaskIds = new Set(
    tasks
      .filter((task) => task.sourcePlanId === plan.id)
      .map((task) => task.id),
  );

  const personHours = timeEntries.reduce((total, entry) => {
    if (!linkedTaskIds.has(entry.taskId)) return total;
    const start = new Date(entry.startUtc).getTime();
    const end = new Date(entry.endUtc).getTime();
    const hours = Math.max(0, end - start) / 3_600_000;
    return total + (hours * (entry.workers ?? 1));
  }, 0);

  return `${personHours.toFixed(1)}h`;
}

function groupByStatus(lineItems: FieldPlanLineItemSummary[]) {
  const inProgress: FieldPlanLineItemSummary[] = [];
  const blocked: FieldPlanLineItemSummary[] = [];
  const pending: FieldPlanLineItemSummary[] = [];
  const completed: FieldPlanLineItemSummary[] = [];
  const deferred: FieldPlanLineItemSummary[] = [];

  for (const li of lineItems) {
    switch (li.status) {
      case 'in-progress': inProgress.push(li); break;
      case 'blocked': blocked.push(li); break;
      case 'pending': pending.push(li); break;
      case 'completed': completed.push(li); break;
      case 'deferred': deferred.push(li); break;
    }
  }

  return { inProgress, blocked, pending, completed, deferred };
}

export function FieldPlanOverlay({ isOpen, onClose }: FieldPlanOverlayProps) {
  const { tasks } = useTaskStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [deferredExpanded, setDeferredExpanded] = useState(false);
  const [actionSheetItem, setActionSheetItem] = useState<FieldPlanLineItemSummary | null>(null);

  const hadDeadlineRiskRef = useRef(false);

  const reloadData = useCallback(async () => {
    const [allPlans, allTimeEntries] = await Promise.all([getAllPlans(), getAllTimeEntries()]);
    setPlans(sortExecutorPlans(allPlans.filter(isExecutorPlan)));
    setTimeEntries(allTimeEntries);
  }, []);

  const handleImportApplied = useCallback(async (planId: string) => {
    await reloadData();
    setSelectedPlanId(planId);
  }, [reloadData]);

  const {
    isLoadingPreview,
    preview,
    isApplyingImport,
    handleFileChange,
    handleApplyImport,
    resetImportPreview,
  } = useFieldPlanImport({
    onMessage: setMessage,
    onImportApplied: handleImportApplied,
  });

  useEffect(() => {
    if (!isOpen) return;
    setMessage(null);
    resetImportPreview();
    setCompletedExpanded(false);
    setDeferredExpanded(false);
    void reloadData();
  }, [isOpen, reloadData, resetImportPreview]);

  useEffect(() => {
    if (!isOpen) return;
    const hasSelection = selectedPlanId != null && plans.some((plan) => plan.id === selectedPlanId);
    if (hasSelection) return;

    const received = plans.find((plan) => plan.status === 'received');
    if (received) {
      setSelectedPlanId(received.id);
      return;
    }

    if (plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    } else {
      setSelectedPlanId(null);
    }
  }, [isOpen, plans, selectedPlanId]);

  const receivedPlans = useMemo(
    () => plans.filter((plan) => plan.status === 'received'),
    [plans],
  );

  const closedPlans = useMemo(
    () => plans.filter((plan) => plan.status === 'session-closed'),
    [plans],
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const lineItems = useMemo(() => {
    if (!selectedPlan) return [];
    return buildFieldPlanLineItemSummaries(selectedPlan, tasks, timeEntries);
  }, [selectedPlan, tasks, timeEntries]);

  const lineItemStatusSummary = useMemo(
    () => summarizeLineItemStatuses(lineItems),
    [lineItems],
  );

  const statusGroups = useMemo(() => groupByStatus(lineItems), [lineItems]);

  const deadlineSummary = useMemo(() => {
    const actionable = lineItems.filter((item) => item.deadlineStatus !== 'unscheduled');
    const overdue = actionable.filter((item) => item.deadlineStatus === 'overdue').length;
    const atRisk = actionable.filter((item) => item.deadlineStatus === 'at-risk').length;
    const done = actionable.filter((item) => item.deadlineStatus === 'done-on-time' || item.deadlineStatus === 'done-late').length;
    return {
      total: actionable.length,
      overdue,
      atRisk,
      done,
    };
  }, [lineItems]);

  useEffect(() => {
    if (!isOpen) return;
    const hasRisk = deadlineSummary.overdue > 0 || deadlineSummary.atRisk > 0;
    if (hasRisk && !hadDeadlineRiskRef.current) {
      trackTelemetryEvent('schedule_deadline_risk_visible');
    }
    hadDeadlineRiskRef.current = hasRisk;
  }, [deadlineSummary.atRisk, deadlineSummary.overdue, isOpen]);

  const unplannedTasks = useMemo(() => {
    if (!selectedPlan || selectedPlan.projectId == null) return [];
    return tasks.filter(
      (task) => task.projectId === selectedPlan.projectId && task.sourcePlanId == null,
    );
  }, [selectedPlan, tasks]);

  const canExecute =
    selectedPlan?.status === 'received' || selectedPlan?.status === 'session-closed';

  const patchLineItem = useCallback(
    async (lineItemId: string, updates: Partial<Omit<PlanLineItem, 'id'>>) => {
      if (!selectedPlan) return;
      const nextPlan = updatePlanLineItem(selectedPlan, lineItemId, updates);
      await updatePlan(nextPlan);
      setPlans((prev) => prev.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan)));
    },
    [selectedPlan],
  );

  const handleReleaseToToday = useCallback(
    async (lineItem: PlanLineItem) => {
      if (!selectedPlan || !canExecute || lineItem.removedFromSource) return;
      const alreadyReleased = tasks.some(
        (task) => task.sourcePlanId === selectedPlan.id && task.sourceLineItemId === lineItem.id,
      );
      if (alreadyReleased) return;

      await createTask(lineItemToCreateTaskInput(lineItem, {
        planId: selectedPlan.id,
        projectId: selectedPlan.projectId,
      }));
    },
    [canExecute, selectedPlan, tasks],
  );

  const handleMarkBlocked = useCallback(
    async (lineItem: PlanLineItem) => {
      if (!canExecute || !selectedPlan) return;
      const reason = window.prompt('Blocked reason (required)', lineItem.blockReason ?? '');
      if (reason == null) return;
      const trimmedReason = reason.trim();
      if (trimmedReason.length === 0) return;

      const categoryInput = window.prompt(
        'Category (optional): access | materials | crew | dependency | other',
        lineItem.blockCategory ?? '',
      );
      const category = normalizeBlockCategory(categoryInput);

      await patchLineItem(lineItem.id, {
        executionStatus: 'blocked',
        blockReason: trimmedReason,
        blockCategory: category,
      });
      await syncLineItemBlockToTasks(selectedPlan.id, lineItem.id, trimmedReason, category);
    },
    [canExecute, patchLineItem, selectedPlan],
  );

  const handleMarkDeferred = useCallback(
    async (lineItem: PlanLineItem) => {
      if (!canExecute) return;
      const note = window.prompt('Deferred note (optional)', lineItem.deferredNote ?? '');
      if (note == null) return;

      await patchLineItem(lineItem.id, {
        executionStatus: 'deferred',
        deferredNote: note.trim() || null,
        blockReason: null,
        blockCategory: null,
      });
    },
    [canExecute, patchLineItem],
  );

  const handleClearBlock = useCallback(
    async (lineItem: PlanLineItem) => {
      if (!canExecute || !selectedPlan) return;
      await patchLineItem(lineItem.id, {
        executionStatus: 'pending',
        blockReason: null,
        blockCategory: null,
      });
      await syncLineItemUnblockToTasks(selectedPlan.id, lineItem.id);
    },
    [canExecute, patchLineItem, selectedPlan],
  );

  const handleReactivateDeferred = useCallback(
    async (lineItem: PlanLineItem) => {
      if (!canExecute) return;
      await patchLineItem(lineItem.id, {
        executionStatus: 'pending',
        deferredNote: null,
      });
    },
    [canExecute, patchLineItem],
  );

  const handleAddNote = useCallback(
    async (lineItem: PlanLineItem) => {
      if (!canExecute) return;
      const note = window.prompt('Executor note', lineItem.executorNote ?? '');
      if (note == null) return;
      await patchLineItem(lineItem.id, {
        executorNote: note.trim() || null,
      });
    },
    [canExecute, patchLineItem],
  );

  const handleExportExecutionReturn = useCallback(async () => {
    if (!selectedPlan) return;

    const summary = summarizeLineItemStatuses(lineItems);
    const summaryText = [
      `Completed: ${summary.completed}`,
      `Blocked: ${summary.blocked}`,
      `Deferred: ${summary.deferred}`,
      `Unplanned tasks: ${unplannedTasks.length}`,
    ].join('\n');

    const confirmed = window.confirm(`Export execution return?\n\n${summaryText}\n\nYou can export again anytime until the plan is archived.`);
    if (!confirmed) return;

    try {
      const latestEntries = await getAllTimeEntries();
      setTimeEntries(latestEntries);

      const envelope = await buildExecutionReturnEnvelope(selectedPlan, tasks, latestEntries);
      const stamp = new Date().toISOString().slice(0, 10);
      const titleKey = sanitizeFileNameSegment(selectedPlan.title);
      downloadJson(`execution-return-${titleKey}-${stamp}.json`, envelope);
      trackTelemetryEvent('interop_execution_return_export');

      const now = nowUtc();
      const updatedPlan: Plan = {
        ...selectedPlan,
        status: 'received',
        sessionClosedAt: null,
        updatedAt: now,
      };
      await updatePlan(updatedPlan);
      setPlans((prev) => sortExecutorPlans(prev.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan))));
      setSelectedPlanId(updatedPlan.id);
      setMessage('Execution return exported. You can continue working and export again when needed.');
    } catch {
      setMessage('Failed to export. Please try again.');
    }
  }, [lineItems, selectedPlan, tasks, unplannedTasks.length]);

  const progressPercent = lineItems.length === 0
    ? 0
    : Math.round((lineItemStatusSummary.completed / lineItems.length) * 100);

  if (!isOpen) return null;

  const renderLineItemRow = (lineItem: FieldPlanLineItemSummary) => {
    const { item, status: liStatus } = lineItem;
    const canRelease = canExecute && !item.removedFromSource && liStatus === 'pending' && lineItem.tasks.length === 0;

    const leftAction = canRelease
      ? {
          label: 'Release',
          icon: <PlayIcon className="swipeable-row__action-icon" />,
          color: 'var(--color-primary)',
          onAction: () => { void handleReleaseToToday(item); },
        }
      : undefined;

    return (
      <SwipeableRow
        key={item.id}
        leftAction={leftAction}
        onLongPress={canExecute && !item.removedFromSource ? () => setActionSheetItem(lineItem) : undefined}
      >
        <button
          type="button"
          className={`field-plan-row field-plan-row--${liStatus}${item.removedFromSource ? ' field-plan-row--removed' : ''}`}
          onClick={canExecute && !item.removedFromSource ? () => setActionSheetItem(lineItem) : undefined}
        >
          <div className="field-plan-row__status-col">
            <span className={`field-plan-row__dot field-plan-row__dot--${liStatus}`} />
          </div>
          <div className="field-plan-row__content">
            <span className="field-plan-row__title">{item.title}</span>
            <span className="field-plan-row__meta">
              {item.workTypeTitle} · {item.workQuantity} {WORK_UNIT_LABELS[item.workUnit]} · {item.crew} crew · {item.timeHours.toFixed(1)}h
            </span>
            {item.blockReason && (
              <span className="field-plan-row__chip field-plan-row__chip--blocked">
                <BlockedIcon className="field-plan-row__chip-icon" />
                {item.blockReason}
              </span>
            )}
            {item.deferredNote && (
              <span className="field-plan-row__chip field-plan-row__chip--deferred">
                Deferred: {item.deferredNote}
              </span>
            )}
            {item.executorNote && (
              <span className="field-plan-row__note">
                Note: {item.executorNote}
              </span>
            )}
            {item.removedFromSource && (
              <span className="field-plan-row__chip field-plan-row__chip--removed">Removed from source</span>
            )}
            {lineItem.deadlineStatus !== 'unscheduled' && (
              <span className={`field-plan-row__deadline field-plan-row__deadline--${lineItem.deadlineStatus}`}>
                {formatDeadlineStatusLabel(lineItem.deadlineStatus)}
                {lineItem.dueDate ? ` · Due ${lineItem.dueDate}` : ''}
              </span>
            )}
          </div>
          <div className="field-plan-row__trail">
            {lineItem.tasks.length > 0 && (
              <CountBadge count={lineItem.tasks.length} variant="muted" size="compact" />
            )}
            <ChevronRightIcon className="field-plan-row__chevron" />
          </div>
        </button>
      </SwipeableRow>
    );
  };

  return (
    <div className="field-plan-overlay" role="dialog" aria-modal="true" aria-label="Field Plan View">
      <header className="field-plan-overlay__header">
        <button type="button" className="field-plan-overlay__back" onClick={onClose}>
          <BackIcon className="field-plan-overlay__back-icon" />
          <span>Today</span>
        </button>
        <h1 className="field-plan-overlay__title">Field Plan</h1>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoadingPreview || isApplyingImport}
        >
          {isLoadingPreview ? 'Reading...' : 'Import'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </header>

      <div className="field-plan-overlay__content">
        {preview && (
          <section className="field-plan-import-card">
            <p className="field-plan-import-card__title">
              <strong>{preview.title}</strong> · {preview.lineItemCount} items · {preview.workTypeCount} work types
            </p>
            <p className="field-plan-import-card__meta">
              Last modified {new Date(preview.lastModifiedAt).toLocaleString()}
            </p>
            {preview.conflict === 'planner-plan' && (
              <p className="field-plan-import-card__meta">Conflict: planner-owned plan exists on this device.</p>
            )}
            {preview.conflict === 'replace-or-skip' && (
              <p className="field-plan-import-card__meta">Conflict: existing received plan found. Replace or skip.</p>
            )}
            {preview.conflict === 'merge' && (
              <p className="field-plan-import-card__meta">Existing execution state found. Import will merge.</p>
            )}
            {preview.lineItemDiffSummary && (
              <div className="field-plan-import-card__diff-summary">
                <span className="field-plan-import-card__diff-label">Line item changes:</span>
                {preview.lineItemDiffSummary.new > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--new">
                    {preview.lineItemDiffSummary.new} new
                  </span>
                )}
                {preview.lineItemDiffSummary.updated > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--updated">
                    {preview.lineItemDiffSummary.updated} updated
                  </span>
                )}
                {preview.lineItemDiffSummary.unchanged > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--unchanged">
                    {preview.lineItemDiffSummary.unchanged} unchanged
                  </span>
                )}
                {preview.lineItemDiffSummary.removed > 0 && (
                  <span className="field-plan-import-card__diff-badge field-plan-import-card__diff-badge--removed">
                    {preview.lineItemDiffSummary.removed} removed
                  </span>
                )}
              </div>
            )}
            <div className="field-plan-import-card__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={isApplyingImport || preview.conflict === 'planner-plan'}
                onClick={() => {
                  void handleApplyImport('replace');
                }}
              >
                {preview.conflict === 'merge' ? 'Merge Import' : 'Apply Import'}
              </button>
              {preview.conflict === 'replace-or-skip' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={isApplyingImport}
                  onClick={() => {
                    void handleApplyImport('skip');
                  }}
                >
                  Skip
                </button>
              )}
            </div>
          </section>
        )}

        {message && <p className="field-plan-overlay__message">{message}</p>}

        {plans.length === 0 ? (
          <section className="field-plan-overlay__empty">
            <h3>No received plans</h3>
            <p>Import a planner package to start execution in Field Plan View.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingPreview || isApplyingImport}
            >
              Import Plan Package
            </button>
          </section>
        ) : (
          <>
            {/* Plan selector */}
            <section className="field-plan__plan-selector">
              <h2 className="field-plan__section-title section-heading">
                <TaskListIcon className="field-plan__icon" />
                Plans
                <CountBadge count={receivedPlans.length} variant="muted" />
              </h2>
              <div className="field-plan__plan-list">
                {receivedPlans.length === 0 && (
                  <p className="field-plan__empty-text">No active received plans.</p>
                )}
                {receivedPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`field-plan__plan-btn${selectedPlanId === plan.id ? ' field-plan__plan-btn--active' : ''}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <span className="field-plan__plan-name">{plan.title}</span>
                    <ChevronRightIcon className="field-plan__plan-chevron" />
                  </button>
                ))}
              </div>

              {closedPlans.length > 0 && (
                <div className="field-plan__past-section">
                  <button
                    type="button"
                    className="field-plan__collapsible-toggle"
                    onClick={() => setShowPastEvents((prev) => !prev)}
                    aria-expanded={showPastEvents}
                  >
                    <CheckIcon className="field-plan__toggle-icon field-plan__toggle-icon--muted" />
                    <span>Past Events</span>
                    <CountBadge count={closedPlans.length} variant="muted" />
                    <ExpandChevronIcon
                      className={`field-plan__toggle-chevron${showPastEvents ? ' field-plan__toggle-chevron--expanded' : ''}`}
                    />
                  </button>
                  {showPastEvents && (
                    <div className="field-plan__plan-list">
                      {closedPlans.map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          className={`field-plan__plan-btn${selectedPlanId === plan.id ? ' field-plan__plan-btn--active' : ''}`}
                          onClick={() => setSelectedPlanId(plan.id)}
                        >
                          <span className="field-plan__plan-name">{plan.title}</span>
                          <ChevronRightIcon className="field-plan__plan-chevron" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Plan detail */}
            {selectedPlan && (
              <>
                {/* Plan header */}
                <section className="field-plan__header-card">
                  <h3 className="field-plan__plan-title">{selectedPlan.title}</h3>
                  <div className="field-plan__progress">
                    <div className="field-plan__progress-track" aria-hidden="true">
                      <div
                        className="field-plan__progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="field-plan__progress-label">
                      {lineItemStatusSummary.completed}/{lineItems.length} completed
                    </span>
                  </div>
                  <div className="field-plan__summary-row">
                    <span className="field-plan__summary-stat">
                      <ClockIcon className="field-plan__summary-icon" />
                      {formatPlanPersonHours(selectedPlan, tasks, timeEntries)}
                    </span>
                    {deadlineSummary.overdue > 0 && (
                      <span className="field-plan__summary-stat field-plan__summary-stat--risk">
                        {deadlineSummary.overdue} overdue
                      </span>
                    )}
                    {deadlineSummary.atRisk > 0 && (
                      <span className="field-plan__summary-stat field-plan__summary-stat--warning">
                        {deadlineSummary.atRisk} at risk
                      </span>
                    )}
                  </div>
                </section>

                {/* In Progress section */}
                {statusGroups.inProgress.length > 0 && (
                  <section className="field-plan__section">
                    <h2 className="field-plan__section-title section-heading">
                      <PlayIcon className="field-plan__icon" />
                      In Progress
                      <CountBadge count={statusGroups.inProgress.length} variant="muted" />
                    </h2>
                    <div className="field-plan__task-list field-plan__task-list--active">
                      {statusGroups.inProgress.map(renderLineItemRow)}
                    </div>
                  </section>
                )}

                {/* Blocked section */}
                {statusGroups.blocked.length > 0 && (
                  <section className="field-plan__section">
                    <h2 className="field-plan__section-title section-heading section-heading--blocked">
                      <WarningIcon className="field-plan__icon" />
                      Blocked
                      <CountBadge count={statusGroups.blocked.length} variant="muted" />
                    </h2>
                    <div className="field-plan__task-list field-plan__task-list--blocked">
                      {statusGroups.blocked.map(renderLineItemRow)}
                    </div>
                  </section>
                )}

                {/* Pending section */}
                {statusGroups.pending.length > 0 && (
                  <section className="field-plan__section">
                    <h2 className="field-plan__section-title section-heading">
                      <TaskListIcon className="field-plan__icon" />
                      Pending
                      <CountBadge count={statusGroups.pending.length} variant="muted" />
                    </h2>
                    <div className="field-plan__task-list">
                      {statusGroups.pending.map(renderLineItemRow)}
                    </div>
                  </section>
                )}

                {/* Completed section (collapsible) */}
                {statusGroups.completed.length > 0 && (
                  <section className="field-plan__section field-plan__section--completed">
                    <button
                      type="button"
                      className="field-plan__collapsible-toggle"
                      onClick={() => setCompletedExpanded((prev) => !prev)}
                      aria-expanded={completedExpanded}
                    >
                      <CheckIcon className="field-plan__toggle-icon field-plan__toggle-icon--ready" />
                      <span>Completed</span>
                      <CountBadge count={statusGroups.completed.length} variant="muted" />
                      <ExpandChevronIcon
                        className={`field-plan__toggle-chevron${completedExpanded ? ' field-plan__toggle-chevron--expanded' : ''}`}
                      />
                    </button>
                    {completedExpanded && (
                      <div className="field-plan__task-list field-plan__task-list--completed">
                        {statusGroups.completed.map(renderLineItemRow)}
                      </div>
                    )}
                  </section>
                )}

                {/* Deferred section (collapsible) */}
                {statusGroups.deferred.length > 0 && (
                  <section className="field-plan__section field-plan__section--deferred">
                    <button
                      type="button"
                      className="field-plan__collapsible-toggle"
                      onClick={() => setDeferredExpanded((prev) => !prev)}
                      aria-expanded={deferredExpanded}
                    >
                      <span>Deferred</span>
                      <CountBadge count={statusGroups.deferred.length} variant="muted" />
                      <ExpandChevronIcon
                        className={`field-plan__toggle-chevron${deferredExpanded ? ' field-plan__toggle-chevron--expanded' : ''}`}
                      />
                    </button>
                    {deferredExpanded && (
                      <div className="field-plan__task-list field-plan__task-list--deferred">
                        {statusGroups.deferred.map(renderLineItemRow)}
                      </div>
                    )}
                  </section>
                )}

                {/* Unplanned tasks (collapsible) */}
                {unplannedTasks.length > 0 && (
                  <details className="field-plan__unplanned">
                    <summary>Unplanned tasks ({unplannedTasks.length})</summary>
                    <ul className="field-plan__unplanned-list">
                      {unplannedTasks.map((task) => (
                        <li key={task.id}>{task.title}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Export */}
                <button
                  type="button"
                  className="btn btn--primary btn--full"
                  onClick={() => {
                    void handleExportExecutionReturn();
                  }}
                >
                  Export Execution Return
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Action sheet for line item actions */}
      <ActionSheet
        isOpen={actionSheetItem !== null}
        onClose={() => setActionSheetItem(null)}
        title={actionSheetItem?.item.title ?? ''}
      >
        {actionSheetItem && (
          <div className="field-plan__action-list">
            {actionSheetItem.status === 'pending' && actionSheetItem.tasks.length === 0 && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  void handleReleaseToToday(actionSheetItem.item);
                  setActionSheetItem(null);
                }}
              >
                <PlayIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--primary" />
                <span>Release to Today</span>
              </button>
            )}

            {actionSheetItem.status !== 'completed' && actionSheetItem.status !== 'blocked' && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  const item = actionSheetItem.item;
                  setActionSheetItem(null);
                  void handleMarkBlocked(item);
                }}
              >
                <BlockedIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--warning" />
                <span>Mark Blocked</span>
              </button>
            )}

            {(actionSheetItem.status === 'pending' || actionSheetItem.status === 'blocked') && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  const item = actionSheetItem.item;
                  setActionSheetItem(null);
                  void handleMarkDeferred(item);
                }}
              >
                <span className="field-plan__action-btn-icon field-plan__action-btn-icon--muted">—</span>
                <span>Mark Deferred</span>
              </button>
            )}

            {actionSheetItem.status === 'blocked' && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  const item = actionSheetItem.item;
                  setActionSheetItem(null);
                  void handleClearBlock(item);
                }}
              >
                <CheckIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--ready" />
                <span>Clear Block</span>
              </button>
            )}

            {actionSheetItem.status === 'deferred' && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  const item = actionSheetItem.item;
                  setActionSheetItem(null);
                  void handleReactivateDeferred(item);
                }}
              >
                <PlayIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--primary" />
                <span>Reactivate</span>
              </button>
            )}

            <button
              type="button"
              className="field-plan__action-btn"
              onClick={() => {
                const item = actionSheetItem.item;
                setActionSheetItem(null);
                void handleAddNote(item);
              }}
            >
              <span className="field-plan__action-btn-icon field-plan__action-btn-icon--muted">+</span>
              <span>Add Note</span>
            </button>
          </div>
        )}
      </ActionSheet>
    </div>
  );
}
