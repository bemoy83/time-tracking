import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllPlans, getAllTimeEntries, updatePlan } from '../../lib/db';
import { buildExecutionReturnEnvelope } from '../../lib/interop/data-transfer/execution-return';
import { downloadJson } from '../../lib/interop/download-json';
import type { BlockCategory, Plan, PlanLineItem } from '../../lib/planning/plan-model';
import { updatePlanLineItem, phaseFieldUpdates } from '../../lib/planning/plan-model';
import { lineItemToCreateTaskInput } from '../../lib/planning/release-plan';
import {
  syncLineItemBlockToTasks,
  syncLineItemUnblockToTasks,
} from '../../lib/planning/task-plan-block-sync';
import { createTask, useTaskStore } from '../../lib/stores/task-store';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { nowUtc, type TimeEntry, type BuildPhase } from '../../lib/types';
import { sanitizeFileNameSegment } from '../../lib/utils/sanitize-filename';
import {
  buildFieldPlanLineItemSummaries,
  summarizeLineItemStatuses,
  type FieldPlanLineItemSummary,
} from './field-plan-model';
import {
  formatPlanPersonHours,
  groupByStatus,
  isExecutorPlan,
  sortExecutorPlans,
} from './field-plan-overlay-helpers';
import type { FormMode } from './field-plan-overlay-types';
import { useFieldPlanImport } from './useFieldPlanImport';

