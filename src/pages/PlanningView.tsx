/**
 * PlanningView — dedicated planning surface separate from Today execution flow.
 * Shows plan list, create/edit plan, work packages with KPI suggestions,
 * risk highlights, lock/save controls, and rationale notes.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LABELS,
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
  formatDurationShort,
  type WorkCategory,
  type WorkUnit,
  type BuildPhase,
} from '../lib/types';
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
  planTotalPersonHours,
} from '../lib/planning/plan-model';
import { generatePlanSuggestions, type LineItemSuggestion } from '../lib/planning/plan-suggestions';
import { comparePlans, type PlanComparison } from '../lib/planning/plan-compare';
import type { WorkTypeKpi } from '../lib/kpi';
import { computeWorkTypeKpis } from '../lib/kpi';
import { useTaskStore } from '../lib/stores/task-store';
import { buildAttributedRollup } from '../lib/attributed-rollup';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];
const BUILD_PHASES: BuildPhase[] = ['build-up', 'tear-down'];

type PlanningSubView = 'list' | 'edit' | 'compare';

export function PlanningView() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subView, setSubView] = useState<PlanningSubView>('list');
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [comparePlanId, setComparePlanId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);
  const { tasks } = useTaskStore();

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
      const computed = computeWorkTypeKpis(completedTasks, rollup.entriesByTask);
      setKpis(computed);
    }
    loadKpis();
  }, [tasks]);

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

  if (subView === 'compare' && activePlan && comparison) {
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
        onSave={handleSavePlan}
        onBack={handleBack}
        onCompare={(planId) => {
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
                <span className="planning-view__item-title">{plan.title}</span>
                <span className={`planning-view__status planning-view__status--${plan.status}`}>
                  {plan.status}
                </span>
                <span className="planning-view__item-meta">
                  {plan.lineItems.length} items
                </span>
              </button>
              <button
                className="btn btn--secondary btn--sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(plan.id);
                }}
              >
                Delete
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
  onSave,
  onBack,
  onCompare,
}: {
  plan: Plan;
  kpis: WorkTypeKpi[];
  plans: Plan[];
  onSave: (plan: Plan) => void;
  onBack: () => void;
  onCompare: (planId: string) => void;
}) {
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [title, setTitle] = useState(plan.title);
  const [showAddItem, setShowAddItem] = useState(false);

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

  const otherPlans = plans.filter((p) => p.id !== plan.id);

  return (
    <div className="planning-view">
      <header className="planning-view__header">
        <button className="btn btn--secondary" onClick={onBack}>Back</button>
        <input
          className="planning-view__title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          disabled={isLocked}
        />
        <span className={`planning-view__status planning-view__status--${currentPlan.status}`}>
          {currentPlan.status}
        </span>
      </header>

      <div className="planning-view__actions">
        <button className="btn btn--secondary" onClick={handleToggleLock}>
          {isLocked ? 'Unlock' : 'Lock Plan'}
        </button>
        {!isLocked && (
          <button className="btn btn--primary" onClick={() => setShowAddItem(true)}>
            Add Work Package
          </button>
        )}
        {otherPlans.length > 0 && (
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

      {/* Summary */}
      <div className="planning-view__summary">
        <span>{currentPlan.lineItems.length} work packages</span>
        <span>{formatDurationShort(totalPersonHours * 3_600_000)} total person-hours</span>
        {suggestions.highRiskCount > 0 && (
          <span className="planning-view__risk-badge planning-view__risk-badge--high">
            {suggestions.highRiskCount} high risk
          </span>
        )}
      </div>

      {showAddItem && !isLocked && (
        <AddLineItemForm
          onAdd={handleAddLineItem}
          onCancel={() => setShowAddItem(false)}
        />
      )}

      {/* Line items */}
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
              onRemove={() => handleRemoveItem(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Line Item Card ---

function LineItemCard({
  item,
  suggestion,
  isLocked,
  onUpdate,
  onRemove,
}: {
  item: PlanLineItem;
  suggestion: LineItemSuggestion | null;
  isLocked: boolean;
  onUpdate: (updates: Partial<PlanLineItem>) => void;
  onRemove: () => void;
}) {
  const [rationale, setRationale] = useState(item.rationale ?? '');
  const riskClass = suggestion ? `planning-view__risk--${suggestion.risk}` : '';

  return (
    <div className={`planning-view__line-item ${riskClass}`}>
      <div className="planning-view__line-item-header">
        <span className="planning-view__line-item-title">{item.title}</span>
        <span className="planning-view__line-item-type">
          {WORK_CATEGORY_LABELS[item.workCategory]} / {WORK_UNIT_LABELS[item.workUnit]} / {BUILD_PHASE_LABELS[item.buildPhase]}
        </span>
        {!isLocked && (
          <button className="btn btn--secondary btn--sm" onClick={onRemove}>Remove</button>
        )}
      </div>

      <div className="planning-view__line-item-fields">
        <label>
          Quantity
          <input
            type="number"
            className="input"
            value={item.workQuantity}
            onChange={(e) => onUpdate({ workQuantity: Number(e.target.value) })}
            disabled={isLocked}
          />
        </label>
        <label>
          Crew
          <input
            type="number"
            className="input"
            value={item.crew}
            min={1}
            max={20}
            onChange={(e) => onUpdate({ crew: Number(e.target.value) })}
            disabled={isLocked}
          />
        </label>
        <label>
          Time (hrs)
          <input
            type="number"
            className="input"
            value={item.timeHours}
            step={0.5}
            onChange={(e) => onUpdate({ timeHours: Number(e.target.value) })}
            disabled={isLocked}
          />
        </label>
        <label>
          Rate ({WORK_UNIT_LABELS[item.workUnit]}/person-hr)
          <input
            type="number"
            className="input"
            value={item.productivityRate}
            step={0.1}
            onChange={(e) => onUpdate({ productivityRate: Number(e.target.value) })}
            disabled={isLocked}
          />
        </label>
      </div>

      {/* KPI Suggestion */}
      {suggestion && suggestion.suggestedRate != null && (
        <div className="planning-view__suggestion">
          <span>KPI suggests {suggestion.suggestedRate.toFixed(1)} {WORK_UNIT_LABELS[item.workUnit]}/person-hr</span>
          {suggestion.confidence && (
            <span className={`planning-view__confidence planning-view__confidence--${suggestion.confidence}`}>
              {suggestion.confidence}
            </span>
          )}
          {!isLocked && (
            <button
              className="btn btn--secondary btn--sm"
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
      <div className="planning-view__rationale">
        <input
          type="text"
          className="input"
          placeholder="Add rationale note..."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          onBlur={() => onUpdate({ rationale: rationale || null })}
          disabled={isLocked}
        />
      </div>
    </div>
  );
}

// --- Add Line Item Form ---

function AddLineItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: PlanLineItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [workCategory, setWorkCategory] = useState<WorkCategory>('carpet-tiles');
  const [workUnit, setWorkUnit] = useState<WorkUnit>('m2');
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('build-up');
  const [workQuantity, setWorkQuantity] = useState(100);
  const [rate, setRate] = useState(10);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const item = createLineItem(title.trim(), workCategory, workUnit, buildPhase, workQuantity, rate);
    onAdd(item);
  };

  return (
    <div className="planning-view__add-form">
      <h3>Add Work Package</h3>
      <div className="planning-view__add-fields">
        <label>
          Title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Category
          <select className="input" value={workCategory} onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}>
            {WORK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{WORK_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
        <label>
          Unit
          <select className="input" value={workUnit} onChange={(e) => setWorkUnit(e.target.value as WorkUnit)}>
            {WORK_UNITS.map((u) => (
              <option key={u} value={u}>{WORK_UNIT_LABELS[u]}</option>
            ))}
          </select>
        </label>
        <label>
          Phase
          <select className="input" value={buildPhase} onChange={(e) => setBuildPhase(e.target.value as BuildPhase)}>
            {BUILD_PHASES.map((p) => (
              <option key={p} value={p}>{BUILD_PHASE_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input className="input" type="number" value={workQuantity} onChange={(e) => setWorkQuantity(Number(e.target.value))} />
        </label>
        <label>
          Rate
          <input className="input" type="number" value={rate} step={0.1} onChange={(e) => setRate(Number(e.target.value))} />
        </label>
      </div>
      <div className="planning-view__add-actions">
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={handleSubmit} disabled={!title.trim()}>Add</button>
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
      <header className="planning-view__header">
        <button className="btn btn--secondary" onClick={onBack}>Back</button>
        <h2 className="planning-view__title">
          {comparison.planATitle} vs {comparison.planBTitle}
        </h2>
      </header>

      <div className="planning-view__compare-summary">
        <div>
          <strong>{comparison.planATitle}</strong>: {comparison.totalDelta.lineItemsA} items,{' '}
          {formatDurationShort(comparison.totalDelta.personHoursA * 3_600_000)} person-hrs
        </div>
        <div>
          <strong>{comparison.planBTitle}</strong>: {comparison.totalDelta.lineItemsB} items,{' '}
          {formatDurationShort(comparison.totalDelta.personHoursB * 3_600_000)} person-hrs
        </div>
        <div className={comparison.totalDelta.personHoursDelta > 0 ? 'planning-view__delta--increase' : 'planning-view__delta--decrease'}>
          Delta: {comparison.totalDelta.personHoursDelta > 0 ? '+' : ''}
          {formatDurationShort(Math.abs(comparison.totalDelta.personHoursDelta) * 3_600_000)} person-hrs
        </div>
      </div>

      <div className="planning-view__compare-items">
        {comparison.lineItems.map((item) => (
          <div key={item.lineItemId} className={`planning-view__compare-item planning-view__compare-item--${item.status}`}>
            <span className="planning-view__compare-title">{item.title}</span>
            <span className={`planning-view__compare-status planning-view__compare-status--${item.status}`}>
              {item.status}
            </span>
            {item.changes.length > 0 && (
              <div className="planning-view__compare-changes">
                {item.changes.map((change) => (
                  <span key={change.field} className="planning-view__compare-change">
                    {change.field}: {change.valueA} → {change.valueB}
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
