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
import { reconcileWorkCalendar } from '../../lib/planning/scheduling/work-calendar';
import { ChevronLeftIcon, PeopleIcon, TaskListIcon } from '../../components/icons';
import { Fab } from '../../components/Fab';
import { ProjectPicker } from '../../components/ProjectPicker';
import { StatusBadge } from '../../components/StatusBadge';
import { MetricCard } from '../../components/MetricCard';
import { AddLineItemForm } from './AddLineItemForm';
import { LineItemCard } from './LineItemCard';
import { shouldClearPlanProjectId } from './plan-editor-state';

interface PlanEditorProps {
  plan: Plan;
  kpis: WorkTypeKpi[];
  plans: Plan[];
  projects: Project[];
  canComparePlans: boolean;
  canOpenProgress: boolean;
  /** When true, all editing controls are disabled (reviewed/archived plans). */
  readOnly?: boolean;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  onCompare: (planId: string) => void;
  onOpenSchedule?: () => void;
  onOpenProgress: () => void;
  onOpenReport?: () => void;
}

export function PlanEditor({
  plan,
  kpis,
  plans,
  projects,
  canComparePlans,
  canOpenProgress,
  readOnly = false,
  onSave,
  onBack,
  onCompare,
  onOpenSchedule,
  onOpenProgress,
  onOpenReport,
}: PlanEditorProps) {
  const { currentPlan, mutatePlan } = usePlanEditorState({ plan, onSave });
  const [title, setTitle] = useState(plan.title);
  const [showAddItem, setShowAddItem] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<BuildPhase>('build-up');
  const [showProjectPicker, setShowProjectPicker] = useState(false);

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
    mutatePlan((prev) => {
      const next = {
        ...prev,
        [field]: value || null,
      };
      return {
        ...next,
        workCalendar: reconcileWorkCalendar(
          next.workCalendar,
          next.eventStartDate,
          next.eventEndDate,
          next.defaultCrewSize,
        ),
      };
    });
  };

  const handleSetDefaultCrewSize = (value: string) => {
    const parsed = value.trim() === '' ? null : Math.max(0, Math.floor(Number(value)));
    mutatePlan((prev) => {
      const next = {
        ...prev,
        defaultCrewSize: Number.isFinite(parsed as number) ? parsed : null,
      };
      return {
        ...next,
        workCalendar: reconcileWorkCalendar(
          next.workCalendar,
          next.eventStartDate,
          next.eventEndDate,
          next.defaultCrewSize,
        ),
      };
    });
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

  useEffect(() => {
    if (!shouldClearPlanProjectId(currentPlan.projectId, projects)) return;
    mutatePlan((prev) => ({ ...prev, projectId: null }));
  }, [currentPlan, projects, mutatePlan]);

  const otherPlans = plans.filter((p) => p.id !== plan.id);

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

        <div className="planning-view__schedule-inputs">
          <label className="planning-view__schedule-input">
            <span>Event start</span>
            <input
              className="input"
              type="date"
              value={currentPlan.eventStartDate ?? ''}
              disabled={readOnly}
              onChange={(e) => handleSetEventDate('eventStartDate', e.target.value)}
            />
          </label>
          <label className="planning-view__schedule-input">
            <span>Event end</span>
            <input
              className="input"
              type="date"
              value={currentPlan.eventEndDate ?? ''}
              disabled={readOnly}
              onChange={(e) => handleSetEventDate('eventEndDate', e.target.value)}
            />
          </label>
          <label className="planning-view__schedule-input">
            <span>Default crew</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={currentPlan.defaultCrewSize ?? ''}
              disabled={readOnly}
              onChange={(e) => handleSetDefaultCrewSize(e.target.value)}
            />
          </label>
        </div>

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
              <button className="btn btn--secondary" onClick={onOpenSchedule}>
                Schedule
              </button>
            )}
            {isLocked && canOpenProgress && (
              <button className="btn btn--secondary" onClick={onOpenProgress}>
                Progress
              </button>
            )}
            <button className={`btn ${isLocked ? 'btn--success' : 'btn--secondary'}`} onClick={handleToggleLock}>
              {isLocked ? 'Revert to Draft' : 'Activate'}
            </button>
            {canComparePlans && otherPlans.length > 0 && (
              <select
                className="input planning-view__compare-trigger"
                onChange={(e) => {
                  if (e.target.value) onCompare(e.target.value);
                }}
                value=""
              >
                <option value="">Compare with...</option>
                {otherPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            )}
          </div>
        )}
        {readOnly && currentPlan.reviewedAt != null && onOpenReport && (
          <div className="planning-view__actions">
            <button className="btn btn--secondary" onClick={onOpenReport}>
              Event Report
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
