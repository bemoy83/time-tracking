import { useEffect, useMemo, useState } from 'react';
import { useCrewPoolStore } from '../../lib/stores/crew-pool-store';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { usePlanLineItemImport } from './hooks/usePlanLineItemImport';
import { type Project } from '../../lib/types';
import type { WorkTypeKpi } from '../../lib/kpi';
import { generatePlanSuggestions } from '../../lib/planning/plan-suggestions';
import {
  type Plan,
  type PlanLineItem,
  addLineItemToPlan,
  duplicateAllLineItemsInPlan,
  duplicateLineItem,
  getPlanDisplayName,
  planTotalPersonHours,
  removeAllLineItemsFromPlan,
  removeLineItemFromPlan,
  updatePlanLineItem,
} from '../../lib/planning/plan-model';
import {
  applyProjectPhaseDatesToPlan,
  setPlanDefaultCrewSize,
  setPlanDefaultEfficiency,
  setPlanEventDate,
  setPlanPhaseDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import {
  dayAvailablePersonHours,
  generateDefaultWorkCalendarForSpans,
} from '../../lib/planning/scheduling/work-calendar';
import { ChevronLeftIcon } from '../../components/icons';
import { ProjectPicker } from '../../components/ProjectPicker';
import { WorkPackageTable } from './WorkPackageTable';
import { shouldClearPlanProjectId } from './plan-editor-state';
import { PlanScheduleInputsPanel } from './schedule/PlanScheduleInputsPanel';
import {
  type PhaseDateField,
  getPrimaryScheduleRange,
  getScheduleRangeForWorkCalendar,
  getWorkCalendarPhaseSpans,
  readPhaseDateValues,
} from './schedule/schedule-date-ui';
import {
  ensureProjectColorAssigned,
  getProjectById,
  hasProjectPhaseDates,
} from '../../lib/stores/task-store';
import { PlanOverviewSection } from './PlanOverviewSection';
import { AddWorkPackageBar } from './AddWorkPackageBar';
import { ScheduleMetricStrip } from './schedule/ScheduleMetricStrip';
import { getPlanEditorMetrics } from './workspace/workspace-metrics';

interface PlanEditorProps {
  plan: Plan;
  kpis: WorkTypeKpi[];
  projects: Project[];
  canOpenProgress: boolean;
  showBackButton?: boolean;
  /** When true, all editing controls are disabled (reviewed/archived plans). */
  readOnly?: boolean;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  onOpenSchedule?: () => void;
  onOpenProgress: () => void;
  onOpenReport?: () => void;
  /** Register flush-before-schedule (for workspace tab switch). Pass fn to register, undefined to unregister. */
  onRegisterBeforeScheduleSwitch?: (fn?: () => Promise<void>) => void;
}

export function PlanEditor({
  plan,
  kpis,
  projects,
  showBackButton = true,
  readOnly = false,
  onSave,
  onBack,
  onOpenSchedule,
  onRegisterBeforeScheduleSwitch,
}: PlanEditorProps) {
  const { currentPlan, mutatePlan, flushAndWait } = usePlanEditorState({ plan, onSave });
  const { defaultCrewSize: systemDefaultCrewSize } = useCrewPoolStore();
  const effectiveCrewSize = systemDefaultCrewSize ?? currentPlan.defaultCrewSize;
  const {
    fileInputRef: importFileInputRef,
    handleFileChange: handleImportFileChange,
    handleConfirm: handleImportConfirm,
    handleCancel: handleImportCancel,
    pendingCount: importPendingCount,
    pendingWorkUnitPreview: importWorkUnitPreview,
    applyImportedUnitLabels,
    setApplyImportedUnitLabels,
    isApplying: isImportApplying,
  } = usePlanLineItemImport({ mutatePlan });

  const [title, setTitle] = useState(plan.title);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  useEffect(() => {
    setTitle(currentPlan.title);
  }, [currentPlan.id, currentPlan.title]);

  useEffect(() => {
    setIdentityError(null);
  }, [currentPlan.id]);

  useEffect(() => {
    setShowProjectPicker(false);
  }, [plan.id]);

  const phaseDates = readPhaseDateValues(currentPlan);
  const primaryRange = getPrimaryScheduleRange(
    phaseDates,
    currentPlan.eventStartDate,
    currentPlan.eventEndDate,
  );
  const workCalendarRange = getScheduleRangeForWorkCalendar(
    phaseDates,
    currentPlan.eventStartDate,
    currentPlan.eventEndDate,
  );
  const workCalendarPhaseSpans = useMemo(
    () => getWorkCalendarPhaseSpans(phaseDates),
    [
      phaseDates.assemblyStartDate,
      phaseDates.assemblyEndDate,
      phaseDates.dismantleStartDate,
      phaseDates.dismantleEndDate,
    ],
  );
  const summaryRange = workCalendarRange ?? primaryRange;

  const suggestions = useMemo(
    () => generatePlanSuggestions(currentPlan.lineItems, kpis, currentPlan),
    [
      currentPlan.lineItems,
      currentPlan.workCalendar,
      currentPlan.defaultCrewSize,
      currentPlan.assemblyStartDate,
      currentPlan.assemblyEndDate,
      currentPlan.dismantleStartDate,
      currentPlan.dismantleEndDate,
      kpis,
    ],
  );
  const suggestionsByLineItemId = useMemo(
    () => new Map(suggestions.items.map((item) => [item.lineItemId, item])),
    [suggestions.items],
  );
  const totalPersonHours = planTotalPersonHours(currentPlan);

  const availableScope = (() => {
    const { workCalendar } = currentPlan;
    if (workCalendar.length === 0 && workCalendarPhaseSpans.length === 0) return null;
    const calendar =
      workCalendar.length > 0
        ? workCalendar
        : generateDefaultWorkCalendarForSpans(workCalendarPhaseSpans, effectiveCrewSize);
    const workDays = calendar.filter((d) => d.isWorkDay);
    const totalAvailable = calendar.reduce(
      (sum, d) => sum + dayAvailablePersonHours(d, effectiveCrewSize),
      0,
    );
    const headroom = totalAvailable - totalPersonHours;
    return { workDayCount: workDays.length, totalAvailable, headroom };
  })();

  const planEditorMetrics = useMemo(
    () => getPlanEditorMetrics(currentPlan),
    [
      currentPlan.lineItems,
      currentPlan.workCalendar,
      currentPlan.defaultCrewSize,
      currentPlan.assemblyStartDate,
      currentPlan.assemblyEndDate,
      currentPlan.dismantleStartDate,
      currentPlan.dismantleEndDate,
    ],
  );

  const isLocked = currentPlan.status === 'active';
  const selectedProject = currentPlan.projectId
    ? projects.find((project) => project.id === currentPlan.projectId) ?? null
    : null;
  const planDisplayName = getPlanDisplayName(currentPlan, selectedProject);
  const hasIdentity =
    selectedProject != null
    || title.trim().length > 0
    || currentPlan.title.trim().length > 0;

  const handleSetTitle = (newTitle: string) => {
    setTitle(newTitle);
    setIdentityError(null);
    mutatePlan((prev) => ({ ...prev, title: newTitle }));
  };

  const handleAssignProject = async (projectId: string | null) => {
    if (projectId == null) {
      setIdentityError(null);
      mutatePlan((prev) => ({ ...prev, projectId: null }));
      return;
    }

    await ensureProjectColorAssigned(projectId);
    const project = getProjectById(projectId);
    if (!project) return;

    setIdentityError(null);
    setTitle(project.name);
    mutatePlan((prev) => {
      const assigned = { ...prev, projectId, title: project.name };
      if (!hasProjectPhaseDates(project)) {
        return assigned;
      }
      return applyProjectPhaseDatesToPlan(assigned, project);
    });
  };

  const handleSetEventDate = (field: 'eventStartDate' | 'eventEndDate', value: string) => {
    mutatePlan((prev) => setPlanEventDate(prev, field, value));
  };

  const handleSetPhaseDate = (field: PhaseDateField, value: string) => {
    mutatePlan((prev) => setPlanPhaseDate(prev, field, value));
  };

  const handleSetDefaultCrewSize = (value: string) => {
    mutatePlan((prev) => setPlanDefaultCrewSize(prev, value));
  };

  const handleSetDefaultEfficiency = (value: string) => {
    mutatePlan((prev) => setPlanDefaultEfficiency(prev, value));
  };

  const handleAddLineItem = (item: PlanLineItem) => {
    mutatePlan((prev) => addLineItemToPlan(prev, item));
  };

  const handleRemoveItem = (itemId: string) => {
    mutatePlan((prev) => removeLineItemFromPlan(prev, itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<PlanLineItem>) => {
    mutatePlan((prev) => updatePlanLineItem(prev, itemId, updates));
  };

  const handleBatchApplySuggestions = (
    updates: Array<{ itemId: string; updates: Partial<PlanLineItem> }>,
  ) => {
    if (updates.length === 0) return;
    mutatePlan((prev) => {
      let next = prev;
      for (const { itemId, updates: lineItemUpdates } of updates) {
        next = updatePlanLineItem(next, itemId, lineItemUpdates);
      }
      return next;
    });
  };

  const handleDuplicateItem = (item: PlanLineItem) => {
    mutatePlan((prev) => addLineItemToPlan(prev, duplicateLineItem(item)));
  };

  const handleDuplicateAll = () => {
    mutatePlan((prev) => duplicateAllLineItemsInPlan(prev));
  };

  const handleRemoveAll = () => {
    mutatePlan((prev) => removeAllLineItemsFromPlan(prev));
  };

  useEffect(() => {
    if (!shouldClearPlanProjectId(currentPlan.projectId, projects)) return;
    mutatePlan((prev) => ({ ...prev, projectId: null }));
  }, [currentPlan, projects, mutatePlan]);

  useEffect(() => {
    onRegisterBeforeScheduleSwitch?.(flushAndWait);
    return () => onRegisterBeforeScheduleSwitch?.();
  }, [onRegisterBeforeScheduleSwitch, flushAndWait]);

  const canOpenScheduleAction = !readOnly && onOpenSchedule != null;

  const handleOpenSchedule = async () => {
    if (!onOpenSchedule) return;
    await flushAndWait();
    onOpenSchedule();
  };

  const scheduleActionBlockedReason =
    summaryRange == null
      ? 'Set schedule dates before building schedule.'
      : currentPlan.lineItems.length === 0
        ? 'Add at least one work package before building schedule.'
        : null;

  const setupSteps = [
    {
      id: 'identity',
      label: 'Identity',
      complete: hasIdentity,
      isCta: false as const,
    },
    {
      id: 'dates',
      label: 'Dates',
      complete: summaryRange != null,
      isCta: false as const,
    },
    {
      id: 'work',
      label: 'Work',
      complete: currentPlan.lineItems.length > 0,
      isCta: false as const,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      activeLabel: 'Build Schedule',
      complete: currentPlan.status !== 'draft',
      isCta: canOpenScheduleAction,
      onClick: handleOpenSchedule,
      disabled: scheduleActionBlockedReason != null,
      disabledReason: scheduleActionBlockedReason,
    },
  ];

  const canAddWorkPackages = !(readOnly || isLocked);

  return (
    <div className="planning-view planning-view--editor">
      {showBackButton && (
        <header className="planning-view__editor-header">
          <button className="planning-view__back" onClick={onBack} aria-label="Back to plans">
            <ChevronLeftIcon className="planning-view__back-icon" />
            Plans
          </button>
        </header>
      )}

      <div className="planning-view__metric-strip-sticky">
        <ScheduleMetricStrip
          metrics={planEditorMetrics}
          steps={setupSteps}
          readOnly={readOnly}
        />
      </div>

      <div className="planning-view__overview-card">
        <PlanOverviewSection
          title={title}
          selectedProject={selectedProject}
          planDisplayName={planDisplayName}
          readOnly={readOnly}
          isLocked={isLocked}
          identityError={identityError}
          onOpenProjectPicker={() => setShowProjectPicker(true)}
        />
        <div className="planning-view__schedule-inputs-wrap">
          <PlanScheduleInputsPanel
            assemblyStartDate={phaseDates.assemblyStartDate}
            assemblyEndDate={phaseDates.assemblyEndDate}
            dismantleStartDate={phaseDates.dismantleStartDate}
            dismantleEndDate={phaseDates.dismantleEndDate}
            eventStartDate={currentPlan.eventStartDate}
            eventEndDate={currentPlan.eventEndDate}
            defaultCrewSize={currentPlan.defaultCrewSize}
            defaultEfficiency={currentPlan.defaultEfficiency}
            readOnly={readOnly || isLocked}
            primaryRange={summaryRange}
            dayCount={availableScope?.workDayCount ?? 0}
            crewSize={effectiveCrewSize ?? null}
            totalAvailable={availableScope?.totalAvailable ?? 0}
            onPhaseDateChange={handleSetPhaseDate}
            onEventDateChange={handleSetEventDate}
            onDefaultCrewSizeChange={handleSetDefaultCrewSize}
            onDefaultEfficiencyChange={handleSetDefaultEfficiency}
          />
        </div>
      </div>

      <section
        className="planning-view__work-packages-section"
        aria-labelledby="work-packages-heading"
      >
        <div
          className={`planning-view__wp-surface${canAddWorkPackages ? ' planning-view__wp-surface--editable' : ''}`}
        >
          <div className="planning-view__wp-table-zone">
            <WorkPackageTable
              lineItems={currentPlan.lineItems}
              suggestionsByLineItemId={suggestionsByLineItemId}
              isLocked={readOnly || isLocked}
              onUpdate={handleUpdateItem}
              onBatchApplySuggestions={readOnly || isLocked ? undefined : handleBatchApplySuggestions}
              onDuplicateAll={readOnly || isLocked ? undefined : handleDuplicateAll}
              onDuplicate={handleDuplicateItem}
              onRemoveAll={readOnly || isLocked ? undefined : handleRemoveAll}
              onRemove={handleRemoveItem}
              onSetItemTagIds={
                readOnly || isLocked
                  ? undefined
                  : (itemId, tagIds) => handleUpdateItem(itemId, { tagIds })
              }
            />
          </div>

          {canAddWorkPackages && (
            <AddWorkPackageBar
              onAdd={handleAddLineItem}
              importPendingCount={importPendingCount}
              importWorkUnitPreview={importWorkUnitPreview}
              applyImportedUnitLabels={applyImportedUnitLabels}
              onApplyImportedUnitLabelsChange={setApplyImportedUnitLabels}
              isImportApplying={isImportApplying}
              importFileInputRef={importFileInputRef}
              onImportFileChange={handleImportFileChange}
              onImportConfirm={handleImportConfirm}
              onImportCancel={handleImportCancel}
            />
          )}
        </div>
      </section>

      <ProjectPicker
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onSelect={(projectId) => {
          void handleAssignProject(projectId);
        }}
        currentProjectId={currentPlan.projectId}
        currentTitle={title}
        onSetTitle={handleSetTitle}
      />
    </div>
  );
}
