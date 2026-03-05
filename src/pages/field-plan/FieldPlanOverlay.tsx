import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackIcon,
  BlockedIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  ExpandChevronIcon,
  PencilIcon,
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

// --- Types ---

interface FieldPlanOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormMode =
  | { kind: 'actions'; lineItem: FieldPlanLineItemSummary }
  | { kind: 'block'; lineItem: FieldPlanLineItemSummary }
  | { kind: 'defer'; lineItem: FieldPlanLineItemSummary }
  | { kind: 'note'; lineItem: FieldPlanLineItemSummary };

const BLOCK_CATEGORIES: { value: BlockCategory; label: string }[] = [
  { value: 'access', label: 'Access' },
  { value: 'materials', label: 'Materials' },
  { value: 'crew', label: 'Crew' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'other', label: 'Other' },
];

// --- Helpers ---

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

// --- Line Item Row Component ---

interface FieldPlanLineItemRowProps {
  lineItem: FieldPlanLineItemSummary;
  canExecute: boolean;
  onRelease: (item: PlanLineItem) => void;
  onOpenActions: (lineItem: FieldPlanLineItemSummary) => void;
}

function FieldPlanLineItemRow({
  lineItem,
  canExecute,
  onRelease,
  onOpenActions,
}: FieldPlanLineItemRowProps) {
  const { item, status, tasks: linkedTasks } = lineItem;
  const canRelease = canExecute && !item.removedFromSource && status === 'pending' && linkedTasks.length === 0;
  const canAct = canExecute && !item.removedFromSource;

  const leftAction = canRelease
    ? {
        label: 'Release',
        icon: <PlayIcon className="swipeable-row__action-icon" />,
        color: 'var(--color-primary)',
        onAction: () => onRelease(item),
      }
    : undefined;

  const rightAction = canAct
    ? {
        label: 'Actions',
        icon: <PencilIcon className="swipeable-row__action-icon" />,
        color: 'var(--color-text-muted)',
        onAction: () => onOpenActions(lineItem),
      }
    : undefined;

  return (
    <SwipeableRow
      leftAction={leftAction}
      rightAction={rightAction}
      onLongPress={canAct ? () => onOpenActions(lineItem) : undefined}
    >
      <button
        type="button"
        className={`field-plan-row field-plan-row--${status}${item.removedFromSource ? ' field-plan-row--removed' : ''}`}
        onClick={canAct ? () => onOpenActions(lineItem) : undefined}
      >
        <div className="field-plan-row__status-col">
          <span className={`field-plan-row__dot field-plan-row__dot--${status}`} />
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
          {linkedTasks.length > 0 && (
            <CountBadge count={linkedTasks.length} variant="muted" size="compact" />
          )}
          <ChevronRightIcon className="field-plan-row__chevron" />
        </div>
      </button>
    </SwipeableRow>
  );
}

// --- Action Sheet Forms ---

