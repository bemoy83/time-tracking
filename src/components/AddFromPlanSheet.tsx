/**
 * AddFromPlanSheet — ActionSheet for releasing active plan line items as tasks.
 *
 * Displays active plans with expandable line-item sections.
 * Users multi-select line items via checkboxes, then confirm to create tasks.
 */

import { useState, useEffect } from 'react';
import { getAllPlans } from '../lib/db';
import type { Plan } from '../lib/planning/plan-model';
import { getPhaseFields, isPhaseActive } from '../lib/planning/plan-model';
import { createTask } from '../lib/stores/task-store';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS, BUILD_PHASES, type BuildPhase } from '../lib/types';
import {
  encodePlanLineItemPhaseSelection,
  selectedPlanItemsToCreateTaskInputs,
} from '../lib/planning/release-selection';
import { ActionSheet } from './ActionSheet';
import { ChevronRightIcon, CheckIcon } from './icons';

interface AddFromPlanSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFromPlanSheet({ isOpen, onClose }: AddFromPlanSheetProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());
  const [selectedSelections, setSelectedSelections] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Load locked plans when sheet opens
  useEffect(() => {
    if (!isOpen) return;
    setExpandedPlanIds(new Set());
    setSelectedSelections(new Set());
    setIsCreating(false);
    getAllPlans().then((all) => {
      setPlans(all.filter((p) => p.status === 'active' || p.status === 'reviewed' || p.reviewedAt != null));
    });
  }, [isOpen]);

  const togglePlan = (planId: string) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const buildSelectionToken = (planId: string, lineItemId: string, phase: BuildPhase): string => (
    encodePlanLineItemPhaseSelection({ planId, lineItemId, phase })
  );

  const activePhases = (plan: Plan, lineItemId: string): BuildPhase[] => {
    const item = plan.lineItems.find((candidate) => candidate.id === lineItemId);
    if (!item) return [];
    return BUILD_PHASES.filter((phase) => isPhaseActive(item, phase));
  };

  const toggleItem = (plan: Plan, lineItemId: string) => {
    const phases = activePhases(plan, lineItemId);
    if (phases.length === 0) return;

    setSelectedSelections((prev) => {
      const next = new Set(prev);
      const tokens = phases.map((phase) => buildSelectionToken(plan.id, lineItemId, phase));
      const allSelected = tokens.every((token) => next.has(token));
      for (const token of tokens) {
        if (allSelected) {
          next.delete(token);
        } else {
          next.add(token);
        }
      }
      return next;
    });
  };

  const togglePhase = (planId: string, lineItemId: string, phase: BuildPhase) => {
    const token = buildSelectionToken(planId, lineItemId, phase);
    setSelectedSelections((prev) => {
      const next = new Set(prev);
      if (next.has(token)) {
        next.delete(token);
      } else {
        next.add(token);
      }
      return next;
    });
  };

  const toggleAllInPlan = (plan: Plan) => {
    const planSelectionTokens = plan.lineItems.flatMap((item) =>
      activePhases(plan, item.id).map((phase) => buildSelectionToken(plan.id, item.id, phase)),
    );
    const allSelected =
      planSelectionTokens.length > 0 && planSelectionTokens.every((token) => selectedSelections.has(token));

    setSelectedSelections((prev) => {
      const next = new Set(prev);
      for (const token of planSelectionTokens) {
        if (allSelected) {
          next.delete(token);
        } else {
          next.add(token);
        }
      }
      return next;
    });
    // Auto-expand when selecting all
    if (!allSelected) {
      setExpandedPlanIds((prev) => {
        const next = new Set(prev);
        next.add(plan.id);
        return next;
      });
    }
  };

  const handleConfirm = async () => {
    if (selectedSelections.size === 0 || isCreating) return;
    setIsCreating(true);
    try {
      const taskInputs = selectedPlanItemsToCreateTaskInputs(plans, selectedSelections);
      // Create tasks sequentially (no batch API)
      for (const input of taskInputs) {
        await createTask(input);
      }
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const hasSelection = selectedSelections.size > 0;

  return (
    <ActionSheet isOpen={isOpen} title="Add from Plan" onClose={onClose}>
      {plans.length === 0 ? (
        <p className="template-picker__blank-desc">
          No active plans. Activate a plan in Planning to add work here.
        </p>
      ) : (
        <div className="plan-picker">
          {plans.map((plan) => {
            const isExpanded = expandedPlanIds.has(plan.id);
            const hasItems = plan.lineItems.length > 0;
            const planSelectionTokens = plan.lineItems.flatMap((item) =>
              activePhases(plan, item.id).map((phase) => buildSelectionToken(plan.id, item.id, phase)),
            );
            const hasSelectableItems = planSelectionTokens.length > 0;
            // Count selected in this plan
            const selectedCount = planSelectionTokens.filter((token) =>
              selectedSelections.has(token),
            ).length;
            const allSelected = hasSelectableItems && selectedCount === planSelectionTokens.length;
            const someSelected = selectedCount > 0 && !allSelected;

            return (
              <div key={plan.id} className="plan-picker__plan">
                <div className="plan-picker__plan-header">
                  {hasSelectableItems && (
                    <button
                      type="button"
                      className="plan-picker__select-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllInPlan(plan);
                      }}
                      aria-label={allSelected ? `Deselect all in ${plan.title}` : `Select all in ${plan.title}`}
                    >
                      <span
                        className={`plan-picker__checkbox${allSelected ? ' plan-picker__checkbox--checked' : ''}${someSelected ? ' plan-picker__checkbox--partial' : ''}`}
                        aria-hidden="true"
                      >
                        {allSelected && <CheckIcon className="plan-picker__check-icon" />}
                        {someSelected && <span className="plan-picker__partial-icon" />}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="plan-picker__plan-toggle"
                    onClick={() => togglePlan(plan.id)}
                    aria-expanded={isExpanded}
                  >
                    <ChevronRightIcon
                      className={`plan-picker__chevron${isExpanded ? ' plan-picker__chevron--open' : ''}`}
                    />
                    <span className="plan-picker__plan-title">{plan.title}</span>
                    <span className="plan-picker__plan-count">
                      {plan.lineItems.length} item{plan.lineItems.length !== 1 ? 's' : ''}
                      {selectedCount > 0 && ` · ${selectedCount} task${selectedCount !== 1 ? 's' : ''} selected`}
                    </span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="plan-picker__items">
                    {!hasItems ? (
                      <p className="plan-picker__empty">No line items in this plan.</p>
                    ) : (
                      plan.lineItems.map((item) => {
                        const itemPhases = BUILD_PHASES.filter((phase) => isPhaseActive(item, phase));
                        const itemPhaseTokens = itemPhases.map((phase) =>
                          buildSelectionToken(plan.id, item.id, phase),
                        );
                        const selectedItemPhaseCount = itemPhaseTokens.filter((token) =>
                          selectedSelections.has(token),
                        ).length;
                        const isSelected =
                          itemPhaseTokens.length > 0 && selectedItemPhaseCount === itemPhaseTokens.length;
                        const isPartiallySelected = selectedItemPhaseCount > 0 && !isSelected;
                        const phases = itemPhases.map((phase) => BUILD_PHASE_LABELS[phase]);
                        const detail = [
                          phases.length > 0 ? phases.join(' / ') : null,
                          item.workQuantity > 0
                            ? `${item.workQuantity} ${WORK_UNIT_LABELS[item.workUnit]}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <div key={item.id} className="plan-picker__item-block">
                            <button
                              type="button"
                              className={`plan-picker__item${selectedItemPhaseCount > 0 ? ' plan-picker__item--selected' : ''}`}
                              onClick={() => toggleItem(plan, item.id)}
                              aria-pressed={isSelected}
                            >
                              <span
                                className={`plan-picker__checkbox${isSelected ? ' plan-picker__checkbox--checked' : ''}${isPartiallySelected ? ' plan-picker__checkbox--partial' : ''}`}
                                aria-hidden="true"
                              >
                                {isSelected && <CheckIcon className="plan-picker__check-icon" />}
                                {isPartiallySelected && <span className="plan-picker__partial-icon" />}
                              </span>
                              <span className="plan-picker__item-content">
                                <span className="plan-picker__item-title">{item.title}</span>
                                <span className="plan-picker__item-detail">{detail}</span>
                              </span>
                            </button>

                            {itemPhases.length > 0 && (
                              <div className="plan-picker__phase-list">
                                {itemPhases.map((phase) => {
                                  const token = buildSelectionToken(plan.id, item.id, phase);
                                  const isPhaseSelected = selectedSelections.has(token);
                                  const pf = getPhaseFields(item, phase);
                                  return (
                                    <button
                                      key={`${item.id}:${phase}`}
                                      type="button"
                                      className={`plan-picker__phase${isPhaseSelected ? ' plan-picker__phase--selected' : ''}`}
                                      onClick={() => togglePhase(plan.id, item.id, phase)}
                                      aria-pressed={isPhaseSelected}
                                    >
                                      <span
                                        className={`plan-picker__checkbox${isPhaseSelected ? ' plan-picker__checkbox--checked' : ''}`}
                                        aria-hidden="true"
                                      >
                                        {isPhaseSelected && <CheckIcon className="plan-picker__check-icon" />}
                                      </span>
                                      <span className="plan-picker__phase-content">
                                        <span className="plan-picker__phase-title">{BUILD_PHASE_LABELS[phase]}</span>
                                        <span className="plan-picker__phase-detail">
                                          {pf.crew} crew · {pf.timeHours.toFixed(1)}h
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={!hasSelection || isCreating}
            onClick={handleConfirm}
          >
            {isCreating
              ? 'Adding…'
              : hasSelection
                ? `Add ${selectedSelections.size} Task${selectedSelections.size !== 1 ? 's' : ''}`
                : 'Add Tasks'}
          </button>
        </div>
      </div>
    </ActionSheet>
  );
}
