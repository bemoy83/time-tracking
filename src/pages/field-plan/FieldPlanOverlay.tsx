import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { BackIcon, ChevronRightIcon } from '../../components/icons';
import { getAllPlans, getAllTimeEntries, updatePlan } from '../../lib/db';
import { lineItemToCreateTaskInput } from '../../lib/planning/release-plan';
import {
  type BlockCategory,
  type Plan,
  type PlanLineItem,
  updatePlanLineItem,
} from '../../lib/planning/plan-model';
import { createTask, useTaskStore } from '../../lib/stores/task-store';
import { nowUtc, WORK_UNIT_LABELS, BUILD_PHASE_LABELS, type TimeEntry } from '../../lib/types';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../lib/interop/data-transfer/plan-package';
import type { PlanPackageImportPreview } from '../../lib/interop/data-transfer/contracts';
import { buildExecutionReturnEnvelope } from '../../lib/interop/data-transfer/execution-return';
import { downloadJson } from '../../lib/interop/download-json';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  buildFieldPlanLineItemSummaries,
  summarizeLineItemStatuses,
  type FieldPlanLineItemSummary,
} from './field-plan-model';

type GroupMode = 'phase' | 'flat';

const GROUP_MODE_STORAGE_KEY = 'fieldPlan.groupMode';

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

  return `${personHours.toFixed(1)} person-hrs`;
}

function sanitizeFileNameSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plan';
}

function getStatusLabel(status: FieldPlanLineItemSummary['status']): string {
  if (status === 'in-progress') return 'In Progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getDeadlineLabel(status: FieldPlanLineItemSummary['deadlineStatus']): string {
  switch (status) {
    case 'due-today': return 'Due today';
    case 'on-track': return 'On track';
    case 'at-risk': return 'At risk';
    case 'overdue': return 'Overdue';
    case 'done-on-time': return 'Done on time';
    case 'done-late': return 'Done late';
    case 'needs-replanning': return 'Needs replanning';
    case 'unscheduled':
    default:
      return 'Unscheduled';
  }
}

function getGroupModeInitialValue(): GroupMode {
  try {
    const stored = sessionStorage.getItem(GROUP_MODE_STORAGE_KEY);
    if (stored === 'flat') return 'flat';
  } catch {
    // Ignore storage failures.
  }
  return 'phase';
}

