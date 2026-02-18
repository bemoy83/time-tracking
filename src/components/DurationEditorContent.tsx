/**
 * DurationEditorContent component.
 * Presentational duration picker form: hours/minutes steppers,
 * optional workers stepper, optional preview, and action buttons.
 * Used inside ActionSheet (Task Detail) and DurationEditorModal (Edit Entry).
 */

import { useState, useEffect, useRef, ReactNode } from 'react';
import { formatDurationShort, formatPersonHours } from '../lib/types';
import { WorkersStepper } from './WorkersStepper';
import { TrashIcon, ChevronUpIcon, ExpandChevronIcon } from './icons';

interface DurationEditorContentProps {
  initialHours: number;
  initialMinutes: number;
  showWorkers?: boolean;
  initialWorkers?: number;
  showDelete?: boolean;
  showClear?: boolean;
  durationLabel?: string;
  preview?: ReactNode;
  onSave: (hours: number, minutes: number, workers?: number) => void;
  onDelete?: () => void;
  onClear?: () => void;
  onCancel: () => void;
  /** When true, resets internal state to initial values */
  resetKey?: number;
}

const clampHours = (v: number) => Math.max(0, Math.min(99, v));
const clampMinutes = (v: number) => Math.max(0, Math.min(59, v));

export function DurationEditorContent({
  initialHours,
  initialMinutes,
  showWorkers = false,
  initialWorkers = 1,
  showDelete = false,
  showClear = false,
  durationLabel = 'Duration',
  preview,
  onSave,
  onDelete,
  onClear,
  onCancel,
  resetKey,
}: DurationEditorContentProps) {
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [workers, setWorkers] = useState(initialWorkers);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // Reset state when resetKey changes (e.g. when ActionSheet opens)
  useEffect(() => {
    setHours(initialHours);
    setMinutes(initialMinutes);
    setWorkers(initialWorkers);
    setShowDeleteConfirm(false);
  }, [resetKey, initialHours, initialMinutes, initialWorkers]);

  const totalMs = hours * 3600000 + minutes * 60000;

  const handleSave = () => {
    if (totalMs <= 0) return;
    onSave(hours, minutes, showWorkers ? workers : undefined);
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <>
      {/* Duration input */}
      <div className="entry-modal__field">
        <label className="entry-modal__label">{durationLabel}</label>
        <div className="entry-modal__duration-summary" aria-live="polite">
          <span
            className={`entry-modal__duration-summary__direct${totalMs > 0 ? ' entry-modal__duration-summary__direct--active' : ''}`}
            aria-label={`Duration: ${hours} hours ${minutes} minutes`}
          >
            {totalMs > 0 ? formatDurationShort(totalMs) : '—'}
          </span>
          {showWorkers && workers > 1 && totalMs > 0 && (
            <span
              className="entry-modal__duration-summary__ph"
              aria-label={`Person-hours: ${formatPersonHours(totalMs, workers)}`}
            >
              × {workers} = {formatPersonHours(totalMs, workers)} person-hrs
            </span>
          )}
        </div>
        <div className="entry-modal__duration-grid">
          <div className="entry-modal__duration-col">
            <button
              type="button"
              className="entry-modal__stepper-btn"
              onClick={() => setHours(clampHours(hours + 1))}
              aria-label="Increase hours"
            >
              <ChevronUpIcon className="entry-modal__stepper-chevron" />
            </button>
            <input
              type="number"
              className="entry-modal__duration-input"
              value={hours}
              readOnly
              min={0}
              max={99}
              aria-label="Hours"
              tabIndex={-1}
            />
            <button
              type="button"
              className="entry-modal__stepper-btn"
              onClick={() => setHours(clampHours(hours - 1))}
              aria-label="Decrease hours"
            >
              <ExpandChevronIcon className="entry-modal__stepper-chevron" />
            </button>
            <span className="entry-modal__duration-unit">hrs</span>
          </div>
          <div className="entry-modal__duration-col">
            <button
              type="button"
              className="entry-modal__stepper-btn"
              onClick={() => setMinutes(clampMinutes(minutes + 5))}
              aria-label="Increase minutes"
            >
              <ChevronUpIcon className="entry-modal__stepper-chevron" />
            </button>
            <input
              type="number"
              className="entry-modal__duration-input"
              value={minutes}
              readOnly
              min={0}
              max={59}
              aria-label="Minutes"
              tabIndex={-1}
            />
            <button
              type="button"
              className="entry-modal__stepper-btn"
              onClick={() => setMinutes(clampMinutes(minutes - 5))}
              aria-label="Decrease minutes"
            >
              <ExpandChevronIcon className="entry-modal__stepper-chevron" />
            </button>
            <span className="entry-modal__duration-unit">min</span>
          </div>
        </div>
      </div>

      {/* Workers stepper */}
      {showWorkers && (
        <div className="entry-modal__field">
          <WorkersStepper value={workers} onChange={setWorkers} size="large" />
        </div>
      )}

      {/* Preview */}
      {preview}

      {/* Actions */}
      <div className="action-sheet__actions">
        {showDelete && (
          <button
            type="button"
            className={`btn ${showDeleteConfirm ? 'btn--danger' : 'btn--ghost'}`}
            onClick={handleDelete}
          >
            <TrashIcon className="entry-modal__btn-icon" />
            {showDeleteConfirm ? 'Confirm delete?' : 'Delete'}
          </button>
        )}
        {showClear && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClear}
          >
            Clear
          </button>
        )}
        <div className="action-sheet__actions-right">
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={saveBtnRef}
            type="button"
            className="btn btn--primary btn--lg"
            onClick={handleSave}
            disabled={totalMs <= 0}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
