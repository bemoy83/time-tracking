/**
 * CreateTaskSheet — ActionSheet for creating tasks and subtasks.
 *
 * Full mode (default): title + work quantity + estimate + workers.
 * Template mode: additionally shows buildPhase, workCategory, targetProductivity (all editable).
 * Subtask mode: title only (showWork/showEstimate/showWorkers = false).
 */

import { useState, useEffect } from 'react';
import {
  WorkUnit,
  WORK_UNIT_LABELS,
  TaskTemplate,
  BuildPhase,
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  WorkCategory,
  WORK_CATEGORY_LABELS,
  WORK_CATEGORIES,
} from '../lib/types';
import { createTask } from '../lib/stores/task-store';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

interface CreateTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  sheetTitle?: string;
  projectId?: string | null;
  parentId?: string | null;
  showWork?: boolean;
  showEstimate?: boolean;
  showWorkers?: boolean;
  template?: TaskTemplate | null;
}

export function CreateTaskSheet({
  isOpen,
  onClose,
  onCreated,
  sheetTitle = 'New Task',
  projectId = null,
  parentId = null,
  showWork = true,
  showEstimate = true,
  showWorkers = true,
  template = null,
}: CreateTaskSheetProps) {
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<WorkUnit>('m2');
  const [estHours, setEstHours] = useState(0);
  const [estMinutes, setEstMinutes] = useState(0);
  const [workers, setWorkers] = useState(1);
  const [buildPhase, setBuildPhase] = useState<BuildPhase | null>(null);
  const [workCategory, setWorkCategory] = useState<WorkCategory | null>(null);
  const [targetProductivity, setTargetProductivity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hasTemplate = !!template;

  // Reset form when sheet opens; pre-fill from template if provided
  useEffect(() => {
    if (isOpen) {
      if (template) {
        setTitle(template.title);
        setUnit(template.workUnit);
        setQuantity(template.workQuantity != null ? String(template.workQuantity) : '');
        const totalMin = template.estimatedMinutes ?? 0;
        setEstHours(Math.floor(totalMin / 60));
        setEstMinutes(totalMin % 60);
        setWorkers(template.defaultWorkers ?? 1);
        setBuildPhase(template.buildPhase);
        setWorkCategory(template.workCategory);
        setTargetProductivity(
          template.targetProductivity != null ? String(template.targetProductivity) : ''
        );
      } else {
        setTitle('');
        setQuantity('');
        setUnit('m2');
        setEstHours(0);
        setEstMinutes(0);
        setWorkers(1);
        setBuildPhase(null);
        setWorkCategory(null);
        setTargetProductivity('');
      }
    }
  }, [isOpen, template]);

  const canCreate = title.trim().length > 0 && !isSaving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsSaving(true);
    try {
      const totalMinutes = estHours * 60 + estMinutes;
      const parsedQty = parseFloat(quantity);
      const parsedProductivity = parseFloat(targetProductivity);
      await createTask({
        title: title.trim(),
        projectId: projectId ?? undefined,
        parentId: parentId ?? undefined,
        estimatedMinutes: showEstimate && totalMinutes > 0 ? totalMinutes : undefined,
        workQuantity: showWork && !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : undefined,
        workUnit: showWork && !isNaN(parsedQty) && parsedQty > 0 ? unit : undefined,
        defaultWorkers: showWorkers && workers > 1 ? workers : undefined,
        targetProductivity: !isNaN(parsedProductivity) && parsedProductivity > 0 ? parsedProductivity : undefined,
        buildPhase: buildPhase ?? undefined,
        workCategory: workCategory ?? undefined,
      });
      onClose();
      onCreated?.();
    } finally {
      setIsSaving(false);
    }
  };

  const incrementHours = () => setEstHours((h) => Math.min(h + 1, 99));
  const decrementHours = () => setEstHours((h) => Math.max(h - 1, 0));
  const incrementMinutes = () => setEstMinutes((m) => (m >= 55 ? 0 : m + 5));
  const decrementMinutes = () => setEstMinutes((m) => (m <= 0 ? 55 : m - 5));

  return (
    <ActionSheet isOpen={isOpen} title={sheetTitle} onClose={onClose}>
      <div className="create-task-sheet__form">
        {/* Title */}
        <input
          type="text"
          className="input"
          placeholder="Task title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => {
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }}
        />

        {/* Build Phase (shown when template provided) */}
        {hasTemplate && (
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
        )}

        {/* Work Category (shown when template provided) */}
        {hasTemplate && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Work Category</label>
            <select
              className="input"
              value={workCategory ?? ''}
              onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}
            >
              {WORK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{WORK_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        )}

        {/* Work Quantity */}
        {showWork && (
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
        )}

        {/* Estimate */}
        {showEstimate && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Estimate</label>
            <div className="entry-modal__duration-grid">
              <div className="entry-modal__duration-col">
                <button
                  type="button"
                  className="entry-modal__stepper-btn"
                  onClick={incrementHours}
                  aria-label="Increase hours"
                >
                  <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                </button>
                <input
                  type="text"
                  className="entry-modal__duration-input"
                  value={estHours}
                  readOnly
                  tabIndex={-1}
                />
                <span className="entry-modal__duration-unit">hrs</span>
                <button
                  type="button"
                  className="entry-modal__stepper-btn"
                  onClick={decrementHours}
                  disabled={estHours <= 0}
                  aria-label="Decrease hours"
                >
                  <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>
              <div className="entry-modal__duration-col">
                <button
                  type="button"
                  className="entry-modal__stepper-btn"
                  onClick={incrementMinutes}
                  aria-label="Increase minutes"
                >
                  <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                </button>
                <input
                  type="text"
                  className="entry-modal__duration-input"
                  value={estMinutes}
                  readOnly
                  tabIndex={-1}
                />
                <span className="entry-modal__duration-unit">min</span>
                <button
                  type="button"
                  className="entry-modal__stepper-btn"
                  onClick={decrementMinutes}
                  disabled={estHours <= 0 && estMinutes <= 0}
                  aria-label="Decrease minutes"
                >
                  <svg className="entry-modal__stepper-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workers */}
        {showWorkers && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Workers</label>
            <WorkersStepper value={workers} onChange={setWorkers} size="large" />
          </div>
        )}

        {/* Target Productivity (shown when template provided) */}
        {hasTemplate && (
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
              onClick={handleCreate}
              disabled={!canCreate}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}
