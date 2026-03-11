import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import {
  WORK_UNIT_LABELS,
  type Project,
} from '../../lib/types';
import type { WorkTypeKpi } from '../../lib/kpi';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { generatePlanSuggestions } from '../../lib/planning/plan-suggestions';
import {
  type Plan,
  type PlanLineItem,
  addLineItemToPlan,
  createLineItem,
  removeLineItemFromPlan,
  updatePlanLineItem,
  duplicateLineItem,
  planTotalPersonHours,
  planPhasePersonHours,
} from '../../lib/planning/plan-model';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
  setPlanPhaseDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import {
  generateDefaultWorkCalendarForSpans,
  dayAvailablePersonHours,
} from '../../lib/planning/scheduling/work-calendar';
import { getContrastColor } from '../../lib/utils/contrast';
import { ChevronIcon, ChevronLeftIcon, WarningIcon } from '../../components/icons';
import { ProjectPicker } from '../../components/ProjectPicker';
import { StatusBadge } from '../../components/StatusBadge';
import { WorkPackageTable } from './WorkPackageTable';
import { shouldClearPlanProjectId } from './plan-editor-state';
import { PlanScheduleInputs } from './schedule/PlanScheduleInputs';
import { ScheduleInputsBlock } from './schedule/ScheduleInputsBlock';
import { useMediaQuery } from '../../lib/hooks/useMediaQuery';
import {
  type PhaseDateField,
  getPrimaryScheduleRange,
  getScheduleRangeForWorkCalendar,
  getWorkCalendarPhaseSpans,
  readPhaseDateValues,
} from './schedule/schedule-date-ui';

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

