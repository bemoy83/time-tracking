/**
 * CreateTaskSheet — ActionSheet for creating tasks and subtasks.
 *
 * Full mode (default): title + work quantity + estimate + workers.
 * Subtask mode: title only (showWork/showEstimate/showWorkers = false).
 */

import { useState, useEffect } from 'react';
import { WorkUnit, WORK_UNIT_LABELS, TaskTemplate } from '../lib/types';
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
  const [isSaving, setIsSaving] = useState(false);

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
      } else {
        setTitle('');
        setQuantity('');
        setUnit('m2');
        setEstHours(0);
        setEstMinutes(0);
        setWorkers(1);
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
      await createTask({
        title: title.trim(),
        projectId: projectId ?? undefined,
        parentId: parentId ?? undefined,
        estimatedMinutes: showEstimate && totalMinutes > 0 ? totalMinutes : undefined,
        workQuantity: showWork && !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : undefined,
        workUnit: showWork && !isNaN(parsedQty) && parsedQty > 0 ? unit : undefined,
        defaultWorkers: showWorkers && workers > 1 ? workers : undefined,
        targetProductivity: template?.targetProductivity ?? undefined,
        buildPhase: template?.buildPhase ?? undefined,
        workCategory: template?.workCategory ?? undefined,
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
