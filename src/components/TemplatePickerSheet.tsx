/**
 * TemplatePickerSheet — ActionSheet for choosing a blank task, template, or plan.
 *
 * - Segmented control: [Blank] [From Template] [From Plan]
 * - Blank mode: description + Create button
 * - Template mode: scrollable list with tap-to-select + Continue button
 * - Plan mode: signals 'from-plan' sentinel to caller
 */

import { useState, useEffect } from 'react';
import {
  TaskTemplate,
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
} from '../lib/types';
import { useTemplateStore } from '../lib/stores/template-store';
import { useWorkTypeStore, getWorkTypeById } from '../lib/stores/work-type-store';
import { ActionSheet } from './ActionSheet';

export const FROM_PLAN_SENTINEL = 'from-plan' as const;

type Mode = 'blank' | 'template' | 'plan';

interface TemplatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: TaskTemplate | null | typeof FROM_PLAN_SENTINEL) => void;
}

export function TemplatePickerSheet({
  isOpen,
  onClose,
  onSelect,
}: TemplatePickerSheetProps) {
  const { templates } = useTemplateStore();
  useWorkTypeStore(); // subscribe to work type updates
  const [mode, setMode] = useState<Mode>('blank');
  const [selected, setSelected] = useState<TaskTemplate | null>(null);

  // Reset selection when sheet opens
  useEffect(() => {
    if (isOpen) {
      setMode('blank');
      setSelected(null);
    }
  }, [isOpen]);

  const handleModeChange = (next: Mode) => {
    setMode(next);
    if (next !== 'template') setSelected(null);
  };

  const canContinue = mode === 'blank' || mode === 'plan' || selected !== null;

  const handleConfirm = () => {
    if (!canContinue) return;
    if (mode === 'plan') {
      onSelect(FROM_PLAN_SENTINEL);
    } else {
      onSelect(mode === 'blank' ? null : selected);
    }
  };

  return (
    <ActionSheet isOpen={isOpen} title="New Task" onClose={onClose}>
      {/* Segmented control */}
      <div
        className="task-work-quantity__unit-pills template-picker__segments"
        role="group"
        aria-label="Task creation mode"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'blank'}
          className={`task-work-quantity__unit-pill${mode === 'blank' ? ' task-work-quantity__unit-pill--active' : ''}`}
          onClick={() => handleModeChange('blank')}
        >
          Blank
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'template'}
          className={`task-work-quantity__unit-pill${mode === 'template' ? ' task-work-quantity__unit-pill--active' : ''}`}
          onClick={() => handleModeChange('template')}
        >
          Template
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'plan'}
          className={`task-work-quantity__unit-pill${mode === 'plan' ? ' task-work-quantity__unit-pill--active' : ''}`}
          onClick={() => handleModeChange('plan')}
        >
          From Plan
        </button>
      </div>

      {/* Content area */}
      {mode === 'blank' ? (
        <p className="template-picker__blank-desc">
          Start from scratch with a blank task.
        </p>
      ) : mode === 'plan' ? (
        <p className="template-picker__blank-desc">
          Add work packages from an active plan as tasks.
        </p>
      ) : (
        <div className="template-picker">
          {templates.length === 0 ? (
            <p className="template-picker__blank-desc">
              No templates yet. Create one in Settings.
            </p>
          ) : (
            templates.map((t) => {
              const wt = t.workTypeId ? getWorkTypeById(t.workTypeId) : null;
              const detail = wt
                ? `${wt.title} · ${WORK_UNIT_LABELS[wt.workUnit]}`
                : `${BUILD_PHASE_LABELS[t.buildPhase]} · ${WORK_UNIT_LABELS[t.workUnit]}`;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`template-picker__row${selected?.id === t.id ? ' template-picker__row--selected' : ''}`}
                  aria-pressed={selected?.id === t.id}
                  onClick={() => setSelected(t)}
                >
                  <span className="template-picker__title">{t.title}</span>
                  <span className="template-picker__detail">{detail}</span>
                </button>
              );
            })
          )}
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
            disabled={!canContinue}
            onClick={handleConfirm}
          >
            {mode === 'blank' ? 'Create' : mode === 'plan' ? 'Continue' : 'Continue'}
          </button>
        </div>
      </div>
    </ActionSheet>
  );
}
