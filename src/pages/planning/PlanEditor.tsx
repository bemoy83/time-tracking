import { useEffect, useState } from 'react';
import { usePlanEditorState } from './hooks/usePlanEditorState';
import {
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  formatDurationShort,
  type BuildPhase,
  type Project,
} from '../../lib/types';
import type { WorkTypeKpi } from '../../lib/kpi';
import type { LineItemSuggestion } from '../../lib/planning/plan-suggestions';
import { generatePlanSuggestions } from '../../lib/planning/plan-suggestions';
import {
  type Plan,
  type PlanLineItem,
  activatePlan,
  revertToDraft,
  addLineItemToPlan,
  removeLineItemFromPlan,
  updatePlanLineItem,
  duplicateLineItem,
  planTotalPersonHours,
} from '../../lib/planning/plan-model';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import {
  setPlanDefaultCrewSize,
  setPlanEventDate,
} from '../../lib/planning/scheduling/plan-schedule-update';
import { exportPlanPackage } from '../../lib/interop/data-transfer/plan-package';
import { ChevronLeftIcon, PeopleIcon, TaskListIcon } from '../../components/icons';
import { Fab } from '../../components/Fab';
import { ProjectPicker } from '../../components/ProjectPicker';
import { StatusBadge } from '../../components/StatusBadge';
import { MetricCard } from '../../components/MetricCard';
import { AddLineItemForm } from './AddLineItemForm';
import { LineItemCard } from './LineItemCard';
import { shouldClearPlanProjectId } from './plan-editor-state';
import { PlanScheduleInputs } from './schedule/PlanScheduleInputs';

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
  const [showAddItem, setShowAddItem] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<BuildPhase>('build-up');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setTitle(plan.title);
  }, [plan.id, plan.updatedAt, plan.title]);

  useEffect(() => {
    setShowAddItem(false);
    setShowProjectPicker(false);
    setPhaseFilter('build-up');
  }, [plan.id]);

  const suggestions = generatePlanSuggestions(currentPlan.lineItems, kpis);
  const totalPersonHours = planTotalPersonHours(currentPlan);
  const isLocked = currentPlan.status === 'active';
  const isEditable = !readOnly && !isLocked;
  const selectedProject = currentPlan.projectId
    ? projects.find((project) => project.id === currentPlan.projectId) ?? null
    : null;

  const handleSave = () => {
    mutatePlan((prev) => ({ ...prev, title }));
  };

  const handleToggleLock = () => {
    mutatePlan((prev) => (isLocked ? revertToDraft(prev) : activatePlan(prev)));
    trackTelemetryEvent('planning_lock_toggle');
  };

  const handleAssignProject = (projectId: string | null) => {
    mutatePlan((prev) => ({ ...prev, projectId }));
  };

  const handleSetEventDate = (field: 'eventStartDate' | 'eventEndDate', value: string) => {
    mutatePlan((prev) => setPlanEventDate(prev, field, value));
  };

  const handleSetDefaultCrewSize = (value: string) => {
    mutatePlan((prev) => setPlanDefaultCrewSize(prev, value));
  };

  const handleAddLineItem = (item: PlanLineItem) => {
    mutatePlan((prev) => addLineItemToPlan(prev, item));
    setShowAddItem(false);
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await flushAndWait();
      await exportPlanPackage(currentPlan);
      trackTelemetryEvent('interop_plan_package_export');
    } catch {
      window.alert('Could not export plan. Please try again.');
    } finally {
      setIsExporting(false);
    }
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

        <PlanScheduleInputs
          eventStartDate={currentPlan.eventStartDate}
          eventEndDate={currentPlan.eventEndDate}
          defaultCrewSize={currentPlan.defaultCrewSize}
          readOnly={readOnly}
          onEventDateChange={handleSetEventDate}
          onDefaultCrewSizeChange={handleSetDefaultCrewSize}
        />

        {/* Summary stats */}
        <div className="planning-view__summary metric-card-row">
          <MetricCard
            icon={<TaskListIcon />}
            iconVariant="tasks"
            value={currentPlan.lineItems.length}
            label="Work packages"
          />
          <MetricCard
            icon={<PeopleIcon />}
            iconVariant="people"
            value={formatDurationShort(totalPersonHours * 3_600_000)}
            label="Person-hours"
          />
          {suggestions.highRiskCount > 0 && (
            <MetricCard
              value={suggestions.highRiskCount}
              label="High risk"
              variant="risk"
            />
          )}
        </div>

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

        {/* Actions */}
        {!readOnly && (
          <div className="planning-view__actions">
            {onOpenSchedule && (
              <button
                className="btn btn--secondary"
                onClick={async () => {
                  await flushAndWait();
                  onOpenSchedule();
                }}
              >
                Schedule
              </button>
            )}
            {isLocked && canOpenProgress && (
              <button className="btn btn--secondary" onClick={onOpenProgress}>
                Progress
              </button>
            )}
            <button className="btn btn--secondary" onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Handing off...' : 'Hand off'}
            </button>
            <button className={`btn ${isLocked ? 'btn--success' : 'btn--secondary'}`} onClick={handleToggleLock}>
              {isLocked ? 'Revert to Draft' : 'Activate'}
            </button>
          </div>
        )}
        {readOnly && currentPlan.reviewedAt != null && (
          <div className="planning-view__actions">
            {onOpenReport && (
              <button className="btn btn--secondary" onClick={onOpenReport}>
                Event Report
              </button>
            )}
            <button className="btn btn--secondary" onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Handing off...' : 'Hand off'}
            </button>
          </div>
        )}
      </div>

      {/* FAB — Add Work Package (when editable) */}
      {isEditable && (
        <Fab onClick={() => setShowAddItem(true)} aria-label="Add work package" />
      )}

      {/* Add form */}
      {showAddItem && isEditable && (
        <AddLineItemForm
          phaseFilter={phaseFilter}
          onAdd={handleAddLineItem}
          onCancel={() => setShowAddItem(false)}
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
          No work packages yet. Tap + to add one.
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
