import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import { usePlanLineItemImport } from './hooks/usePlanLineItemImport';
import {
  WORK_UNIT_LABELS,
  type Project,
} from '../../lib/types';
import type { WorkTypeKpi } from '../../lib/kpi';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { generatePlanSuggestions, getPhaseWorkDayCount } from '../../lib/planning/plan-suggestions';
import {
  type Plan,
  type PlanLineItem,
  addLineItemToPlan,
  createLineItem,
  getPlanDisplayName,
  removeLineItemFromPlan,
  updatePlanLineItem,
  duplicateLineItem,
  planTotalPersonHours,
  planPhasePersonHours,
} from '../../lib/planning/plan-model';
import {
  applyProjectPhaseDatesToPlan,
  setPlanDefaultCrewSize,
  setPlanDefaultEfficiency,
  setPlanEventDate,
  setPlanPhaseDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import {
  generateDefaultWorkCalendarForSpans,
  dayAvailablePersonHours,
} from '../../lib/planning/scheduling/work-calendar';
import { ChevronLeftIcon, ChevronRightIcon, FolderIcon, PencilIcon } from '../../components/icons';
import { PlanEditorKpiRow } from './PlanEditorKpiRow';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { ProjectPicker } from '../../components/ProjectPicker';
import { WorkPackageTable } from './WorkPackageTable';
import { PlanSetupStepper } from './PlanSetupStepper';
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
  const {
    fileInputRef: importFileInputRef,
    handleFileChange: handleImportFileChange,
    handleConfirm: handleImportConfirm,
    handleCancel: handleImportCancel,
    pendingCount: importPendingCount,
    isApplying: isImportApplying,
  } = usePlanLineItemImport({ mutatePlan });
  const [title, setTitle] = useState(plan.title);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'csv'>('manual');

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
  const assemblyPersonHours = planPhasePersonHours(currentPlan, 'assembly');
  const dismantlePersonHours = planPhasePersonHours(currentPlan, 'dismantle');

  const availableScope = (() => {
    const { defaultCrewSize, workCalendar } = currentPlan;
    if (workCalendar.length === 0 && workCalendarPhaseSpans.length === 0) return null;
    const calendar =
      workCalendar.length > 0
        ? workCalendar
        : generateDefaultWorkCalendarForSpans(workCalendarPhaseSpans, defaultCrewSize);
    const workDays = calendar.filter((d) => d.isWorkDay);
    const totalAvailable = calendar.reduce(
      (sum, d) => sum + dayAvailablePersonHours(d, defaultCrewSize),
      0,
    );
    const headroom = totalAvailable - totalPersonHours;
    return { workDayCount: workDays.length, totalAvailable, headroom };
  })();

  const assemblyWorkDays = getPhaseWorkDayCount(currentPlan, 'assembly');
  const dismantleWorkDays = getPhaseWorkDayCount(currentPlan, 'dismantle');

  const isLocked = currentPlan.status === 'active';
  const selectedProject = currentPlan.projectId
    ? projects.find((project) => project.id === currentPlan.projectId) ?? null
    : null;
  const planDisplayName = getPlanDisplayName(currentPlan, selectedProject);
  const hasIdentity =
    selectedProject != null
    || title.trim().length > 0
    || currentPlan.title.trim().length > 0;

  const { workTypes } = useWorkTypeStore();
  const selectableWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );
  const addTitleRef = useRef<HTMLInputElement>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newWorkTypeId, setNewWorkTypeId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  useEffect(() => {
    if (selectableWorkTypes.length === 0) {
      if (newWorkTypeId) setNewWorkTypeId('');
      return;
    }
    const isCurrentValid = selectableWorkTypes.some((wt) => wt.id === newWorkTypeId);
    if (!isCurrentValid) {
      setNewWorkTypeId(selectableWorkTypes[0].id);
    }
  }, [newWorkTypeId, selectableWorkTypes]);

  const newWorkType = newWorkTypeId
    ? selectableWorkTypes.find((wt) => wt.id === newWorkTypeId) ?? null
    : null;
  const newQuantityValue = (() => {
    const parsed = Number(newQuantity);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  })();
  const hasValidNewQuantity = newQuantity.trim() !== '' && newQuantityValue > 0;
  const addDisabledReason = selectableWorkTypes.length === 0
    ? 'No work types available'
    : !newTitle.trim()
    ? 'Title required'
    : newWorkType == null
      ? 'Type required'
      : !hasValidNewQuantity
        ? 'Quantity must be greater than 0'
      : null;
  const canAddWorkPackages = !(readOnly || isLocked);

  const handleAddRow = () => {
    if (!newWorkType || !newTitle.trim() || !hasValidNewQuantity) return;
    handleAddLineItem(
      createLineItem(
        newTitle.trim(),
        newWorkType.title,
        newWorkType.workUnit,
        newQuantityValue,
        newWorkType.assemblyRate,
        newWorkType.dismantleRate,
        'template',
        newWorkType.id,
      ),
    );
    setNewTitle('');
    setNewQuantity('');
    addTitleRef.current?.focus();
  };

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

  const reviewedDateLabel = currentPlan.reviewedAt
    ? new Date(currentPlan.reviewedAt).toLocaleDateString()
    : null;
  const overviewHelperText = readOnly
    ? reviewedDateLabel
      ? `This plan is archived (reviewed ${reviewedDateLabel}) with its event or project identity preserved.`
      : 'This plan is archived with its event or project identity preserved.'
    : isLocked
      ? 'This plan is live. Its event or project identity is locked while execution is in progress.'
      : 'Name the event or work you are planning, or link it to a project if delivery should follow that project.';
  const scheduleActionBlockedReason =
    summaryRange == null
      ? 'Set schedule dates before building schedule.'
      : currentPlan.lineItems.length === 0
        ? 'Add at least one work package before building schedule.'
        : null;
  const setupSteps = [
    {
      id: 'identity',
      label: 'Event/Project',
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

  const utilizationPct = availableScope && availableScope.totalAvailable > 0
    ? Math.round((totalPersonHours / availableScope.totalAvailable) * 100)
    : null;

  return (
    <div className="planning-view planning-view--editor">
      <PlanEditorKpiRow
        packageCount={currentPlan.lineItems.length}
        personHours={totalPersonHours}
        utilizationPct={utilizationPct}
        workDays={availableScope?.workDayCount ?? null}
        workDaysSecondary={{ assembly: assemblyWorkDays, dismantle: dismantleWorkDays }}
      />
      {showBackButton && (
        <header className="planning-view__editor-header">
          <button className="planning-view__back" onClick={onBack} aria-label="Back to plans">
            <ChevronLeftIcon className="planning-view__back-icon" />
            Plans
          </button>
        </header>
      )}

      <div className="planning-view__sticky-summary">
        <section className="planning-view__overview-block" aria-label="Plan overview">
          <div className="planning-view__overview-identity">
            <div className="planning-view__overview-field planning-view__overview-field--identity">
              <span className="planning-view__overview-label">Event/Project</span>
              {readOnly || isLocked ? (
                <div className="planning-view__identity-readonly" aria-live="polite">
                  {selectedProject && (
                    <ProjectColorDot color={selectedProject.color} size="md" className="planning-view__project-dot" />
                  )}
                  <span className="planning-view__identity-readonly-value">
                    {planDisplayName || 'Untitled plan'}
                  </span>
                </div>
              ) : selectedProject ? (
                <div className="planning-view__identity-assigned-row">
                  <button
                    type="button"
                    className="planning-view__project-button planning-view__project-button--selected"
                    onClick={() => setShowProjectPicker(true)}
                    aria-label={`Change project: ${selectedProject.name}`}
                  >
                    <span className="planning-view__project-selected">
                      <ProjectColorDot color={selectedProject.color} size="md" className="planning-view__project-dot" />
                      <span>{selectedProject.name}</span>
                      <PencilIcon className="planning-view__project-edit-icon" />
                    </span>
                  </button>
                </div>
              ) : (
                <div className="planning-view__identity-assigned-row">
                  <button
                    type="button"
                    className={`planning-view__identity-trigger${title.trim() ? ' planning-view__identity-trigger--has-value' : ''}`}
                    onClick={() => setShowProjectPicker(true)}
                    aria-label={title.trim() ? `Edit plan name: ${title}` : 'Set event or project'}
                  >
                    {title.trim() ? (
                      <>
                        <span className="planning-view__identity-trigger-value">{title}</span>
                        <PencilIcon className="planning-view__project-edit-icon" />
                      </>
                    ) : (
                      <>
                        <FolderIcon className="planning-view__identity-picker-icon" />
                        <span className="planning-view__identity-trigger-placeholder">Set event or project…</span>
                        <ChevronRightIcon className="planning-view__identity-picker-chevron" />
                      </>
                    )}
                  </button>
                </div>
              )}
              {identityError && (
                <span className="planning-view__overview-error" role="alert">
                  {identityError}
                </span>
              )}
            </div>
          </div>

          <div className="planning-view__overview-content">
            <div className="planning-view__overview-context">
              <p className="planning-view__overview-helper">{overviewHelperText}</p>
            </div>

          </div>

          <PlanSetupStepper steps={setupSteps} readOnly={readOnly} />
        </section>

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
            crewSize={currentPlan.defaultCrewSize ?? null}
            totalAvailable={availableScope?.totalAvailable ?? 0}
            onPhaseDateChange={handleSetPhaseDate}
            onEventDateChange={handleSetEventDate}
            onDefaultCrewSizeChange={handleSetDefaultCrewSize}
            onDefaultEfficiencyChange={handleSetDefaultEfficiency}
          />
        </div>
      </div>

      <section className="planning-view__work-packages-section" aria-labelledby="work-packages-heading">
        <div className={`planning-view__wp-surface${canAddWorkPackages ? ' planning-view__wp-surface--editable' : ''}`}>
          <div className="planning-view__items-header">
            <h2 id="work-packages-heading" className="planning-view__items-title">Work Packages</h2>
            <div className="planning-view__items-summary">
              <span>{currentPlan.lineItems.length} packages</span>
              <span className="planning-view__items-summary-asm">Assembly {assemblyPersonHours.toFixed(1)} ph</span>
              <span className="planning-view__items-summary-dis">Dismantle {dismantlePersonHours.toFixed(1)} ph</span>
            </div>
          </div>

          {canAddWorkPackages && (
            <div className="planning-view__wp-add-zone">
              <div className="planning-view__wp-add-bar">
                {importPendingCount !== null ? (
                  <div className="planning-view__wp-add-mode planning-view__wp-add-mode--csv-confirm">
                    <span className="planning-view__import-confirm">
                      Import {importPendingCount} package{importPendingCount !== 1 ? 's' : ''}
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => {
                            handleImportConfirm();
                            setAddMode('manual');
                          }}
                          disabled={isImportApplying}
                        >
                        Confirm
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={handleImportCancel}>
                        Cancel
                      </button>
                    </span>
                  </div>
                ) : (
                  <>
                    <div
                      className="task-work-quantity__unit-pills planning-view__wp-add-segments"
                      role="group"
                      aria-label="Add work packages by"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={addMode === 'manual'}
                        className={`task-work-quantity__unit-pill${addMode === 'manual' ? ' task-work-quantity__unit-pill--active' : ''}`}
                        onClick={() => setAddMode('manual')}
                      >
                        Add manually
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={addMode === 'csv'}
                        className={`task-work-quantity__unit-pill${addMode === 'csv' ? ' task-work-quantity__unit-pill--active' : ''}`}
                        onClick={() => setAddMode('csv')}
                      >
                        Import CSV
                      </button>
                    </div>

                    {addMode === 'manual' ? (
                      <>
                        <p className="planning-view__wp-add-bar-help">
                          List the work needed for this project/event. Start with title, type, and
                          quantity, then adjust details in the table below.
                        </p>

                        <div className="planning-view__wp-add-bar-fields">
                  <label className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--title">
                    <span className="planning-view__wp-add-bar-label">Title</span>
                    <input
                      ref={addTitleRef}
                      className="input planning-view__wp-add-bar-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRow();
                        }
                      }}
                      placeholder="Work package title"
                      aria-label="New work package title"
                    />
                  </label>

                  <label className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--type">
                    <span className="planning-view__wp-add-bar-label">Type</span>
                    <select
                      className="input planning-view__wp-add-bar-type"
                      value={newWorkTypeId}
                      onChange={(e) => setNewWorkTypeId(e.target.value)}
                      disabled={selectableWorkTypes.length === 0}
                      aria-label="New work package type"
                    >
                      {selectableWorkTypes.length === 0 && (
                        <option value="">No work types. Add in Settings.</option>
                      )}
                      {selectableWorkTypes.map((wt) => (
                        <option key={wt.id} value={wt.id}>
                          {wt.title} · {WORK_UNIT_LABELS[wt.workUnit]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--qty">
                    <span className="planning-view__wp-add-bar-label">Quantity</span>
                    <input
                      className="input planning-view__wp-add-bar-qty"
                      type="number"
                      min={0.01}
                      step="any"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRow();
                        }
                      }}
                      placeholder="0"
                      aria-label="New work package quantity"
                    />
                  </label>

                  <div className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--unit">
                    <span className="planning-view__wp-add-bar-label">Unit</span>
                    <span className="planning-view__wp-add-bar-unit">
                      {newWorkType ? WORK_UNIT_LABELS[newWorkType.workUnit] : '—'}
                    </span>
                  </div>

                  <div className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--action">
                    <span className="planning-view__wp-add-bar-label planning-view__wp-add-bar-label--sr-only">Action</span>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm planning-view__wp-add-bar-btn"
                      onClick={handleAddRow}
                      disabled={addDisabledReason != null}
                      title={addDisabledReason ?? 'Add work package'}
                    >
                      Add
                    </button>
                  </div>
                </div>
                      </>
                    ) : (
                      <div className="planning-view__wp-add-mode planning-view__wp-add-mode--csv">
                        <p className="planning-view__wp-add-bar-help">
                          Choose a CSV file with work package data (title, workTypeTitle, workUnit, phase, …)
                        </p>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => importFileInputRef.current?.click()}
                        >
                          Choose file
                        </button>
                        <input
                          ref={importFileInputRef}
                          type="file"
                          accept=".csv"
                          hidden
                          onChange={handleImportFileChange}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="planning-view__wp-table-zone">
            <WorkPackageTable
              lineItems={currentPlan.lineItems}
              suggestionsByLineItemId={suggestionsByLineItemId}
              isLocked={readOnly || isLocked}
              onUpdate={handleUpdateItem}
              onBatchApplySuggestions={readOnly || isLocked ? undefined : handleBatchApplySuggestions}
              onDuplicate={handleDuplicateItem}
              onRemove={handleRemoveItem}
            />
          </div>
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
