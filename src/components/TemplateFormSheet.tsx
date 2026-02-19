/**
 * TemplateFormSheet — ActionSheet for creating and editing task templates.
 */

import { useState, useEffect } from 'react';
import {
  WorkUnit,
  WORK_UNIT_LABELS,
  BuildPhase,
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  WorkCategory,
  WORK_CATEGORY_LABELS,
  WORK_CATEGORIES,
  TaskTemplate,
} from '../lib/types';
import { createTemplate, updateTemplate } from '../lib/stores/template-store';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

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

  const [title, setTitle] = useState('');
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('build-up');
  const [workCategory, setWorkCategory] = useState<WorkCategory>('carpet-tiles');
  const [unit, setUnit] = useState<WorkUnit>('m2');
  const [quantity, setQuantity] = useState('');
  const [estHours, setEstHours] = useState(0);
  const [estMinutes, setEstMinutes] = useState(0);
  const [workers, setWorkers] = useState(1);
  const [targetProductivity, setTargetProductivity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset/populate form when sheet opens
  useEffect(() => {
    if (isOpen) {
      if (template) {
        setTitle(template.title);
        setBuildPhase(template.buildPhase);
        setWorkCategory(template.workCategory);
        setUnit(template.workUnit);
        setQuantity(template.workQuantity != null ? String(template.workQuantity) : '');
        const totalMin = template.estimatedMinutes ?? 0;
        setEstHours(Math.floor(totalMin / 60));
        setEstMinutes(totalMin % 60);
        setWorkers(template.defaultWorkers ?? 1);
        setTargetProductivity(
          template.targetProductivity != null ? String(template.targetProductivity) : ''
        );
      } else {
        setTitle('');
        setBuildPhase('build-up');
        setWorkCategory('carpet-tiles');
        setUnit('m2');
        setQuantity('');
        setEstHours(0);
        setEstMinutes(0);
        setWorkers(1);
        setTargetProductivity('');
      }
    }
  }, [isOpen, template]);

  const canSave = title.trim().length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const totalMinutes = estHours * 60 + estMinutes;
      const parsedQty = parseFloat(quantity);
      const parsedProductivity = parseFloat(targetProductivity);

      const input = {
        title: title.trim(),
        workUnit: unit,
        buildPhase,
        workCategory,
        workQuantity: !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : null,
        estimatedMinutes: totalMinutes > 0 ? totalMinutes : null,
        defaultWorkers: workers > 1 ? workers : null,
        targetProductivity: !isNaN(parsedProductivity) && parsedProductivity > 0 ? parsedProductivity : null,
      };

      if (isEdit && template) {
        await updateTemplate(template.id, input);
      } else {
        await createTemplate(input);
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

        {/* Build Phase */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Build Phase</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Build phase">
            {BUILD_PHASES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={buildPhase === p}
                className={`task-work-quantity__unit-pill${buildPhase === p ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setBuildPhase(p)}
              >
                {BUILD_PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Work Category */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Category</label>
          <select
            className="input"
            value={workCategory}
            onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}
          >
            {WORK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {WORK_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        {/* Work Unit */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Unit</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Unit">
            {WORK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                className={`task-work-quantity__unit-pill${unit === u ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setUnit(u)}
              >
                {WORK_UNIT_LABELS[u]}
              </button>
            ))}
          </div>
        </div>

        {/* Work Quantity */}
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
              {WORK_UNIT_LABELS[unit]}
            </span>
          </div>
        </div>

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

        {/* Target Productivity */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Target Productivity</label>
          <div className="task-work-quantity__input-wrap">
            <input
              inputMode="decimal"
              className="task-work-quantity__number-input"
              value={targetProductivity}
              onChange={(e) => setTargetProductivity(e.target.value)}
              placeholder="0"
              style={{ width: `${Math.max(String(targetProductivity || '0').length, 1)}ch` }}
            />
            <span className="task-work-quantity__input-unit" aria-hidden="true">
              {WORK_UNIT_LABELS[unit]}/person-hr
            </span>
          </div>
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
