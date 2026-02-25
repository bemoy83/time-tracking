/**
 * PlanningView — dedicated planning surface separate from Today execution flow.
 * Shows plan list, create/edit plan, work packages with KPI suggestions,
 * risk highlights, lock/save controls, and rationale notes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  formatDurationShort,
  type BuildPhase,
} from '../lib/types';
import { useWorkTypeStore, getWorkTypeById } from '../lib/stores/work-type-store';
import { getAllPlans, addPlan, updatePlan, deletePlan } from '../lib/db';
import {
  type Plan,
  type PlanLineItem,
  createPlan,
  createLineItem,
  lockPlan,
  unlockPlan,
  addLineItemToPlan,
  removeLineItemFromPlan,
  updatePlanLineItem,
  duplicateLineItem,
  planTotalPersonHours,
  resolveLineItemWorkTypeTitle,
} from '../lib/planning/plan-model';
import { generatePlanSuggestions, type LineItemSuggestion } from '../lib/planning/plan-suggestions';
import { comparePlans, type PlanComparison } from '../lib/planning/plan-compare';
import type { WorkTypeKpi } from '../lib/kpi';
import { computeWorkTypeKpis } from '../lib/kpi';
import { useTaskStore } from '../lib/stores/task-store';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { getOutlierHandlingMode } from '../lib/stores/kpi-settings';
import { getFeatureFlag } from '../lib/flags/feature-flags';
import { trackTelemetryEvent } from '../lib/telemetry/telemetry';
import { computeProductivityResult } from '../lib/calculator';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  XIcon,
  CalculatorIcon,
  SparklesIcon,
} from '../components/icons';

/** Select all text on focus so typing replaces the value. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

type PlanningSubView = 'list' | 'edit' | 'compare';

export function PlanningView() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subView, setSubView] = useState<PlanningSubView>('list');
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [comparePlanId, setComparePlanId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);
  const { tasks } = useTaskStore();
  const { workTypes } = useWorkTypeStore();
  const canComparePlans = getFeatureFlag('planningScenarioCompare');

  // Load plans from DB
  useEffect(() => {
    getAllPlans().then(setPlans);
  }, []);

  // Load KPIs for suggestions
  useEffect(() => {
    async function loadKpis() {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      if (completedTasks.length === 0) {
        setKpis([]);
        return;
      }
      const rollup = await buildAttributedRollup(completedTasks, tasks);
      const outlierMode = getOutlierHandlingMode();
      const computed = computeWorkTypeKpis(completedTasks, rollup.entriesByTask, {
        workTypes,
        archiveOnly: true,
        outlierMode,
      });
      setKpis(computed);
    }
    loadKpis();
  }, [tasks, workTypes]);

  const handleCreatePlan = useCallback(async () => {
    const plan = createPlan('New Plan');
    await addPlan(plan);
    setPlans((prev) => [...prev, plan]);
    setActivePlan(plan);
    setSubView('edit');
  }, []);

  const handleSelectPlan = useCallback((plan: Plan) => {
    setActivePlan(plan);
    setSubView('edit');
  }, []);

  const handleSavePlan = useCallback(async (plan: Plan) => {
    await updatePlan(plan);
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
    setActivePlan(plan);
  }, []);

  const handleDeletePlan = useCallback(async (planId: string) => {
    await deletePlan(planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (activePlan?.id === planId) {
      setActivePlan(null);
      setSubView('list');
    }
  }, [activePlan]);

  const handleBack = useCallback(() => {
    setSubView('list');
    setActivePlan(null);
    setComparePlanId(null);
  }, []);

  // Compare view
  const comparison = activePlan && comparePlanId
    ? comparePlans(activePlan, plans.find((p) => p.id === comparePlanId)!)
    : null;

  useEffect(() => {
    if (!canComparePlans && subView === 'compare') {
      setSubView('edit');
      setComparePlanId(null);
    }
  }, [canComparePlans, subView]);

  if (subView === 'list') {
    return (
      <PlanList
        plans={plans}
        onSelect={handleSelectPlan}
        onCreate={handleCreatePlan}
        onDelete={handleDeletePlan}
      />
    );
  }

  if (canComparePlans && subView === 'compare' && activePlan && comparison) {
    return (
      <CompareView
        comparison={comparison}
        onBack={() => setSubView('edit')}
      />
    );
  }

  if (subView === 'edit' && activePlan) {
    return (
      <PlanEditor
        plan={activePlan}
        kpis={kpis}
        plans={plans}
        canComparePlans={canComparePlans}
        onSave={handleSavePlan}
        onBack={handleBack}
        onCompare={(planId) => {
          trackTelemetryEvent('planning_compare_open');
          setComparePlanId(planId);
          setSubView('compare');
        }}
      />
    );
  }

  return null;
}

// --- Plan List ---

function PlanList({
  plans,
  onSelect,
  onCreate,
  onDelete,
}: {
  plans: Plan[];
  onSelect: (plan: Plan) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="planning-view">
      <header className="planning-view__header">
        <h1 className="planning-view__title">Plans</h1>
        <button className="btn btn--primary" onClick={onCreate}>
          New Plan
        </button>
      </header>

      {plans.length === 0 ? (
        <p className="planning-view__empty">No plans yet. Create one to get started.</p>
      ) : (
        <ul className="planning-view__list">
          {plans.map((plan) => (
            <li key={plan.id} className="planning-view__item">
              <button
                className="planning-view__item-btn"
                onClick={() => onSelect(plan)}
              >
                <span className="planning-view__item-content">
                  <span className="planning-view__item-title">{plan.title}</span>
                  <span className="planning-view__item-meta">
                    {plan.lineItems.length} {plan.lineItems.length === 1 ? 'package' : 'packages'}
                  </span>
                </span>
                <span className={`planning-view__status planning-view__status--${plan.status}`}>
                  {plan.status}
                </span>
                <ChevronRightIcon className="planning-view__item-chevron" />
              </button>
              <button
                className="planning-view__item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(plan.id);
                }}
                aria-label={`Delete ${plan.title}`}
              >
                <TrashIcon className="planning-view__item-delete-icon" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Plan Editor ---

function PlanEditor({
  plan,
  kpis,
  plans,
  canComparePlans,
  onSave,
  onBack,
  onCompare,
}: {
  plan: Plan;
  kpis: WorkTypeKpi[];
  plans: Plan[];
  canComparePlans: boolean;
  onSave: (plan: Plan) => void;
  onBack: () => void;
  onCompare: (planId: string) => void;
}) {
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [title, setTitle] = useState(plan.title);
  const [showAddItem, setShowAddItem] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<BuildPhase>('build-up');

  const suggestions = generatePlanSuggestions(currentPlan.lineItems, kpis);
  const totalPersonHours = planTotalPersonHours(currentPlan);
  const isLocked = currentPlan.status === 'locked';

  const handleSave = () => {
    const updated = { ...currentPlan, title };
    onSave(updated);
  };

  const handleToggleLock = () => {
    const updated = isLocked ? unlockPlan(currentPlan) : lockPlan(currentPlan);
    setCurrentPlan(updated);
    onSave(updated);
    trackTelemetryEvent('planning_lock_toggle');
  };

  const handleAddLineItem = (item: PlanLineItem) => {
    const updated = addLineItemToPlan(currentPlan, item);
    setCurrentPlan(updated);
    onSave(updated);
    setShowAddItem(false);
  };

  const handleRemoveItem = (itemId: string) => {
    const updated = removeLineItemFromPlan(currentPlan, itemId);
    setCurrentPlan(updated);
    onSave(updated);
  };

  const handleUpdateItem = (itemId: string, updates: Partial<PlanLineItem>) => {
    const updated = updatePlanLineItem(currentPlan, itemId, updates);
    setCurrentPlan(updated);
    onSave(updated);
  };

  const handleDuplicateItem = (item: PlanLineItem) => {
    const updated = addLineItemToPlan(currentPlan, duplicateLineItem(item));
    setCurrentPlan(updated);
    onSave(updated);
  };

  const otherPlans = plans.filter((p) => p.id !== plan.id);

  return (
    <div className="planning-view">
      <header className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plans">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Plans
        </button>
      </header>

      <div className="planning-view__editor-header">
        <input
          className="planning-view__title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          disabled={isLocked}
          aria-label="Plan title"
        />
        <span className={`planning-view__status planning-view__status--${currentPlan.status}`}>
          {currentPlan.status}
        </span>
      </div>

      {/* Summary stats */}
      <div className="planning-view__summary">
        <div className="planning-view__stat">
          <span className="planning-view__stat-value">{currentPlan.lineItems.length}</span>
          <span className="planning-view__stat-label">Work packages</span>
        </div>
        <div className="planning-view__stat">
          <span className="planning-view__stat-value">
            {formatDurationShort(totalPersonHours * 3_600_000)}
          </span>
          <span className="planning-view__stat-label">Person-hours</span>
        </div>
        {suggestions.highRiskCount > 0 && (
          <div className="planning-view__stat planning-view__stat--risk">
            <span className="planning-view__stat-value">{suggestions.highRiskCount}</span>
            <span className="planning-view__stat-label">High risk</span>
          </div>
        )}
      </div>

      {!isLocked && (
        <div className="planning-view__phase-toggle" role="group" aria-label="Build phase filter">
          {BUILD_PHASES.map((phase) => (
            <button
              key={phase}
              type="button"
              className={`planning-view__phase-toggle-btn${phaseFilter === phase ? ' planning-view__phase-toggle-btn--active' : ''}`}
              onClick={() => setPhaseFilter(phase)}
              aria-pressed={phaseFilter === phase}
            >
              {BUILD_PHASE_LABELS[phase]}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="planning-view__actions">
        <button
          className={`btn ${isLocked ? 'btn--success' : 'btn--secondary'}`}
          onClick={handleToggleLock}
        >
          {isLocked ? 'Unlock' : 'Lock Plan'}
        </button>
        {!isLocked && (
          <button className="btn btn--primary" onClick={() => setShowAddItem(true)}>
            Add Work Package
          </button>
        )}
        {canComparePlans && otherPlans.length > 0 && (
          <select
            className="input planning-view__compare-select"
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

      {/* Add form */}
      {showAddItem && !isLocked && (
        <AddLineItemForm
          phaseFilter={phaseFilter}
          onAdd={handleAddLineItem}
          onCancel={() => setShowAddItem(false)}
        />
      )}

      {/* Line items */}
      {currentPlan.lineItems.length > 0 && (
        <div>
          <div className="planning-view__items-header">
            <h2 className="planning-view__items-title">Work Packages</h2>
          </div>
          <div className="planning-view__items">
            {currentPlan.lineItems.map((item) => {
              const suggestion = suggestions.items.find((s) => s.lineItemId === item.id);
              return (
                <LineItemCard
                  key={item.id}
                  item={item}
                  suggestion={suggestion ?? null}
                  isLocked={isLocked}
                  onUpdate={(updates) => handleUpdateItem(item.id, updates)}
                  onDuplicate={handleDuplicateItem}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Line Item Card ---

function LineItemCard({
  item,
  suggestion,
  isLocked,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  item: PlanLineItem;
  suggestion: LineItemSuggestion | null;
  isLocked: boolean;
  onUpdate: (updates: Partial<PlanLineItem>) => void;
  onDuplicate?: (item: PlanLineItem) => void;
  onRemove: () => void;
}) {
  const [rationale, setRationale] = useState(item.rationale ?? '');
  const riskClass = suggestion ? `planning-view__risk--${suggestion.risk}` : '';

  const canRecomputeTime = item.workQuantity > 0 && item.crew > 0 && item.productivityRate > 0;
  const handleRecomputeTime = () => {
    const result = computeProductivityResult('time', item.workQuantity, item.productivityRate, 0, item.crew);
    if (result?.timeHours != null) {
      onUpdate({ timeHours: Math.round(result.timeHours * 100) / 100 });
    }
  };

  const canRecomputeCrew = item.workQuantity > 0 && item.timeHours > 0 && item.productivityRate > 0;
  const handleRecomputeCrew = () => {
    const result = computeProductivityResult('crew', item.workQuantity, item.productivityRate, item.timeHours, 0);
    if (result?.crew != null) {
      onUpdate({ crew: result.crew });
    }
  };

  const workTypeLabel = (() => {
    const wt = item.workTypeId ? getWorkTypeById(item.workTypeId) : null;
    return wt
      ? `${wt.title} · ${BUILD_PHASE_LABELS[wt.buildPhase]} · ${WORK_UNIT_LABELS[wt.workUnit]}`
      : `${resolveLineItemWorkTypeTitle(item)} · ${BUILD_PHASE_LABELS[item.buildPhase]} · ${WORK_UNIT_LABELS[item.workUnit]}`;
  })();

  return (
    <div className={`planning-view__line-item ${riskClass}`}>
      <div className="planning-view__line-item-header">
        <div className="planning-view__line-item-info">
          <span className="planning-view__line-item-title">{item.title}</span>
          <span className="planning-view__line-item-type">{workTypeLabel}</span>
        </div>
        {!isLocked && (
          <div className="planning-view__line-item-actions">
            <button
              type="button"
              className="planning-view__line-item-duplicate"
              onClick={() => onDuplicate?.(item)}
              aria-label={`Duplicate ${item.title}`}
            >
              Duplicate
            </button>
            <button
              className="planning-view__line-item-remove"
              onClick={onRemove}
              aria-label={`Remove ${item.title}`}
            >
              <XIcon className="planning-view__line-item-remove-icon" />
            </button>
          </div>
        )}
      </div>

      {isLocked ? (
        <div className="planning-view__line-item-fields">
          <div className="planning-view__field">
            <span className="planning-view__field-label">Quantity</span>
            <span className="planning-view__field-value">{item.workQuantity}</span>
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">Crew</span>
            <span className="planning-view__field-value">{item.crew}</span>
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">Time (hrs)</span>
            <span className="planning-view__field-value">{item.timeHours}</span>
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">Rate</span>
            <span className="planning-view__field-value">
              {item.productivityRate} {WORK_UNIT_LABELS[item.workUnit]}/ph
            </span>
          </div>
        </div>
      ) : (
        <div className="planning-view__line-item-fields">
          <div className="planning-view__field">
            <span className="planning-view__field-label">Quantity</span>
            <input
              type="number"
              className="input"
              value={item.workQuantity}
              onChange={(e) => onUpdate({ workQuantity: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">
              Crew
              <button
                className="planning-view__recompute-btn"
                onClick={handleRecomputeCrew}
                disabled={!canRecomputeCrew}
                aria-label="Recompute crew from quantity, time, and rate"
                title="Recompute crew"
              >
                <CalculatorIcon className="planning-view__recompute-icon" />
              </button>
            </span>
            <input
              type="number"
              className="input"
              value={item.crew}
              min={1}
              max={20}
              onChange={(e) => onUpdate({ crew: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">
              Time (hrs)
              <button
                className="planning-view__recompute-btn"
                onClick={handleRecomputeTime}
                disabled={!canRecomputeTime}
                aria-label="Recompute time from quantity, crew, and rate"
                title="Recompute time"
              >
                <CalculatorIcon className="planning-view__recompute-icon" />
              </button>
            </span>
            <input
              type="number"
              className="input"
              value={item.timeHours}
              step={0.5}
              onChange={(e) => onUpdate({ timeHours: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">
              Rate ({WORK_UNIT_LABELS[item.workUnit]}/ph)
            </span>
            <input
              type="number"
              className="input"
              value={item.productivityRate}
              step={0.1}
              onChange={(e) => onUpdate({ productivityRate: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
        </div>
      )}

      {/* KPI Suggestion */}
      {suggestion && suggestion.suggestedRate != null && (
        <div className="planning-view__suggestion">
          <SparklesIcon className="planning-view__suggestion-icon" />
          <span className="planning-view__suggestion-text">
            KPI suggests{' '}
            <span className="planning-view__suggestion-rate">
              {suggestion.suggestedRate.toFixed(1)} {WORK_UNIT_LABELS[item.workUnit]}/ph
            </span>
          </span>
          {suggestion.confidence && (
            <span className={`planning-view__confidence planning-view__confidence--${suggestion.confidence}`}>
              {suggestion.confidence}
            </span>
          )}
          {!isLocked && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onUpdate({
                productivityRate: suggestion.suggestedRate!,
                rateSource: 'historical',
                timeHours: suggestion.suggestedTimeHours ?? item.timeHours,
              })}
            >
              Apply
            </button>
          )}
        </div>
      )}

      {/* Risk warnings */}
      {suggestion && suggestion.riskReasons.length > 0 && (
        <div className="planning-view__risk-warnings">
          {suggestion.riskReasons.map((reason, i) => (
            <span key={i} className="planning-view__risk-reason">{reason}</span>
          ))}
        </div>
      )}

      {/* Rationale note */}
      {!isLocked && (
        <div className="planning-view__rationale">
          <input
            type="text"
            className="input"
            placeholder="Add rationale note..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            onBlur={() => onUpdate({ rationale: rationale || null })}
          />
        </div>
      )}
      {isLocked && rationale && (
        <div className="planning-view__line-item-type">
          {rationale}
        </div>
      )}
    </div>
  );
}

// --- Add Line Item Form ---

function AddLineItemForm({
  phaseFilter,
  onAdd,
  onCancel,
}: {
  phaseFilter: BuildPhase;
  onAdd: (item: PlanLineItem) => void;
  onCancel: () => void;
}) {
  const { workTypes } = useWorkTypeStore();
  const filteredWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.buildPhase === phaseFilter),
    [workTypes, phaseFilter],
  );
  const [title, setTitle] = useState('');
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
  const [workQuantity, setWorkQuantity] = useState(0);
  const [rate, setRate] = useState(10);

  useEffect(() => {
    if (filteredWorkTypes.length === 0) {
      if (selectedWorkTypeId) {
        setSelectedWorkTypeId('');
      }
      return;
    }
    const isCurrentSelectionValid = filteredWorkTypes.some((wt) => wt.id === selectedWorkTypeId);
    if (!isCurrentSelectionValid) {
      setSelectedWorkTypeId(filteredWorkTypes[0].id);
      setRate(filteredWorkTypes[0].expectedProductivity);
    }
  }, [filteredWorkTypes, selectedWorkTypeId]);

  const selectedWorkType = selectedWorkTypeId
    ? filteredWorkTypes.find((wt) => wt.id === selectedWorkTypeId) ?? null
    : null;

  const handleWorkTypeChange = (wtId: string) => {
    setSelectedWorkTypeId(wtId);
    const wt = filteredWorkTypes.find((candidate) => candidate.id === wtId);
    if (wt) {
      setRate(wt.expectedProductivity);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !selectedWorkType) return;
    const item = createLineItem(
      title.trim(),
      selectedWorkType.title,
      selectedWorkType.workUnit,
      selectedWorkType.buildPhase,
      workQuantity,
      rate,
      'template',
      selectedWorkType.id,
    );
    onAdd(item);
  };

  const noWorkTypesMessage = `No work types for ${BUILD_PHASE_LABELS[phaseFilter]}. Add work types in Settings.`;

  return (
    <div className="planning-view__add-form">
      <h3 className="planning-view__add-form-title">Add Work Package</h3>
      <div className="planning-view__add-fields">
        <div className="planning-view__field">
          <span className="planning-view__field-label">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Install drywall"
            autoFocus
          />
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">Work Type</span>
          <select
            className="input"
            value={selectedWorkTypeId}
            disabled={filteredWorkTypes.length === 0}
            onChange={(e) => handleWorkTypeChange(e.target.value)}
          >
            {filteredWorkTypes.length === 0 && <option value="">{noWorkTypesMessage}</option>}
            {filteredWorkTypes.map((wt) => (
              <option key={wt.id} value={wt.id}>
                {wt.title} · {BUILD_PHASE_LABELS[wt.buildPhase]} · {WORK_UNIT_LABELS[wt.workUnit]}
              </option>
            ))}
          </select>
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">
            Quantity{selectedWorkType ? ` (${WORK_UNIT_LABELS[selectedWorkType.workUnit]})` : ''}
          </span>
          <input
            className="input"
            type="number"
            value={workQuantity}
            onChange={(e) => setWorkQuantity(Number(e.target.value))}
            onFocus={selectOnFocus}
          />
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">
            Rate{selectedWorkType ? ` (${WORK_UNIT_LABELS[selectedWorkType.workUnit]}/ph)` : ''}
          </span>
          <input
            className="input"
            type="number"
            value={rate}
            step={0.1}
            onChange={(e) => setRate(Number(e.target.value))}
            onFocus={selectOnFocus}
          />
        </div>
      </div>
      <div className="planning-view__add-actions">
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn--primary"
          onClick={handleSubmit}
          disabled={!title.trim() || !selectedWorkType}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// --- Compare View ---

function CompareView({
  comparison,
  onBack,
}: {
  comparison: PlanComparison;
  onBack: () => void;
}) {
  return (
    <div className="planning-view">
      <header className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Back
        </button>
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Compare
        </h2>
      </header>

      <div className="planning-view__compare-summary">
        <div className="planning-view__compare-row">
          <span className="planning-view__compare-plan-name">{comparison.planATitle}</span>
          <span className="planning-view__compare-plan-stat">
            {comparison.totalDelta.lineItemsA} items · {formatDurationShort(comparison.totalDelta.personHoursA * 3_600_000)}
          </span>
        </div>
        <div className="planning-view__compare-row">
          <span className="planning-view__compare-plan-name">{comparison.planBTitle}</span>
          <span className="planning-view__compare-plan-stat">
            {comparison.totalDelta.lineItemsB} items · {formatDurationShort(comparison.totalDelta.personHoursB * 3_600_000)}
          </span>
        </div>
        <div className="planning-view__compare-delta">
          <span>Delta</span>
          <span className={comparison.totalDelta.personHoursDelta > 0 ? 'planning-view__delta--increase' : 'planning-view__delta--decrease'}>
            {comparison.totalDelta.personHoursDelta > 0 ? '+' : ''}
            {formatDurationShort(Math.abs(comparison.totalDelta.personHoursDelta) * 3_600_000)} person-hrs
          </span>
        </div>
      </div>

      <div className="planning-view__compare-items">
        {comparison.lineItems.map((item) => (
          <div key={item.lineItemId} className={`planning-view__compare-item planning-view__compare-item--${item.status}`}>
            <div className="planning-view__compare-item-header">
              <span className="planning-view__compare-title">{item.title}</span>
              <span className={`planning-view__compare-status planning-view__compare-status--${item.status}`}>
                {item.status}
              </span>
            </div>
            {item.changes.length > 0 && (
              <div className="planning-view__compare-changes">
                {item.changes.map((change) => (
                  <span key={change.field} className="planning-view__compare-change">
                    {change.field}: {change.valueA}{' '}
                    <span className="planning-view__compare-change-arrow">&rarr;</span>{' '}
                    {change.valueB}
                    {change.percentChange != null && (
                      <span className={change.percentChange > 0 ? 'planning-view__delta--increase' : 'planning-view__delta--decrease'}>
                        {' '}({change.percentChange > 0 ? '+' : ''}{(change.percentChange * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
