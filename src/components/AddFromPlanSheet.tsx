/**
 * AddFromPlanSheet — ActionSheet for releasing locked plan line items as tasks.
 *
 * Displays locked plans with expandable line-item sections.
 * Users multi-select line items via checkboxes, then confirm to create tasks.
 */

import { useState, useEffect } from 'react';
import { getAllPlans } from '../lib/db';
import type { Plan, PlanLineItem } from '../lib/planning/plan-model';
import { lineItemToCreateTaskInput } from '../lib/planning/release-plan';
import { createTask } from '../lib/stores/task-store';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../lib/types';
import { ActionSheet } from './ActionSheet';
import { ChevronRightIcon, CheckIcon } from './icons';

interface AddFromPlanSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFromPlanSheet({ isOpen, onClose }: AddFromPlanSheetProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Load locked plans when sheet opens
  useEffect(() => {
    if (!isOpen) return;
    setExpandedPlanIds(new Set());
    setSelectedItemIds(new Set());
    setIsCreating(false);
    getAllPlans().then((all) => {
      setPlans(all.filter((p) => p.status === 'locked'));
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

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedItemIds.size === 0 || isCreating) return;
    setIsCreating(true);
    try {
      // Collect selected line items across all plans
      const items: PlanLineItem[] = [];
      for (const plan of plans) {
        for (const item of plan.lineItems) {
          if (selectedItemIds.has(item.id)) {
            items.push(item);
          }
        }
      }
      // Create tasks sequentially (no batch API)
      for (const item of items) {
        await createTask(lineItemToCreateTaskInput(item));
      }
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const hasSelection = selectedItemIds.size > 0;

  return (
    <ActionSheet isOpen={isOpen} title="Add from Plan" onClose={onClose}>
      {plans.length === 0 ? (
        <p className="template-picker__blank-desc">
          No locked plans. Lock a plan in Planning to add work here.
        </p>
      ) : (
        <div className="plan-picker">
          {plans.map((plan) => {
            const isExpanded = expandedPlanIds.has(plan.id);
            const hasItems = plan.lineItems.length > 0;
            // Count selected in this plan
            const selectedCount = plan.lineItems.filter((i) =>
              selectedItemIds.has(i.id),
            ).length;

            return (
              <div key={plan.id} className="plan-picker__plan">
                <button
                  type="button"
                  className="plan-picker__plan-header"
                  onClick={() => togglePlan(plan.id)}
                  aria-expanded={isExpanded}
                >
                  <ChevronRightIcon
                    className={`plan-picker__chevron${isExpanded ? ' plan-picker__chevron--open' : ''}`}
                  />
                  <span className="plan-picker__plan-title">{plan.title}</span>
                  <span className="plan-picker__plan-count">
                    {plan.lineItems.length} item{plan.lineItems.length !== 1 ? 's' : ''}
                    {selectedCount > 0 && ` · ${selectedCount} selected`}
                  </span>
                </button>

                {isExpanded && (
                  <div className="plan-picker__items">
                    {!hasItems ? (
                      <p className="plan-picker__empty">No line items in this plan.</p>
                    ) : (
                      plan.lineItems.map((item) => {
                        const isSelected = selectedItemIds.has(item.id);
                        const detail = [
                          BUILD_PHASE_LABELS[item.buildPhase],
                          WORK_UNIT_LABELS[item.workUnit],
                          item.workQuantity > 0
                            ? `${item.workQuantity} ${WORK_UNIT_LABELS[item.workUnit]}`
                            : null,
                          item.crew > 1 ? `${item.crew} workers` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`plan-picker__item${isSelected ? ' plan-picker__item--selected' : ''}`}
                            onClick={() => toggleItem(item.id)}
                            aria-pressed={isSelected}
                          >
                            <span
                              className={`plan-picker__checkbox${isSelected ? ' plan-picker__checkbox--checked' : ''}`}
                              aria-hidden="true"
                            >
                              {isSelected && <CheckIcon className="plan-picker__check-icon" />}
                            </span>
                            <span className="plan-picker__item-content">
                              <span className="plan-picker__item-title">{item.title}</span>
                              <span className="plan-picker__item-detail">{detail}</span>
                            </span>
                          </button>
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
                ? `Add ${selectedItemIds.size} Task${selectedItemIds.size !== 1 ? 's' : ''}`
                : 'Add Tasks'}
          </button>
        </div>
      </div>
    </ActionSheet>
  );
}
