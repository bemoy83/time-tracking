import { useEffect, useState } from 'react';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import {
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  type BuildPhase,
  type Project,
} from '../../lib/types';
import type { WorkTypeKpi } from '../../lib/kpi';
import type { LineItemSuggestion } from '../../lib/planning/plan-suggestions';
import { generatePlanSuggestions } from '../../lib/planning/plan-suggestions';
import {
  type Plan,
  type PlanLineItem,
  addLineItemToPlan,
  removeLineItemFromPlan,
  updatePlanLineItem,
  duplicateLineItem,
  planTotalPersonHours,
} from '../../lib/planning/plan-model';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
  setPlanPhaseDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import {
  generateDefaultWorkCalendar,
  dayAvailablePersonHours,
} from '../../lib/planning/scheduling/work-calendar';
import { ChevronLeftIcon } from '../../components/icons';
import { ProjectPicker } from '../../components/ProjectPicker';
import { StatusBadge } from '../../components/StatusBadge';
import { AddLineItemForm } from './AddLineItemForm';
import { LineItemCard } from './LineItemCard';
import { shouldClearPlanProjectId } from './plan-editor-state';
import { PlanScheduleInputs } from './schedule/PlanScheduleInputs';
import { ScheduleInputsBlock } from './schedule/ScheduleInputsBlock';
import {
  type PhaseDateField,
  getPrimaryScheduleRange,
  readPhaseDateValues,
} from './schedule/schedule-date-ui';

interface PlanEditorProps {
  plan: Plan;
  kpis: WorkTypeKpi[];
  projects: Project[];
  canOpenProgress: boolean;
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
  canOpenProgress,
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
  const [phaseFilter, setPhaseFilter] = useState<BuildPhase>('build-up');
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  useEffect(() => {
    setTitle(plan.title);
  }, [plan.id, plan.updatedAt, plan.title]);

  useEffect(() => {
    setShowProjectPicker(false);
    setPhaseFilter('build-up');
  }, [plan.id]);

  const phaseDates = readPhaseDateValues(currentPlan);
  const primaryRange = getPrimaryScheduleRange(
    phaseDates,
    currentPlan.eventStartDate,
    currentPlan.eventEndDate,
  );
  const isEmpty = primaryRange == null;
  const [inputsExpanded, setInputsExpanded] = useState(isEmpty);

  const suggestions = generatePlanSuggestions(currentPlan.lineItems, kpis, currentPlan);
  const totalPersonHours = planTotalPersonHours(currentPlan);

  const availableScope = (() => {
    const { defaultCrewSize, workCalendar } = currentPlan;
    if (!primaryRange) return null;
    const calendar =
      workCalendar.length > 0
        ? workCalendar
        : generateDefaultWorkCalendar(primaryRange.start, primaryRange.end, defaultCrewSize);
    const workDays = calendar.filter((d) => d.isWorkDay);
    const totalAvailable = calendar.reduce(
      (sum, d) => sum + dayAvailablePersonHours(d, defaultCrewSize),
      0,
    );
    const headroom = totalAvailable - totalPersonHours;
    return { workDayCount: workDays.length, totalAvailable, headroom };
  })();

  const isLocked = currentPlan.status === 'active';
  const isEditable = !readOnly && !isLocked;
  const selectedProject = currentPlan.projectId
    ? projects.find((project) => project.id === currentPlan.projectId) ?? null
    : null;

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

  return (
    <div className="planning-view">
      <header className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plans">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Plans
        </button>
      </header>

      <div className="planning-view__sticky-summary">
        <div className="planning-view__editor-header">
          <input
            className="planning-view__title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            disabled={readOnly || isLocked}
            aria-label="Plan title"
          />
          <StatusBadge variant={currentPlan.status} />
          {!readOnly && onOpenSchedule && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={async () => {
                await flushAndWait();
                onOpenSchedule();
              }}
            >
              Schedule
            </button>
          )}
          {!readOnly && isLocked && canOpenProgress && (
            <button className="btn btn--secondary btn--sm" onClick={onOpenProgress}>
              Progress
            </button>
          )}
          {readOnly && currentPlan.reviewedAt != null && onOpenReport && (
            <button className="btn btn--secondary btn--sm" onClick={onOpenReport}>
              Event Report
            </button>
          )}
        </div>

        <div className="planning-view__project-row">
          <span className="planning-view__project-label">Event</span>
          <button
            type="button"
            className={`planning-view__project-button${selectedProject ? ' planning-view__project-button--selected' : ' planning-view__project-button--empty'}`}
            onClick={() => setShowProjectPicker(true)}
            disabled={readOnly || isLocked}
            style={
              selectedProject
                ? { backgroundColor: selectedProject.color, color: 'white' }
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

        <ScheduleInputsBlock
          expanded={inputsExpanded}
          onToggle={() => setInputsExpanded((p) => !p)}
          primaryRange={primaryRange}
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


        {isEditable && (
          <div className="planning-view__phase-pills" role="group" aria-label="Build phase filter">
            {BUILD_PHASES.map((phase) => (
              <button
                key={phase}
                type="button"
                className={`planning-view__phase-pill${phaseFilter === phase ? ' planning-view__phase-pill--active' : ''}`}
                onClick={() => setPhaseFilter(phase)}
                aria-pressed={phaseFilter === phase}
              >
                {BUILD_PHASE_LABELS[phase]}
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Add form — always visible when editable */}
      {isEditable && (
        <AddLineItemForm
          phaseFilter={phaseFilter}
          onAdd={handleAddLineItem}
        />
      )}

      {/* Line items */}
      {currentPlan.lineItems.length > 0 ? (
        <div>
          <div className="planning-view__items-header">
            <h2 className="planning-view__items-title">Work Packages</h2>
          </div>
          <div className="planning-view__items">
            {currentPlan.lineItems.map((item) => {
              const suggestion: LineItemSuggestion | null =
                suggestions.items.find((s) => s.lineItemId === item.id) ?? null;
              return (
                <LineItemCard
                  key={item.id}
                  item={item}
                  suggestion={suggestion}
                  isLocked={readOnly || isLocked}
                  onUpdate={(updates) => handleUpdateItem(item.id, updates)}
                  onDuplicate={handleDuplicateItem}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <p className="planning-view__empty-items">
          No work packages yet. Use the form above to add one.
        </p>
      )}

      <ProjectPicker
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onSelect={(projectId) => handleAssignProject(projectId)}
        currentProjectId={currentPlan.projectId}
      />
    </div>
  );
}
