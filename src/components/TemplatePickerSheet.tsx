/**
 * TemplatePickerSheet — ActionSheet for choosing a blank task or a template.
 *
 * - Segmented control: [Blank] [From Template]
 * - Blank mode: description + Create button
 * - Template mode: scrollable list with tap-to-select + Continue button (enabled once selection made)
 */

import { useState, useEffect } from 'react';
import {
  TaskTemplate,
  WORK_UNIT_LABELS,
  WORK_CATEGORY_LABELS,
  BUILD_PHASE_LABELS,
} from '../lib/types';
import { useTemplateStore } from '../lib/stores/template-store';
import { ActionSheet } from './ActionSheet';

type Mode = 'blank' | 'template';

interface TemplatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: TaskTemplate | null) => void;
}

export function TemplatePickerSheet({
  isOpen,
  onClose,
  onSelect,
}: TemplatePickerSheetProps) {
  const { templates } = useTemplateStore();
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
    if (next === 'blank') setSelected(null);
  };

  const canContinue = mode === 'blank' || selected !== null;

  const handleConfirm = () => {
    if (!canContinue) return;
    onSelect(mode === 'blank' ? null : selected);
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
          From Template
        </button>
      </div>

      {/* Content area */}
      {mode === 'blank' ? (
        <p className="template-picker__blank-desc">
          Start from scratch with a blank task.
        </p>
      ) : (
        <div className="template-picker">
          {templates.length === 0 ? (
            <p className="template-picker__blank-desc">
              No templates yet. Create one in Settings.
            </p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`template-picker__row${selected?.id === t.id ? ' template-picker__row--selected' : ''}`}
                aria-pressed={selected?.id === t.id}
                onClick={() => setSelected(t)}
              >
                <span className="template-picker__title">{t.title}</span>
                <span className="template-picker__detail">
                  {WORK_CATEGORY_LABELS[t.workCategory]} · {BUILD_PHASE_LABELS[t.buildPhase]} · {WORK_UNIT_LABELS[t.workUnit]}
                </span>
              </button>
            ))
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
            {mode === 'blank' ? 'Create' : 'Continue'}
          </button>
        </div>
      </div>
    </ActionSheet>
  );
}