function BlockForm({
  lineItem,
  onSubmit,
  onCancel,
}: {
  lineItem: PlanLineItem;
  onSubmit: (reason: string, category: BlockCategory | null) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState(lineItem.blockReason ?? '');
  const [category, setCategory] = useState<BlockCategory | null>(lineItem.blockCategory ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSubmit = reason.trim().length > 0;

  return (
    <>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label" htmlFor="block-reason">Reason</label>
        <input
          ref={inputRef}
          id="block-reason"
          className="input"
          type="text"
          placeholder="What's blocking this?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label">Category</label>
        <div className="field-plan__category-pills" role="radiogroup" aria-label="Block category">
          {BLOCK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              className={`field-plan__category-pill${category === cat.value ? ' field-plan__category-pill--active' : ''}`}
              onClick={() => setCategory(category === cat.value ? null : cat.value)}
              role="radio"
              aria-checked={category === cat.value}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--warning btn--lg"
            onClick={() => canSubmit && onSubmit(reason.trim(), category)}
            disabled={!canSubmit}
          >
            Block
          </button>
        </div>
      </div>
    </>
  );
}

function DeferForm({
  lineItem,
  onSubmit,
  onCancel,
}: {
  lineItem: PlanLineItem;
  onSubmit: (note: string | null) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(lineItem.deferredNote ?? '');

  return (
    <>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label" htmlFor="defer-note">Note (optional)</label>
        <input
          id="defer-note"
          className="input"
          type="text"
          placeholder="Why is this deferred?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </div>
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => onSubmit(note.trim() || null)}
          >
            Defer
          </button>
        </div>
      </div>
    </>
  );
}

function NoteForm({
  lineItem,
  onSubmit,
  onCancel,
}: {
  lineItem: PlanLineItem;
  onSubmit: (note: string | null) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(lineItem.executorNote ?? '');

  return (
    <>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label" htmlFor="executor-note">Note</label>
        <input
          id="executor-note"
          className="input"
          type="text"
          placeholder="Add a note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </div>
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => onSubmit(note.trim() || null)}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}

// --- Main Overlay ---

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
  const [formMode, setFormMode] = useState<FormMode | null>(null);

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
    setFormMode(null);
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

  const progressPercent = useMemo(
    () => lineItems.length === 0 ? 0 : Math.round((lineItemStatusSummary.completed / lineItems.length) * 100),
    [lineItems.length, lineItemStatusSummary.completed],
  );

  const deadlineSummary = useMemo(() => {
    const actionable = lineItems.filter((item) => item.deadlineStatus !== 'unscheduled');
    const overdue = actionable.filter((item) => item.deadlineStatus === 'overdue').length;
    const atRisk = actionable.filter((item) => item.deadlineStatus === 'at-risk').length;
    const done = actionable.filter((item) => item.deadlineStatus === 'done-on-time' || item.deadlineStatus === 'done-late').length;
    return { total: actionable.length, overdue, atRisk, done };
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
    (lineItem: PlanLineItem) => {
      if (!selectedPlan || !canExecute || lineItem.removedFromSource) return;
      const alreadyReleased = tasks.some(
        (task) => task.sourcePlanId === selectedPlan.id && task.sourceLineItemId === lineItem.id,
      );
      if (alreadyReleased) return;

      void createTask(lineItemToCreateTaskInput(lineItem, {
        planId: selectedPlan.id,
        projectId: selectedPlan.projectId,
      }));
    },
    [canExecute, selectedPlan, tasks],
  );

  const handleBlockSubmit = useCallback(
    async (lineItemId: string, reason: string, category: BlockCategory | null) => {
      if (!canExecute || !selectedPlan) return;
      await patchLineItem(lineItemId, {
        executionStatus: 'blocked',
        blockReason: reason,
        blockCategory: category,
      });
      await syncLineItemBlockToTasks(selectedPlan.id, lineItemId, reason, category);
    },
    [canExecute, patchLineItem, selectedPlan],
  );

  const handleDeferSubmit = useCallback(
    async (lineItemId: string, note: string | null) => {
      if (!canExecute) return;
      await patchLineItem(lineItemId, {
        executionStatus: 'deferred',
        deferredNote: note,
        blockReason: null,
        blockCategory: null,
      });
    },
    [canExecute, patchLineItem],
  );

  const handleNoteSubmit = useCallback(
    async (lineItemId: string, note: string | null) => {
      if (!canExecute) return;
      await patchLineItem(lineItemId, {
        executorNote: note,
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

  const closeForm = useCallback(() => setFormMode(null), []);

  const openActions = useCallback(
    (lineItem: FieldPlanLineItemSummary) => setFormMode({ kind: 'actions', lineItem }),
    [],
  );

  // Derive ActionSheet title and content from formMode
  const sheetTitle = formMode
    ? formMode.kind === 'block' ? 'Mark Blocked'
      : formMode.kind === 'defer' ? 'Mark Deferred'
      : formMode.kind === 'note' ? 'Add Note'
      : formMode.lineItem.item.title
    : '';

  if (!isOpen) return null;

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
                onClick={() => { void handleApplyImport('replace'); }}
              >
                {preview.conflict === 'merge' ? 'Merge Import' : 'Apply Import'}
              </button>
              {preview.conflict === 'replace-or-skip' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={isApplyingImport}
                  onClick={() => { void handleApplyImport('skip'); }}
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

                {/* In Progress */}
                {statusGroups.inProgress.length > 0 && (
                  <section className="field-plan__section">
                    <h2 className="field-plan__section-title section-heading">
                      <PlayIcon className="field-plan__icon" />
                      In Progress
                      <CountBadge count={statusGroups.inProgress.length} variant="muted" />
                    </h2>
                    <div className="field-plan__task-list field-plan__task-list--active">
                      {statusGroups.inProgress.map((li) => (
                        <FieldPlanLineItemRow
                          key={li.item.id}
                          lineItem={li}
                          canExecute={canExecute}
                          onRelease={handleReleaseToToday}
                          onOpenActions={openActions}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Blocked */}
                {statusGroups.blocked.length > 0 && (
                  <section className="field-plan__section">
                    <h2 className="field-plan__section-title section-heading section-heading--blocked">
                      <WarningIcon className="field-plan__icon" />
                      Blocked
                      <CountBadge count={statusGroups.blocked.length} variant="muted" />
                    </h2>
                    <div className="field-plan__task-list field-plan__task-list--blocked">
                      {statusGroups.blocked.map((li) => (
                        <FieldPlanLineItemRow
                          key={li.item.id}
                          lineItem={li}
                          canExecute={canExecute}
                          onRelease={handleReleaseToToday}
                          onOpenActions={openActions}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Pending */}
                {statusGroups.pending.length > 0 && (
                  <section className="field-plan__section">
                    <h2 className="field-plan__section-title section-heading">
                      <TaskListIcon className="field-plan__icon" />
                      Pending
                      <CountBadge count={statusGroups.pending.length} variant="muted" />
                    </h2>
                    <div className="field-plan__task-list">
                      {statusGroups.pending.map((li) => (
                        <FieldPlanLineItemRow
                          key={li.item.id}
                          lineItem={li}
                          canExecute={canExecute}
                          onRelease={handleReleaseToToday}
                          onOpenActions={openActions}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Completed (collapsible) */}
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
                        {statusGroups.completed.map((li) => (
                          <FieldPlanLineItemRow
                            key={li.item.id}
                            lineItem={li}
                            canExecute={canExecute}
                            onRelease={handleReleaseToToday}
                            onOpenActions={openActions}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Deferred (collapsible) */}
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
                        {statusGroups.deferred.map((li) => (
                          <FieldPlanLineItemRow
                            key={li.item.id}
                            lineItem={li}
                            canExecute={canExecute}
                            onRelease={handleReleaseToToday}
                            onOpenActions={openActions}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Unplanned tasks */}
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
                  onClick={() => { void handleExportExecutionReturn(); }}
                >
                  Export Execution Return
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Unified ActionSheet — actions menu or inline form */}
      <ActionSheet
        isOpen={formMode !== null}
        onClose={closeForm}
        title={sheetTitle}
      >
        {formMode?.kind === 'actions' && (
          <div className="field-plan__action-list">
            {formMode.lineItem.status === 'pending' && formMode.lineItem.tasks.length === 0 && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  handleReleaseToToday(formMode.lineItem.item);
                  closeForm();
                }}
              >
                <PlayIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--primary" />
                <span>Release to Today</span>
              </button>
            )}

            {formMode.lineItem.status !== 'completed' && formMode.lineItem.status !== 'blocked' && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => setFormMode({ kind: 'block', lineItem: formMode.lineItem })}
              >
                <BlockedIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--warning" />
                <span>Mark Blocked</span>
              </button>
            )}

            {(formMode.lineItem.status === 'pending' || formMode.lineItem.status === 'blocked') && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => setFormMode({ kind: 'defer', lineItem: formMode.lineItem })}
              >
                <span className="field-plan__action-btn-icon field-plan__action-btn-icon--muted">—</span>
                <span>Mark Deferred</span>
              </button>
            )}

            {formMode.lineItem.status === 'blocked' && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  void handleClearBlock(formMode.lineItem.item);
                  closeForm();
                }}
              >
                <CheckIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--ready" />
                <span>Clear Block</span>
              </button>
            )}

            {formMode.lineItem.status === 'deferred' && (
              <button
                type="button"
                className="field-plan__action-btn"
                onClick={() => {
                  void handleReactivateDeferred(formMode.lineItem.item);
                  closeForm();
                }}
              >
                <PlayIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--primary" />
                <span>Reactivate</span>
              </button>
            )}

            <button
              type="button"
              className="field-plan__action-btn"
              onClick={() => setFormMode({ kind: 'note', lineItem: formMode.lineItem })}
            >
              <PencilIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--muted" />
              <span>Add Note</span>
            </button>
          </div>
        )}

        {formMode?.kind === 'block' && (
          <BlockForm
            lineItem={formMode.lineItem.item}
            onSubmit={(reason, category) => {
              void handleBlockSubmit(formMode.lineItem.item.id, reason, category);
              closeForm();
            }}
            onCancel={closeForm}
          />
        )}

        {formMode?.kind === 'defer' && (
          <DeferForm
            lineItem={formMode.lineItem.item}
            onSubmit={(note) => {
              void handleDeferSubmit(formMode.lineItem.item.id, note);
              closeForm();
            }}
            onCancel={closeForm}
          />
        )}

        {formMode?.kind === 'note' && (
          <NoteForm
            lineItem={formMode.lineItem.item}
            onSubmit={(note) => {
              void handleNoteSubmit(formMode.lineItem.item.id, note);
              closeForm();
            }}
            onCancel={closeForm}
          />
        )}
      </ActionSheet>
    </div>
  );
}