function formatAutosaveLabel(updatedAt: string | null | undefined): string {
  if (!updatedAt) return 'Autosave on';
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) return 'Autosave on';
  return `Autosaved ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function PlanEditor({
  plan,
  kpis,
  projects,
  canOpenProgress,
  showBackButton = true,
  readOnly = false,
  onSave,
  onBack,
  onOpenSchedule,
  onOpenProgress,
  onOpenReport,
  onRegisterBeforeScheduleSwitch,
}: PlanEditorProps) {
  const { currentPlan, mutatePlan, flushAndWait } = usePlanEditorState({ plan, onSave });
  const [title, setTitle] = useState(plan.title);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  useEffect(() => {
    setTitle(plan.title);
  }, [plan.id, plan.updatedAt, plan.title]);

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
      phaseDates.buildUpStartDate,
      phaseDates.buildUpEndDate,
      phaseDates.tearDownStartDate,
      phaseDates.tearDownEndDate,
    ],
  );
  const summaryRange = workCalendarRange ?? primaryRange;
  const isEmpty = summaryRange == null;
  const [inputsExpanded, setInputsExpanded] = useState(isEmpty);
  const isDesktopControlBand = useMediaQuery('(min-width: 1200px)') && !showBackButton;
  const scheduleInputsExpanded = isDesktopControlBand ? true : inputsExpanded;

  const suggestions = generatePlanSuggestions(currentPlan.lineItems, kpis, currentPlan);
  const suggestionsByLineItemId = useMemo(
    () => new Map(suggestions.items.map((item) => [item.lineItemId, item])),
    [suggestions.items],
  );
  const totalPersonHours = planTotalPersonHours(currentPlan);
  const buildUpPersonHours = planPhasePersonHours(currentPlan, 'build-up');
  const tearDownPersonHours = planPhasePersonHours(currentPlan, 'tear-down');

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

  const isLocked = currentPlan.status === 'active';
  const selectedProject = currentPlan.projectId
    ? projects.find((project) => project.id === currentPlan.projectId) ?? null
    : null;

  const { workTypes } = useWorkTypeStore();
  const selectableWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );
  const addTitleRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    setShowActionMenu(false);
  }, [plan.id]);

  useEffect(() => {
    if (!showActionMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setShowActionMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowActionMenu(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showActionMenu]);

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
        newWorkType.buildUpRate,
        newWorkType.tearDownRate,
        'template',
        newWorkType.id,
      ),
    );
    setNewTitle('');
    setNewQuantity('');
    addTitleRef.current?.focus();
  };

  const handleSave = () => {
    mutatePlan((prev) => ({ ...prev, title }));
  };

  const handleAssignProject = (projectId: string | null) => {
    mutatePlan((prev) => ({ ...prev, projectId }));
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

  const handleAddLineItem = (item: PlanLineItem) => {
    mutatePlan((prev) => addLineItemToPlan(prev, item));
  };

  const handleRemoveItem = (itemId: string) => {
    mutatePlan((prev) => removeLineItemFromPlan(prev, itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<PlanLineItem>) => {
    mutatePlan((prev) => updatePlanLineItem(prev, itemId, updates));
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
  const canOpenProgressAction = !readOnly && isLocked && canOpenProgress;
  const canOpenEventReportAction = readOnly && currentPlan.reviewedAt != null && onOpenReport != null;

  const handleOpenSchedule = async () => {
    if (!onOpenSchedule) return;
    await flushAndWait();
    onOpenSchedule();
  };

  type HeaderAction = {
    id: 'schedule' | 'progress' | 'report';
    label: string;
    onClick: () => void | Promise<void>;
  };

  let primaryAction: HeaderAction | null = null;
  if (canOpenEventReportAction) {
    primaryAction = { id: 'report', label: 'View Event Report', onClick: onOpenReport! };
  } else if (canOpenProgressAction) {
    primaryAction = { id: 'progress', label: 'Open Progress', onClick: onOpenProgress };
  } else if (canOpenScheduleAction) {
    primaryAction = { id: 'schedule', label: 'Build Schedule', onClick: handleOpenSchedule };
  }

  const secondaryActions: HeaderAction[] = [];
  if (canOpenScheduleAction && primaryAction?.id !== 'schedule') {
    secondaryActions.push({ id: 'schedule', label: 'Schedule', onClick: handleOpenSchedule });
  }
  if (canOpenProgressAction && primaryAction?.id !== 'progress') {
    secondaryActions.push({ id: 'progress', label: 'Progress', onClick: onOpenProgress });
  }
  if (canOpenEventReportAction && primaryAction?.id !== 'report') {
    secondaryActions.push({ id: 'report', label: 'Event Report', onClick: onOpenReport! });
  }
  const titleInputId = `plan-title-${currentPlan.id}`;
  const reviewedDateLabel = currentPlan.reviewedAt
    ? new Date(currentPlan.reviewedAt).toLocaleDateString()
    : null;
  const overviewHelperText = readOnly
    ? reviewedDateLabel
      ? `This plan is archived (reviewed ${reviewedDateLabel}) with its project/event linkage preserved.`
      : 'This plan is archived with its project/event linkage preserved.'
    : isLocked
      ? 'This plan is tied to a live project/event. Keep work packages aligned with actual execution.'
      : 'Assign the target project/event first so all work packages roll up to real project delivery.';
  const statusHelperText = (() => {
    switch (currentPlan.status) {
      case 'draft':
        return 'Draft plans are editable and not yet ready for live execution.';
      case 'active':
        return 'Active plans are live for execution and should stay aligned with actual progress.';
      case 'reviewed':
        return 'Reviewed plans are archived and locked for historical reporting.';
      case 'received':
        return 'Received plans come from execution and are read-only in planning mode.';
      case 'session-closed':
        return 'Session-closed plans are finalized from execution and kept for reference.';
      default:
        return 'This status controls what parts of the plan can still be edited.';
    }
  })();
  const readinessItems = [
    {
      id: 'project',
      label: 'Project linked',
      complete: selectedProject != null,
      pendingLabel: 'Select project',
    },
    {
      id: 'dates',
      label: 'Dates configured',
      complete: summaryRange != null,
      pendingLabel: 'Set dates',
    },
    {
      id: 'packages',
      label: 'Work packages added',
      complete: currentPlan.lineItems.length > 0,
      pendingLabel: 'Add packages',
    },
  ] as const;
  const readinessCompleteCount = readinessItems.filter((item) => item.complete).length;
  const readinessMissingItems = readinessItems.filter((item) => !item.complete);
  const readinessSummaryLabel = `${readinessCompleteCount}/${readinessItems.length} checks ready`;
  const readinessWarningLabel = readinessMissingItems.length > 0
    ? `${readinessMissingItems.length} need attention`
    : null;
  const readinessWarningDetail = readinessMissingItems
    .map((item) => item.pendingLabel)
    .join(' · ');
  const autosaveLabel = formatAutosaveLabel(currentPlan.updatedAt);
  const scheduleActionBlockedReason =
    summaryRange == null
      ? 'Set schedule dates before building schedule.'
      : currentPlan.lineItems.length === 0
        ? 'Add at least one work package before building schedule.'
        : null;
  const getActionDisabledReason = (action: HeaderAction): string | null => {
    if (action.id === 'schedule') return scheduleActionBlockedReason;
    return null;
  };
  const primaryActionDisabledReason = primaryAction
    ? getActionDisabledReason(primaryAction)
    : null;

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

      <div className="planning-view__sticky-summary">
        <section className="planning-view__overview-block" aria-label="Plan overview">
          <div className="planning-view__overview-identity">
            <div className="planning-view__overview-title-row">
              <label className="planning-view__overview-field planning-view__overview-field--title" htmlFor={titleInputId}>
                <span className="planning-view__overview-label">Plan Title</span>
                <input
                  id={titleInputId}
                  className="planning-view__title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSave}
                  disabled={readOnly || isLocked}
                />
              </label>
            </div>
          </div>

          <div className="planning-view__overview-content">
            <div className="planning-view__overview-context">
              <p className="planning-view__overview-helper">{overviewHelperText}</p>

              <div className="planning-view__overview-field planning-view__overview-field--project">
                <span className="planning-view__overview-label">Project</span>
                <div className="planning-view__project-row">
                  <button
                    type="button"
                    className={`planning-view__project-button${selectedProject ? ' planning-view__project-button--selected' : ' planning-view__project-button--empty'}`}
                    onClick={() => setShowProjectPicker(true)}
                    disabled={readOnly || isLocked}
                    style={
                      selectedProject
                        ? { backgroundColor: selectedProject.color, color: getContrastColor(selectedProject.color) }
                        : undefined
                    }
                  >
                    {selectedProject ? (
                      <span className="planning-view__project-selected">
                        <span>{selectedProject.name}</span>
                      </span>
                    ) : (
                      <span className="planning-view__project-none">+ Add to project</span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="planning-view__overview-signals">
              <div className="planning-view__overview-status-card" aria-label="Plan status">
                <div className="planning-view__overview-status-card-head">
                  <span className="planning-view__overview-status-label">Status</span>
                  <StatusBadge variant={currentPlan.status} />
                </div>
                <p className="planning-view__overview-status-helper">{statusHelperText}</p>
              </div>

              <div className="planning-view__overview-readiness" aria-label="Plan readiness">
                <h3 className="planning-view__overview-readiness-title">Readiness</h3>
                <ul className="planning-view__overview-readiness-list">
                  {readinessItems.map((item) => (
                    <li
                      key={item.id}
                      className={`planning-view__overview-readiness-item${item.complete ? ' planning-view__overview-readiness-item--complete' : ' planning-view__overview-readiness-item--pending'}`}
                    >
                      <span className="planning-view__overview-readiness-label">{item.label}</span>
                      <span className="planning-view__overview-readiness-state">
                        {item.complete ? 'Ready' : item.pendingLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="planning-view__workflow-footer" aria-label="Plan actions">
            <div className="planning-view__workflow-meta" role="status" aria-live="polite">
              <span className="planning-view__workflow-chip">{autosaveLabel}</span>
              <span className="planning-view__workflow-chip">{readinessSummaryLabel}</span>
              {readinessWarningLabel && (
                <span
                  className="planning-view__workflow-chip planning-view__workflow-chip--warning"
                  title={readinessWarningDetail}
                >
                  <WarningIcon className="planning-view__workflow-chip-icon" />
                  <span>{readinessWarningLabel}</span>
                </span>
              )}
            </div>

            {(primaryAction != null || secondaryActions.length > 0) && (
              <div className="planning-view__workflow-actions">
                {secondaryActions.length > 0 && (
                  <div className="planning-view__workflow-menu" ref={actionMenuRef}>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm planning-view__workflow-more"
                      aria-haspopup="menu"
                      aria-expanded={showActionMenu}
                      onClick={() => setShowActionMenu((prev) => !prev)}
                    >
                      More
                      <ChevronIcon
                        className={`planning-view__workflow-more-chevron${showActionMenu ? ' planning-view__workflow-more-chevron--open' : ''}`}
                      />
                    </button>
                    {showActionMenu && (
                      <div className="planning-view__workflow-menu-popover" role="menu" aria-label="More actions">
                        {secondaryActions.map((action) => {
                          const disabledReason = getActionDisabledReason(action);
                          return (
                            <button
                              key={action.id}
                              type="button"
                              role="menuitem"
                              className="planning-view__workflow-menu-item"
                              disabled={disabledReason != null}
                              title={disabledReason ?? action.label}
                              onClick={() => {
                                if (disabledReason != null) return;
                                setShowActionMenu(false);
                                void action.onClick();
                              }}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {primaryAction && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={primaryActionDisabledReason != null}
                    title={primaryActionDisabledReason ?? primaryAction.label}
                    onClick={() => {
                      if (primaryActionDisabledReason != null) return;
                      void primaryAction.onClick();
                    }}
                  >
                    {primaryAction.label}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="planning-view__schedule-inputs-wrap">
          <ScheduleInputsBlock
            expanded={scheduleInputsExpanded}
            onToggle={() => setInputsExpanded((p) => !p)}
            collapsible={!isDesktopControlBand}
            primaryRange={summaryRange}
            dayCount={availableScope?.workDayCount ?? 0}
            crewSize={currentPlan.defaultCrewSize ?? null}
            totalAvailable={availableScope?.totalAvailable ?? 0}
          >
            <PlanScheduleInputs
              buildUpStartDate={phaseDates.buildUpStartDate}
              buildUpEndDate={phaseDates.buildUpEndDate}
              tearDownStartDate={phaseDates.tearDownStartDate}
              tearDownEndDate={phaseDates.tearDownEndDate}
              eventStartDate={currentPlan.eventStartDate}
              eventEndDate={currentPlan.eventEndDate}
              defaultCrewSize={currentPlan.defaultCrewSize}
              readOnly={readOnly || isLocked}
              onPhaseDateChange={handleSetPhaseDate}
              onEventDateChange={handleSetEventDate}
              onDefaultCrewSizeChange={handleSetDefaultCrewSize}
            />
          </ScheduleInputsBlock>
        </div>
      </div>

      <section className="planning-view__work-packages-section" aria-labelledby="work-packages-heading">
        <div className={`planning-view__wp-surface${canAddWorkPackages ? ' planning-view__wp-surface--editable' : ''}`}>
          <div className="planning-view__items-header">
            <h2 id="work-packages-heading" className="planning-view__items-title">Work Packages</h2>
            <div className="planning-view__items-summary">
              <span>{currentPlan.lineItems.length} packages</span>
              <span>Build-up {buildUpPersonHours.toFixed(1)} ph</span>
              <span>Tear-down {tearDownPersonHours.toFixed(1)} ph</span>
            </div>
          </div>

          {canAddWorkPackages && (
            <div className="planning-view__wp-add-zone">
              <div className="planning-view__wp-add-bar">
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
              </div>
            </div>
          )}

          <div className="planning-view__wp-table-zone">
            <WorkPackageTable
              lineItems={currentPlan.lineItems}
              suggestionsByLineItemId={suggestionsByLineItemId}
              isLocked={readOnly || isLocked}
              onUpdate={handleUpdateItem}
              onDuplicate={handleDuplicateItem}
              onRemove={handleRemoveItem}
            />
          </div>
        </div>
      </section>

      <ProjectPicker
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onSelect={(projectId) => handleAssignProject(projectId)}
        currentProjectId={currentPlan.projectId}
      />
    </div>
  );
}