export function useFieldPlanModel() {
  const { tasks, projects } = useTaskStore();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [deferredExpanded, setDeferredExpanded] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<'all' | BuildPhase>('all');
  const [viewMode, setViewMode] = useState<'by-plan' | 'by-phase'>('by-plan');

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

  // Reset state and load data on mount
  useEffect(() => {
    setMessage(null);
    resetImportPreview();
    setCompletedExpanded(false);
    setDeferredExpanded(false);
    setFormMode(null);
    void reloadData();
  }, [reloadData, resetImportPreview]);

  // Auto-select a plan when plans change; reset phase filter on plan change
  useEffect(() => {
    const hasSelection = selectedPlanId != null && plans.some((plan) => plan.id === selectedPlanId);
    if (hasSelection) return;

    setPhaseFilter('all');

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
  }, [plans, selectedPlanId]);

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

  const projectColor = useMemo(() => {
    if (!selectedPlan?.projectId) return undefined;
    return projects.find((p) => p.id === selectedPlan.projectId)?.color;
  }, [selectedPlan?.projectId, projects]);

  const lineItems = useMemo(() => {
    if (!selectedPlan) return [];
    return buildFieldPlanLineItemSummaries(selectedPlan, tasks, timeEntries);
  }, [selectedPlan, tasks, timeEntries]);

  const allActiveLineItems = useMemo(
    () => receivedPlans.flatMap((plan) => buildFieldPlanLineItemSummaries(plan, tasks, timeEntries)),
    [receivedPlans, tasks, timeEntries],
  );

  const displayLineItems = useMemo(
    () => phaseFilter === 'all' ? lineItems : lineItems.filter((li) => li.phase === phaseFilter),
    [lineItems, phaseFilter],
  );

  const lineItemStatusSummary = useMemo(
    () => summarizeLineItemStatuses(displayLineItems),
    [displayLineItems],
  );

  const statusGroups = useMemo(() => groupByStatus(displayLineItems), [displayLineItems]);

  const progressPercent = useMemo(
    () => displayLineItems.length === 0 ? 0 : Math.round((lineItemStatusSummary.completed / displayLineItems.length) * 100),
    [displayLineItems.length, lineItemStatusSummary.completed],
  );

  const deadlineSummary = useMemo(() => {
    const actionable = lineItems.filter((item) => item.deadlineStatus !== 'unscheduled');
    const overdue = actionable.filter((item) => item.deadlineStatus === 'overdue').length;
    const atRisk = actionable.filter((item) => item.deadlineStatus === 'at-risk').length;
    const done = actionable.filter((item) => item.deadlineStatus === 'done-on-time' || item.deadlineStatus === 'done-late').length;
    return { total: actionable.length, overdue, atRisk, done };
  }, [lineItems]);

  useEffect(() => {
    const hasRisk = deadlineSummary.overdue > 0 || deadlineSummary.atRisk > 0;
    if (hasRisk && !hadDeadlineRiskRef.current) {
      trackTelemetryEvent('schedule_deadline_risk_visible');
    }
    hadDeadlineRiskRef.current = hasRisk;
  }, [deadlineSummary.atRisk, deadlineSummary.overdue]);

  const unplannedTasks = useMemo(() => {
    if (!selectedPlan || selectedPlan.projectId == null) return [];
    return tasks.filter(
      (task) => task.projectId === selectedPlan.projectId && task.sourcePlanId == null,
    );
  }, [selectedPlan, tasks]);

  const selectedPlanPersonHours = useMemo(() => {
    if (!selectedPlan) return '0.0h';
    return formatPlanPersonHours(selectedPlan, tasks, timeEntries);
  }, [selectedPlan, tasks, timeEntries]);

  const canExecute =
    selectedPlan?.status === 'received' || selectedPlan?.status === 'session-closed';

  const patchLineItem = useCallback(
    async (planId: string, lineItemId: string, updates: Partial<Omit<PlanLineItem, 'id'>>) => {
      const targetPlan = plans.find((p) => p.id === planId);
      if (!targetPlan) return;
      const nextPlan = updatePlanLineItem(targetPlan, lineItemId, updates);
      await updatePlan(nextPlan);
      setPlans((prev) => prev.map((p) => (p.id === nextPlan.id ? nextPlan : p)));
    },
    [plans],
  );

  const handleReleaseToToday = useCallback(
    (lineItem: FieldPlanLineItemSummary) => {
      if (!lineItem.planCanExecute || lineItem.item.removedFromSource) return;
      const alreadyReleased = tasks.some(
        (task) =>
          task.sourcePlanId === lineItem.planId
          && task.sourceLineItemId === lineItem.item.id
          && (task.buildPhase ?? 'build-up') === lineItem.phase,
      );
      if (alreadyReleased) return;

      void createTask(lineItemToCreateTaskInput(
        lineItem.item,
        lineItem.phase,
        {
          planId: lineItem.planId,
          projectId: lineItem.planProjectId,
        },
      ));
    },
    [tasks],
  );

  const handleBlockSubmit = useCallback(
    async (lineItemId: string, phase: BuildPhase, planId: string, reason: string, category: BlockCategory | null) => {
      await patchLineItem(planId, lineItemId, phaseFieldUpdates(phase, {
        executionStatus: 'blocked',
        blockReason: reason,
        blockCategory: category,
      }));
      await syncLineItemBlockToTasks(planId, lineItemId, reason, category);
    },
    [patchLineItem],
  );

  const handleDeferSubmit = useCallback(
    async (lineItemId: string, phase: BuildPhase, planId: string, note: string | null) => {
      await patchLineItem(planId, lineItemId, phaseFieldUpdates(phase, {
        executionStatus: 'deferred',
        deferredNote: note,
        blockReason: null,
        blockCategory: null,
      }));
    },
    [patchLineItem],
  );

  const handleNoteSubmit = useCallback(
    async (lineItemId: string, phase: BuildPhase, planId: string, note: string | null) => {
      await patchLineItem(planId, lineItemId, phaseFieldUpdates(phase, {
        executorNote: note,
      }));
    },
    [patchLineItem],
  );

  const handleClearBlock = useCallback(
    async (lineItem: FieldPlanLineItemSummary) => {
      await patchLineItem(lineItem.planId, lineItem.item.id, phaseFieldUpdates(lineItem.phase, {
        executionStatus: 'pending',
        blockReason: null,
        blockCategory: null,
      }));
      await syncLineItemUnblockToTasks(lineItem.planId, lineItem.item.id);
    },
    [patchLineItem],
  );

  const handleReactivateDeferred = useCallback(
    async (lineItem: FieldPlanLineItemSummary) => {
      await patchLineItem(lineItem.planId, lineItem.item.id, phaseFieldUpdates(lineItem.phase, {
        executionStatus: 'pending',
        deferredNote: null,
      }));
    },
    [patchLineItem],
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

  return {
    isLoadingPreview,
    preview,
    isApplyingImport,
    handleFileChange,
    handleApplyImport,

    plans,
    receivedPlans,
    closedPlans,
    selectedPlan,
    selectedPlanId,
    projectColor,
    showPastEvents,
    message,
    formMode,
    completedExpanded,
    deferredExpanded,
    phaseFilter,

    lineItems,
    allActiveLineItems,
    lineItemStatusSummary,
    statusGroups,
    progressPercent,
    deadlineSummary,
    selectedPlanPersonHours,
    unplannedTasks,
    canExecute,
    viewMode,

    setSelectedPlanId,
    togglePastEvents: () => setShowPastEvents((prev) => !prev),
    toggleCompletedExpanded: () => setCompletedExpanded((prev) => !prev),
    toggleDeferredExpanded: () => setDeferredExpanded((prev) => !prev),
    setFormMode,
    setPhaseFilter,
    setViewMode,

    closeForm,
    openActions,
    handleReleaseToToday,
    handleBlockSubmit,
    handleDeferSubmit,
    handleNoteSubmit,
    handleClearBlock,
    handleReactivateDeferred,
    handleExportExecutionReturn,
  };
}
