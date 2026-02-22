/**
 * TemplateFormSheet — ActionSheet for creating and editing task templates.
 * Uses WorkType selector for work definition fields.
 */

import { useState, useEffect } from 'react';
import {
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
  TaskTemplate,
} from '../lib/types';
import { createTemplate, updateTemplate } from '../lib/stores/template-store';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';

interface TemplateFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  template?: TaskTemplate | null;
  onDelete?: () => void;
}

export function TemplateFormSheet({
  isOpen,
  onClose,
  template = null,
  onDelete,
}: TemplateFormSheetProps) {
  const isEdit = !!template;
  const { workTypes } = useWorkTypeStore();

  const [workTypeId, setWorkTypeId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [estHours, setEstHours] = useState(0);
  const [estMinutes, setEstMinutes] = useState(0);
  const [workers, setWorkers] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Reset/populate form when sheet opens
  useEffect(() => {
    if (isOpen) {
      if (template) {
        setWorkTypeId(template.workTypeId ?? '');
        setTitle(template.title);
        setQuantity(template.workQuantity != null ? String(template.workQuantity) : '');
        const totalMin = template.estimatedMinutes ?? 0;
        setEstHours(Math.floor(totalMin / 60));
        setEstMinutes(totalMin % 60);
        setWorkers(template.defaultWorkers ?? 1);
      } else {
        setWorkTypeId(workTypes.length > 0 ? workTypes[0].id : '');
        setTitle('');
        setQuantity('');
        setEstHours(0);
        setEstMinutes(0);
        setWorkers(1);
      }
    }
  }, [isOpen, template, workTypes]);

  const selectedWorkType = workTypes.find((wt) => wt.id === workTypeId);

  // When work type changes, update title default for new templates
  useEffect(() => {
    if (!isEdit && selectedWorkType && !title) {
      setTitle(selectedWorkType.title);
    }
  }, [workTypeId, selectedWorkType, isEdit]);

  const canSave = title.trim().length > 0 && workTypeId !== '' && !isSaving;

  const handleSave = async () => {
    if (!canSave || !selectedWorkType) return;
    setIsSaving(true);
    try {
      const totalMinutes = estHours * 60 + estMinutes;
      const parsedQty = parseFloat(quantity);

      const input = {
        title: title.trim(),
        workTypeId,
        workUnit: selectedWorkType.workUnit,
        buildPhase: selectedWorkType.buildPhase,
        workQuantity: !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : null,
        estimatedMinutes: totalMinutes > 0 ? totalMinutes : null,
        defaultWorkers: workers > 1 ? workers : null,
        targetProductivity: selectedWorkType.expectedProductivity,
      };

      if (isEdit && template) {
        await updateTemplate(template.id, input);
      } else {
        await createTemplate(input as never);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const incrementHours = () => setEstHours((h) => Math.min(h + 1, 99));
  const decrementHours = () => setEstHours((h) => Math.max(h - 1, 0));
  const incrementMinutes = () => setEstMinutes((m) => (m >= 55 ? 0 : m + 5));
  const decrementMinutes = () => setEstMinutes((m) => (m <= 0 ? 55 : m - 5));

  return (
    <ActionSheet isOpen={isOpen} title={isEdit ? 'Edit Template' : 'New Template'} onClose={onClose}>
      <div className="create-task-sheet__form">
        {/* Title */}
        <input
          type="text"
          className="input"
          placeholder="Template title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => {
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }}
        />

        {/* Work Type Selector */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Type</label>
          {workTypes.length === 0 ? (
            <p className="settings-view__empty">
              No work types defined. Add one in Settings first.
            </p>
          ) : (
            <select
              className="input"
              value={workTypeId}
              onChange={(e) => {
                setWorkTypeId(e.target.value);
                const wt = workTypes.find((w) => w.id === e.target.value);
                if (wt && !isEdit) {
                  setTitle(wt.title);
                }
              }}
            >
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.title} · {WORK_UNIT_LABELS[wt.workUnit]} · {BUILD_PHASE_LABELS[wt.buildPhase]}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Read-only work type info */}
        {selectedWorkType && (
          <div className="create-task-sheet__section">
            <div className="settings-view__row-detail">
              Expected: {selectedWorkType.expectedProductivity} {WORK_UNIT_LABELS[selectedWorkType.workUnit]}/person-hr
            </div>
          </div>
        )}

        {/* Work Quantity */}
        {selectedWorkType && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Work Quantity</label>
            <div className="task-work-quantity__input-wrap">
              <input
                inputMode="decimal"
                className="task-work-quantity__number-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                style={{ width: `${Math.max(String(quantity || '0').length, 1)}ch` }}
              />
              <span className="task-work-quantity__input-unit" aria-hidden="true">
                {WORK_UNIT_LABELS[selectedWorkType.workUnit]}
              </span>
            </div>
          </div>
        )}

        {/* Estimate */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Estimate</label>
          <div className="entry-modal__duration-grid">
            <div className="entry-modal__duration-col">
              <button type="button" className="entry-modal__stepper-btn" onClick={incrementHours} aria-label="Increase hours">
                <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <input type="text" className="entry-modal__duration-input" value={estHours} readOnly tabIndex={-1} />
              <span className="entry-modal__duration-unit">hrs</span>
              <button type="button" className="entry-modal__stepper-btn" onClick={decrementHours} disabled={estHours <= 0} aria-label="Decrease hours">
                <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            </div>
            <div className="entry-modal__duration-col">
              <button type="button" className="entry-modal__stepper-btn" onClick={incrementMinutes} aria-label="Increase minutes">
                <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <input type="text" className="entry-modal__duration-input" value={estMinutes} readOnly tabIndex={-1} />
              <span className="entry-modal__duration-unit">min</span>
              <button type="button" className="entry-modal__stepper-btn" onClick={decrementMinutes} disabled={estHours <= 0 && estMinutes <= 0} aria-label="Decrease minutes">
                <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Workers */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Workers</label>
          <WorkersStepper value={workers} onChange={setWorkers} size="large" />
        </div>

        {/* Actions */}
        <div className="action-sheet__actions">
          {isEdit && onDelete && (
            <button type="button" className="btn btn--danger btn--lg" onClick={onDelete}>
              Delete
            </button>
          )}
          <div className="action-sheet__actions-right">
            <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}
