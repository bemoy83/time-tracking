/**
 * TemplatePickerSheet — ActionSheet for choosing a template or blank task.
 */

import {
  TaskTemplate,
  WORK_UNIT_LABELS,
  WORK_CATEGORY_LABELS,
  BUILD_PHASE_LABELS,
} from '../lib/types';
import { useTemplateStore } from '../lib/stores/template-store';
import { ActionSheet } from './ActionSheet';

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

  return (
    <ActionSheet isOpen={isOpen} title="New Task" onClose={onClose}>
      <div className="template-picker">
        <button
          type="button"
          className="template-picker__row"
          onClick={() => onSelect(null)}
        >
          <span className="template-picker__title">Blank Task</span>
          <span className="template-picker__detail">Start from scratch</span>
        </button>

        {templates.length > 0 && (
          <div className="template-picker__divider" />
        )}

        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className="template-picker__row"
            onClick={() => onSelect(t)}
          >
            <span className="template-picker__title">{t.title}</span>
            <span className="template-picker__detail">
              {WORK_CATEGORY_LABELS[t.workCategory]} · {BUILD_PHASE_LABELS[t.buildPhase]} · {WORK_UNIT_LABELS[t.workUnit]}
            </span>
          </button>
        ))}
      </div>
    </ActionSheet>
  );
}