export function FieldPlanOverlay({ isOpen, onClose }: FieldPlanOverlayProps) {
  const { tasks } = useTaskStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>(getGroupModeInitialValue);
  const [message, setMessage] = useState<string | null>(null);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PlanPackageImportPreview | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  const reloadData = useCallback(async () => {
    const [allPlans, allTimeEntries] = await Promise.all([getAllPlans(), getAllTimeEntries()]);
    setPlans(sortExecutorPlans(allPlans.filter(isExecutorPlan)));
    setTimeEntries(allTimeEntries);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setMessage(null);
    setPreview(null);
    void reloadData();
  }, [isOpen, reloadData]);

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

  useEffect(() => {
    if (!isOpen) return;
    try {
      sessionStorage.setItem(GROUP_MODE_STORAGE_KEY, groupMode);
    } catch {
      // Ignore storage failures.
    }
  }, [groupMode, isOpen]);

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

  const lineItemsByPhase = useMemo(() => {
    const grouped = {
      'build-up': [] as FieldPlanLineItemSummary[],
      'tear-down': [] as FieldPlanLineItemSummary[],
    };

    for (const lineItem of lineItems) {
      grouped[lineItem.item.buildPhase].push(lineItem);
    }

    return grouped;
  }, [lineItems]);

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
    if (deadlineSummary.overdue > 0 || deadlineSummary.atRisk > 0) {
      trackTelemetryEvent('schedule_deadline_risk_visible');
    }
  }, [deadlineSummary.atRisk, deadlineSummary.overdue, isOpen]);

  const unplannedTasks = useMemo(() => {
    if (!selectedPlan || selectedPlan.projectId == null) return [];
    return tasks.filter(
      (task) => task.projectId === selectedPlan.projectId && task.sourcePlanId == null,
    );
  }, [selectedPlan, tasks]);

  const canExecute = selectedPlan?.status === 'received';

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
      if (!canExecute) return;
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
    },
    [canExecute, patchLineItem],
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
      if (!canExecute) return;
      await patchLineItem(lineItem.id, {
        executionStatus: 'pending',
        blockReason: null,
        blockCategory: null,
      });
    },
    [canExecute, patchLineItem],
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

  const handleCloseSession = useCallback(async () => {
    if (!selectedPlan || selectedPlan.status !== 'received') return;

    const summary = summarizeLineItemStatuses(lineItems);
    const summaryText = [
      `Completed: ${summary.completed}`,
      `Blocked: ${summary.blocked}`,
      `Deferred: ${summary.deferred}`,
      `Unplanned tasks: ${unplannedTasks.length}`,
    ].join('\n');

    const confirmed = window.confirm(`Close session and export execution return?\n\n${summaryText}`);
    if (!confirmed) return;

    try {
      const latestEntries = await getAllTimeEntries();
      setTimeEntries(latestEntries);

      const envelope = buildExecutionReturnEnvelope(selectedPlan, tasks, latestEntries);
      const stamp = new Date().toISOString().slice(0, 10);
      const titleKey = sanitizeFileNameSegment(selectedPlan.title);
      downloadJson(`execution-return-${titleKey}-${stamp}.json`, envelope);
      trackTelemetryEvent('interop_execution_return_export');

      const closedAt = nowUtc();
      const closedPlan: Plan = {
        ...selectedPlan,
        status: 'session-closed',
        sessionClosedAt: closedAt,
        updatedAt: closedAt,
      };
      await updatePlan(closedPlan);
      setPlans((prev) => sortExecutorPlans(prev.map((plan) => (plan.id === closedPlan.id ? closedPlan : plan))));
      setSelectedPlanId(closedPlan.id);
      setMessage('Session closed and execution return exported.');
      trackTelemetryEvent('interop_session_close');
    } catch {
      setMessage('Failed to close session. Please try again.');
      trackTelemetryEvent('interop_session_close_failed');
    }
  }, [lineItems, selectedPlan, tasks, unplannedTasks.length]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setMessage(null);
    setPreview(null);
    setIsLoadingPreview(true);

    try {
      const text = await file.text();
      const parsed = parsePlanPackageJson(text);
      if (!parsed.ok) {
        setMessage(parsed.error);
        return;
      }

      const nextPreview = await previewPlanPackageImport(parsed.envelope);
      setPreview(nextPreview);
      trackTelemetryEvent('interop_plan_package_preview');
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  const handleApplyImport = useCallback(async (resolution: 'replace' | 'skip' = 'replace') => {
    if (!preview) return;
    setIsApplyingImport(true);
    try {
      const result = await applyPlanPackageImport(preview, resolution);
      setMessage(result.reason);
      if (result.applied) {
        setPreview(null);
        await reloadData();
        setSelectedPlanId(preview.planId);
        trackTelemetryEvent(result.merged ? 'interop_plan_package_merge' : 'interop_plan_package_import');
        if (preview.envelope.schemaVersion === '1.0') {
          trackTelemetryEvent('schedule_import_defaulted');
        }
      } else if (resolution === 'skip') {
        trackTelemetryEvent('interop_plan_package_skip');
      } else {
        trackTelemetryEvent('interop_plan_package_conflict');
      }
    } finally {
      setIsApplyingImport(false);
    }
  }, [preview, reloadData]);

  if (!isOpen) return null;

  return (
    <div className="field-plan-overlay" role="dialog" aria-modal="true" aria-label="Field Plan View">
      <header className="field-plan-overlay__header">
        <button type="button" className="field-plan-overlay__back" onClick={onClose}>
          <BackIcon className="field-plan-overlay__back-icon" />
          <span>Today</span>
        </button>
        <h2 className="field-plan-overlay__title">Field Plan</h2>
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
            <section className="field-plan-overlay__plan-selector">
              <div className="field-plan-overlay__plan-group">
                <h3>Received Plans</h3>
                {receivedPlans.length === 0 && (
                  <p className="field-plan-overlay__empty-text">No active received plans.</p>
                )}
                {receivedPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`field-plan-overlay__plan-btn${selectedPlanId === plan.id ? ' field-plan-overlay__plan-btn--active' : ''}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <span>{plan.title}</span>
                    <ChevronRightIcon className="field-plan-overlay__plan-chevron" />
                  </button>
                ))}
              </div>

              {closedPlans.length > 0 && (
                <div className="field-plan-overlay__plan-group">
                  <button
                    type="button"
                    className="field-plan-overlay__past-toggle"
                    onClick={() => setShowPastEvents((prev) => !prev)}
                    aria-expanded={showPastEvents}
                  >
                    <span>Past events ({closedPlans.length})</span>
                    <ChevronRightIcon
                      className={`field-plan-overlay__past-chevron${showPastEvents ? ' field-plan-overlay__past-chevron--open' : ''}`}
                    />
                  </button>

                  {showPastEvents && (
                    <div className="field-plan-overlay__past-list">
                      {closedPlans.map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          className={`field-plan-overlay__plan-btn${selectedPlanId === plan.id ? ' field-plan-overlay__plan-btn--active' : ''}`}
                          onClick={() => setSelectedPlanId(plan.id)}
                        >
                          <span>{plan.title}</span>
                          <ChevronRightIcon className="field-plan-overlay__plan-chevron" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {selectedPlan && (
              <section className="field-plan-detail">
                <header className="field-plan-detail__header">
                  <h3 className="field-plan-detail__title">{selectedPlan.title}</h3>
                  <p className="field-plan-detail__meta">
                    {lineItemStatusSummary.completed} of {lineItems.length} completed · {formatPlanPersonHours(selectedPlan, tasks, timeEntries)}
                  </p>
                  {deadlineSummary.total > 0 && (
                    <p className="field-plan-detail__meta">
                      {deadlineSummary.done} of {deadlineSummary.total} should be complete by now · {deadlineSummary.overdue} overdue · {deadlineSummary.atRisk} at risk
                    </p>
                  )}
                  <div className="field-plan-detail__progress-track" aria-hidden="true">
                    <div
                      className="field-plan-detail__progress-fill"
                      style={{
                        width: lineItems.length === 0
                          ? '0%'
                          : `${Math.round((lineItemStatusSummary.completed / lineItems.length) * 100)}%`,
                      }}
                    />
                  </div>
                </header>

                <div className="field-plan-detail__status-row">
                  <span>Blocked: {lineItemStatusSummary.blocked}</span>
                  <span>In progress: {lineItemStatusSummary.inProgress}</span>
                  <span>Deferred: {lineItemStatusSummary.deferred}</span>
                  <span>Pending: {lineItemStatusSummary.pending}</span>
                </div>

                <div className="field-plan-detail__toolbar">
                  <button
                    type="button"
                    className={`btn btn--sm ${groupMode === 'phase' ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setGroupMode('phase')}
                  >
                    Grouped
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm ${groupMode === 'flat' ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setGroupMode('flat')}
                  >
                    Flat
                  </button>
                </div>

                {groupMode === 'phase' ? (
                  <div className="field-plan-detail__groups">
                    {(['build-up', 'tear-down'] as const).map((phase) => (
                      <div key={phase} className="field-plan-detail__group">
                        <h4 className="field-plan-detail__group-title">{BUILD_PHASE_LABELS[phase]}</h4>
                        {lineItemsByPhase[phase].length === 0 ? (
                          <p className="field-plan-detail__empty-group">No line items.</p>
                        ) : (
                          lineItemsByPhase[phase].map((lineItem) => (
                            <LineItemCard
                              key={lineItem.item.id}
                              lineItem={lineItem}
                              canExecute={canExecute}
                              onRelease={handleReleaseToToday}
                              onMarkBlocked={handleMarkBlocked}
                              onMarkDeferred={handleMarkDeferred}
                              onAddNote={handleAddNote}
                              onClearBlock={handleClearBlock}
                              onReactivateDeferred={handleReactivateDeferred}
                            />
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="field-plan-detail__group">
                    {lineItems.map((lineItem) => (
                      <LineItemCard
                        key={lineItem.item.id}
                        lineItem={lineItem}
                        canExecute={canExecute}
                        onRelease={handleReleaseToToday}
                        onMarkBlocked={handleMarkBlocked}
                        onMarkDeferred={handleMarkDeferred}
                        onAddNote={handleAddNote}
                        onClearBlock={handleClearBlock}
                        onReactivateDeferred={handleReactivateDeferred}
                      />
                    ))}
                  </div>
                )}

                <details className="field-plan-detail__unplanned">
                  <summary>Unplanned tasks ({unplannedTasks.length})</summary>
                  {unplannedTasks.length === 0 ? (
                    <p className="field-plan-detail__empty-group">No unplanned tasks this session.</p>
                  ) : (
                    <ul>
                      {unplannedTasks.map((task) => (
                        <li key={task.id}>{task.title}</li>
                      ))}
                    </ul>
                  )}
                </details>

                {selectedPlan.status === 'received' ? (
                  <button
                    type="button"
                    className="btn btn--primary field-plan-detail__close-session"
                    onClick={() => {
                      void handleCloseSession();
                    }}
                  >
                    Close Session & Export Return
                  </button>
                ) : (
                  <p className="field-plan-detail__closed-note">
                    Session closed {selectedPlan.sessionClosedAt ? new Date(selectedPlan.sessionClosedAt).toLocaleString() : ''}.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface LineItemCardProps {
  lineItem: FieldPlanLineItemSummary;
  canExecute: boolean;
  onRelease: (lineItem: PlanLineItem) => Promise<void>;
  onMarkBlocked: (lineItem: PlanLineItem) => Promise<void>;
  onMarkDeferred: (lineItem: PlanLineItem) => Promise<void>;
  onAddNote: (lineItem: PlanLineItem) => Promise<void>;
  onClearBlock: (lineItem: PlanLineItem) => Promise<void>;
  onReactivateDeferred: (lineItem: PlanLineItem) => Promise<void>;
}

function LineItemCard({
  lineItem,
  canExecute,
  onRelease,
  onMarkBlocked,
  onMarkDeferred,
  onAddNote,
  onClearBlock,
  onReactivateDeferred,
}: LineItemCardProps) {
  const { item, status, tasks } = lineItem;

  return (
    <article className={`field-line-item field-line-item--${status}${item.removedFromSource ? ' field-line-item--removed' : ''}`}>
      <div className="field-line-item__header">
        <h5 className="field-line-item__title">{item.title}</h5>
        <span className="field-line-item__status">{getStatusLabel(status)}</span>
      </div>

      <p className="field-line-item__meta">
        {item.workTypeTitle} · {item.workQuantity} {WORK_UNIT_LABELS[item.workUnit]} · {item.crew} workers · {item.timeHours.toFixed(1)}h
      </p>
      <p className="field-line-item__meta">
        {getDeadlineLabel(lineItem.deadlineStatus)}
        {lineItem.dueDate ? ` · Due ${lineItem.dueDate}` : ''}
      </p>

      {item.removedFromSource && (
        <p className="field-line-item__notice">Removed from latest planner package.</p>
      )}

      {item.blockReason && (
        <p className="field-line-item__notice">Blocked: {item.blockReason}</p>
      )}

      {item.deferredNote && (
        <p className="field-line-item__notice">Deferred: {item.deferredNote}</p>
      )}

      {item.executorNote && (
        <p className="field-line-item__note">Note: {item.executorNote}</p>
      )}

      <p className="field-line-item__meta">Linked tasks: {tasks.length}</p>

      {canExecute && !item.removedFromSource && (
        <div className="field-line-item__actions">
          {status === 'pending' && tasks.length === 0 && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                void onRelease(item);
              }}
            >
              Release to Today
            </button>
          )}

          {status !== 'completed' && status !== 'blocked' && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                void onMarkBlocked(item);
              }}
            >
              Mark Blocked
            </button>
          )}

          {(status === 'pending' || status === 'blocked') && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                void onMarkDeferred(item);
              }}
            >
              Mark Deferred
            </button>
          )}

          {status === 'blocked' && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                void onClearBlock(item);
              }}
            >
              Clear Block
            </button>
          )}

          {status === 'deferred' && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                void onReactivateDeferred(item);
              }}
            >
              Reactivate
            </button>
          )}

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              void onAddNote(item);
            }}
          >
            Add Note
          </button>
        </div>
      )}
    </article>
  );
}
